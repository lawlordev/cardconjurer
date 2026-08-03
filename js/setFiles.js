(function(root, factory) {
	var model = root && root.CardConjurerSetModel;
	if (!model && typeof require === 'function') model = require('./setModel.js');
	var api = factory(model);
	if (typeof module === 'object' && module.exports) module.exports = api;
	if (root) root.CardConjurerSetFiles = api;
})(typeof window !== 'undefined' ? window : globalThis, function(Model) {
	'use strict';
	var CARD_FORMAT = 'card-conjurer-card';
	var SET_FORMAT = 'card-conjurer-set';

	function hash(value) {
		var result = 2166136261;
		for (var i = 0; i < value.length; i++) {
			result ^= value.charCodeAt(i);
			result = Math.imul(result, 16777619);
		}
		return (result >>> 0).toString(16).padStart(8, '0');
	}

	function extractAssets(value, assets) {
		if (typeof value === 'string' && /^data:image\//i.test(value)) {
			var id = 'asset-' + hash(value);
			if (!assets[id]) {
				var match = value.match(/^data:([^;,]+)[;,]/i);
				assets[id] = {id: id, mimeType: match ? match[1] : 'application/octet-stream', name: id, dataUrl: value};
			}
			return {kind: 'asset', assetId: id};
		}
		if (Array.isArray(value)) return value.map(function(item) { return extractAssets(item, assets); });
		if (value && typeof value === 'object') {
			var output = {};
			Object.keys(value).forEach(function(key) { output[key] = extractAssets(value[key], assets); });
			return output;
		}
		return value;
	}

	function hydrateAssets(value, assets) {
		if (value && value.kind === 'asset' && value.assetId && Object.keys(value).length === 2) {
			if (!assets[value.assetId]) throw new Error('The file refers to a missing uploaded asset: ' + value.assetId);
			return assets[value.assetId].dataUrl;
		}
		if (Array.isArray(value)) return value.map(function(item) { return hydrateAssets(item, assets); });
		if (value && typeof value === 'object') {
			var output = {};
			Object.keys(value).forEach(function(key) { output[key] = hydrateAssets(value[key], assets); });
			return output;
		}
		return value;
	}

	function envelope(format, payload) {
		var assets = {};
		return {
			format: format,
			schemaVersion: Model.SCHEMA_VERSION,
			exportedAt: new Date().toISOString(),
			payload: extractAssets(Model.clone(payload), assets),
			assets: Object.values(assets)
		};
	}

	function createCardEnvelope(card, set) {
		return envelope(CARD_FORMAT, {card: card, setContext: set});
	}

	function createSetEnvelope(set, cards) {
		return envelope(SET_FORMAT, {set: set, cards: cards});
	}

	function validateEnvelope(input, expectedFormat) {
		var value = typeof input === 'string' ? JSON.parse(input) : Model.clone(input);
		if (!value || typeof value !== 'object') throw new Error('This file does not contain a Card Conjurer export.');
		if (![CARD_FORMAT, SET_FORMAT].includes(value.format)) throw new Error('Unsupported Card Conjurer file type.');
		if (expectedFormat && value.format !== expectedFormat) throw new Error('Choose a ' + (expectedFormat === CARD_FORMAT ? 'card' : 'set') + ' file.');
		if (value.schemaVersion !== Model.SCHEMA_VERSION) throw new Error('Unsupported file schema version ' + value.schemaVersion + '.');
		if (!value.payload || typeof value.payload !== 'object') throw new Error('The export payload is missing.');
		var assets = {};
		(value.assets || []).forEach(function(asset) {
			if (!asset.id || assets[asset.id]) throw new Error('The file contains duplicate or invalid asset IDs.');
			if (!/^data:image\//i.test(asset.dataUrl || '')) throw new Error('An embedded asset is not a supported image.');
			assets[asset.id] = asset;
		});
		var payload = hydrateAssets(value.payload, assets);
		if (value.format === CARD_FORMAT && (!payload.card || !payload.setContext)) throw new Error('The card or its set context is missing.');
		if (value.format === SET_FORMAT && (!payload.set || !Array.isArray(payload.cards))) throw new Error('The set or card list is missing.');
		return {format: value.format, schemaVersion: value.schemaVersion, exportedAt: value.exportedAt, payload: payload};
	}

	function cardMatchKey(card) {
		return [card.originId || card.id || '', card.gameplayFingerprint || Model.gameplayFingerprint(card), card.frameGroupKey || '', card.variantKind || ''].join('|');
	}

	function importCardInto(cards, envelopeValue, activeSetId) {
		var parsed = validateEnvelope(envelopeValue, CARD_FORMAT);
		var imported = Model.deriveCard(Model.clone(parsed.payload.card));
		imported.setId = activeSetId;
		imported.gameplayFingerprint = Model.gameplayFingerprint(imported);
		var origin = imported.originId || imported.id;
		var index = cards.findIndex(function(local) {
			return (local.originId || local.id) === origin ||
				(Model.gameplayFingerprint(local) === imported.gameplayFingerprint && (local.frameGroupKey || '') === (imported.frameGroupKey || '') && (local.variantKind || '') === (imported.variantKind || ''));
		});
		var result = cards.map(Model.clone);
		if (index >= 0) {
			imported.id = result[index].id;
			imported.logicalCardId = result[index].logicalCardId === result[index].id ? imported.id : result[index].logicalCardId;
			result[index] = imported;
		} else {
			imported.originId = origin;
			imported.id = Model.createId('card');
			if (!imported.logicalCardId || imported.logicalCardId === parsed.payload.card.id) imported.logicalCardId = imported.id;
			result.push(imported);
		}
		return {cards: result, card: imported, replaced: index >= 0};
	}

	function mergeSet(localSet, localCards, importedSet, importedCards) {
		var set = Object.assign({}, Model.clone(localSet), Model.clone(importedSet), {id: localSet.id});
		var result = localCards.map(Model.clone);
		importedCards.forEach(function(raw) {
			var card = Model.clone(raw);
			var index = result.findIndex(function(local) {
				return (local.originId || local.id) === (card.originId || card.id) || cardMatchKey(local) === cardMatchKey(card);
			});
			card.setId = set.id;
			if (index >= 0) {
				card.id = result[index].id;
				result[index] = card;
			} else {
				card.originId = card.originId || card.id;
				card.id = Model.createId('card');
				card.logicalCardId = card.id;
				result.push(card);
			}
		});
		return {set: set, cards: result};
	}

	return {
		CARD_FORMAT: CARD_FORMAT, SET_FORMAT: SET_FORMAT,
		createCardEnvelope: createCardEnvelope, createSetEnvelope: createSetEnvelope,
		validateEnvelope: validateEnvelope, importCardInto: importCardInto, mergeSet: mergeSet,
		extractAssets: extractAssets, hydrateAssets: hydrateAssets
	};
});
