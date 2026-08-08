const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const Model = require('../js/setModel.js');
const Files = require('../js/setFiles.js');
const Print = require('../js/printModel.js');
const workspace = fs.readFileSync(path.join(__dirname, '../js/setWorkspace.js'), 'utf8');
const editor = fs.readFileSync(path.join(__dirname, '../creator/index.html'), 'utf8');
const desktop = fs.readFileSync(path.join(__dirname, '../js/desktopBridge.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../css/style-9.css'), 'utf8');

function frameRegistry() {
	const context = {window: {}};
	vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/frameRegistry.js'), 'utf8'), context);
	return context.window.FRAME_REGISTRY;
}

test('directional frame profiles expose complementary front and back defaults', () => {
	const registry = frameRegistry();
	assert.deepEqual({...registry.faceDefinition('M15TransformFront')}, {side:'front', counterpart:'M15TransformBackNew'});
	assert.deepEqual({...registry.faceDefinition('M15TransformBackNew')}, {side:'back', counterpart:'M15TransformFront'});
	assert.deepEqual({...registry.faceDefinition('ModalRegular')}, {side:'front', counterpart:'ModalRegularBack'});
	assert.equal(registry.faceDefinition('M15Regular-1'), null);
	assert.equal(registry.customizationRoot('M15TransformFront'), 'M15Regular-1');
	assert.equal(registry.customizationRoot('M15TransformBackNew'), 'M15Regular-1');
	assert.equal(registry.customizationRoot('TransformBorderlessBack'), 'M15Regular-1');
});

test('both directional faces restore their shared frame customization family', () => {
	assert.match(workspace, /function faceUiForProfile[\s\S]*FRAME_REGISTRY\.customizationRoot\(profile\)/);
	assert.match(workspace, /function normalizedDirectionalFaceUi[\s\S]*next\.activeFramePack = customizationRoot/);
});

test('double-sided cards remain one portable record with both face assets', () => {
	const set = Model.createDefaultSet([], '2026-01-01T00:00:00Z');
	const card = Model.createDefaultCard(set.id, {text:{title:{text:'Day'}}, artSource:'data:image/png;base64,FRONT'});
	card.backFace = {
		cardData:{text:{title:{text:'Night'}}, artSource:'data:image/png;base64,BACK'},
		uiState:{activeFramePack:'M15TransformBackNew'}
	};
	const envelope = Files.createCardEnvelope(card, set);
	assert.equal(envelope.payload.card.backFace.cardData.artSource.kind, 'asset');
	assert.equal(envelope.assets.length, 2);
	const parsed = Files.validateEnvelope(envelope, Files.CARD_FORMAT);
	assert.equal(parsed.payload.card.backFace.cardData.text.title.text, 'Night');
	assert.equal(parsed.payload.card.backFace.cardData.artSource, 'data:image/png;base64,BACK');
});

test('flip and side deletion use the established blurred preview transition', () => {
	assert.match(workspace, /async function flipCard\(\)[\s\S]*runCardPreviewTransition/);
	assert.match(workspace, /async function deleteSide\(\)[\s\S]*runCardPreviewTransition/);
	assert.match(workspace, /frameProfileSelected[\s\S]*Add reverse side/);
	assert.match(editor, /id='card-editor-flip'/);
	assert.match(editor, /Delete This Side/);
	assert.match(editor, /Delete Both Sides/);
	assert.match(styles, /button > span\[aria-hidden='true'\]/);
	assert.doesNotMatch(styles, /button > span,\s*\n\.creator-card-action-buttons/);
});

test('print backs prefer a rendered reverse face and otherwise retain the standard back', () => {
	assert.equal(Print.backSource({backFace:{printSource:'blob:reverse'}}, '/core/standard-card-back.png'), 'blob:reverse');
	assert.equal(Print.backSource({}, '/core/standard-card-back.png'), '/core/standard-card-back.png');
	assert.match(desktop, /images\[card\.id \+ ':back'\]/);
	assert.match(desktop, /Custom reverse face/);
});
