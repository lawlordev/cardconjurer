(function(root, factory) {
	var api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	if (root) root.CardConjurerSetModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
	'use strict';

	var SCHEMA_VERSION = 2;
	var RARITIES = ['common', 'uncommon', 'rare', 'mythic'];
	var SET_SYMBOL_RARITY_CODES = {common: 'c', uncommon: 'u', rare: 'r', mythic: 'm'};
	var SET_SYMBOL_ALIASES = {anb: 'ana', tsb: 'tsp', pmei: 'sld'};
	var COLORS = ['W', 'U', 'B', 'R', 'G'];
	var DEFAULT_GROUP_ORDER = ['tokens', 'borderless', 'special', 'booster-fun', 'custom'];
	var DEFAULT_LIST_STATE = {
		search: '', sort: 'collector', direction: 'asc',
		color: '', colorMode: 'includes', identity: '', identityMode: 'includes',
		rarity: '', cardType: ''
	};

	function clone(value) {
		if (value == null) return value;
		return JSON.parse(JSON.stringify(value));
	}

	function createId(prefix) {
		var random = typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID()
			: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
		return (prefix || 'id') + '-' + random;
	}

	function normalizeText(value) {
		return String(value == null ? '' : value)
			.replace(/\{[^}]*\}/g, ' ')
			.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
			.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
	}

	function titleFromData(data) {
		return data && data.text && data.text.title ? String(data.text.title.text || '') : String(data && data.title || '');
	}

	function textValue(data, candidates) {
		var text = data && data.text || {};
		for (var i = 0; i < candidates.length; i++) {
			var item = text[candidates[i]];
			if (item && item.text != null) return String(item.text);
		}
		return '';
	}

	function manaSymbols(value, allowBare) {
		var matches = String(value || '').toUpperCase().match(/\{([^}]+)\}/g) || [];
		if (matches.length) return matches.map(function(value) { return value.slice(1, -1); });
		return allowBare ? String(value || '').toUpperCase().trim().split(/\s+/).filter(Boolean) : [];
	}

	function colorsIn(value, allowBare) {
		var found = new Set();
		manaSymbols(value, allowBare).forEach(function(symbol) {
			COLORS.forEach(function(color) {
				if (symbol.split('/').includes(color)) found.add(color);
			});
		});
		return COLORS.filter(function(color) { return found.has(color); });
	}

	function colorIndicator(data) {
		var raw = data && (data.colorIndicator || data.color || data.colors) || '';
		var text = Array.isArray(raw) ? raw.join('') : String(raw);
		return COLORS.filter(function(color) { return text.toUpperCase().includes(color); });
	}

	function unionColors() {
		var found = new Set();
		Array.prototype.slice.call(arguments).flat().forEach(function(color) {
			if (COLORS.includes(color)) found.add(color);
		});
		return COLORS.filter(function(color) { return found.has(color); });
	}

	function manaValue(value) {
		return manaSymbols(value, true).reduce(function(total, symbol) {
			if (/^\d+$/.test(symbol)) return total + Number(symbol);
			if (/^[XYZ]$/.test(symbol)) return total;
			var choices = symbol.split('/');
			var numeric = choices.filter(function(part) { return /^\d+$/.test(part); }).map(Number);
			if (numeric.length) return total + Math.max.apply(Math, numeric);
			return total + 1;
		}, 0);
	}

	function deriveCard(card) {
		var data = card.cardData || {};
		var title = titleFromData(data);
		var typeLine = textValue(data, ['type', 'typeLine', 'typeline']);
		var rulesText = textValue(data, ['rules', 'rulesText', 'text']);
		var manaCost = textValue(data, ['mana', 'manaCost', 'cost']);
		var artist = String(data.infoArtist || data.artist || '');
		var actual = unionColors(colorsIn(manaCost, true), colorIndicator(data));
		var identity = unionColors(actual, colorsIn(rulesText, false));
		var normalizedType = normalizeText(typeLine);
		var cardTypes = [];
		['artifact', 'battle', 'creature', 'enchantment', 'instant', 'land', 'planeswalker', 'sorcery', 'tribal'].forEach(function(type) {
			if (new RegExp('(^|[^a-z])' + type + '([^a-z]|$)').test(normalizedType)) cardTypes.push(type);
		});
		return Object.assign({}, card, {
			derived: {
				title: title, normalizedTitle: normalizeText(title),
				typeLine: typeLine, normalizedType: normalizedType,
				rulesText: rulesText, normalizedRules: normalizeText(rulesText),
				artist: artist, normalizedArtist: normalizeText(artist),
				manaCost: manaCost, manaValue: manaValue(manaCost),
				actualColors: actual, colorIdentity: identity, cardTypes: cardTypes
			}
		});
	}

	function gameplayFingerprint(card) {
		var data = card.cardData || {};
		var keys = ['title', 'mana', 'manaCost', 'type', 'typeLine', 'rules', 'rulesText', 'power', 'toughness', 'loyalty', 'defense'];
		var values = keys.map(function(key) {
			return normalizeText(data.text && data.text[key] ? data.text[key].text : data[key]);
		});
		return values.join('|');
	}

	function nextUntitled(sets) {
		var usedNames = new Set((sets || []).map(function(set) { return normalizeText(set.name); }));
		var usedCodes = new Set((sets || []).map(function(set) { return String(set.code || '').toUpperCase(); }));
		var number = 1;
		while (usedNames.has(normalizeText(number === 1 ? 'Untitled Set' : 'Untitled Set ' + number)) || usedCodes.has('UT' + number)) number++;
		return {name: number === 1 ? 'Untitled Set' : 'Untitled Set ' + number, code: 'UT' + number};
	}

	function normalizeSetCode(value) {
		return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
	}

	function normalizeSymbolCode(value) {
		return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
	}

	function symbolSourcesForCode(value) {
		var requestedCode = normalizeSymbolCode(value);
		if (!requestedCode) return null;
		var assetCode = SET_SYMBOL_ALIASES[requestedCode] || requestedCode;
		var folder = 'official';
		var extension = assetCode === 'xxxx' ? 'png' : 'svg';
		var filenameCode = assetCode;
		if (['a22', 'a23', 'j22', 'hlw'].includes(assetCode)) {
			folder = 'custom';
			extension = 'png';
			if (assetCode === 'j22') filenameCode = 'J22';
		} else if (['cc', 'logan', 'joe'].includes(assetCode)) {
			folder = 'custom';
			extension = 'svg';
		}
		return RARITIES.reduce(function(sources, rarity) {
			sources[rarity] = '/img/setSymbols/' + folder + '/' + filenameCode + '-' + SET_SYMBOL_RARITY_CODES[rarity] + '.' + extension;
			return sources;
		}, {});
	}

	function validateSet(set, sets) {
		var errors = {};
		if (!String(set.name || '').trim()) errors.name = 'Enter a set name.';
		if (!/^[A-Z0-9]{3}$/.test(String(set.code || ''))) errors.code = 'Use exactly three letters or numbers.';
		(sets || []).forEach(function(other) {
			if (other.id === set.id) return;
			if (normalizeText(other.name) === normalizeText(set.name)) errors.name = 'Set names must be unique.';
			if (String(other.code || '').toUpperCase() === String(set.code || '').toUpperCase()) errors.code = 'Set codes must be unique.';
		});
		return errors;
	}

	function createDefaultSet(existingSets, now) {
		var date = now ? new Date(now) : new Date();
		var next = nextUntitled(existingSets || []);
		var timestamp = date.toISOString();
		return {
			id: createId('set'), name: next.name, description: '', releaseDate: '', creator: 'Card Conjurer User',
			notes: '', story: '', code: next.code, language: 'EN', copyright: '© ' + date.getUTCFullYear() + ' Custom Cards.', copyrightFirstLineNoteStyle: false,
			collectorStyle: 'post-one', symbolCode: '', symbolSources: {common: '', uncommon: '', rare: '', mythic: ''},
			collectorGroupOrder: DEFAULT_GROUP_ORDER.slice(), activeCardId: null, listState: clone(DEFAULT_LIST_STATE), activeTab: 'cards',
			createdAt: timestamp, updatedAt: timestamp
		};
	}

	function createDefaultCard(setId, cardData, now) {
		var timestamp = (now ? new Date(now) : new Date()).toISOString();
		var id = createId('card');
		var card = {
			id: id, setId: setId, cardData: clone(cardData || {}), uiState: {}, rarity: 'common', printingCategory: 'main',
			frameGroupKey: 'main', frameGroupLabel: 'Main Set', classificationOverride: false,
			logicalCardId: id, variantKind: null, variantOrder: 0, sortOrder: Date.now(), collectorNumber: '0001',
			gameplayFingerprint: '', backFace: null, thumbnail: '', thumbnailDirty: true, printQuantity: 1,
			createdAt: timestamp, updatedAt: timestamp
		};
		card = deriveCard(card);
		card.gameplayFingerprint = gameplayFingerprint(card);
		return card;
	}

	function printingGroup(card) {
		if (card.frameGroupKey === 'main' || card.printingCategory === 'main') return 'main';
		var category = card.printingCategory || 'special';
		var key = card.frameGroupKey || category;
		if (['token', 'tokens'].includes(category)) return 'tokens';
		if (category === 'borderless') return 'borderless';
		if (category === 'booster-fun') return key.indexOf('booster-fun') === 0 ? key : 'booster-fun:' + key;
		if (category === 'custom') return key.indexOf('custom') === 0 ? key : 'custom:' + key;
		return key === 'special' ? 'special' : (key.indexOf('special') === 0 ? key : 'special:' + key);
	}

	function collectorBucket(card) {
		var derived = card.derived || deriveCard(card).derived;
		var type = derived.normalizedType;
		if (/(^|\s)land(\s|$)/.test(type)) return /(^|\s)basic(\s|$)/.test(type) ? 9 : 8;
		var colors = derived.actualColors || [];
		if (colors.length > 1) return 6;
		if (colors.length === 1) return 1 + COLORS.indexOf(colors[0]);
		if (/(^|\s)artifact(\s|$)/.test(type)) return 7;
		return 0;
	}

	function groupRank(key, order) {
		if (key === 'main') return 0;
		var direct = order.indexOf(key);
		if (direct >= 0) return direct + 1;
		var root = key.split(':')[0];
		var parent = order.indexOf(root);
		return parent >= 0 ? parent + 1 + (key === root ? 0 : 0.001) : order.length + 10;
	}

	function compareEntry(a, b, set) {
		var group = groupRank(a.group, set.collectorGroupOrder || DEFAULT_GROUP_ORDER) - groupRank(b.group, set.collectorGroupOrder || DEFAULT_GROUP_ORDER);
		if (group) return group;
		if (a.group !== b.group) return a.group.localeCompare(b.group);
		var bucket = collectorBucket(a.cards[0]) - collectorBucket(b.cards[0]);
		if (bucket) return bucket;
		var title = (a.cards[0].derived.normalizedTitle || '').localeCompare(b.cards[0].derived.normalizedTitle || '');
		if (title) return title;
		return Number(a.cards[0].sortOrder || 0) - Number(b.cards[0].sortOrder || 0);
	}

	function suffixFor(index) {
		var result = '';
		var value = index;
		do {
			result = String.fromCharCode(97 + (value % 26)) + result;
			value = Math.floor(value / 26) - 1;
		} while (value >= 0);
		return result;
	}

	function padNumber(value, width) {
		var text = String(value);
		while (text.length < width) text = '0' + text;
		return text;
	}

	function numberCards(cards, set) {
		var prepared = (cards || []).map(function(card) {
			var next = deriveCard(clone(card));
			var currentFingerprint = gameplayFingerprint(next);
			if (next.variantKind && next.gameplayFingerprint && next.gameplayFingerprint !== currentFingerprint) {
				next.variantKind = null;
				next.logicalCardId = next.id;
				next.variantOrder = 0;
			}
			next.gameplayFingerprint = currentFingerprint;
			return next;
		});
		var artFamilies = new Set(prepared.filter(function(card) { return card.variantKind === 'art'; }).map(function(card) {
			return printingGroup(card) + '|' + card.logicalCardId;
		}));
		var families = new Map();
		prepared.forEach(function(card) {
			var group = printingGroup(card);
			var isArtFamily = card.variantKind === 'art' || (card.variantKind !== 'treatment' && artFamilies.has(group + '|' + card.logicalCardId));
			var key = isArtFamily ? group + '|art|' + card.logicalCardId : group + '|single|' + card.id;
			if (!families.has(key)) families.set(key, {group: group, cards: []});
			families.get(key).cards.push(card);
		});
		var entries = Array.from(families.values());
		entries.forEach(function(entry) {
			entry.cards.sort(function(a, b) { return Number(a.variantOrder || 0) - Number(b.variantOrder || 0) || Number(a.sortOrder || 0) - Number(b.sortOrder || 0); });
		});
		entries.sort(function(a, b) { return compareEntry(a, b, set); });
		// Art variants are separate printable cards, but their lettered numbers share
		// one numbered checklist slot. Pre-ONE denominators count those slots, not
		// the number of physical art records.
		var total = entries.length;
		entries.forEach(function(entry, index) {
			var base = padNumber(index + 1, set.collectorStyle === 'pre-one' ? 3 : 4);
			entry.cards.forEach(function(card, variantIndex) {
				var suffix = entry.cards.length > 1 ? suffixFor(variantIndex) : '';
				card.collectorNumber = base + suffix + (set.collectorStyle === 'pre-one' ? '/' + padNumber(total, 3) : '');
			});
		});
		return prepared;
	}

	function naturalCollectorCompare(a, b) {
		var parse = function(value) {
			var match = String(value || '').match(/^(\d+)([a-z]*)(?:\/(\d+))?/i) || [];
			return [Number(match[1] || 0), match[2] || '', Number(match[3] || 0)];
		};
		var left = parse(a), right = parse(b);
		return left[0] - right[0] || left[1].localeCompare(right[1]) || left[2] - right[2];
	}

	function matchesColor(colors, selected, mode) {
		if (!selected) return true;
		if (selected === 'C') return mode === 'only' ? colors.length === 0 : colors.length === 0;
		return mode === 'only' ? colors.length === 1 && colors[0] === selected : colors.includes(selected);
	}

	function selectCards(cards, listState) {
		var state = Object.assign({}, DEFAULT_LIST_STATE, listState || {});
		var query = normalizeText(state.search);
		var result = (cards || []).filter(function(raw) {
			var card = raw.derived ? raw : deriveCard(raw);
			var d = card.derived;
			var searchableTitle = d.normalizedTitle || normalizeText('Untitled Card');
			if (query && ![searchableTitle, d.normalizedType, d.normalizedRules, d.normalizedArtist].some(function(value) { return value.includes(query); })) return false;
			if (!matchesColor(d.actualColors, state.color, state.colorMode)) return false;
			if (!matchesColor(d.colorIdentity, state.identity, state.identityMode)) return false;
			if (state.rarity && card.rarity !== state.rarity) return false;
			if (state.cardType && !d.cardTypes.includes(String(state.cardType).toLowerCase())) return false;
			return true;
		}).slice();
		result.sort(function(a, b) {
			var comparison = 0;
			if (state.sort === 'alphabetical') comparison = a.derived.normalizedTitle.localeCompare(b.derived.normalizedTitle);
			else if (state.sort === 'mana-value') comparison = a.derived.manaValue - b.derived.manaValue || a.derived.normalizedTitle.localeCompare(b.derived.normalizedTitle);
			else comparison = naturalCollectorCompare(a.collectorNumber, b.collectorNumber);
			return state.direction === 'desc' ? -comparison : comparison;
		});
		return result;
	}

	function createHistory() { return {entries: [], cursor: 0}; }

	function valuesEqual(left, right) {
		return left === right || JSON.stringify(left) === JSON.stringify(right);
	}

	function entityDelta(before, after) {
		var left = new Map((before || []).map(function(value) { return [value.id, value]; }));
		var right = new Map((after || []).map(function(value) { return [value.id, value]; }));
		var ids = new Set(Array.from(left.keys()).concat(Array.from(right.keys())));
		var changes = [];
		ids.forEach(function(id) {
			var oldValue = left.get(id); var newValue = right.get(id);
			if (valuesEqual(oldValue, newValue)) return;
			changes.push({id: id, before: oldValue == null ? null : clone(oldValue), after: newValue == null ? null : clone(newValue)});
		});
		return changes;
	}

	function createStateDelta(before, after) {
		var delta = {
			kind: 'workspace-delta-v1',
			sets: entityDelta(before && before.sets, after && after.sets),
			cards: entityDelta(before && before.cards, after && after.cards)
		};
		var oldActive = before && before.activeSetId || null;
		var newActive = after && after.activeSetId || null;
		if (oldActive !== newActive) delta.activeSetId = {before: oldActive, after: newActive};
		return delta;
	}

	function deltaEmpty(delta) {
		return !delta || (!(delta.sets || []).length && !(delta.cards || []).length && !delta.activeSetId);
	}

	function applyEntityDelta(values, changes, side) {
		var result = (values || []).slice();
		var indexes = new Map(result.map(function(value, index) { return [value.id, index]; }));
		(changes || []).forEach(function(change) {
			var value = change[side]; var index = indexes.get(change.id);
			if (value == null) {
				if (index == null) return;
				result.splice(index, 1);
				indexes = new Map(result.map(function(item, itemIndex) { return [item.id, itemIndex]; }));
				return;
			}
			if (index == null) {
				indexes.set(change.id, result.length);
				result.push(clone(value));
			} else result[index] = clone(value);
		});
		return result;
	}

	function applyStateDelta(state, delta, side) {
		var direction = side === 'before' ? 'before' : 'after';
		return {
			sets: applyEntityDelta(state && state.sets, delta && delta.sets, direction),
			cards: applyEntityDelta(state && state.cards, delta && delta.cards, direction),
			activeSetId: delta && delta.activeSetId ? delta.activeSetId[direction] : state && state.activeSetId || null
		};
	}

	function mergeEntityDeltas(first, second) {
		var byId = new Map();
		(first || []).forEach(function(change) { byId.set(change.id, clone(change)); });
		(second || []).forEach(function(change) {
			var previous = byId.get(change.id);
			byId.set(change.id, {id: change.id, before: previous ? previous.before : clone(change.before), after: clone(change.after)});
		});
		return Array.from(byId.values()).filter(function(change) { return !valuesEqual(change.before, change.after); });
	}

	function mergeStateDeltas(first, second) {
		var result = {
			kind: 'workspace-delta-v1',
			sets: mergeEntityDeltas(first && first.sets, second && second.sets),
			cards: mergeEntityDeltas(first && first.cards, second && second.cards)
		};
		if (first && first.activeSetId || second && second.activeSetId) result.activeSetId = {
			before: first && first.activeSetId ? first.activeSetId.before : second.activeSetId.before,
			after: second && second.activeSetId ? second.activeSetId.after : first.activeSetId.after
		};
		if (result.activeSetId && result.activeSetId.before === result.activeSetId.after) delete result.activeSetId;
		return result;
	}

	function pushHistory(history, transaction, limit) {
		var current = history || createHistory();
		var next = {entries: current.entries.slice(0, current.cursor), cursor: current.cursor};
		var previous = next.entries[next.entries.length - 1];
		if (transaction.coalescingKey && previous && previous.coalescingKey === transaction.coalescingKey && transaction.timestamp - previous.timestamp < 1200) {
			var merged = Object.assign({}, previous, {timestamp: transaction.timestamp, label: transaction.label});
			if (previous.delta && transaction.delta) merged.delta = mergeStateDeltas(previous.delta, transaction.delta);
			else merged.after = clone(transaction.after);
			next.entries[next.entries.length - 1] = merged;
		} else next.entries.push(clone(transaction));
		var cap = limit || 40;
		if (next.entries.length > cap) next.entries.splice(0, next.entries.length - cap);
		next.cursor = next.entries.length;
		return next;
	}

	function undoHistory(history, currentState) {
		var current = history || createHistory();
		var next = {entries: current.entries.slice(), cursor: current.cursor};
		if (next.cursor <= 0) return {history: next, state: null, label: ''};
		var entry = next.entries[next.cursor - 1];
		next.cursor--;
		return {history: next, state: entry.delta && currentState ? applyStateDelta(currentState, entry.delta, 'before') : clone(entry.before), label: entry.label};
	}

	function redoHistory(history, currentState) {
		var current = history || createHistory();
		var next = {entries: current.entries.slice(), cursor: current.cursor};
		if (next.cursor >= next.entries.length) return {history: next, state: null, label: ''};
		var entry = next.entries[next.cursor];
		next.cursor++;
		return {history: next, state: entry.delta && currentState ? applyStateDelta(currentState, entry.delta, 'after') : clone(entry.after), label: entry.label};
	}

	return {
		SCHEMA_VERSION: SCHEMA_VERSION, RARITIES: RARITIES, COLORS: COLORS,
		DEFAULT_GROUP_ORDER: DEFAULT_GROUP_ORDER, DEFAULT_LIST_STATE: DEFAULT_LIST_STATE,
		clone: clone, createId: createId, normalizeText: normalizeText, normalizeSetCode: normalizeSetCode,
		normalizeSymbolCode: normalizeSymbolCode, symbolSourcesForCode: symbolSourcesForCode,
		validateSet: validateSet, nextUntitled: nextUntitled, createDefaultSet: createDefaultSet, createDefaultCard: createDefaultCard,
		deriveCard: deriveCard, gameplayFingerprint: gameplayFingerprint, manaValue: manaValue,
		printingGroup: printingGroup, collectorBucket: collectorBucket, suffixFor: suffixFor,
		numberCards: numberCards, naturalCollectorCompare: naturalCollectorCompare, selectCards: selectCards,
		createHistory: createHistory, createStateDelta: createStateDelta, deltaEmpty: deltaEmpty, applyStateDelta: applyStateDelta,
		pushHistory: pushHistory, undoHistory: undoHistory, redoHistory: redoHistory
	};
});
