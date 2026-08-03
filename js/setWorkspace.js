(function(root) {
	'use strict';
	var Model = root.CardConjurerSetModel;
	var Storage = root.CardConjurerSetStorage;
	var Files = root.CardConjurerSetFiles;
	var state = {sets: [], cards: [], histories: {}, activeSetId: null, revision: 0};
	var initialized = false;
	var loadingCard = false;
	var captureTimer = null;
	var editorDirty = false;
	var persistTimer = null;
	var drawerReturnFocus = null;
	var initialBlankCardData = null;
	var zipCanceled = false;
	var pendingTransferMode = null;
	var pendingSetImport = null;
	var DEFAULT_SET_SYMBOL_BOUNDS = {x: 0.9213, y: 0.5910, width: 0.12, height: 0.0410, vertical: 'center', horizontal: 'right'};
	var channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('card-conjurer-sets') : null;

	function clone(value) { return Model.clone(value); }
	function activeSet() { return state.sets.find(function(set) { return set.id === state.activeSetId; }) || null; }
	function cardsFor(setId) { return state.cards.filter(function(card) { return card.setId === setId; }); }
	function collectorSlotCount(setId) {
		return new Set(cardsFor(setId).map(function(card) {
			var match = String(card.collectorNumber || '').match(/^\d+/);
			return match ? match[0] : card.id;
		})).size;
	}
	function activeCardRecord() {
		var set = activeSet();
		return set ? state.cards.find(function(card) { return card.id === set.activeCardId; }) || cardsFor(set.id)[0] : null;
	}

	function yearFor(set) {
		if (set.releaseDate && /^\d{4}/.test(set.releaseDate)) return set.releaseDate.slice(0, 4);
		return String(new Date().getFullYear());
	}

	function symbolFor(set, cardRecord) {
		var derived = cardRecord.derived || Model.deriveCard(cardRecord).derived;
		var common = derived.cardTypes.includes('land') && /(^|\s)basic(\s|$)/.test(derived.normalizedType) || cardRecord.printingCategory === 'token' || cardRecord.printingCategory === 'tokens';
		return set.symbolSources[common ? 'common' : cardRecord.rarity] || '';
	}

	function hydratedCardData(record, set) {
		var data = clone(record.cardData || {});
		data.infoNumber = record.collectorNumber;
		data.infoRarity = ({common: 'C', uncommon: 'U', rare: 'R', mythic: 'M'})[record.rarity] || 'C';
		data.infoSet = set.code;
		data.infoLanguage = set.language;
		data.infoYear = yearFor(set);
		data.infoCopyright = set.copyright;
		var source = symbolFor(set, record);
		if (source) data.setSymbolSource = source;
		return data;
	}

	function symbolSourceKey(source) {
		var value = String(source || ''); var hash = 2166136261;
		for (var index = 0; index < value.length; index++) {
			hash ^= value.charCodeAt(index);
			hash = Math.imul(hash, 16777619);
		}
		return value.length + ':' + (hash >>> 0).toString(16);
	}

	function symbolPlacementMissing(data, source) {
		if (!data || !data.setSymbolBounds) return true;
		var x = Number(data.setSymbolX); var y = Number(data.setSymbolY); var zoom = Number(data.setSymbolZoom);
		if (![x, y, zoom].every(Number.isFinite) || zoom <= 0 || zoom > 5) return true;
		if (x === 0 && y === 0 && zoom === 1) return true;
		return Boolean(source) && data.setSymbolPlacementKey !== symbolSourceKey(source);
	}

	function stripSetOwned(data) {
		var output = clone(data || {});
		['infoNumber', 'infoSet', 'infoLanguage', 'infoYear', 'infoCopyright'].forEach(function(key) { delete output[key]; });
		delete output.setSymbolSource;
		return output;
	}

	function snapshot() {
		return {sets: clone(state.sets), cards: clone(state.cards), activeSetId: state.activeSetId};
	}

	function snapshotEqual(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

	function restoreSnapshot(value) {
		state.sets = clone(value.sets || []);
		state.cards = clone(value.cards || []);
		state.activeSetId = value.activeSetId;
		numberAllSets();
	}

	function renumberSet(setId) {
		var set = state.sets.find(function(item) { return item.id === setId; });
		if (!set) return;
		var numbered = Model.numberCards(cardsFor(setId), set);
		var byId = new Map(numbered.map(function(card) { return [card.id, card]; }));
		state.cards = state.cards.map(function(card) { return byId.get(card.id) || card; });
		if (!set.activeCardId || !byId.has(set.activeCardId)) set.activeCardId = numbered[0] && numbered[0].id || null;
	}

	function numberAllSets() { state.sets.forEach(function(set) { renumberSet(set.id); }); }

	function ensureHistory(setId) {
		if (!state.histories[setId]) state.histories[setId] = Model.createHistory();
		return state.histories[setId];
	}

	async function persist(immediate) {
		clearTimeout(persistTimer);
		var save = async function() {
			state.revision = Date.now();
			setStatus('Saving…', 'saving');
			try {
				await Storage.saveState(state);
				setStatus('Saved locally', 'saved');
				if (channel) channel.postMessage({revision: state.revision, source: root.name || 'tab'});
			} catch (error) {
				console.error(error);
				setStatus('Autosave failed — export a backup', 'error');
				showWorkspaceError(error.message || 'Autosave failed.');
			}
		};
		if (immediate) return save();
		persistTimer = setTimeout(save, 120);
	}

	function recordHistory(setIds, label, coalescingKey, before, after) {
		var transaction = {label: label, coalescingKey: coalescingKey || '', timestamp: Date.now(), before: before, after: after};
		Array.from(new Set(setIds.filter(Boolean))).forEach(function(setId) {
			state.histories[setId] = Model.pushHistory(ensureHistory(setId), transaction, 40);
		});
	}

	async function commit(label, coalescingKey, mutator, affectedSetIds, options) {
		var before = snapshot();
		await mutator();
		numberAllSets();
		var after = snapshot();
		if (!snapshotEqual(before, after)) recordHistory((affectedSetIds || []).concat([before.activeSetId, after.activeSetId]), label, coalescingKey, before, after);
		await persist(options && options.immediate);
		if (!options || options.render !== false) renderWorkspace();
	}

	function setStatus(message, kind) {
		var globalStatus = document.querySelector('#sets-global-status');
		var localStatus = document.querySelector('#sets-status');
		if (globalStatus) globalStatus.textContent = message;
		if (localStatus) { localStatus.textContent = message; localStatus.dataset.kind = kind || ''; }
		var dot = document.querySelector('.creator-status-dot');
		if (dot) dot.dataset.kind = kind || '';
	}

	function showWorkspaceError(message) {
		var error = document.querySelector('#sets-error');
		if (error) { error.hidden = false; error.textContent = message; }
	}

	function clearWorkspaceError() {
		var error = document.querySelector('#sets-error');
		if (error) error.hidden = true;
	}

	function cleanupLegacyStorage() {
		try {
			var keys = JSON.parse(localStorage.getItem('cardKeys') || '[]');
			keys.forEach(function(key) { localStorage.removeItem(key); });
			['cardKeys', '__card_conjurer_live_draft__', '__card_conjurer_live_draft_ui__', '__card_conjurer_bulk_card__'].forEach(function(key) { localStorage.removeItem(key); });
		} catch (error) { console.warn('Legacy card keys could not be removed.', error); }
	}

	async function bootstrap() {
		var loaded = await Storage.loadState();
		state = Object.assign(state, loaded);
		if (!state.sets.length) {
			var set = Model.createDefaultSet([]);
			var blankData = initialBlankCardData || (typeof cardStorageSnapshot === 'function' ? cardStorageSnapshot() : {});
			var cardRecord = Model.createDefaultCard(set.id, stripSetOwned(blankData));
			set.activeCardId = cardRecord.id;
			state.sets = [set]; state.cards = [cardRecord]; state.activeSetId = set.id;
			state.histories[set.id] = Model.createHistory();
			renumberSet(set.id);
			await persist(true);
			cleanupLegacyStorage();
		}
		if (!state.activeSetId || !state.sets.some(function(set) { return set.id === state.activeSetId; })) state.activeSetId = state.sets[0].id;
		numberAllSets();
	}

	function escapeHtml(value) {
		return String(value == null ? '' : value).replace(/[&<>"']/g, function(character) {
			return ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[character];
		});
	}

	function safeMarkdown(markdown) {
		var source = escapeHtml(markdown || '');
		var lines = source.split(/\r?\n/);
		var output = [];
		var inCode = false;
		lines.forEach(function(line) {
			if (/^```/.test(line)) { output.push(inCode ? '</code></pre>' : '<pre><code>'); inCode = !inCode; return; }
			if (inCode) { output.push(line + '\n'); return; }
			line = line.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
			line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(match, label, url) {
				var decoded = url.replace(/&amp;/g, '&');
				return /^(https?:|mailto:)/i.test(decoded) ? '<a href="' + escapeHtml(decoded) + '" target="_blank" rel="noopener">' + label + '</a>' : label;
			});
			var heading = line.match(/^(#{1,3})\s+(.*)$/);
			if (heading) output.push('<h' + heading[1].length + '>' + heading[2] + '</h' + heading[1].length + '>');
			else if (/^[-*]\s+/.test(line)) output.push('<ul><li>' + line.replace(/^[-*]\s+/, '') + '</li></ul>');
			else if (/^&gt;\s?/.test(line)) output.push('<blockquote>' + line.replace(/^&gt;\s?/, '') + '</blockquote>');
			else if (line.trim()) output.push('<p>' + line + '</p>');
		});
		if (inCode) output.push('</code></pre>');
		return output.join('');
	}

	function tabButton(key, label, active) {
		return '<button type="button" role="tab" class="sets-tab' + (active ? ' selected' : '') + '" aria-selected="' + (active ? 'true' : 'false') + '" onclick="CardConjurerSets.selectTab(\'' + key + '\')">' + label + '</button>';
	}

	function selectOptions(values, selected, labels) {
		return values.map(function(value) { return '<option value="' + escapeHtml(value) + '"' + (value === selected ? ' selected' : '') + '>' + escapeHtml(labels && labels[value] || value || 'Any') + '</option>'; }).join('');
	}

	function renderWorkspace() {
		var host = document.querySelector('#sets-workspace-content');
		var set = activeSet();
		if (!host || !set) return;
		host.setAttribute('aria-busy', 'false');
		var history = ensureHistory(set.id);
		host.innerHTML = '<div class="sets-header">' +
			'<label class="sets-drawer-close" for="sets-drawer-toggle" role="button" tabindex="0" aria-label="Close sets drawer">×</label>' +
			'<div><span class="creator-eyebrow">Sets &amp; Cards</span><select id="sets-switcher" class="input" aria-label="Active set" onchange="CardConjurerSets.selectSet(this.value)">' +
			state.sets.map(function(item) { return '<option value="' + item.id + '"' + (item.id === set.id ? ' selected' : '') + '>' + escapeHtml(item.name) + ' · ' + escapeHtml(item.code) + '</option>'; }).join('') + '</select></div>' +
			'<div class="sets-header-actions"><button type="button" class="input" onclick="CardConjurerSets.newSet()">New set</button><button type="button" class="sets-icon-button" onclick="CardConjurerSets.undo()"' + (history.cursor ? '' : ' disabled') + ' aria-label="Undo">↶</button><button type="button" class="sets-icon-button" onclick="CardConjurerSets.redo()"' + (history.cursor < history.entries.length ? '' : ' disabled') + ' aria-label="Redo">↷</button></div></div>' +
			'<div id="sets-error" class="sets-error" role="alert" hidden></div>' +
			'<div class="sets-tabs" role="tablist">' + tabButton('cards', 'Cards', set.activeTab === 'cards') + tabButton('details', 'Set Details', set.activeTab === 'details') + tabButton('symbol', 'Set Symbol', set.activeTab === 'symbol') + tabButton('collector', 'Collector', set.activeTab === 'collector') + '</div>' +
			'<div id="sets-tab-panel" class="sets-tab-panel" role="tabpanel"></div>' +
			'<div class="sets-footer"><span id="sets-status" role="status" aria-live="polite">Saved locally</span><span>' + cardsFor(set.id).length + ' printing' + (cardsFor(set.id).length === 1 ? '' : 's') + '</span></div>' +
			'<input id="sets-card-import" type="file" accept=".cardconjurer-card,application/json" hidden onchange="CardConjurerSets.importCardFile(event)">' +
			'<input id="sets-set-import" type="file" accept=".cardconjurer-set,application/json" hidden onchange="CardConjurerSets.importSetFile(event)">' +
			'<dialog id="sets-transfer-dialog" class="sets-dialog"><form method="dialog"><div><span class="creator-eyebrow">Card action</span><h3 id="sets-transfer-title">Move card</h3></div><label>Destination set<select id="sets-transfer-target" class="input"></select></label><div class="sets-dialog-actions"><button value="cancel">Cancel</button><button id="sets-transfer-confirm" type="button" class="sets-confirm" onclick="CardConjurerSets.confirmMoveOrCopy()">Move card</button></div></form></dialog>' +
			'<dialog id="sets-import-dialog" class="sets-dialog"><form method="dialog"><div><span class="creator-eyebrow">Set import</span><h3>Matching set found</h3><p id="sets-import-message">Choose how to import this set.</p></div><div class="sets-dialog-actions"><button value="cancel" onclick="CardConjurerSets.cancelSetImport()">Cancel</button><button type="button" onclick="CardConjurerSets.resolveSetImport(\'merge\')">Merge</button><button type="button" class="sets-confirm" onclick="CardConjurerSets.resolveSetImport(\'replace\')">Replace</button></div></form></dialog>';
		renderActiveTab();
		updateUndoButtons();
	}

	function renderActiveTab() {
		var set = activeSet();
		var panel = document.querySelector('#sets-tab-panel');
		if (!set || !panel) return;
		if (set.activeTab === 'details') renderDetailsTab(panel, set);
		else if (set.activeTab === 'symbol') renderSymbolTab(panel, set);
		else if (set.activeTab === 'collector') renderCollectorTab(panel, set);
		else renderCardsTab(panel, set);
	}

	function renderCardsTab(panel, set) {
		var view = Object.assign({}, Model.DEFAULT_LIST_STATE, set.listState || {});
		panel.innerHTML = '<div class="sets-card-toolbar"><button type="button" class="input sets-primary" onclick="CardConjurerSets.newCard()">+ New card</button><button type="button" class="input" onclick="CardConjurerSets.duplicateCard()">Duplicate</button><button type="button" class="input" onclick="CardConjurerSets.addVariant(\'art\')">Art variant</button><button type="button" class="input" onclick="CardConjurerSets.addVariant(\'treatment\')">Treatment</button></div>' +
			'<label class="sets-search"><span class="sr-only">Search cards</span><input class="input" value="' + escapeHtml(view.search) + '" placeholder="Search title, type, rules, artist…" oninput="CardConjurerSets.updateListState(\'search\', this.value)"></label>' +
			'<details class="sets-list-options"><summary>Sort &amp; filters</summary><div class="sets-filter-grid">' +
			'<label>Sort<select class="input" onchange="CardConjurerSets.updateListState(\'sort\', this.value)">' + selectOptions(['collector','alphabetical','mana-value'], view.sort, {'collector':'Collector','alphabetical':'Alphabetical','mana-value':'Mana Value'}) + '</select></label>' +
			'<label>Direction<select class="input" onchange="CardConjurerSets.updateListState(\'direction\', this.value)">' + selectOptions(['asc','desc'], view.direction, {asc:'Ascending',desc:'Descending'}) + '</select></label>' +
			'<label>Color<select class="input" onchange="CardConjurerSets.updateListState(\'color\', this.value)">' + selectOptions(['','W','U','B','R','G','C'], view.color, {'':'Any',W:'White',U:'Blue',B:'Black',R:'Red',G:'Green',C:'Colorless'}) + '</select></label>' +
			'<label>Color match<select class="input" onchange="CardConjurerSets.updateListState(\'colorMode\', this.value)">' + selectOptions(['includes','only'], view.colorMode, {includes:'Includes',only:'Only'}) + '</select></label>' +
			'<label>Identity<select class="input" onchange="CardConjurerSets.updateListState(\'identity\', this.value)">' + selectOptions(['','W','U','B','R','G','C'], view.identity, {'':'Any',W:'White',U:'Blue',B:'Black',R:'Red',G:'Green',C:'Colorless'}) + '</select></label>' +
			'<label>Identity match<select class="input" onchange="CardConjurerSets.updateListState(\'identityMode\', this.value)">' + selectOptions(['includes','only'], view.identityMode, {includes:'Includes',only:'Only'}) + '</select></label>' +
			'<label>Rarity<select class="input" onchange="CardConjurerSets.updateListState(\'rarity\', this.value)">' + selectOptions(['','common','uncommon','rare','mythic'], view.rarity, {'':'Any',common:'Common',uncommon:'Uncommon',rare:'Rare',mythic:'Mythic Rare'}) + '</select></label>' +
			'<label>Card type<select class="input" onchange="CardConjurerSets.updateListState(\'cardType\', this.value)">' + selectOptions(['','artifact','battle','creature','enchantment','instant','land','planeswalker','sorcery','tribal'], view.cardType, {'':'Any'}) + '</select></label></div></details>' +
			'<div id="sets-card-list" class="sets-card-list" role="listbox" aria-label="Cards in ' + escapeHtml(set.name) + '"></div>' +
			'<div class="sets-card-actions"><button type="button" onclick="CardConjurerSets.moveOrCopy(\'move\')">Move</button><button type="button" onclick="CardConjurerSets.moveOrCopy(\'copy\')">Copy</button><button type="button" onclick="CardConjurerSets.exportCard()">Export card</button><button type="button" onclick="document.querySelector(\'#sets-card-import\').click()">Import card</button><button type="button" class="danger" onclick="CardConjurerSets.deleteCard()">Delete</button></div>' +
			'<div class="sets-set-actions"><button type="button" onclick="CardConjurerSets.exportSet()">Export set</button><button type="button" onclick="document.querySelector(\'#sets-set-import\').click()">Import set</button><button type="button" onclick="CardConjurerSets.downloadSetImages()">Download images</button><button type="button" class="danger" onclick="CardConjurerSets.deleteSet()">Delete set</button></div>' +
			'<div id="sets-zip-progress" class="sets-zip-progress" hidden><span></span><button type="button" onclick="CardConjurerSets.cancelZip()">Cancel</button></div>';
		renderCardList();
	}

	function renderCardList() {
		var host = document.querySelector('#sets-card-list');
		var set = activeSet();
		if (!host || !set) return;
		var selected = set.activeCardId;
		var cards = Model.selectCards(cardsFor(set.id), set.listState);
		if (!cards.length) { host.innerHTML = '<div class="sets-empty-list"><strong>No matching cards</strong><span>Clear a search or filter to see this set.</span></div>'; return; }
		host.innerHTML = cards.map(function(card) {
			var title = card.derived.title || 'Untitled Card';
			var thumbnail = card.thumbnail ? '<img src="' + card.thumbnail + '" alt="">' : '<span class="sets-thumbnail-placeholder" aria-hidden="true"></span>';
			return '<button type="button" class="sets-card-row' + (card.id === selected ? ' selected' : '') + '" role="option" aria-selected="' + (card.id === selected ? 'true' : 'false') + '" onclick="CardConjurerSets.selectCard(\'' + card.id + '\')">' + thumbnail + '<span class="sets-card-row-copy"><strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml(card.derived.manaCost || 'No mana cost') + ' · ' + escapeHtml(card.rarity === 'mythic' ? 'Mythic Rare' : card.rarity[0].toUpperCase() + card.rarity.slice(1)) + '</span></span><b>' + escapeHtml(card.collectorNumber) + '</b></button>';
		}).join('');
	}

	function field(label, key, value, type, attrs) {
		return '<label class="sets-field"><span>' + label + '</span><input class="input" type="' + (type || 'text') + '" value="' + escapeHtml(value || '') + '" ' + (attrs || '') + ' oninput="CardConjurerSets.previewSetField(\'' + key + '\', this)" onblur="CardConjurerSets.commitSetField(\'' + key + '\', this)"></label>';
	}

	function renderDetailsTab(panel, set) {
		panel.innerHTML = '<div class="sets-form">' + field('Set name','name',set.name) + field('Short description','description',set.description) + field('Release date','releaseDate',set.releaseDate,'date') + field('Creator','creator',set.creator) +
			'<label class="sets-field"><span>Notes</span><textarea class="input" rows="3" oninput="CardConjurerSets.updateSetText(\'notes\', this.value)">' + escapeHtml(set.notes) + '</textarea></label>' +
			'<label class="sets-field"><span>Story (Markdown)</span><textarea id="sets-story" class="input" rows="9" oninput="CardConjurerSets.updateSetText(\'story\', this.value); CardConjurerSets.previewStory(this.value)">' + escapeHtml(set.story) + '</textarea></label>' +
			'<section class="sets-markdown-preview" aria-label="Rendered story preview"><span class="creator-eyebrow">Preview</span><div id="sets-story-preview">' + safeMarkdown(set.story) + '</div></section></div>';
	}

	function renderSymbolTab(panel, set) {
		var labels = {common:'Common · tokens · basic lands', uncommon:'Uncommon', rare:'Rare', mythic:'Mythic Rare'};
		panel.innerHTML = '<p class="sets-tab-intro">Load a bundled symbol family by set code, or upload and link individual rarity overrides. Placement remains card-specific.</p>' +
			'<section class="sets-symbol-loader"><div><strong>Load by set code</strong><span>Fills Common, Uncommon, Rare, and Mythic Rare at once.</span></div><label><span class="sr-only">Symbol set code</span><input id="sets-symbol-code" class="input" type="text" maxlength="12" autocomplete="off" spellcheck="false" value="' + escapeHtml(set.symbolCode || set.code || '') + '" placeholder="Set code" oninput="this.value=CardConjurerSetModel.normalizeSymbolCode(this.value)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();CardConjurerSets.loadSymbolsByCode(this)}"></label><button type="button" class="input sets-primary" onclick="CardConjurerSets.loadSymbolsByCode(document.querySelector(\'#sets-symbol-code\'))">Load all rarities</button></section>' +
			'<div class="sets-symbol-grid">' + Model.RARITIES.map(function(rarity) {
			var source = set.symbolSources[rarity] || '';
			return '<section class="sets-symbol-card"><div class="sets-symbol-preview">' + (source ? '<img src="' + escapeHtml(source) + '" alt="' + labels[rarity] + ' set symbol">' : '<span>—</span>') + '</div><label><strong>' + labels[rarity] + '</strong><input class="input" value="' + escapeHtml(source) + '" placeholder="Image URL" onblur="CardConjurerSets.updateSymbol(\'' + rarity + '\', this.value)"></label><button type="button" onclick="this.nextElementSibling.click()">Upload image</button><input type="file" accept="image/*" hidden onchange="CardConjurerSets.uploadSymbol(\'' + rarity + '\', event)"></section>';
		}).join('') + '</div>';
	}

	function renderCollectorTab(panel, set) {
		var cards = cardsFor(set.id);
		panel.innerHTML = '<div class="sets-form sets-collector-form">' + field('Set code','code',set.code,'text','maxlength="3"') + field('Language','language',set.language,'text','maxlength="8"') +
			'<label class="sets-field"><span>Copyright</span><textarea class="input" rows="2" maxlength="160" oninput="CardConjurerSets.updateSetText(\'copyright\', this.value)">' + escapeHtml(set.copyright) + '</textarea></label>' +
			'<label class="sets-field"><span>Collector format</span><select class="input" onchange="CardConjurerSets.updateCollectorStyle(this.value)">' + selectOptions(['post-one','pre-one'], set.collectorStyle, {'post-one':'Post-ONE · 0001','pre-one':'Pre-ONE · 001/' + String(collectorSlotCount(set.id)).padStart(3,'0')}) + '</select></label>' +
			'<div class="sets-collector-summary"><span>Printed year</span><strong>' + yearFor(set) + '</strong><span>Collector slots</span><strong>' + collectorSlotCount(set.id) + '</strong><span>Card files</span><strong>' + cards.length + '</strong></div>' +
			'<section><div class="sets-section-heading"><div><span class="creator-eyebrow">Collector groups</span><h4>Main is always first</h4></div></div><ol class="sets-group-list"><li><span>Main Set</span><small>Fixed</small></li>' + set.collectorGroupOrder.map(function(group, index) { return '<li><span>' + escapeHtml(group.replace(/(^|[-:])([a-z])/g, function(_, before, letter) { return (before ? ' ' : '') + letter.toUpperCase(); })) + '</span><span><button type="button" onclick="CardConjurerSets.moveGroup(' + index + ',-1)" aria-label="Move group up">↑</button><button type="button" onclick="CardConjurerSets.moveGroup(' + index + ',1)" aria-label="Move group down">↓</button></span></li>'; }).join('') + '</ol></section></div>';
	}

	function updateUndoButtons() {
		var set = activeSet(); if (!set) return;
		var history = ensureHistory(set.id);
		['#sets-undo-app'].forEach(function(selector) { var button = document.querySelector(selector); if (button) button.disabled = history.cursor <= 0; });
		['#sets-redo-app'].forEach(function(selector) { var button = document.querySelector(selector); if (button) button.disabled = history.cursor >= history.entries.length; });
	}

	async function loadActiveCard() {
		var set = activeSet(); var record = activeCardRecord();
		if (!set || !record || typeof loadCardData !== 'function') return;
		loadingCard = true;
		try {
			var styleInput = document.querySelector('#enableNewCollectorStyle');
			if (styleInput) styleInput.checked = set.collectorStyle === 'post-one';
			var hydrated = hydratedCardData(record, set);
			var repairedSymbolPlacement = Boolean(hydrated.setSymbolSource && symbolPlacementMissing(hydrated, hydrated.setSymbolSource));
			if (repairedSymbolPlacement && !hydrated.setSymbolBounds) hydrated.setSymbolBounds = clone(DEFAULT_SET_SYMBOL_BOUNDS);
			await loadCardData(hydrated, record.uiState || {});
			if (repairedSymbolPlacement && typeof resetSetSymbol === 'function') {
				resetSetSymbol();
				card.setSymbolPlacementKey = symbolSourceKey(hydrated.setSymbolSource);
				record.cardData = stripSetOwned(cardStorageSnapshot());
				record.updatedAt = new Date().toISOString();
			}
			if (typeof setBottomInfoStyle === 'function') { await setBottomInfoStyle(); await bottomInfoEdited(); }
			renderCardDetailsSummary();
			await updateThumbnail(record.id);
			if (repairedSymbolPlacement) await persist();
		} finally { loadingCard = false; editorDirty = false; }
	}

	function renderCardDetailsSummary() {
		var record = activeCardRecord(); var set = activeSet(); var host = document.querySelector('#sets-card-details-summary');
		if (!record || !set || !host) return;
		host.innerHTML = '<div class="creator-download-heading"><span class="creator-eyebrow">Card Details</span><h3>' + escapeHtml(record.derived.title || 'Untitled Card') + '</h3></div>' +
			'<div class="sets-card-detail-grid"><label>Collector number<input class="input" value="' + escapeHtml(record.collectorNumber) + '" readonly></label><label>Rarity<select class="input" onchange="CardConjurerSets.updateCardDetail(\'rarity\',this.value)">' + selectOptions(Model.RARITIES, record.rarity, {mythic:'Mythic Rare'}) + '</select></label>' +
			'<label>Printing category<select class="input" onchange="CardConjurerSets.updateCardDetail(\'printingCategory\',this.value)">' + selectOptions(['main','token','borderless','special','booster-fun','custom'], record.printingCategory, {'booster-fun':'Booster Fun'}) + '</select></label><label>Frame group<input class="input" value="' + escapeHtml(record.frameGroupKey || '') + '" onchange="CardConjurerSets.updateCardDetail(\'frameGroupKey\',this.value)"></label></div>' +
			'<p class="input-description">Set code ' + escapeHtml(set.code) + ', ' + escapeHtml(set.language) + ', symbol, year, copyright, and collector style are controlled by the set.</p>';
		['#info-number','#info-rarity','#info-set','#info-language','#info-year','#info-copyright','#enableNewCollectorStyle'].forEach(function(selector) { var input = document.querySelector(selector); if (input) input.disabled = true; });
	}

	async function updateThumbnail(cardId) {
		var record = state.cards.find(function(item) { return item.id === cardId; });
		var canvas = document.querySelector('#previewCanvas');
		if (!record || !canvas || !canvas.width) return;
		try {
			var thumb = document.createElement('canvas'); thumb.width = 72; thumb.height = 101;
			thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);
			record.thumbnail = thumb.toDataURL('image/webp', 0.72); record.thumbnailDirty = false;
			renderCardList();
		} catch (error) { record.thumbnailDirty = true; }
	}

	async function captureActiveCard(label, coalescingKey) {
		if (!initialized || loadingCard || !editorDirty || typeof cardStorageSnapshot !== 'function') return;
		var record = activeCardRecord(); var set = activeSet(); if (!record || !set) return;
		editorDirty = false;
		var currentData = stripSetOwned(cardStorageSnapshot());
		if (JSON.stringify(currentData) === JSON.stringify(record.cardData) && JSON.stringify(liveDraftUiSnapshot()) === JSON.stringify(record.uiState)) return;
		var before = snapshot();
		var oldUi = record.uiState || {};
		record.cardData = currentData; record.uiState = liveDraftUiSnapshot(); record.updatedAt = new Date().toISOString(); record.thumbnailDirty = true;
		if (record.variantKind === 'art' && oldUi.activeFramePack && record.uiState.activeFramePack && oldUi.activeFramePack !== record.uiState.activeFramePack) {
			record.variantKind = null; record.logicalCardId = record.id; record.variantOrder = 0;
		}
		inferFrameClassification(record);
		renumberSet(set.id);
		var after = snapshot();
		recordHistory([set.id], label || 'Edit card', coalescingKey || 'card-edit', before, after);
		await updateThumbnail(record.id);
		await persist(); updateUndoButtons(); renderCardDetailsSummary();
	}

	function queueCapture(delay) {
		if (loadingCard || !initialized) return;
		editorDirty = true;
		clearTimeout(captureTimer);
		captureTimer = setTimeout(function() { captureActiveCard('Edit card', 'card-edit'); }, Math.max(delay == null ? 350 : delay, 700));
	}

	function automaticFrameSettled() {
		if (loadingCard || !initialized) return;
		editorDirty = true;
		clearTimeout(captureTimer);
		captureTimer = setTimeout(function() { captureActiveCard('Auto-update frame', 'card-edit'); }, 120);
	}

	function inferFrameClassification(record) {
		if (record.classificationOverride || typeof FRAME_REGISTRY === 'undefined') return;
		var pack = record.uiState.activeFrameCustomizationPack || record.uiState.activeFramePack;
		if (!pack) return;
		var collector = typeof FRAME_REGISTRY.collectorDefinition === 'function' ? FRAME_REGISTRY.collectorDefinition(pack) : null;
		if (collector) {
			record.printingCategory = collector.category;
			record.frameGroupKey = collector.groupKey;
			record.frameGroupLabel = collector.groupLabel;
			return;
		}
		var definition = FRAME_REGISTRY.definition(pack);
		var category = definition.category;
		if (category === 'tokens') record.printingCategory = 'token';
		else if (category === 'booster-fun') record.printingCategory = definition.family && /borderless/i.test(definition.family) ? 'borderless' : 'booster-fun';
		else if (category === 'custom') record.printingCategory = 'custom';
		else if (category === 'legacy') record.printingCategory = 'special';
		else record.printingCategory = /borderless/i.test(definition.family || '') ? 'borderless' : 'main';
		record.frameGroupKey = record.printingCategory === 'main' ? 'main' : (record.printingCategory === 'token' ? 'tokens' : (definition.family || record.printingCategory));
		record.frameGroupLabel = definition.family || record.frameGroupKey;
	}

	async function selectCard(id) {
		await captureActiveCard();
		var set = activeSet(); if (!set || !state.cards.some(function(card) { return card.id === id && card.setId === set.id; })) return;
		set.activeCardId = id; await persist(); renderWorkspace(); await loadActiveCard(); closeDrawer();
	}

	async function selectSet(id) {
		await captureActiveCard();
		if (!state.sets.some(function(set) { return set.id === id; })) return;
		state.activeSetId = id; await persist(true); renderWorkspace(); await loadActiveCard();
	}

	async function selectTab(key) {
		var set = activeSet(); if (!set) return;
		set.activeTab = key; await persist(); renderWorkspace();
	}

	async function newSet() {
		await captureActiveCard();
		var newSetRecord;
		await commit('Create set', '', function() {
			newSetRecord = Model.createDefaultSet(state.sets);
			var newCardRecord = Model.createDefaultCard(newSetRecord.id, stripSetOwned(initialBlankCardData || {}));
			newSetRecord.activeCardId = newCardRecord.id;
			state.sets.push(newSetRecord); state.cards.push(newCardRecord); state.activeSetId = newSetRecord.id; state.histories[newSetRecord.id] = Model.createHistory();
		}, [state.activeSetId], {immediate: true});
		await loadActiveCard();
	}

	async function newCard() {
		await captureActiveCard(); var set = activeSet();
		await commit('Create card', '', function() {
			var newCardRecord = Model.createDefaultCard(set.id, stripSetOwned(initialBlankCardData || {}));
			newCardRecord.sortOrder = Math.max(0, ...cardsFor(set.id).map(function(item) { return Number(item.sortOrder || 0); })) + 1;
			state.cards.push(newCardRecord); set.activeCardId = newCardRecord.id;
		}, [set.id], {immediate: true});
		await loadActiveCard();
	}

	async function duplicateCard() {
		await captureActiveCard(); var set = activeSet(); var source = activeCardRecord(); if (!source) return;
		await commit('Duplicate card', '', function() {
			var copy = clone(source); copy.id = Model.createId('card'); copy.originId = null; copy.logicalCardId = copy.id; copy.variantKind = null; copy.variantOrder = 0; copy.sortOrder = Number(source.sortOrder || 0) + 0.0001; copy.createdAt = copy.updatedAt = new Date().toISOString(); copy.thumbnail = source.thumbnail;
			state.cards.push(copy); set.activeCardId = copy.id;
		}, [set.id], {immediate: true}); await loadActiveCard();
	}

	async function addVariant(kind) {
		await captureActiveCard(); var set = activeSet(); var source = activeCardRecord(); if (!source) return;
		await commit('Add ' + kind + ' variant', '', function() {
			var copy = clone(source); copy.id = Model.createId('card'); copy.logicalCardId = source.logicalCardId || source.id; source.logicalCardId = copy.logicalCardId; copy.variantKind = kind; copy.variantOrder = Math.max(0, ...state.cards.filter(function(item) { return item.logicalCardId === copy.logicalCardId && item.variantKind === kind; }).map(function(item) { return Number(item.variantOrder || 0); })) + 1; copy.sortOrder = Number(source.sortOrder || 0) + copy.variantOrder / 10000; copy.createdAt = copy.updatedAt = new Date().toISOString();
			state.cards.push(copy); set.activeCardId = copy.id;
		}, [set.id], {immediate: true}); await loadActiveCard();
	}

	async function deleteCardAction() {
		await captureActiveCard(); var set = activeSet(); var source = activeCardRecord(); if (!set || !source) return;
		await commit('Delete card', '', function() {
			var ordered = Model.selectCards(cardsFor(set.id), {sort:'collector',direction:'asc'}); var index = ordered.findIndex(function(item) { return item.id === source.id; });
			state.cards = state.cards.filter(function(item) { return item.id !== source.id; });
			var remaining = cardsFor(set.id);
			if (!remaining.length) {
				var blankCard = Model.createDefaultCard(set.id, stripSetOwned(initialBlankCardData || {})); state.cards.push(blankCard); set.activeCardId = blankCard.id;
			} else set.activeCardId = (remaining[Math.min(index, remaining.length - 1)] || remaining[0]).id;
		}, [set.id], {immediate: true}); await loadActiveCard();
	}

	async function deleteSetAction() {
		var set = activeSet(); if (!set || !confirm('Delete “' + set.name + '” and every card in it? You can undo this action.')) return;
		await captureActiveCard(); var deletedId = set.id; var historyOwner = deletedId;
		var before = snapshot();
		state.sets = state.sets.filter(function(item) { return item.id !== deletedId; }); state.cards = state.cards.filter(function(item) { return item.setId !== deletedId; });
		if (!state.sets.length) {
			var fallback = Model.createDefaultSet([]); var blankCard = Model.createDefaultCard(fallback.id, stripSetOwned(initialBlankCardData || {})); fallback.activeCardId = blankCard.id; state.sets.push(fallback); state.cards.push(blankCard); state.histories[fallback.id] = Model.createHistory(); state.activeSetId = fallback.id; historyOwner = fallback.id;
		} else state.activeSetId = state.sets[0].id;
		numberAllSets(); var after = snapshot(); recordHistory([historyOwner], 'Delete set', '', before, after); await persist(true); renderWorkspace(); await loadActiveCard();
	}

	async function resetActiveCard() {
		if (!confirm('Reset this card to a blank default card? You can undo this action.')) return;
		var set = activeSet(); var record = activeCardRecord(); if (!record) return;
		await commit('Reset card', '', function() {
			var reset = Model.createDefaultCard(set.id, stripSetOwned(initialBlankCardData || {}));
			reset.id = record.id; reset.logicalCardId = record.id; reset.sortOrder = record.sortOrder; state.cards[state.cards.indexOf(record)] = reset; set.activeCardId = reset.id;
		}, [set.id], {immediate: true}); await loadActiveCard();
	}

	async function undo() {
		await captureActiveCard(); var set = activeSet(); if (!set) return;
		var result = Model.undoHistory(ensureHistory(set.id)); if (!result.state) return;
		state.histories[set.id] = result.history; restoreSnapshot(result.state); await persist(true); renderWorkspace(); await loadActiveCard(); setStatus('Undid ' + result.label, 'saved');
	}

	async function redo() {
		var set = activeSet(); if (!set) return;
		var result = Model.redoHistory(ensureHistory(set.id)); if (!result.state) return;
		state.histories[set.id] = result.history; restoreSnapshot(result.state); await persist(true); renderWorkspace(); await loadActiveCard(); setStatus('Redid ' + result.label, 'saved');
	}

	function updateListState(key, value) {
		var set = activeSet(); if (!set) return;
		set.listState = Object.assign({}, Model.DEFAULT_LIST_STATE, set.listState || {}); set.listState[key] = value;
		renderCardList(); persist();
	}

	function previewSetField(key, input) {
		var set = activeSet(); if (!set) return;
		var value = key === 'code' ? Model.normalizeSetCode(input.value) : input.value;
		if (key === 'code' && input.value !== value) input.value = value;
		var draft = Object.assign({}, set, {[key]: value}); var errors = Model.validateSet(draft, state.sets);
		input.setCustomValidity(errors[key] || '');
	}

	async function commitSetField(key, input) {
		var set = activeSet(); if (!set) return;
		var value = key === 'code' ? Model.normalizeSetCode(input.value) : input.value.trim();
		var draft = Object.assign({}, set, {[key]: value}); var errors = Model.validateSet(draft, state.sets);
		if (errors[key]) { input.setCustomValidity(errors[key]); input.reportValidity(); input.value = set[key]; return; }
		await commit('Edit set ' + key, 'set:' + key, function() { set[key] = value; set.updatedAt = new Date().toISOString(); }, [set.id], {render:false});
		if (['releaseDate'].includes(key)) await loadActiveCard();
		var option = document.querySelector('#sets-switcher option[value="' + set.id + '"]'); if (option) option.textContent = set.name + ' · ' + set.code;
	}

	async function updateSetText(key, value) {
		var set = activeSet(); if (!set || set[key] === value) return;
		await commit('Edit set ' + key, 'set:' + key, function() { set[key] = value; }, [set.id], {render:false});
		if (key === 'copyright') await loadActiveCard();
	}

	function previewStory(value) { var host = document.querySelector('#sets-story-preview'); if (host) host.innerHTML = safeMarkdown(value); }

	function invalidateSetCardThumbnails(set) {
		cardsFor(set.id).forEach(function(cardRecord) {
			cardRecord.thumbnail = '';
			cardRecord.thumbnailDirty = true;
		});
	}

	async function refreshActiveCardSymbol() {
		var set = activeSet(); var record = activeCardRecord();
		if (!set || !record || typeof uploadSetSymbol !== 'function') return;
		var source = symbolFor(set, record) || (typeof blank !== 'undefined' && blank.src) || '/img/blank.png';
		var repairedSymbolPlacement = symbolPlacementMissing(card, source);
		if (repairedSymbolPlacement && !card.setSymbolBounds) card.setSymbolBounds = clone(DEFAULT_SET_SYMBOL_BOUNDS);
		uploadSetSymbol(source);
		if (typeof waitForRenderableImage === 'function' && typeof setSymbol !== 'undefined') await waitForRenderableImage(setSymbol);
		if (repairedSymbolPlacement && typeof resetSetSymbol === 'function') {
			resetSetSymbol();
			card.setSymbolPlacementKey = symbolSourceKey(source);
		}
		else if (typeof setSymbolEdited === 'function') setSymbolEdited();
		else if (typeof drawCard === 'function') drawCard();
		if (repairedSymbolPlacement && typeof cardStorageSnapshot === 'function') {
			record.cardData = stripSetOwned(cardStorageSnapshot());
			record.updatedAt = new Date().toISOString();
		}
		await updateThumbnail(record.id);
		if (repairedSymbolPlacement) await persist();
	}

	async function updateSymbol(rarity, source) {
		var set = activeSet(); var normalizedSource = String(source || '').trim();
		if (!set || set.symbolSources[rarity] === normalizedSource) return;
		await commit('Change ' + rarity + ' set symbol', '', function() {
			set.symbolSources[rarity] = normalizedSource;
			invalidateSetCardThumbnails(set);
		}, [set.id]);
		await refreshActiveCardSymbol();
	}

	function uploadSymbol(rarity, event) {
		var file = event.target.files && event.target.files[0]; if (!file) return;
		var reader = new FileReader(); reader.onload = function() { updateSymbol(rarity, reader.result); }; reader.readAsDataURL(file); event.target.value = '';
	}

	function symbolImageLoads(source) {
		return new Promise(function(resolve) {
			var image = new Image();
			image.onload = function() { resolve(true); };
			image.onerror = function() { resolve(false); };
			image.src = typeof fixUri === 'function' ? fixUri(source) : source;
		});
	}

	async function loadSymbolsByCode(input) {
		var set = activeSet();
		var code = Model.normalizeSymbolCode(input && input.value);
		if (!set || !input) return;
		input.value = code;
		if (!code) { input.setCustomValidity('Enter a set code.'); input.reportValidity(); return; }
		input.setCustomValidity('');
		clearWorkspaceError();
		var button = input.closest('.sets-symbol-loader').querySelector('button');
		var sources = Model.symbolSourcesForCode(code);
		button.disabled = true;
		button.textContent = 'Loading…';
		var results = await Promise.all(Model.RARITIES.map(function(rarity) { return symbolImageLoads(sources[rarity]); }));
		if (results.some(function(result) { return !result; })) {
			button.disabled = false;
			button.textContent = 'Load all rarities';
			showWorkspaceError('A complete four-rarity symbol family was not found for "' + code.toUpperCase() + '". Check the code or use the individual rarity overrides below.');
			return;
		}
		await commit('Load ' + code.toUpperCase() + ' set symbols', '', function() {
			set.symbolCode = code;
			set.symbolSources = sources;
			invalidateSetCardThumbnails(set);
		}, [set.id]);
		await refreshActiveCardSymbol();
		setStatus('Loaded ' + code.toUpperCase() + ' symbols for all rarities', 'saved');
	}

	async function updateCollectorStyle(value) {
		var set = activeSet(); if (!set) return;
		await commit('Change collector format', '', function() { set.collectorStyle = value; }, [set.id]); await loadActiveCard();
	}

	async function moveGroup(index, delta) {
		var set = activeSet(); var target = index + delta; if (!set || target < 0 || target >= set.collectorGroupOrder.length) return;
		await commit('Reorder collector groups', '', function() { var group = set.collectorGroupOrder.splice(index, 1)[0]; set.collectorGroupOrder.splice(target, 0, group); }, [set.id]); await loadActiveCard();
	}

	async function updateCardDetail(key, value) {
		var record = activeCardRecord(); var set = activeSet(); if (!record) return;
		if (key === 'rarity') {
			var before = snapshot();
			loadingCard = true;
			try {
				record.rarity = value;
				var rarityCode = ({common:'C',uncommon:'U',rare:'R',mythic:'M'})[value] || 'C';
				card.infoRarity = rarityCode;
				var rarityInput = document.querySelector('#info-rarity'); if (rarityInput) rarityInput.value = rarityCode;
				var symbolRarity = document.querySelector('#set-symbol-rarity'); if (symbolRarity) symbolRarity.value = rarityCode;
				var source = symbolFor(set, record);
				if (source && typeof uploadSetSymbol === 'function') {
					uploadSetSymbol(source);
					if (typeof waitForRenderableImage === 'function') await waitForRenderableImage(setSymbol);
				}
				if (typeof bottomInfoEdited === 'function') await bottomInfoEdited();
				if (typeof autoFrame === 'function') await autoFrame();
				record.cardData = stripSetOwned(cardStorageSnapshot());
				record.uiState = liveDraftUiSnapshot();
				record.updatedAt = new Date().toISOString();
				record.thumbnailDirty = true;
				inferFrameClassification(record);
				renumberSet(set.id);
			} finally { loadingCard = false; editorDirty = false; }
			var after = snapshot();
			recordHistory([set.id], 'Change card rarity', '', before, after);
			await updateThumbnail(record.id); await persist(true); renderWorkspace(); renderCardDetailsSummary();
			return;
		}
		await commit('Change card ' + key, '', function() { record[key] = value; if (key === 'printingCategory' || key === 'frameGroupKey') record.classificationOverride = true; }, [set.id]); await loadActiveCard();
	}

	async function moveOrCopy(mode) {
		await captureActiveCard(); var sourceSet = activeSet(); var source = activeCardRecord(); if (!source || state.sets.length < 2) { alert('Create another set first.'); return; }
		pendingTransferMode = mode;
		var dialog = document.querySelector('#sets-transfer-dialog'); var targetSelect = document.querySelector('#sets-transfer-target'); var title = document.querySelector('#sets-transfer-title'); var confirmButton = document.querySelector('#sets-transfer-confirm');
		var choices = state.sets.filter(function(set) { return set.id !== sourceSet.id; });
		targetSelect.innerHTML = choices.map(function(set) { return '<option value="' + set.id + '">' + escapeHtml(set.name) + ' · ' + escapeHtml(set.code) + '</option>'; }).join('');
		title.textContent = mode === 'move' ? 'Move card' : 'Copy card'; confirmButton.textContent = title.textContent; dialog.showModal();
	}

	async function confirmMoveOrCopy() {
		var mode = pendingTransferMode; var sourceSet = activeSet(); var source = activeCardRecord(); var targetId = document.querySelector('#sets-transfer-target').value; var target = state.sets.find(function(set) { return set.id === targetId; }); if (!mode || !source || !target) return;
		document.querySelector('#sets-transfer-dialog').close(); pendingTransferMode = null;
		await commit((mode === 'move' ? 'Move' : 'Copy') + ' card', '', function() {
			var moved = mode === 'copy' ? clone(source) : source; if (mode === 'copy') { moved.id = Model.createId('card'); moved.logicalCardId = moved.id; moved.variantKind = null; moved.originId = null; state.cards.push(moved); }
			moved.setId = target.id; moved.sortOrder = Math.max(0, ...cardsFor(target.id).map(function(item) { return Number(item.sortOrder || 0); })) + 1; target.activeCardId = moved.id;
			if (mode === 'move' && !cardsFor(sourceSet.id).length) { var blankCard = Model.createDefaultCard(sourceSet.id, stripSetOwned(initialBlankCardData || {})); state.cards.push(blankCard); sourceSet.activeCardId = blankCard.id; }
			state.activeSetId = target.id;
		}, [sourceSet.id, target.id], {immediate:true}); await loadActiveCard();
	}

	function downloadJson(value, filename) {
		var link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type:'application/json'})); link.download = filename; document.body.appendChild(link); link.click(); setTimeout(function() { URL.revokeObjectURL(link.href); link.remove(); }, 0);
	}

	function safeFilename(value) { return String(value || 'Untitled').replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/[. ]+$/g, '').slice(0, 120) || 'Untitled'; }
	function exportCardAction() { var record = activeCardRecord(), set = activeSet(); if (record && set) downloadJson(Files.createCardEnvelope(record, set), safeFilename(record.derived.title || 'Untitled Card') + '.cardconjurer-card'); }
	function exportSetAction() { var set = activeSet(); if (set) downloadJson(Files.createSetEnvelope(set, cardsFor(set.id)), safeFilename(set.name) + '.cardconjurer-set'); }

	function readFile(event, callback) {
		var input = event.target; var file = input.files && input.files[0]; if (!file) return;
		var reader = new FileReader(); reader.onload = async function() { try { clearWorkspaceError(); await callback(reader.result); } catch (error) { showWorkspaceError(error.message); } finally { input.value = ''; } }; reader.onerror = function() { showWorkspaceError('The selected file could not be read.'); input.value = ''; }; reader.readAsText(file);
	}

	function importCardFile(event) {
		readFile(event, async function(text) {
			var set = activeSet(); var imported;
			await commit('Import card', '', function() { imported = Files.importCardInto(state.cards, text, set.id); state.cards = imported.cards; set.activeCardId = imported.card.id; }, [set.id], {immediate:true}); await loadActiveCard(); setStatus(imported.replaced ? 'Replaced matching card' : 'Imported card', 'saved');
		});
	}

	function importSetFile(event) {
		readFile(event, async function(text) {
			var parsed = Files.validateEnvelope(text, Files.SET_FORMAT); var importedSet = parsed.payload.set; var importedCards = parsed.payload.cards;
			var collision = state.sets.find(function(set) { return Model.normalizeText(set.name) === Model.normalizeText(importedSet.name) || String(set.code).toUpperCase() === String(importedSet.code).toUpperCase(); });
			if (collision) {
				pendingSetImport = {importedSet: importedSet, importedCards: importedCards, collisionId: collision.id};
				var message = document.querySelector('#sets-import-message');
				if (message) message.textContent = collision.name + ' (' + collision.code + ') already exists. Merge keeps local-only cards and lets the imported version win on matches; replace removes the current contents first.';
				document.querySelector('#sets-import-dialog').showModal();
				return;
			}
			await applySetImport('new', {importedSet: importedSet, importedCards: importedCards, collisionId: null});
		});
	}

	async function applySetImport(mode, pending) {
		var importedSet = pending.importedSet; var importedCards = pending.importedCards; var collision = pending.collisionId && state.sets.find(function(set) { return set.id === pending.collisionId; });
		var affected = collision ? collision.id : state.activeSetId;
		await commit('Import set', '', function() {
				if (!collision) { var setCopy = clone(importedSet); setCopy.id = Model.createId('set'); importedCards = importedCards.map(function(card) { var copy = clone(card); copy.id = Model.createId('card'); copy.setId = setCopy.id; copy.logicalCardId = copy.id; return copy; }); setCopy.activeCardId = importedCards[0] && importedCards[0].id; state.sets.push(setCopy); state.cards.push.apply(state.cards, importedCards); state.activeSetId = setCopy.id; state.histories[setCopy.id] = Model.createHistory(); }
				else if (mode === 'replace') { var id = collision.id; state.cards = state.cards.filter(function(card) { return card.setId !== id; }); Object.assign(collision, clone(importedSet), {id:id}); importedCards = importedCards.map(function(card) { var copy=clone(card); copy.id=Model.createId('card'); copy.setId=id; copy.logicalCardId=copy.id; return copy; }); state.cards.push.apply(state.cards, importedCards); collision.activeCardId = importedCards[0] && importedCards[0].id; state.activeSetId=id; }
				else { var merged = Files.mergeSet(collision, cardsFor(collision.id), importedSet, importedCards); Object.assign(collision, merged.set); state.cards = state.cards.filter(function(card) { return card.setId !== collision.id; }).concat(merged.cards); collision.activeCardId = merged.cards[0] && merged.cards[0].id; state.activeSetId=collision.id; }
		}, [affected], {immediate:true}); await loadActiveCard();
	}

	async function resolveSetImport(mode) {
		if (!pendingSetImport || !['merge', 'replace'].includes(mode)) return;
		var pending = pendingSetImport; pendingSetImport = null;
		var dialog = document.querySelector('#sets-import-dialog'); if (dialog && dialog.open) dialog.close();
		await applySetImport(mode, pending);
	}

	function cancelSetImport() { pendingSetImport = null; }

	async function ensureZip() {
		if (root.JSZip) return root.JSZip;
		if (typeof loadScript === 'function') await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
		for (var index = 0; index < 40 && !root.JSZip; index++) await new Promise(function(resolve) { setTimeout(resolve, 100); });
		if (!root.JSZip) throw new Error('ZIP support could not be loaded.'); return root.JSZip;
	}

	async function canvasBlob(format) { return new Promise(function(resolve) { previewCanvas.toBlob(resolve, format === 'jpeg' ? 'image/jpeg' : 'image/png', format === 'jpeg' ? 0.92 : undefined); }); }

	async function downloadSetImages() {
		await captureActiveCard(); var set = activeSet(); var originalSetId = state.activeSetId; var originalCardId = set.activeCardId; var ordered = Model.selectCards(cardsFor(set.id), {sort:'collector',direction:'asc'}); var progress = document.querySelector('#sets-zip-progress'); var progressText = progress && progress.querySelector('span'); zipCanceled = false;
		try {
			var Zip = await ensureZip(); var zip = new Zip(); if (progress) progress.hidden = false;
			var formatValue = document.querySelector('#download-format').value; var format = formatValue === 'jpeg' ? 'jpeg' : 'png'; var used = new Set();
			for (var index = 0; index < ordered.length; index++) {
				if (zipCanceled) throw new Error('Image export canceled.'); var record = ordered[index]; set.activeCardId = record.id; if (progressText) progressText.textContent = 'Rendering ' + (index + 1) + ' of ' + ordered.length + ': ' + (record.derived.title || 'Untitled Card'); await loadActiveCard();
				var blob = await canvasBlob(format); var filename = safeFilename(record.collectorNumber.replace('/', '-') + ' ' + (record.derived.title || 'Untitled Card')) + '.' + (format === 'jpeg' ? 'jpg' : 'png'); var base=filename, suffix=2; while(used.has(filename)){filename=base.replace(/(\.[^.]+)$/,'-'+suffix+'$1');suffix++;} used.add(filename); zip.file(filename, blob);
			}
			if (progressText) progressText.textContent = 'Building ZIP…'; var content = await zip.generateAsync({type:'blob'}); var link=document.createElement('a'); link.href=URL.createObjectURL(content); link.download=safeFilename(set.name)+'-images.zip'; document.body.appendChild(link); link.click(); setTimeout(function(){URL.revokeObjectURL(link.href);link.remove();},0); setStatus('Downloaded ' + ordered.length + ' card images','saved');
		} catch (error) { if (!zipCanceled) showWorkspaceError(error.message); else setStatus('Image export canceled','saved'); }
		finally { state.activeSetId=originalSetId; set=activeSet(); if(set) set.activeCardId=originalCardId; if(progress) progress.hidden=true; renderWorkspace(); await loadActiveCard(); }
	}

	function cancelZip() { zipCanceled = true; }

	function openDrawer(trigger) { var drawer=document.querySelector('#sets-workspace'), toggle=document.querySelector('#sets-drawer-toggle'), button=document.querySelector('#sets-drawer-open'); drawerReturnFocus=trigger||document.activeElement; if(toggle)toggle.checked=true; if(drawer)drawer.classList.add('opened'); if(button)button.setAttribute('aria-expanded','true'); document.body.classList.add('sets-drawer-active'); setTimeout(function(){drawer&&drawer.querySelector('.sets-drawer-close')&&drawer.querySelector('.sets-drawer-close').focus();},0); }
	function closeDrawer() { var drawer=document.querySelector('#sets-workspace'), toggle=document.querySelector('#sets-drawer-toggle'), button=document.querySelector('#sets-drawer-open'); if(toggle)toggle.checked=false; if(drawer)drawer.classList.remove('opened'); if(button)button.setAttribute('aria-expanded','false'); document.body.classList.remove('sets-drawer-active'); if(drawerReturnFocus&&drawerReturnFocus.isConnected)drawerReturnFocus.focus(); }

	async function initialize() {
		if (initialized) return;
		try {
			if (root.frameCatalogReadyPromise) await root.frameCatalogReadyPromise;
			initialBlankCardData = stripSetOwned(typeof cardStorageSnapshot === 'function' ? cardStorageSnapshot() : {});
			await bootstrap(); initialized = true; renderWorkspace(); await loadActiveCard();
			document.querySelector('.creator-menu')?.addEventListener('input', function(event) { if (!event.target.closest('#sets-card-details-summary')) queueCapture(420); });
			document.querySelector('.creator-menu')?.addEventListener('change', function(event) { if (!event.target.closest('#sets-card-details-summary')) queueCapture(0); });
			document.addEventListener('keydown', function(event) {
				if (event.key === 'Escape') closeDrawer();
				if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.isComposing) { event.preventDefault(); event.shiftKey ? redo() : undo(); }
			});
			setStatus('Saved locally','saved');
		} catch (error) {
			console.error(error); var host=document.querySelector('#sets-workspace-content'); if(host)host.innerHTML='<div class="creator-library-empty"><h3>Sets could not open</h3><p>'+escapeHtml(error.message)+'</p><button class="input" onclick="location.reload()">Retry</button></div>'; setStatus('Local storage unavailable','error');
		}
	}

	if (channel) channel.onmessage = async function(event) { if (!initialized || !event.data || event.data.revision <= state.revision) return; setStatus('Another tab changed this set — refreshing…','saving'); try { var loaded=await Storage.loadState(); state=Object.assign(state,loaded); numberAllSets(); renderWorkspace(); await loadActiveCard(); } catch(error){showWorkspaceError(error.message);} };

	root.CardConjurerSets = {
		initialize: initialize, captureActiveCard: captureActiveCard, queueCapture: queueCapture, resetActiveCard: resetActiveCard,
		automaticFrameSettled: automaticFrameSettled,
		selectSet: selectSet, selectTab: selectTab, selectCard: selectCard, newSet: newSet, newCard: newCard, duplicateCard: duplicateCard, addVariant: addVariant,
		deleteCard: deleteCardAction, deleteSet: deleteSetAction, undo: undo, redo: redo, updateListState: updateListState,
		previewSetField: previewSetField, commitSetField: commitSetField, updateSetText: updateSetText, previewStory: previewStory,
		updateSymbol: updateSymbol, uploadSymbol: uploadSymbol, loadSymbolsByCode: loadSymbolsByCode, updateCollectorStyle: updateCollectorStyle, moveGroup: moveGroup, updateCardDetail: updateCardDetail,
		moveOrCopy: moveOrCopy, confirmMoveOrCopy: confirmMoveOrCopy, exportCard: exportCardAction, exportSet: exportSetAction, importCardFile: importCardFile, importSetFile: importSetFile, resolveSetImport: resolveSetImport, cancelSetImport: cancelSetImport,
		downloadSetImages: downloadSetImages, cancelZip: cancelZip, openDrawer: openDrawer, closeDrawer: closeDrawer,
		getState: function() { return clone(state); }, safeMarkdown: safeMarkdown, deleteDatabaseForTests: Storage.deleteDatabaseForTests
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true}); else setTimeout(initialize, 0);
})(window);
