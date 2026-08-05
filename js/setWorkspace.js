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
	var cardSearchReturnFocus = null;
	var pendingCardSelection = null;
	var cardSelectionPromise = null;
	var cardTransitionTimer = null;
	var thumbnailRefreshTimer = null;
	var thumbnailRefreshCardId = null;
	var initialBlankCardData = null;
	var zipCanceled = false;
	var zipRendering = false;
	var pendingTransferMode = null;
	var pendingSetImport = null;
	var scryfallSearchResults = [];
	var WORKSPACE_LAYOUT_KEY = 'card-conjurer-workspace-layout-v1';
	var workspaceLayout = {leftWidth: null, rightWidth: null, collapsed: false};
	var DEFAULT_SET_SYMBOL_BOUNDS = {x: 0.9213, y: 0.5910, width: 0.12, height: 0.0410, vertical: 'center', horizontal: 'right'};
	var channel = !root.setConjurerDesktop && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('card-conjurer-sets') : null;

	function clone(value) { return Model.clone(value); }
	function clamp(value, minimum, maximum) { return Math.min(Math.max(value, minimum), maximum); }
	function loadWorkspaceLayout() {
		try {
			var saved = JSON.parse(localStorage.getItem(WORKSPACE_LAYOUT_KEY) || 'null');
			if (saved && typeof saved === 'object') workspaceLayout = {
				leftWidth: Number.isFinite(Number(saved.leftWidth)) ? Number(saved.leftWidth) : null,
				rightWidth: Number.isFinite(Number(saved.rightWidth)) ? Number(saved.rightWidth) : null,
				collapsed: Boolean(saved.collapsed)
			};
		} catch (error) {}
	}
	function saveWorkspaceLayout() {
		try { localStorage.setItem(WORKSPACE_LAYOUT_KEY, JSON.stringify(workspaceLayout)); } catch (error) {}
	}
	function applyWorkspaceLayout() {
		var grid = document.querySelector('.creator-workspace .creator-grid'); if (!grid) return;
		if (workspaceLayout.leftWidth) grid.style.setProperty('--sets-panel-width', Math.round(workspaceLayout.leftWidth) + 'px');
		if (workspaceLayout.rightWidth) grid.style.setProperty('--editor-panel-width', Math.round(workspaceLayout.rightWidth) + 'px');
		grid.classList.toggle('sets-panel-collapsed', workspaceLayout.collapsed);
	}
	function revealWorkspace() {
		return new Promise(function(resolve) {
			requestAnimationFrame(function() {
				requestAnimationFrame(function() {
					var workspace = document.querySelector('.creator-workspace');
					if (workspace) workspace.classList.add('is-ready');
					if (root.SetConjurerBoot) root.SetConjurerBoot.finish();
					resolve();
				});
			});
		});
	}
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

	function updateCardEditorActions() {
		var button = document.querySelector('#card-editor-add-variant');
		var duplicateButton = document.querySelector('#card-editor-duplicate');
		var record = activeCardRecord();
		if (!record) return;
		var collectorMatch = String(record.collectorNumber || '').match(/^(\d+)([a-z]*)/i);
		var match = collectorMatch && collectorMatch[1] ? collectorMatch : null;
		var base = String(Number(match ? match[1] : 1)).padStart(4, '0');
		if (duplicateButton) {
			var currentNumber = base + (match ? match[2] || '' : '');
			var duplicateNumber = String(Number(match ? match[1] : 1) + 1).padStart(4, '0');
			duplicateButton.title = 'This card keeps its collector number ' + currentNumber + '; the duplicate will be ' + duplicateNumber;
		}
		if (!button) return;
		var logicalId = record.logicalCardId || record.id;
		var family = state.cards.filter(function(card) { return (card.logicalCardId || card.id) === logicalId; });
		if (family.length === 1) {
			button.title = 'Make this card ' + base + 'a and the variant will be ' + base + 'b';
		} else {
			button.title = 'Add variant ' + base + Model.suffixFor(family.length) + ' to this card';
		}
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
		data.infoCopyrightFirstLineNoteStyle = Boolean(set.copyrightFirstLineNoteStyle);
		var source = symbolFor(set, record);
		if (source) data.setSymbolSource = source;
		return data;
	}

	async function syncActiveCollectorNumber(record) {
		if (!record || typeof card === 'undefined') return false;
		var nextNumber = String(record.collectorNumber || '');
		var input = document.querySelector('#info-number');
		var inputChanged = Boolean(input && String(input.value) !== nextNumber);
		var cardChanged = String(card.infoNumber || '') !== nextNumber;
		if (!inputChanged && !cardChanged) return false;
		if (input) input.value = nextNumber;
		card.infoNumber = nextNumber;
		if (input && typeof bottomInfoEdited === 'function') await bottomInfoEdited();
		else if (typeof drawCard === 'function') drawCard();
		return true;
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
		['infoNumber', 'infoSet', 'infoLanguage', 'infoYear', 'infoCopyright', 'infoCopyrightFirstLineNoteStyle'].forEach(function(key) { delete output[key]; });
		delete output.setSymbolSource;
		return output;
	}

	function snapshot() {
		return {sets: clone(state.sets), cards: clone(state.cards), activeSetId: state.activeSetId};
	}

	function snapshotEqual(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

	function restoreSnapshot(value) {
		state.sets = value.sets || [];
		state.cards = value.cards || [];
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
			try {
				await Storage.saveState(state);
				setStatus('Saved successfully', 'saved');
				if (channel) channel.postMessage({revision: state.revision, source: root.name || 'tab'});
			} catch (error) {
				console.error(error);
				setStatus('Issue saving', 'error');
				showWorkspaceError(error.message || 'Autosave failed.');
			}
		};
		if (immediate) return save();
		persistTimer = setTimeout(save, 120);
	}

	async function persistMutation(mutation) {
		if (!root.setConjurerDesktop || !Storage.applyMutation) return persist(true);
		clearTimeout(persistTimer);
		state.revision = Date.now();
		mutation.revision = state.revision;
		try {
			await Storage.applyMutation(mutation);
			setStatus('Saved successfully', 'saved');
		} catch (error) {
			console.error(error);
			setStatus('Issue saving', 'error');
			showWorkspaceError(error.message || 'Autosave failed.');
		}
	}

	function recordHistory(setIds, label, coalescingKey, before, after) {
		var delta = Model.createStateDelta(before, after);
		if (Model.deltaEmpty(delta)) return;
		var transaction = {label: label, coalescingKey: coalescingKey || '', timestamp: Date.now(), delta: delta};
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

	function applyStatus(message, kind) {
		var globalStatus = document.querySelector('#sets-global-status');
		var localStatus = document.querySelector('#sets-status');
		var globalMessage = kind === 'error' ? 'Issue saving' : 'Saved successfully';
		if (globalStatus) globalStatus.textContent = globalMessage;
		if (localStatus) { localStatus.textContent = message; localStatus.dataset.kind = kind || ''; }
		var dot = document.querySelector('.creator-status-dot');
		if (dot) dot.dataset.kind = kind || '';
		var context = document.querySelector('.creator-app-context');
		if (context) context.dataset.kind = kind || '';
	}

	function setStatus(message, kind) {
		kind = kind === 'error' ? 'error' : 'saved';
		applyStatus(message, kind);
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
		var damagedCards = state.cards.filter(function(record) { return !record.cardData || !record.cardData.text || typeof record.cardData.text !== 'object' || Array.isArray(record.cardData.text); });
		if (damagedCards.length && initialBlankCardData && initialBlankCardData.text) {
			if (root.setConjurerDesktop) await root.setConjurerDesktop.storage.createPreUpdateSnapshot('repair-beta-card-layouts');
			damagedCards.forEach(function(record) {
				var current = record.cardData && typeof record.cardData === 'object' ? record.cardData : {};
				var repaired = Object.assign({}, clone(initialBlankCardData), current);
				repaired.text = clone(initialBlankCardData.text);
				if (!Array.isArray(current.frames) || !current.frames.length) repaired.frames = clone(initialBlankCardData.frames || []);
				record.cardData = repaired;
			});
			await persist(true);
		}
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
		return '<button type="button" role="tab" class="sets-tab' + (active ? ' selected' : '') + '" aria-selected="' + (active ? 'true' : 'false') + '" data-set-tab="' + key + '">' + label + '</button>';
	}

	function selectOptions(values, selected, labels) {
		return values.map(function(value) { return '<option value="' + escapeHtml(value) + '"' + (value === selected ? ' selected' : '') + '>' + escapeHtml(labels && labels[value] || value || 'Any') + '</option>'; }).join('');
	}

	var CARD_LIST_MANA_SYMBOLS = new Set(
		Array.from({length: 21}, function(_, index) { return String(index); }).concat([
			'w','u','b','r','g','c','x','y','z','s','t','e','a','p','h','inf','alchemy','purple',
			'wu','wb','ub','ur','br','bg','rg','rw','gw','gu',
			'2w','2u','2b','2r','2g','wp','up','bp','rp','gp',
			'wup','wbp','ubp','urp','brp','bgp','rgp','rwp','gwp','gup',
			'cw','cu','cb','cr','cg'
		])
	);

	function manaTokensForList(value) {
		var normalized = typeof FRAME_REGISTRY !== 'undefined' && typeof FRAME_REGISTRY.normalizeManaCost === 'function'
			? FRAME_REGISTRY.normalizeManaCost(value)
			: String(value || '').replace(/[{}]/g, ' ').trim();
		return normalized.split(/\s+/).map(function(token) { return token.toUpperCase(); }).filter(Boolean);
	}

	function cardListManaCosts(cardRecord) {
		var text = cardRecord.cardData && cardRecord.cardData.text || {};
		var costs = Object.keys(text).filter(function(key) {
			var textObject = text[key];
			return textObject && String(textObject.text || '').trim() && (textObject.manaCost || /^mana(?:cost)?\d*$/i.test(key));
		}).map(function(key) { return String(text[key].text || '').trim(); });
		if (!costs.length && cardRecord.derived.manaCost) costs.push(cardRecord.derived.manaCost);
		return costs.slice(0, 2);
	}

	function renderCardListManaCost(value) {
		var tokens = manaTokensForList(value);
		if (!tokens.length) return '<span class="sets-card-no-mana">No mana cost</span>';
		return '<span class="sets-card-mana" aria-label="Mana cost ' + escapeHtml(tokens.join(' ')) + '">' + tokens.map(function(token) {
			var assetKey = token.toLowerCase().replace(/\//g, '');
			if (!CARD_LIST_MANA_SYMBOLS.has(assetKey)) return '<span class="sets-card-mana-fallback">' + escapeHtml(token) + '</span>';
			return '<img src="/img/manaSymbols/' + assetKey + '.svg" alt="">';
		}).join('') + '</span>';
	}

	function renderCardListManaCosts(cardRecord) {
		var costs = cardListManaCosts(cardRecord);
		if (!costs.length) return '<span class="sets-card-no-mana">No mana cost</span>';
		return '<span class="sets-card-mana-costs">' + costs.map(renderCardListManaCost).join('<span class="sets-card-mana-separator" aria-hidden="true">//</span>') + '</span>';
	}

	function renderWorkspace() {
		var host = document.querySelector('#sets-workspace-content');
		var set = activeSet();
		if (!host || !set) return;
		if (!host.dataset.cardSelectionBound) {
			host.addEventListener('click', function(event) {
				var tab = event.target.closest('[data-set-tab]');
				if (tab && host.contains(tab)) { void selectTab(tab.dataset.setTab); return; }
				var action = event.target.closest('[data-set-action]');
				if (action && host.contains(action)) {
					var details = action.closest('details');
					if (details) details.removeAttribute('open');
					switch (action.dataset.setAction) {
						case 'export-set': void exportSetAction(); break;
						case 'download-set-images': void downloadSetImages(); break;
						case 'print-set': if (root.SetConjurerDesktop) root.SetConjurerDesktop.openPrint('set'); break;
						case 'duplicate-set': void duplicateSet(); break;
						case 'delete-set': void deleteSetAction(); break;
						case 'collapse-panel': toggleSetsPanel(true); break;
						case 'expand-panel': toggleSetsPanel(false); break;
						case 'confirm-transfer': void confirmMoveOrCopy(); break;
						case 'cancel-set-import': cancelSetImport(); break;
						case 'merge-set-import': void resolveSetImport('merge'); break;
						case 'replace-set-import': void resolveSetImport('replace'); break;
						case 'clear-card-search':
							var search = action.parentElement.querySelector('[data-card-search]');
							if (search) { search.value = ''; search.dispatchEvent(new Event('input', {bubbles:true})); search.focus(); }
							break;
						case 'cancel-zip': cancelZip(); break;
						case 'open-markdown-help':
							var markdownHelp = document.querySelector('#markdown-help-drawer');
							if (markdownHelp) markdownHelp.classList.add('opened');
							break;
						case 'move-collector-group': void moveGroup(Number(action.dataset.groupIndex), Number(action.dataset.groupDelta)); break;
						case 'retry-workspace': location.reload(); break;
					}
					return;
				}
				var loadSymbols = event.target.closest('[data-symbol-load-all]');
				if (loadSymbols && host.contains(loadSymbols)) { void loadSymbolsByCode(host.querySelector('[data-symbol-code]')); return; }
				var uploadSymbolButton = event.target.closest('[data-symbol-upload]');
				if (uploadSymbolButton && host.contains(uploadSymbolButton)) { uploadSymbolButton.closest('.sets-symbol-card').querySelector('[data-symbol-file]').click(); return; }
				var clearSymbolButton = event.target.closest('[data-symbol-clear]');
				if (clearSymbolButton && host.contains(clearSymbolButton)) { void clearSymbols(); return; }
				var button = event.target.closest('[data-card-id]');
				if (button && host.contains(button)) selectCard(button.dataset.cardId);
			});
			host.addEventListener('input', function(event) {
				if (event.target.matches('[data-symbol-code]')) event.target.value = Model.normalizeSymbolCode(event.target.value);
				else if (event.target.matches('[data-card-search]')) void updateListState('search', event.target.value);
				else if (event.target.matches('[data-set-field]')) previewSetField(event.target.dataset.setField, event.target);
				else if (event.target.matches('[data-set-text]')) {
					void updateSetText(event.target.dataset.setText, event.target.value);
					if (event.target.dataset.setText === 'story') previewStory(event.target.value);
				}
			});
			host.addEventListener('focusout', function(event) {
				if (event.target.matches('[data-set-field]')) void commitSetField(event.target.dataset.setField, event.target);
			});
			host.addEventListener('keydown', function(event) {
				if (event.key === 'Enter' && event.target.matches('[data-symbol-code]')) { event.preventDefault(); void loadSymbolsByCode(event.target); }
			});
			host.addEventListener('change', function(event) {
				if (event.target.matches('[data-symbol-source]')) void updateSymbol(event.target.dataset.symbolSource, event.target.value);
				else if (event.target.matches('[data-symbol-file]')) uploadSymbol(event.target.dataset.symbolFile, event);
				else if (event.target.matches('[data-card-import]')) void importCardFile(event);
				else if (event.target.matches('[data-set-import]')) void importSetFile(event);
				else if (event.target.matches('[data-copyright-note-style]')) void updateCopyrightNoteStyle(event.target.checked);
				else if (event.target.matches('[data-collector-style]')) void updateCollectorStyle(event.target.value);
				else if (event.target.matches('[data-card-detail]')) void updateCardDetail(event.target.dataset.cardDetail, event.target.value);
			});
			host.dataset.cardSelectionBound = 'true';
		}
		var topSwitcher = document.querySelector('#sets-switcher');
		if (topSwitcher) topSwitcher.innerHTML = state.sets.map(function(item) { return '<option value="' + item.id + '"' + (item.id === set.id ? ' selected' : '') + '>' + escapeHtml(item.name) + ' · ' + escapeHtml(item.code) + '</option>'; }).join('');
		host.setAttribute('aria-busy', 'false');
		var cardCount = cardsFor(set.id).length;
		var railCards = Model.selectCards(cardsFor(set.id), {sort:'collector', direction:'asc'});
		host.innerHTML = '<div class="sets-header">' +
			'<label class="sets-drawer-close" for="sets-drawer-toggle" role="button" tabindex="0" aria-label="Close sets drawer">×</label>' +
			'<div><span class="creator-eyebrow">' + cardCount + ' card' + (cardCount === 1 ? '' : 's') + ' in set</span></div>' +
			'<div class="sets-header-controls"><details class="creator-action-dropdown sets-options-dropdown"><summary class="input">Set Options <span class="card-specific-chevron" aria-hidden="true"></span></summary><div class="creator-action-dropdown-menu"><button type="button" data-set-action="export-set">Export Set</button><button type="button" data-set-action="download-set-images">Download Images</button><button type="button" data-set-action="print-set">Print Set</button><button type="button" data-set-action="duplicate-set">Duplicate Set</button><button type="button" class="danger" data-set-action="delete-set">Delete Set</button></div></details>' +
			'<button type="button" class="sets-panel-toggle sets-panel-collapse" data-set-action="collapse-panel" aria-label="Collapse set panel" title="Collapse set panel"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 4v16M18 7l-5 5 5 5"/></svg></button></div></div>' +
			'<div id="sets-error" class="sets-error" role="alert" hidden></div>' +
			'<div class="sets-tabs"><div class="segmented-tab-track sets-tab-track" role="tablist">' + tabButton('cards', 'Cards', set.activeTab === 'cards') + tabButton('details', 'Set Details', set.activeTab === 'details') + tabButton('symbol', 'Set Symbol', set.activeTab === 'symbol') + tabButton('collector', 'Collector', set.activeTab === 'collector') + '</div></div>' +
			'<div id="sets-tab-panel" class="sets-tab-panel" role="tabpanel"></div>' +
			'<input id="sets-card-import" type="file" accept=".cardconjurer-card,application/json" hidden data-card-import>' +
			'<input id="sets-set-import" type="file" accept=".cardconjurer-set,application/json" hidden data-set-import>' +
			'<dialog id="sets-transfer-dialog" class="sets-dialog"><form method="dialog"><div><span class="creator-eyebrow">Card action</span><h3 id="sets-transfer-title">Move card</h3></div><label>Destination set<select id="sets-transfer-target" class="input"></select></label><div class="sets-dialog-actions"><button value="cancel">Cancel</button><button id="sets-transfer-confirm" type="button" class="sets-confirm" data-set-action="confirm-transfer">Move card</button></div></form></dialog>' +
			'<dialog id="sets-import-dialog" class="sets-dialog"><form method="dialog"><div><span class="creator-eyebrow">Set import</span><h3>Matching set found</h3><p id="sets-import-message">Choose how to import this set.</p></div><div class="sets-dialog-actions"><button value="cancel" data-set-action="cancel-set-import">Cancel</button><button type="button" data-set-action="merge-set-import">Merge</button><button type="button" class="sets-confirm" data-set-action="replace-set-import">Replace</button></div></form></dialog>' +
			'<div class="sets-collapsed-rail"><button type="button" class="sets-panel-toggle sets-panel-expand" data-set-action="expand-panel" aria-label="Expand set panel" title="Expand set panel"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 4v16M11 7l5 5-5 5"/></svg></button><div class="sets-rail-cards" role="listbox" aria-label="Cards in ' + escapeHtml(set.name) + '">' + railCards.map(function(card) { var title = card.derived.title || 'Untitled Card'; var thumbnail = card.thumbnail ? '<img src="' + card.thumbnail + '" alt="">' : '<span class="sets-rail-placeholder" aria-hidden="true"></span>'; return '<button type="button" class="sets-rail-card' + (card.id === set.activeCardId ? ' selected' : '') + '" data-card-id="' + escapeHtml(card.id) + '" title="' + escapeHtml(card.collectorNumber + ' · ' + title) + '">' + thumbnail + '</button>'; }).join('') + '</div></div>';
		renderActiveTab();
		updateUndoButtons();
		updateCardEditorActions();
	}

	function renderActiveTab() {
		var set = activeSet();
		var panel = document.querySelector('#sets-tab-panel');
		if (!set || !panel) return;
		panel.classList.toggle('sets-cards-panel', set.activeTab === 'cards');
		if (set.activeTab === 'details') renderDetailsTab(panel, set);
		else if (set.activeTab === 'symbol') renderSymbolTab(panel, set);
		else if (set.activeTab === 'collector') renderCollectorTab(panel, set);
		else renderCardsTab(panel, set);
	}

	function renderCardsTab(panel, set) {
		var view = Object.assign({}, Model.DEFAULT_LIST_STATE, set.listState || {});
		panel.innerHTML = '<label class="sets-search"><span class="sr-only">Search cards</span><svg class="sets-search-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg><input type="search" class="input" value="' + escapeHtml(view.search) + '" placeholder="Search title, type, rules, artist…" data-card-search><button type="button" class="sets-search-clear" aria-label="Clear search" data-set-action="clear-card-search"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17"></path></svg></button></label>' +
			'<div class="sets-card-scroll">' +
			'<div id="sets-card-list" class="sets-card-list" role="listbox" aria-label="Cards in ' + escapeHtml(set.name) + '"></div></div>';
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
			var typeLine = card.derived.typeLine || 'No type line';
			var rarity = card.rarity === 'mythic' ? 'Mythic Rare' : card.rarity[0].toUpperCase() + card.rarity.slice(1);
			return '<button type="button" class="sets-card-row' + (card.id === selected ? ' selected' : '') + '" role="option" aria-selected="' + (card.id === selected ? 'true' : 'false') + '" data-card-id="' + escapeHtml(card.id) + '">' + thumbnail + '<span class="sets-card-row-copy"><strong>' + escapeHtml(title) + '</strong><span class="sets-card-type">' + escapeHtml(typeLine) + '</span><span class="sets-card-meta">' + renderCardListManaCosts(card) + '<span class="sets-card-meta-divider" aria-hidden="true">·</span><span class="sets-card-rarity">' + escapeHtml(rarity) + '</span></span></span><b>' + escapeHtml(card.collectorNumber) + '</b></button>';
		}).join('');
	}

	function updateSelectedCardRows(cardId) {
		document.querySelectorAll('[data-card-id]').forEach(function(row) {
			var selected = row.dataset.cardId === cardId;
			row.classList.toggle('selected', selected);
			if (row.getAttribute('role') === 'option') row.setAttribute('aria-selected', String(selected));
		});
	}

	function refreshCardListRow(cardId) {
		var record = state.cards.find(function(item) { return item.id === cardId; });
		var row = document.querySelector('#sets-card-list [data-card-id="' + cardId + '"]');
		if (!record || !row) return;
		var title = row.querySelector('.sets-card-row-copy > strong'); if (title) title.textContent = record.derived.title || 'Untitled Card';
		var typeLine = row.querySelector('.sets-card-type'); if (typeLine) typeLine.textContent = record.derived.typeLine || 'No type line';
		var mana = row.querySelector('.sets-card-meta');
		if (mana) mana.innerHTML = renderCardListManaCosts(record) + '<span class="sets-card-meta-divider" aria-hidden="true">·</span><span class="sets-card-rarity">' + escapeHtml(record.rarity === 'mythic' ? 'Mythic Rare' : record.rarity[0].toUpperCase() + record.rarity.slice(1)) + '</span>';
		var number = row.querySelector(':scope > b'); if (number) number.textContent = record.collectorNumber;
		refreshThumbnailElements(record);
	}

	function field(label, key, value, type, attrs) {
		var inputClass = type === 'date' ? 'input sets-date-input' : 'input';
		return '<label class="sets-field"><span>' + label + '</span><input class="' + inputClass + '" type="' + (type || 'text') + '" value="' + escapeHtml(value || '') + '" ' + (attrs || '') + ' data-set-field="' + key + '"></label>';
	}

	function renderDetailsTab(panel, set) {
		panel.innerHTML = '<div class="sets-form">' + field('Set name','name',set.name) + field('Short description','description',set.description) + field('Release date','releaseDate',set.releaseDate,'date') + field('Creator','creator',set.creator) +
			'<label class="sets-field"><span>Notes</span><textarea class="input" rows="3" data-set-text="notes">' + escapeHtml(set.notes) + '</textarea></label>' +
			'<div class="sets-field"><div class="sets-field-heading"><span>Story (Markdown)</span><button type="button" class="text-field-layout-button" aria-controls="markdown-help-drawer" data-set-action="open-markdown-help">Markdown Help</button></div><textarea id="sets-story" class="input" rows="9" data-set-text="story">' + escapeHtml(set.story) + '</textarea></div>' +
			'<section class="sets-markdown-preview" aria-label="Rendered story preview"><span class="creator-eyebrow">Preview</span><div id="sets-story-preview">' + safeMarkdown(set.story) + '</div></section></div>';
	}

	function renderSymbolTab(panel, set) {
		var labels = {common:'Common · tokens · basic lands', uncommon:'Uncommon', rare:'Rare', mythic:'Mythic Rare'};
		panel.innerHTML = '<section class="readable-background padding sets-symbol-loader"><div class="art-section-heading"><h4>Load by set code</h4></div><label><span class="sr-only">Symbol set code</span><input id="sets-symbol-code" class="input" type="text" maxlength="12" autocomplete="off" spellcheck="false" value="' + escapeHtml(set.symbolCode || set.code || '') + '" placeholder="Set code" data-symbol-code></label><button type="button" class="input sets-primary" data-symbol-load-all>Load all rarities</button></section>' +
			'<div class="sets-symbol-grid">' + Model.RARITIES.map(function(rarity) {
				var source = set.symbolSources[rarity] || '';
				return '<section class="sets-symbol-card"><div class="sets-symbol-preview">' + (source ? '<img src="' + escapeHtml(source) + '" alt="' + labels[rarity] + ' set symbol">' : '<span>—</span>') + '</div><label><strong>' + labels[rarity] + '</strong><input class="input" value="' + escapeHtml(source) + '" placeholder="Image URL" data-symbol-source="' + rarity + '"></label><button type="button" data-symbol-upload="' + rarity + '">Upload image</button><input type="file" accept="image/*" hidden data-symbol-file="' + rarity + '"></section>';
			}).join('') + '</div><div class="sets-symbol-actions"><button type="button" class="sets-symbol-clear" data-symbol-clear>Clear Symbols</button></div>';
	}

	function renderCollectorTab(panel, set) {
		panel.innerHTML = '<div class="sets-form sets-collector-form">' + field('Set code','code',set.code,'text','maxlength="3"') + field('Language','language',set.language,'text','maxlength="8"') +
			'<label class="sets-field"><span>Copyright</span><textarea class="input" rows="2" maxlength="160" data-set-text="copyright">' + escapeHtml(set.copyright) + '</textarea></label>' +
			'<label class="checkbox-container input workspace-checkbox frame-advanced-option sets-copyright-note-style"><span class="frame-advanced-option-copy"><strong>Match first copyright line to Note</strong><small>Use the Note font and size on every card in this set</small></span><input type="checkbox" ' + (set.copyrightFirstLineNoteStyle ? 'checked' : '') + ' data-copyright-note-style><span class="checkmark"></span></label>' +
			'<label class="sets-field"><span>Collector format</span><select class="input" data-collector-style>' + selectOptions(['post-one','pre-one'], set.collectorStyle, {'post-one':'Post-ONE · 0001','pre-one':'Pre-ONE · 001/' + String(collectorSlotCount(set.id)).padStart(3,'0')}) + '</select></label>' +
			'<section class="readable-background padding sets-collector-groups"><div class="art-section-heading"><h4>Collector Groups</h4></div><ol class="sets-group-list"><li><span>Main Set</span><small>Fixed</small></li>' + set.collectorGroupOrder.map(function(group, index) { return '<li><span>' + escapeHtml(group.replace(/(^|[-:])([a-z])/g, function(_, before, letter) { return (before ? ' ' : '') + letter.toUpperCase(); })) + '</span><span class="sets-group-actions"><button type="button" data-set-action="move-collector-group" data-group-index="' + index + '" data-group-delta="-1" aria-label="Move group up">↑</button><button type="button" data-set-action="move-collector-group" data-group-index="' + index + '" data-group-delta="1" aria-label="Move group down">↓</button></span></li>'; }).join('') + '</ol></section></div>';
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
			if (typeof waitForLoadedCardAssets === 'function') await waitForLoadedCardAssets();
			if (repairedSymbolPlacement && typeof resetSetSymbol === 'function') {
				resetSetSymbol();
				card.setSymbolPlacementKey = symbolSourceKey(hydrated.setSymbolSource);
				record.cardData = stripSetOwned(cardStorageSnapshot());
				record.updatedAt = new Date().toISOString();
			}
			if (typeof setBottomInfoStyle === 'function') { await setBottomInfoStyle(); await bottomInfoEdited(); }
			if (!zipRendering) renderCardDetailsSummary();
			var thumbnailChanged = zipRendering ? false : await updateThumbnail(record.id);
			if (repairedSymbolPlacement || thumbnailChanged) await persist();
		} finally { loadingCard = false; editorDirty = false; }
	}

	function renderCardDetailsSummary() {
		var record = activeCardRecord(); var set = activeSet(); var host = document.querySelector('#text-rarity-field');
		if (!record || !set || !host) return;
		host.innerHTML = '<div class="text-field-card-heading"><label>Rarity</label></div>' +
			'<select class="input text-field-input" data-card-detail="rarity" aria-label="Rarity">' + selectOptions(Model.RARITIES, record.rarity, {mythic:'Mythic Rare'}) + '</select>';
		['#info-number','#info-rarity','#info-set','#info-language','#info-year','#info-copyright','#enableNewCollectorStyle'].forEach(function(selector) { var input = document.querySelector(selector); if (input) input.disabled = true; });
	}

	function refreshThumbnailElements(record) {
		document.querySelectorAll('[data-card-id]').forEach(function(button) {
			if (button.dataset.cardId !== record.id) return;
			var visual = button.querySelector('img, .sets-thumbnail-placeholder, .sets-rail-placeholder');
			if (record.thumbnail) {
				var image = visual && visual.tagName === 'IMG' ? visual : document.createElement('img');
				image.src = record.thumbnail;
				image.alt = '';
				if (visual !== image) visual ? visual.replaceWith(image) : button.prepend(image);
			} else if (visual && visual.tagName === 'IMG') {
				var placeholder = document.createElement('span');
				placeholder.className = button.classList.contains('sets-rail-card') ? 'sets-rail-placeholder' : 'sets-thumbnail-placeholder';
				placeholder.setAttribute('aria-hidden', 'true');
				visual.replaceWith(placeholder);
			}
		});
	}

	async function updateThumbnail(cardId) {
		var record = state.cards.find(function(item) { return item.id === cardId; });
		var canvas = document.querySelector('#previewCanvas');
		if (!record || !canvas || !canvas.width) return false;
		try {
			var thumb = document.createElement('canvas'); thumb.width = 72; thumb.height = 101;
			thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);
			var nextThumbnail = thumb.toDataURL('image/webp', 0.72);
			var changed = record.thumbnail !== nextThumbnail || record.thumbnailDirty;
			record.thumbnail = nextThumbnail; record.thumbnailDirty = false;
			refreshThumbnailElements(record);
			return changed;
		} catch (error) { record.thumbnailDirty = true; return false; }
	}

	function queueRenderedThumbnailRefresh() {
		if (!initialized || loadingCard) return;
		var record = activeCardRecord();
		if (!record) return;
		record.thumbnailDirty = true;
		thumbnailRefreshCardId = record.id;
		clearTimeout(thumbnailRefreshTimer);
		thumbnailRefreshTimer = setTimeout(async function() {
			var cardId = thumbnailRefreshCardId;
			thumbnailRefreshCardId = null;
			var active = activeCardRecord();
			if (!cardId || loadingCard || !active || active.id !== cardId) return;
			if (await updateThumbnail(cardId)) await persist();
		}, 280);
	}

	async function captureActiveCard(label, coalescingKey) {
		if (!initialized || loadingCard || !editorDirty || typeof cardStorageSnapshot !== 'function') return;
		var record = activeCardRecord(); var set = activeSet(); if (!record || !set) return;
		editorDirty = false;
		var currentData = stripSetOwned(cardStorageSnapshot());
		if (Storage.ingestAssets) currentData = await Storage.ingestAssets(currentData);
		if (JSON.stringify(currentData) === JSON.stringify(record.cardData) && JSON.stringify(liveDraftUiSnapshot()) === JSON.stringify(record.uiState)) return;
		var beforeRecord = clone(record); var beforeSet = clone(set); var beforeFingerprint = Model.gameplayFingerprint(record);
		var beforeGroup = [record.printingCategory, record.frameGroupKey, record.variantKind, record.logicalCardId].join('|');
		var oldUi = record.uiState || {};
		record.cardData = currentData; record.uiState = liveDraftUiSnapshot(); record.updatedAt = new Date().toISOString(); record.thumbnailDirty = true;
		if (record.variantKind === 'art' && oldUi.activeFramePack && record.uiState.activeFramePack && oldUi.activeFramePack !== record.uiState.activeFramePack) {
			record.variantKind = null; record.logicalCardId = record.id; record.variantOrder = 0;
		}
		inferFrameClassification(record);
		var afterFingerprint = Model.gameplayFingerprint(record);
		var afterGroup = [record.printingCategory, record.frameGroupKey, record.variantKind, record.logicalCardId].join('|');
		var listOrderChanged = beforeFingerprint !== afterFingerprint || beforeGroup !== afterGroup;
		if (listOrderChanged) renumberSet(set.id);
		else {
			var derived = Model.deriveCard(record);
			record.derived = derived.derived; record.gameplayFingerprint = afterFingerprint;
		}
		var updatedRecord = state.cards.find(function(item) { return item.id === record.id; }) || record;
		if (listOrderChanged) {
			loadingCard = true;
			try { await syncActiveCollectorNumber(updatedRecord); }
			finally { loadingCard = false; }
		}
		var before = {sets: [beforeSet], cards: [beforeRecord], activeSetId: state.activeSetId};
		var after = {sets: [clone(set)], cards: [clone(updatedRecord)], activeSetId: state.activeSetId};
		recordHistory([set.id], label || 'Edit card', coalescingKey || 'card-edit', before, after);
		await updateThumbnail(record.id);
		if (listOrderChanged) renderCardList(); else refreshCardListRow(record.id);
		await persistMutation({sets:[set], cards:[updatedRecord], histories:{[set.id]:state.histories[set.id]}, deletedSetIds:[], deletedCardIds:[]}); updateUndoButtons(); renderCardDetailsSummary();
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

	function beginCardPreviewTransition() {
		var preview = document.querySelector('#previewCanvas');
		var transition = document.querySelector('#preview-transition-canvas');
		var well = preview && preview.closest('.creator-canvas-well');
		if (!preview || !transition || !well) return;
		clearTimeout(cardTransitionTimer);
		transition.width = preview.width;
		transition.height = preview.height;
		var context = transition.getContext('2d');
		context.clearRect(0, 0, transition.width, transition.height);
		context.drawImage(preview, 0, 0, transition.width, transition.height);
		well.classList.remove('is-card-ready');
		well.classList.add('is-card-switching');
		well.setAttribute('aria-busy', 'true');
	}

	function finishCardPreviewTransition() {
		var transition = document.querySelector('#preview-transition-canvas');
		var well = transition && transition.closest('.creator-canvas-well');
		if (!transition || !well) return Promise.resolve();
		return new Promise(function(resolve) {
			requestAnimationFrame(function() {
				requestAnimationFrame(function() {
					well.classList.add('is-card-ready');
					well.setAttribute('aria-busy', 'false');
					cardTransitionTimer = setTimeout(function() {
						well.classList.remove('is-card-switching', 'is-card-ready');
						transition.getContext('2d').clearRect(0, 0, transition.width, transition.height);
					}, 200);
					resolve();
				});
			});
		});
	}

	function waitForCardPreviewTransitionPaint() {
		return new Promise(function(resolve) {
			requestAnimationFrame(function() { setTimeout(resolve, 0); });
		});
	}

	async function runCardPreviewTransition(action) {
		beginCardPreviewTransition();
		try {
			await waitForCardPreviewTransitionPaint();
			return await action();
		} finally {
			await finishCardPreviewTransition();
		}
	}

	function selectCard(id) {
		var set = activeSet();
		if (!set || !state.cards.some(function(card) { return card.id === id && card.setId === set.id; }) || set.activeCardId === id) return Promise.resolve();
		pendingCardSelection = {setId: set.id, cardId: id};
		if (cardSelectionPromise) return cardSelectionPromise;
		beginCardPreviewTransition();
		cardSelectionPromise = (async function() {
			var loadedSelection = false;
			try {
				await waitForCardPreviewTransitionPaint();
				while (pendingCardSelection) {
					var selection = pendingCardSelection;
					pendingCardSelection = null;
					await captureActiveCard();
					var selectionSet = state.sets.find(function(item) { return item.id === selection.setId; });
					if (!selectionSet || state.activeSetId !== selection.setId || !state.cards.some(function(card) { return card.id === selection.cardId && card.setId === selection.setId; })) continue;
					selectionSet.activeCardId = selection.cardId;
					await persistMutation({sets:[selectionSet], cards:[], histories:{}, deletedSetIds:[], deletedCardIds:[], activeSetId:state.activeSetId});
					updateSelectedCardRows(selection.cardId);
					await loadActiveCard();
					loadedSelection = true;
				}
				if (loadedSelection) closeDrawer();
			} catch (error) {
				console.error('The selected card could not be opened.', error);
				showWorkspaceError(error.message || 'The selected card could not be opened.');
			} finally {
				await finishCardPreviewTransition();
				cardSelectionPromise = null;
				if (pendingCardSelection) selectCard(pendingCardSelection.cardId);
			}
		})();
		return cardSelectionPromise;
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

	async function duplicateSet() {
		await captureActiveCard();
		var source = activeSet(); if (!source) return;
		var sourceCards = cardsFor(source.id);
		await commit('Duplicate set', '', function() {
			var defaults = Model.createDefaultSet(state.sets);
			var copy = clone(source);
			var baseName = source.name + ' Copy';
			var copyName = baseName; var copyIndex = 2;
			while (state.sets.some(function(item) { return Model.normalizeText(item.name) === Model.normalizeText(copyName); })) copyName = baseName + ' ' + copyIndex++;
			copy.id = defaults.id; copy.name = copyName; copy.code = defaults.code; copy.createdAt = copy.updatedAt = new Date().toISOString();
			var idMap = {};
			sourceCards.forEach(function(card) { idMap[card.id] = Model.createId('card'); });
			var copiedCards = sourceCards.map(function(card) {
				var cardCopy = clone(card); var oldLogicalId = card.logicalCardId || card.id;
				cardCopy.id = idMap[card.id]; cardCopy.setId = copy.id; cardCopy.logicalCardId = idMap[oldLogicalId] || cardCopy.id; cardCopy.originId = null;
				cardCopy.createdAt = cardCopy.updatedAt = new Date().toISOString();
				return cardCopy;
			});
			copy.activeCardId = idMap[source.activeCardId] || (copiedCards[0] && copiedCards[0].id);
			state.sets.push(copy); state.cards.push.apply(state.cards, copiedCards); state.activeSetId = copy.id; state.histories[copy.id] = Model.createHistory();
		}, [source.id], {immediate: true});
		await loadActiveCard();
	}

	async function newCard() {
		return runCardPreviewTransition(async function() {
			await captureActiveCard(); var set = activeSet();
			await commit('Create card', '', function() {
				var newCardRecord = Model.createDefaultCard(set.id, stripSetOwned(initialBlankCardData || {}));
				newCardRecord.sortOrder = Math.max(0, ...cardsFor(set.id).map(function(item) { return Number(item.sortOrder || 0); })) + 1;
				state.cards.push(newCardRecord); set.activeCardId = newCardRecord.id;
			}, [set.id], {immediate: true});
			await loadActiveCard();
		});
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
		return runCardPreviewTransition(async function() {
			await captureActiveCard(); var set = activeSet(); var source = activeCardRecord(); if (!set || !source) return;
			await commit('Delete card', '', function() {
				var ordered = Model.selectCards(cardsFor(set.id), {sort:'collector',direction:'asc'}); var index = ordered.findIndex(function(item) { return item.id === source.id; });
				state.cards = state.cards.filter(function(item) { return item.id !== source.id; });
				var remaining = cardsFor(set.id);
				if (!remaining.length) {
					var blankCard = Model.createDefaultCard(set.id, stripSetOwned(initialBlankCardData || {})); state.cards.push(blankCard); set.activeCardId = blankCard.id;
				} else set.activeCardId = (remaining[Math.min(index, remaining.length - 1)] || remaining[0]).id;
			}, [set.id], {immediate: true}); await loadActiveCard();
		});
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
		var result = Model.undoHistory(ensureHistory(set.id), {sets:state.sets, cards:state.cards, activeSetId:state.activeSetId}); if (!result.state) return;
		state.histories[set.id] = result.history; restoreSnapshot(result.state); await persist(true); renderWorkspace(); await loadActiveCard(); setStatus('Undid ' + result.label, 'saved');
	}

	async function redo() {
		var set = activeSet(); if (!set) return;
		var result = Model.redoHistory(ensureHistory(set.id), {sets:state.sets, cards:state.cards, activeSetId:state.activeSetId}); if (!result.state) return;
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
		if (['releaseDate', 'code', 'language'].includes(key)) await loadActiveCard();
		var option = document.querySelector('#sets-switcher option[value="' + set.id + '"]'); if (option) option.textContent = set.name + ' · ' + set.code;
	}

	async function updateSetText(key, value) {
		var set = activeSet(); if (!set || set[key] === value) return;
		await commit('Edit set ' + key, 'set:' + key, function() { set[key] = value; }, [set.id], {render:false});
		if (key === 'copyright') await loadActiveCard();
	}

	async function updateCopyrightNoteStyle(enabled) {
		var set = activeSet(); if (!set || Boolean(set.copyrightFirstLineNoteStyle) === Boolean(enabled)) return;
		await commit('Change set copyright style', '', function() {
			set.copyrightFirstLineNoteStyle = Boolean(enabled);
			invalidateSetCardThumbnails(set);
		}, [set.id]);
		await loadActiveCard();
	}

	function previewStory(value) { var host = document.querySelector('#sets-story-preview'); if (host) host.innerHTML = safeMarkdown(value); }

	function invalidateSetCardThumbnails(set) {
		cardsFor(set.id).forEach(function(cardRecord) {
			cardRecord.thumbnailDirty = true;
		});
	}

	async function refreshActiveCardSymbol() {
		var set = activeSet(); var record = activeCardRecord();
		if (!set || !record || typeof uploadSetSymbol !== 'function') return;
		var symbolSource = symbolFor(set, record);
		var source = symbolSource || (typeof blank !== 'undefined' && blank.src) || '/img/blank.png';
		var repairedSymbolPlacement = Boolean(symbolSource) && symbolPlacementMissing(card, symbolSource);
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

	async function clearSymbols() {
		var set = activeSet();
		if (!set || (!set.symbolCode && !Model.RARITIES.some(function(rarity) { return Boolean(set.symbolSources[rarity]); }))) return;
		await commit('Clear set symbols', '', function() {
			set.symbolCode = '';
			set.symbolSources = {common:'', uncommon:'', rare:'', mythic:''};
			invalidateSetCardThumbnails(set);
		}, [set.id]);
		await refreshActiveCardSymbol();
		setStatus('Cleared set symbols', 'saved');
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
				await syncActiveCollectorNumber(state.cards.find(function(item) { return item.id === record.id; }) || record);
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

	async function downloadJson(value, filename) {
		if (root.setConjurerDesktop) {
			value = await Storage.materializeAssets(value);
			var extension = filename.endsWith('.cardconjurer-card') ? 'cardconjurer-card' : filename.endsWith('.cardconjurer-set') ? 'cardconjurer-set' : 'json';
			return root.setConjurerDesktop.files.saveExport({suggestedName: filename, extension: extension, content: JSON.stringify(value, null, 2)});
		}
		var link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type:'application/json'})); link.download = filename; document.body.appendChild(link); link.click(); setTimeout(function() { URL.revokeObjectURL(link.href); link.remove(); }, 0);
	}

	function safeFilename(value) { return String(value || 'Untitled').replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/[. ]+$/g, '').slice(0, 120) || 'Untitled'; }
	async function exportCardAction() { await captureActiveCard(); var record = activeCardRecord(), set = activeSet(); if (record && set) downloadJson(Files.createCardEnvelope(record, set), safeFilename(record.derived.title || 'Untitled Card') + '.cardconjurer-card'); }
	function exportCardImage(format) {
		if (typeof downloadCard !== 'function') return;
		if (format === 'jpeg') downloadCard(false, true);
		else downloadCard();
	}
	function exportSetAction() { var set = activeSet(); if (set) return downloadJson(Files.createSetEnvelope(set, cardsFor(set.id)), safeFilename(set.name) + '.cardconjurer-set'); }
	async function updatePrintQuantity(cardId, value) {
		var record = state.cards.find(function(item) { return item.id === cardId; });
		if (!record) return;
		record.printQuantity = root.SetConjurerPrint ? root.SetConjurerPrint.quantity(value) : Math.max(0, Math.min(99, Math.round(Number(value) || 0)));
		await persist(true);
	}

	async function importText(kind, text) {
		var file = new File([text], kind === 'card' ? 'import.cardconjurer-card' : 'import.cardconjurer-set', {type:'application/json'});
		var event = {target: {files: [file], value: ''}};
		return kind === 'card' ? importCardFile(event) : importSetFile(event);
	}

	function setCardSearchStatus(message, kind) {
		var status = document.querySelector('#card-search-status');
		if (!status) return;
		status.textContent = message;
		status.dataset.kind = kind || '';
		status.hidden = !message;
	}

	function openCardSearch(trigger) {
		var drawer = document.querySelector('#card-search-drawer');
		var query = document.querySelector('#card-search-query');
		var language = document.querySelector('#card-search-language');
		var set = activeSet();
		if (!drawer || !query) return;
		cardSearchReturnFocus = trigger || document.activeElement;
		scryfallSearchResults = [];
		query.value = '';
		if (language && set) {
			var setLanguage = String(set.language || 'en').toLowerCase();
			language.value = Array.from(language.options).some(function(option) { return option.value === setLanguage; }) ? setLanguage : 'en';
		}
		var results = document.querySelector('#card-search-results');
		var resultsLabel = document.querySelector('#card-search-results-label');
		var importButton = document.querySelector('#card-search-import');
		if (results) results.innerHTML = '';
		if (resultsLabel) resultsLabel.hidden = true;
		if (importButton) importButton.disabled = true;
		setCardSearchStatus('');
		drawer.classList.add('opened');
		drawer.setAttribute('aria-hidden', 'false');
		setTimeout(function() { query.focus(); }, 0);
	}

	function closeCardSearch(returnFocus) {
		var drawer = document.querySelector('#card-search-drawer');
		if (drawer) {
			drawer.classList.remove('opened');
			drawer.setAttribute('aria-hidden', 'true');
		}
		if (returnFocus !== false && cardSearchReturnFocus && cardSearchReturnFocus.isConnected) cardSearchReturnFocus.focus();
		cardSearchReturnFocus = null;
	}

	async function searchScryfallCards() {
		var queryInput = document.querySelector('#card-search-query');
		var languageInput = document.querySelector('#card-search-language');
		var results = document.querySelector('#card-search-results');
		var resultsLabel = document.querySelector('#card-search-results-label');
		var importButton = document.querySelector('#card-search-import');
		var searchButton = document.querySelector('#card-search-submit');
		var query = String(queryInput && queryInput.value || '').trim();
		if (!query) { setCardSearchStatus('Card name required.', 'error'); queryInput && queryInput.focus(); return; }
		if (searchButton) searchButton.disabled = true;
		if (importButton) importButton.disabled = true;
		if (resultsLabel) resultsLabel.hidden = true;
		setCardSearchStatus('Searching Scryfall…');
		try {
			var language = languageInput && languageInput.value || 'en';
			var params = new URLSearchParams({order:'released', include_extras:'true', q:'name=' + query + ' lang=' + language});
			params.set('unique', 'prints');
			var response = await fetch('https://api.scryfall.com/cards/search?' + params.toString());
			if (!response.ok) {
				if (response.status === 404) throw new Error('No cards found for “' + query + '”.');
				throw new Error('Scryfall search failed. Try again.');
			}
			var payload = await response.json();
			var processed = [];
			(payload.data || []).forEach(function(cardResult) {
				if (typeof processScryfallCard === 'function') processScryfallCard(cardResult, processed);
				else processed.push(cardResult);
			});
			scryfallSearchResults = processed.filter(function(cardResult) { return cardResult && cardResult.type_line && cardResult.type_line !== 'Card'; });
			results.innerHTML = '';
			scryfallSearchResults.forEach(function(cardResult, index) {
				var name = cardResult.printed_name || cardResult.name || 'Untitled Card';
				if (cardResult.flavor_name) name += ' (' + cardResult.flavor_name + ')';
				else if (cardResult.printed_name) name += ' (' + cardResult.name + ')';
				var detail = String(cardResult.set || '').toUpperCase() + ' #' + String(cardResult.collector_number || '');
				results.appendChild(new Option(name + ' (' + detail + ')', String(index)));
			});
			if (!scryfallSearchResults.length) throw new Error('No importable cards found for “' + query + '”.');
			results.value = '0';
			resultsLabel.hidden = false;
			importButton.disabled = false;
			setCardSearchStatus(scryfallSearchResults.length + ' result' + (scryfallSearchResults.length === 1 ? '' : 's') + ' found.');
		} catch (error) {
			scryfallSearchResults = [];
			if (results) results.innerHTML = '';
			if (resultsLabel) resultsLabel.hidden = true;
			setCardSearchStatus(error.message || 'Scryfall search failed. Try again.', 'error');
		} finally {
			if (searchButton) searchButton.disabled = false;
		}
	}

	async function importScryfallCard() {
		var results = document.querySelector('#card-search-results');
		var selected = results && scryfallSearchResults[Number(results.value)];
		var set = activeSet();
		if (!selected || !set || typeof changeCardIndex !== 'function') return;
		await captureActiveCard();
		var beforeImport = snapshot();
		closeCardSearch(false);
		try {
			var record = Model.createDefaultCard(set.id, stripSetOwned(initialBlankCardData || {}));
			record.sortOrder = Math.max(0, ...cardsFor(set.id).map(function(item) { return Number(item.sortOrder || 0); })) + 1;
			state.cards.push(record);
			set.activeCardId = record.id;
			renumberSet(set.id);
			await loadActiveCard();
			record = activeCardRecord();
			if (!record) throw new Error('The new card could not be created.');
			var importedRarity = String(selected.rarity || 'common').toLowerCase();
			if (!Model.RARITIES.includes(importedRarity)) importedRarity = importedRarity === 'special' || importedRarity === 'bonus' ? 'rare' : 'common';
			record.rarity = importedRarity;
			changeCardIndex(clone(selected), {preserveSetOwned:true, useExactArt:true});
			var hydrated = hydratedCardData(record, set);
			var fields = {
				'#info-number': hydrated.infoNumber,
				'#info-rarity': hydrated.infoRarity,
				'#info-set': hydrated.infoSet,
				'#info-language': hydrated.infoLanguage,
				'#info-year': hydrated.infoYear,
				'#info-copyright': hydrated.infoCopyright
			};
			Object.keys(fields).forEach(function(selector) { var input = document.querySelector(selector); if (input) input.value = fields[selector] || ''; });
			var symbolRarityInput = document.querySelector('#set-symbol-rarity');
			if (symbolRarityInput) symbolRarityInput.value = hydrated.infoRarity || 'C';
			if (typeof card !== 'undefined') {
				card.infoNumber = hydrated.infoNumber;
				card.infoRarity = hydrated.infoRarity;
				card.infoSet = hydrated.infoSet;
				card.infoLanguage = hydrated.infoLanguage;
				card.infoYear = hydrated.infoYear;
				card.infoCopyright = hydrated.infoCopyright;
			}
			if (hydrated.setSymbolSource && typeof uploadSetSymbol === 'function') {
				uploadSetSymbol(hydrated.setSymbolSource);
				if (typeof waitForRenderableImage === 'function' && typeof setSymbol !== 'undefined') await waitForRenderableImage(setSymbol);
				if (typeof setSymbolEdited === 'function') setSymbolEdited();
			}
			if (typeof bottomInfoEdited === 'function') await bottomInfoEdited();
			if (typeof waitForRenderableImage === 'function' && typeof art !== 'undefined') await waitForRenderableImage(art);
			await new Promise(function(resolve) { setTimeout(resolve, 750); });
			clearTimeout(captureTimer);
			editorDirty = false;
			record.cardData = stripSetOwned(cardStorageSnapshot());
			record.uiState = liveDraftUiSnapshot();
			record.updatedAt = new Date().toISOString();
			record.thumbnailDirty = true;
			inferFrameClassification(record);
			renumberSet(set.id);
			var afterImport = snapshot();
			if (!snapshotEqual(beforeImport, afterImport)) recordHistory([set.id], 'Import card from Scryfall', '', beforeImport, afterImport);
			await updateThumbnail(record.id);
			await persist(true);
			renderWorkspace();
			renderCardDetailsSummary();
			setStatus('Imported ' + (selected.printed_name || selected.name || 'card'), 'saved');
		} catch (error) {
			restoreSnapshot(beforeImport);
			renderWorkspace();
			await loadActiveCard();
			await persist(true);
			showWorkspaceError(error.message || 'The selected card could not be imported.');
		}
	}

	function readFile(event, callback) {
		var input = event.target; var file = input.files && input.files[0]; if (!file) return;
		var reader = new FileReader(); reader.onload = async function() { try { clearWorkspaceError(); await callback(reader.result); } catch (error) { showWorkspaceError(error.message); } finally { input.value = ''; } }; reader.onerror = function() { showWorkspaceError('The selected file could not be read.'); input.value = ''; }; reader.readAsText(file);
	}

	function importCardFile(event) {
		readFile(event, async function(text) {
			var requirements = Files.validateEnvelope(text, Files.CARD_FORMAT).requiredPacks;
			if (root.SetConjurerDesktop) await root.SetConjurerDesktop.ensureRequiredPacks(requirements);
			var set = activeSet(); var imported;
			await commit('Import card', '', function() { imported = Files.importCardInto(state.cards, text, set.id); state.cards = imported.cards; set.activeCardId = imported.card.id; }, [set.id], {immediate:true}); await loadActiveCard(); setStatus(imported.replaced ? 'Replaced matching card' : 'Imported card', 'saved');
		});
	}

	function importSetFile(event) {
		readFile(event, async function(text) {
			var parsed = Files.validateEnvelope(text, Files.SET_FORMAT); var importedSet = parsed.payload.set; var importedCards = parsed.payload.cards;
			if (root.SetConjurerDesktop) await root.SetConjurerDesktop.ensureRequiredPacks(parsed.requiredPacks);
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
		if (typeof loadScript === 'function') await loadScript('/node_modules/jszip/dist/jszip.min.js');
		for (var index = 0; index < 40 && !root.JSZip; index++) await new Promise(function(resolve) { setTimeout(resolve, 100); });
		if (!root.JSZip) throw new Error('ZIP support could not be loaded.'); return root.JSZip;
	}

	function ensureZipDialog() {
		var dialog = document.querySelector('#sets-zip-dialog');
		if (dialog) return dialog;
		document.body.insertAdjacentHTML('beforeend', '<dialog id="sets-zip-dialog" class="sets-dialog desktop-onboarding sets-zip-dialog" aria-labelledby="sets-zip-title"><form method="dialog"><header class="desktop-onboarding-header"><h2 id="sets-zip-title">Preparing card images</h2></header><div class="desktop-pack-progress desktop-onboarding-progress sets-zip-modal-progress" aria-live="polite"><span id="sets-zip-progress-label" class="desktop-pack-progress-label">Preparing image export…</span><span class="desktop-pack-progress-track" aria-hidden="true"><i></i></span></div><footer class="desktop-onboarding-footer sets-zip-footer"><button id="sets-zip-cancel" type="button" class="creator-app-action sets-zip-cancel">Cancel</button></footer></form></dialog>');
		dialog = document.querySelector('#sets-zip-dialog');
		dialog.querySelector('#sets-zip-cancel').addEventListener('click', cancelZip);
		dialog.addEventListener('cancel', function(event) { event.preventDefault(); cancelZip(); });
		return dialog;
	}

	function updateZipDialog(message, percent) {
		var dialog = ensureZipDialog();
		var label = dialog.querySelector('#sets-zip-progress-label');
		var fill = dialog.querySelector('.desktop-pack-progress-track i');
		if (label) label.textContent = message;
		if (fill) fill.style.width = clamp(Number(percent) || 0, 0, 100) + '%';
	}

	function openZipDialog() {
		var dialog = ensureZipDialog();
		var cancel = dialog.querySelector('#sets-zip-cancel');
		var workspace = document.querySelector('.creator-workspace');
		var workspaceBackground = workspace && getComputedStyle(workspace).getPropertyValue('--workspace-bg').trim();
		dialog.style.setProperty('--sets-zip-backdrop', workspaceBackground || '#0b0f16');
		if (cancel) { cancel.disabled = false; cancel.textContent = 'Cancel'; }
		updateZipDialog('Preparing image export…', 0);
		if (!dialog.open) dialog.showModal();
		return dialog;
	}

	function closeZipDialog() {
		var dialog = document.querySelector('#sets-zip-dialog');
		if (dialog && dialog.open) dialog.close();
	}

	async function canvasBlob(format) { return new Promise(function(resolve) { cardCanvas.toBlob(resolve, format === 'jpeg' ? 'image/jpeg' : 'image/png', format === 'jpeg' ? 0.92 : undefined); }); }

	async function streamZipToDesktop(zip, archiveId) {
		return new Promise(function(resolve, reject) {
			var settled = false; var chunks = []; var chunkBytes = 0; var latestPercent = 0; var batchBytes = 2 * 1024 * 1024;
			var stream = zip.generateInternalStream({type:'uint8array',streamFiles:true});
			function fail(error) { if (settled) return; settled = true; reject(error); }
			function flush() {
				if (!chunkBytes) return Promise.resolve();
				var batch = new Uint8Array(chunkBytes); var offset = 0;
				chunks.forEach(function(chunk) { batch.set(chunk, offset); offset += chunk.byteLength; });
				chunks = []; chunkBytes = 0;
				return root.setConjurerDesktop.files.appendArchive(archiveId, batch).then(function() { updateZipDialog('Building ZIP…', 90 + latestPercent / 10); });
			}
			stream.on('data', function(chunk, metadata) {
				if (zipCanceled) { fail(new Error('Image export canceled.')); return; }
				chunks.push(chunk); chunkBytes += chunk.byteLength; latestPercent = metadata.percent;
				if (chunkBytes < batchBytes) return;
				stream.pause(); flush().then(function() { if (!settled) stream.resume(); }, fail);
			});
			stream.on('error', fail);
			stream.on('end', function() { flush().then(function() { if (!settled) { settled = true; resolve(); } }, fail); });
			stream.resume();
		});
	}

	async function renderPrintImages(cardIds, onProgress) {
		await captureActiveCard();
		var set = activeSet();
		if (!set) return {};
		var originalCardId = set.activeCardId;
		var ids = Array.from(new Set(cardIds || [])).filter(function(id) { return state.cards.some(function(record) { return record.id === id && record.setId === set.id; }); });
		var images = {};
		try {
			for (var index = 0; index < ids.length; index++) {
				var record = state.cards.find(function(item) { return item.id === ids[index]; });
				set.activeCardId = record.id;
				if (typeof onProgress === 'function') onProgress({index: index, total: ids.length, card: clone(record)});
				await loadActiveCard();
				await new Promise(function(resolve) { requestAnimationFrame(function() { requestAnimationFrame(resolve); }); });
				var blob = await canvasBlob('png');
				if (!blob) throw new Error('The high-resolution print image for ' + (record.derived.title || 'Untitled Card') + ' could not be rendered.');
				images[record.id] = blob;
			}
			return images;
		} finally {
			set.activeCardId = originalCardId;
			renderWorkspace();
			await loadActiveCard();
		}
	}

	async function downloadSetImages() {
		openZipDialog(); var originalSetId = state.activeSetId; var set = activeSet(); var originalCardId = set && set.activeCardId; var previousPreviewSuppression = Boolean(root.cardConjurerSuppressPreviewRender); var workspaceRestored = false; var failureMessage = ''; var archiveId = ''; zipCanceled = false;
		async function restoreWorkspace() {
			if (workspaceRestored) return; workspaceRestored = true; zipRendering = true; root.cardConjurerSuppressPreviewRender = true;
			state.activeSetId=originalSetId; set=activeSet(); if(set) { set.activeCardId=originalCardId; renderWorkspace(); await loadActiveCard(); }
			await new Promise(function(resolve) { requestAnimationFrame(function() { requestAnimationFrame(resolve); }); });
			zipRendering = false; root.cardConjurerSuppressPreviewRender = previousPreviewSuppression;
		}
		try {
			await new Promise(function(resolve) { requestAnimationFrame(resolve); });
			await captureActiveCard(); set = activeSet(); if (!set) throw new Error('No set is available to export.');
			var ordered = Model.selectCards(cardsFor(set.id), {sort:'collector',direction:'asc'}); zipRendering = true; root.cardConjurerSuppressPreviewRender = true;
			var Zip = await ensureZip(); var zip = new Zip();
			var formatInput = document.querySelector('#download-format'); var formatValue = formatInput ? formatInput.value : 'png'; var format = formatValue === 'jpeg' ? 'jpeg' : 'png'; var used = new Set();
			for (var index = 0; index < ordered.length; index++) {
				if (zipCanceled) throw new Error('Image export canceled.'); var record = ordered[index]; set.activeCardId = record.id; updateZipDialog('Rendering ' + (index + 1) + ' of ' + ordered.length + ': ' + (record.derived.title || 'Untitled Card'), ordered.length ? (index / ordered.length) * 90 : 90); await loadActiveCard();
				var blob = await canvasBlob(format); var filename = safeFilename(record.collectorNumber.replace('/', '-') + ' ' + (record.derived.title || 'Untitled Card')) + '.' + (format === 'jpeg' ? 'jpg' : 'png'); var base=filename, suffix=2; while(used.has(filename)){filename=base.replace(/(\.[^.]+)$/,'-'+suffix+'$1');suffix++;} used.add(filename); zip.file(filename, blob);
			}
			updateZipDialog('Building ZIP…', 90); var desktopExport = Boolean(root.setConjurerDesktop); var zipName = safeFilename(set.name) + '-images.zip'; var content;
			if (desktopExport) {
				var archive = await root.setConjurerDesktop.files.beginArchive({suggestedName:zipName}); archiveId = archive.id;
				await streamZipToDesktop(zip, archiveId); if (zipCanceled) throw new Error('Image export canceled.');
				await root.setConjurerDesktop.files.completeArchive(archiveId);
				await restoreWorkspace(); closeZipDialog();
				var result = await root.setConjurerDesktop.files.saveArchive(archiveId); archiveId = '';
				if (result.canceled) { setStatus('Image export canceled','saved'); return; }
			} else {
				content = await zip.generateAsync({type:'blob'}, function(metadata) { if (zipCanceled) throw new Error('Image export canceled.'); updateZipDialog('Building ZIP…', 90 + metadata.percent / 10); });
				await restoreWorkspace(); closeZipDialog();
				var link=document.createElement('a'); link.href=URL.createObjectURL(content); link.download=zipName; document.body.appendChild(link); link.click(); setTimeout(function(){URL.revokeObjectURL(link.href);link.remove();},0);
			}
			setStatus('Downloaded ' + ordered.length + ' card images','saved');
		} catch (error) { if (!zipCanceled) failureMessage = error.message; else setStatus('Image export canceled','saved'); }
		finally { if (archiveId) { try { await root.setConjurerDesktop.files.cancelArchive(archiveId); } catch (cleanupError) { if (!failureMessage) failureMessage = cleanupError.message; } } await restoreWorkspace(); closeZipDialog(); if(failureMessage) { showWorkspaceError(failureMessage); setStatus('Image export failed','error'); } }
	}

	function cancelZip() { zipCanceled = true; var button = document.querySelector('#sets-zip-cancel'); if(button) { button.disabled = true; button.textContent = 'Canceling…'; } updateZipDialog('Canceling image export…', 0); }

	function openDrawer(trigger) { var drawer=document.querySelector('#sets-workspace'), toggle=document.querySelector('#sets-drawer-toggle'), button=document.querySelector('#sets-drawer-open'); drawerReturnFocus=trigger||document.activeElement; if(toggle)toggle.checked=true; if(drawer)drawer.classList.add('opened'); if(button)button.setAttribute('aria-expanded','true'); document.body.classList.add('sets-drawer-active'); setTimeout(function(){drawer&&drawer.querySelector('.sets-drawer-close')&&drawer.querySelector('.sets-drawer-close').focus();},0); }
	function closeDrawer() { var drawer=document.querySelector('#sets-workspace'), toggle=document.querySelector('#sets-drawer-toggle'), button=document.querySelector('#sets-drawer-open'); if(toggle)toggle.checked=false; if(drawer)drawer.classList.remove('opened'); if(button)button.setAttribute('aria-expanded','false'); document.body.classList.remove('sets-drawer-active'); if(drawerReturnFocus&&drawerReturnFocus.isConnected)drawerReturnFocus.focus(); }
	function toggleSetsPanel(expand) {
		var grid = document.querySelector('.creator-workspace .creator-grid'); if (!grid) return;
		var collapse = expand === false ? false : !workspaceLayout.collapsed;
		if (collapse && !workspaceLayout.leftWidth) workspaceLayout.leftWidth = document.querySelector('#sets-workspace')?.getBoundingClientRect().width || null;
		workspaceLayout.collapsed = collapse;
		applyWorkspaceLayout(); saveWorkspaceLayout();
		document.querySelectorAll('details.creator-action-dropdown[open]').forEach(function(dropdown) { dropdown.removeAttribute('open'); });
	}

	function resizeWorkspacePanel(side, startLeft, startRight, deltaX) {
		var grid = document.querySelector('.creator-workspace .creator-grid'); if (!grid) return;
		var total = grid.getBoundingClientRect().width;
		var minimumLeft = 208, minimumMiddle = 320, minimumRight = 304, separators = 2;
		if (side === 'left') {
			workspaceLayout.leftWidth = clamp(startLeft + deltaX, minimumLeft, Math.max(minimumLeft, total - startRight - minimumMiddle - separators));
		} else {
			workspaceLayout.rightWidth = clamp(startRight - deltaX, minimumRight, Math.max(minimumRight, total - startLeft - minimumMiddle - separators));
		}
		applyWorkspaceLayout();
	}

	function beginWorkspaceResize(event, side) {
		if (event.button !== 0 || window.innerWidth <= 880) return;
		if (workspaceLayout.collapsed && side === 'left') { workspaceLayout.collapsed = false; applyWorkspaceLayout(); }
		var grid = document.querySelector('.creator-workspace .creator-grid');
		var left = document.querySelector('#sets-workspace');
		var right = document.querySelector('.creator-workspace .creator-menu');
		if (!grid || !left || !right) return;
		event.preventDefault();
		var startX = event.clientX, startLeft = left.getBoundingClientRect().width, startRight = right.getBoundingClientRect().width;
		grid.classList.add('workspace-is-resizing'); document.body.classList.add('workspace-panel-resizing');
		function move(moveEvent) { resizeWorkspacePanel(side, startLeft, startRight, moveEvent.clientX - startX); }
		function finish() {
			document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', finish);
			grid.classList.remove('workspace-is-resizing'); document.body.classList.remove('workspace-panel-resizing'); saveWorkspaceLayout();
		}
		document.addEventListener('pointermove', move); document.addEventListener('pointerup', finish, {once:true});
	}

	function initializeWorkspaceResizers() {
		document.querySelectorAll('.workspace-resizer').forEach(function(handle) {
			var side = handle.classList.contains('workspace-resizer-left') ? 'left' : 'right';
			handle.addEventListener('pointerdown', function(event) { beginWorkspaceResize(event, side); });
			handle.addEventListener('keydown', function(event) {
				if (!['ArrowLeft','ArrowRight'].includes(event.key) || window.innerWidth <= 880) return;
				event.preventDefault();
				if (workspaceLayout.collapsed && side === 'left') { workspaceLayout.collapsed = false; applyWorkspaceLayout(); }
				var left = document.querySelector('#sets-workspace').getBoundingClientRect().width;
				var right = document.querySelector('.creator-workspace .creator-menu').getBoundingClientRect().width;
				var step = event.shiftKey ? 32 : 12;
				resizeWorkspacePanel(side, left, right, event.key === 'ArrowRight' ? step : -step); saveWorkspaceLayout();
			});
		});
		window.addEventListener('resize', applyWorkspaceLayout);
	}

	async function initialize() {
		if (initialized) return;
		try {
			if (root.SetConjurerDesktop && root.SetConjurerDesktop.ready) await root.SetConjurerDesktop.ready;
			loadWorkspaceLayout(); applyWorkspaceLayout(); initializeWorkspaceResizers();
			if (root.frameCatalogReadyPromise) await root.frameCatalogReadyPromise;
			initialBlankCardData = stripSetOwned(typeof cardStorageSnapshot === 'function' ? cardStorageSnapshot() : {});
			await bootstrap(); initialized = true; renderWorkspace(); applyWorkspaceLayout(); await loadActiveCard(); await revealWorkspace();
			window.addEventListener('cardconjurer:preview-rendered', queueRenderedThumbnailRefresh);
			document.querySelector('.creator-menu')?.addEventListener('input', function(event) { if (!event.target.closest('#text-rarity-field')) queueCapture(420); });
			document.querySelector('.creator-menu')?.addEventListener('change', function(event) {
				if (event.target.matches('[data-card-detail]')) void updateCardDetail(event.target.dataset.cardDetail, event.target.value);
				else if (!event.target.closest('#text-rarity-field')) queueCapture(0);
			});
			document.addEventListener('click', function(event) {
				var cardImportAction = event.target.closest('[data-card-import-action]');
				if (cardImportAction) {
					var importDropdown = cardImportAction.closest('details.creator-action-dropdown');
					if (importDropdown) importDropdown.removeAttribute('open');
					if (cardImportAction.dataset.cardImportAction === 'file') {
						var cardImportInput = document.querySelector('#sets-card-import');
						if (cardImportInput) cardImportInput.click();
					} else if (cardImportAction.dataset.cardImportAction === 'search') {
						openCardSearch(cardImportAction);
					}
					return;
				}
				document.querySelectorAll('details.creator-action-dropdown[open]').forEach(function(dropdown) {
					if (!dropdown.contains(event.target)) dropdown.removeAttribute('open');
				});
			});
			document.addEventListener('keydown', function(event) {
				if (event.key === 'Escape') {
					document.querySelectorAll('details.creator-action-dropdown[open]').forEach(function(dropdown) { dropdown.removeAttribute('open'); });
					closeCardSearch();
					closeDrawer();
				}
				if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.isComposing) { event.preventDefault(); event.shiftKey ? redo() : undo(); }
			});
			setStatus('Saved successfully','saved');
		} catch (error) {
			console.error(error); var host=document.querySelector('#sets-workspace-content'); if(host)host.innerHTML='<div class="creator-library-empty"><h3>Sets could not open</h3><p>'+escapeHtml(error.message)+'</p><button class="input" data-set-action="retry-workspace">Retry</button></div>'; setStatus('Issue saving','error'); await revealWorkspace();
		}
	}

	if (channel) channel.onmessage = async function(event) { if (!initialized || !event.data || event.data.revision <= state.revision) return; try { var loaded=await Storage.loadState(); state=Object.assign(state,loaded); numberAllSets(); renderWorkspace(); await loadActiveCard(); } catch(error){showWorkspaceError(error.message);} };

	root.CardConjurerSets = {
		initialize: initialize, captureActiveCard: captureActiveCard, queueCapture: queueCapture, resetActiveCard: resetActiveCard,
		automaticFrameSettled: automaticFrameSettled,
		selectSet: selectSet, selectTab: selectTab, selectCard: selectCard, newSet: newSet, duplicateSet: duplicateSet, newCard: newCard, duplicateCard: duplicateCard, addVariant: addVariant,
		deleteCard: deleteCardAction, deleteSet: deleteSetAction, undo: undo, redo: redo, updateListState: updateListState,
		previewSetField: previewSetField, commitSetField: commitSetField, updateSetText: updateSetText, updateCopyrightNoteStyle: updateCopyrightNoteStyle, previewStory: previewStory,
		updateSymbol: updateSymbol, uploadSymbol: uploadSymbol, loadSymbolsByCode: loadSymbolsByCode, clearSymbols: clearSymbols, updateCollectorStyle: updateCollectorStyle, moveGroup: moveGroup, updateCardDetail: updateCardDetail,
		moveOrCopy: moveOrCopy, confirmMoveOrCopy: confirmMoveOrCopy, exportCard: exportCardAction, exportCardImage: exportCardImage, exportSet: exportSetAction, updatePrintQuantity: updatePrintQuantity, importCardFile: importCardFile, importSetFile: importSetFile, importText: importText, resolveSetImport: resolveSetImport, cancelSetImport: cancelSetImport,
		openCardSearch: openCardSearch, closeCardSearch: closeCardSearch, searchScryfallCards: searchScryfallCards, importScryfallCard: importScryfallCard,
		downloadSetImages: downloadSetImages, renderPrintImages: renderPrintImages, cancelZip: cancelZip, openDrawer: openDrawer, closeDrawer: closeDrawer, toggleSetsPanel: toggleSetsPanel,
		getState: function() { return clone(state); }, safeMarkdown: safeMarkdown, deleteDatabaseForTests: Storage.deleteDatabaseForTests
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true}); else setTimeout(initialize, 0);
})(window);
