const test = require('node:test');
const assert = require('node:assert/strict');
const Model = require('../js/setModel.js');

function data(title, cost = '', type = '', rules = '', artist = '') {
	return {text: {title: {text: title}, mana: {text: cost}, type: {text: type}, rules: {text: rules}}, infoArtist: artist};
}

function card(set, title, cost, type, extra = {}) {
	return Object.assign(Model.createDefaultCard(set.id, data(title, cost, type), '2026-01-01T00:00:00Z'), extra);
}

test('allocates first and subsequent Untitled names and three-character codes', () => {
	const first = Model.createDefaultSet([], '2026-01-01T00:00:00Z');
	assert.equal(first.name, 'Untitled Set');
	assert.equal(first.code, 'UT1');
	assert.equal(first.creator, 'Card Conjurer User');
	assert.equal(first.copyright, '© 2026 Custom Cards.');
	assert.equal(first.copyrightFirstLineNoteStyle, false);
	const second = Model.createDefaultSet([first], '2026-01-01T00:00:00Z');
	assert.equal(second.name, 'Untitled Set 2');
	assert.equal(second.code, 'UT2');
});

test('normalizes and validates set codes and uniqueness', () => {
	assert.equal(Model.normalizeSetCode(' a-b12 '), 'AB1');
	const set = Model.createDefaultSet([], '2026-01-01T00:00:00Z');
	assert.deepEqual(Model.validateSet(set, [set]), {});
	const other = Object.assign({}, set, {id: 'other', name: 'Other', code: 'AA'});
	assert.equal(Model.validateSet(other, [set]).code, 'Use exactly three letters or numbers.');
});

test('builds all four set-symbol sources from one code', () => {
	assert.equal(Model.normalizeSymbolCode(' LE-A! '), 'lea');
	assert.deepEqual(Model.symbolSourcesForCode('lea'), {
		common: '/img/setSymbols/official/lea-c.svg',
		uncommon: '/img/setSymbols/official/lea-u.svg',
		rare: '/img/setSymbols/official/lea-r.svg',
		mythic: '/img/setSymbols/official/lea-m.svg'
	});
	assert.equal(Model.symbolSourcesForCode('anb').rare, '/img/setSymbols/official/ana-r.svg');
	assert.equal(Model.symbolSourcesForCode('j22').mythic, '/img/setSymbols/custom/J22-m.png');
	assert.equal(Model.symbolSourcesForCode(''), null);
});

test('orders the standard collector buckets and formats Post-ONE numbers', () => {
	const set = Model.createDefaultSet([], '2026-01-01T00:00:00Z');
	const cards = [
		card(set, 'Plains', '', 'Basic Land — Plains'),
		card(set, 'Island Home', '', 'Land'),
		card(set, 'Mox', '', 'Artifact'),
		card(set, 'Gold', '{W}{U}', 'Creature'),
		card(set, 'Green', '{G}', 'Creature'),
		card(set, 'Red', '{R}', 'Instant'),
		card(set, 'Black', '{B}', 'Sorcery'),
		card(set, 'Blue', '{U}', 'Creature'),
		card(set, 'White', '{W}', 'Creature'),
		card(set, 'Void', '', 'Creature')
	];
	const numbered = Model.numberCards(cards, set).sort((a, b) => Model.naturalCollectorCompare(a.collectorNumber, b.collectorNumber));
	assert.deepEqual(numbered.map(item => item.derived.title), ['Void', 'White', 'Blue', 'Black', 'Red', 'Green', 'Gold', 'Mox', 'Island Home', 'Plains']);
	assert.equal(numbered[0].collectorNumber, '0001');
	assert.equal(numbered[9].collectorNumber, '0010');
});

test('counts lettered art families once in Pre-ONE and supports suffixes beyond z', () => {
	const set = Model.createDefaultSet([], '2026-01-01T00:00:00Z');
	set.collectorStyle = 'pre-one';
	const original = card(set, 'Many Arts', '{1}', 'Creature');
	const cards = Array.from({length: 28}, (_, index) => Object.assign({}, original, {
		id: 'art-' + index, logicalCardId: original.id, variantKind: index ? 'art' : null, variantOrder: index, sortOrder: index
	}));
	const numbered = Model.numberCards(cards, set).sort((a, b) => a.variantOrder - b.variantOrder);
	assert.equal(numbered[0].collectorNumber, '001a/001');
	assert.equal(numbered[25].collectorNumber, '001z/001');
	assert.equal(numbered[26].collectorNumber, '001aa/001');
	assert.equal(numbered[27].collectorNumber, '001ab/001');
});

test('uses the final collector slot as the Pre-ONE denominator after art variants', () => {
	const set = Model.createDefaultSet([], '2026-01-01T00:00:00Z');
	set.collectorStyle = 'pre-one';
	const first = card(set, 'First', '{W}', 'Creature', {sortOrder: 1});
	const second = card(set, 'Second', '{U}', 'Creature', {sortOrder: 2});
	const secondArt = {...second, id:'second-art', logicalCardId:second.id, variantKind:'art', variantOrder:1, sortOrder:3};
	const third = card(set, 'Third', '{B}', 'Creature', {sortOrder: 4});
	const numbered = Model.numberCards([first, second, secondArt, third], set);
	assert.deepEqual(numbered.map(item => item.collectorNumber).sort(Model.naturalCollectorCompare), ['001/003', '002a/003', '002b/003', '003/003']);
});

test('treatment variants receive independent numbers and DFC records count once', () => {
	const set = Model.createDefaultSet([], '2026-01-01T00:00:00Z');
	const original = card(set, 'Transform Me', '{1}{U}', 'Creature', {backFace: {title: 'Back'}});
	const treatment = Object.assign({}, original, {id: 'treatment', logicalCardId: original.id, variantKind: 'treatment', printingCategory: 'borderless', frameGroupKey: 'borderless'});
	const numbered = Model.numberCards([original, treatment], set);
	assert.equal(new Set(numbered.map(item => item.collectorNumber)).size, 2);
});

test('treatment variants never join a same-identity art suffix family', () => {
	const set = Model.createDefaultSet([], '2026-01-01T00:00:00Z');
	const original = card(set, 'Variant Family', '{U}', 'Creature');
	const art = {...original, id:'art', logicalCardId:original.id, variantKind:'art', variantOrder:1};
	const treatment = {...original, id:'treatment', logicalCardId:original.id, variantKind:'treatment', variantOrder:2};
	const numbered = Model.numberCards([original, art, treatment], set);
	assert.deepEqual(numbered.map(item => item.collectorNumber).sort(), ['0001a','0001b','0002']);
});

test('derives actual color, broader identity, mana value, search and filters', () => {
	const set = Model.createDefaultSet([], '2026-01-01T00:00:00Z');
	const hybrid = Model.createDefaultCard(set.id, data('Hybrid Sage', '{2/W}{U/P}{X}', 'Artifact Creature', 'Add {B}.', 'A. Artist'));
	const derived = Model.deriveCard(hybrid);
	assert.deepEqual(derived.derived.actualColors, ['W', 'U']);
	assert.deepEqual(derived.derived.colorIdentity, ['W', 'U', 'B']);
	assert.equal(derived.derived.manaValue, 3);
	derived.collectorNumber = '0001';
	assert.equal(Model.selectCards([derived], {search: 'artist'}).length, 1);
	assert.equal(Model.selectCards([derived], {color: 'W', colorMode: 'includes'}).length, 1);
	assert.equal(Model.selectCards([derived], {color: 'W', colorMode: 'only'}).length, 0);
	assert.equal(Model.selectCards([derived], {identity: 'B', identityMode: 'includes'}).length, 1);
	assert.equal(Model.selectCards([derived], {cardType: 'artifact'}).length, 1);
});

test('derives colors and mana value from the editor’s normalized bare mana tokens', () => {
	const set = Model.createDefaultSet([], '2026-01-01T00:00:00Z');
	const normalized = Model.deriveCard(Model.createDefaultCard(set.id, data('Normalized', '2 U R', 'Instant')));
	assert.deepEqual(normalized.derived.actualColors, ['U', 'R']);
	assert.equal(normalized.derived.manaValue, 4);
});

test('gameplay divergence unlinks a linked variant during renumbering', () => {
	const set = Model.createDefaultSet([], '2026-01-01T00:00:00Z');
	const original = card(set, 'Original', '{W}', 'Creature');
	const variant = Object.assign({}, original, {id: 'variant', logicalCardId: original.id, variantKind: 'art', variantOrder: 1});
	variant.gameplayFingerprint = Model.gameplayFingerprint(variant);
	variant.cardData = data('Changed', '{W}', 'Creature');
	const result = Model.numberCards([original, variant], set).find(item => item.id === 'variant');
	assert.equal(result.variantKind, null);
	assert.equal(result.logicalCardId, 'variant');
});
