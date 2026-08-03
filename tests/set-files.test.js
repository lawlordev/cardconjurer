const test = require('node:test');
const assert = require('node:assert/strict');
const Model = require('../js/setModel.js');
const Files = require('../js/setFiles.js');

function fixture() {
	const set = Model.createDefaultSet([], '2026-01-01T00:00:00Z');
	const card = Model.createDefaultCard(set.id, {text: {title: {text: 'Portable Card'}}, artSource: 'data:image/png;base64,AAAA'});
	set.activeCardId = card.id;
	return {set, card};
}

test('card envelopes deduplicate uploaded images and preserve URL sources', () => {
	const {set, card} = fixture();
	card.cardData.watermarkSource = card.cardData.artSource;
	card.cardData.setSymbolSource = 'https://example.com/symbol.svg';
	const envelope = Files.createCardEnvelope(card, set);
	assert.equal(envelope.assets.length, 1);
	const parsed = Files.validateEnvelope(envelope, Files.CARD_FORMAT);
	assert.equal(parsed.payload.card.cardData.artSource, 'data:image/png;base64,AAAA');
	assert.equal(parsed.payload.card.cardData.setSymbolSource, 'https://example.com/symbol.svg');
});

test('rejects unknown versions, malformed envelopes and missing assets', () => {
	const {set, card} = fixture();
	const envelope = Files.createCardEnvelope(card, set);
	assert.throws(() => Files.validateEnvelope({...envelope, schemaVersion: 99}), /Unsupported file schema/);
	assert.throws(() => Files.validateEnvelope({format: 'wat', schemaVersion: 1, payload: {}}), /Unsupported Card Conjurer/);
	const broken = structuredClone(envelope);
	broken.assets = [];
	assert.throws(() => Files.validateEnvelope(broken), /missing uploaded asset/);
});

test('exports schema two metadata and remains compatible with schema one', () => {
	const {set, card} = fixture();
	const envelope = Files.createCardEnvelope(card, set);
	assert.equal(envelope.schemaVersion, 2);
	assert.equal(envelope.producer.name, 'Set Conjurer');
	const legacy = structuredClone(envelope);
	legacy.schemaVersion = 1;
	delete legacy.producer;
	delete legacy.requiredPacks;
	assert.equal(Files.validateEnvelope(legacy).schemaVersion, 1);
});

test('card import replaces matching gameplay/frame printing', () => {
	const {set, card} = fixture();
	const envelope = Files.createCardEnvelope({...card, id: 'foreign'}, set);
	const imported = Files.importCardInto([card], envelope, set.id);
	assert.equal(imported.replaced, true);
	assert.equal(imported.cards.length, 1);
	assert.equal(imported.cards[0].id, card.id);
});

test('set merge gives imported metadata/cards precedence and keeps local-only cards', () => {
	const {set, card} = fixture();
	const localOnly = Model.createDefaultCard(set.id, {text: {title: {text: 'Local Only'}}});
	const importedSet = {...set, name: 'Imported Name'};
	const importedCard = {...card, cardData: {...card.cardData, infoArtist: 'Imported Artist'}};
	const merged = Files.mergeSet(set, [card, localOnly], importedSet, [importedCard]);
	assert.equal(merged.set.name, 'Imported Name');
	assert.equal(merged.cards.length, 2);
	assert.equal(merged.cards.find(item => item.id === card.id).cardData.infoArtist, 'Imported Artist');
});
