const test = require('node:test');
const assert = require('node:assert/strict');
const Print = require('../../js/printModel.js');

test('clamps print quantities and expands copies', () => {
	assert.equal(Print.quantity(-2), 0);
	assert.equal(Print.quantity(120), 99);
	assert.equal(Print.expand([{id:'a', printQuantity:2}, {id:'b', printQuantity:0}]).length, 2);
});

test('imposes eight portrait cards per landscape page', () => {
	const cards = Array.from({length:9}, (_, index) => ({id:String(index), printQuantity:1}));
	const pages = Print.pages(cards);
	assert.equal(pages.length, 2);
	assert.equal(pages[0].length, 8);
	assert.equal(pages[1].length, 1);
	assert.deepEqual(Object.keys(Print.PAPERS), ['letter','a4']);
});

test('mirrors back columns without compacting a partial final row', () => {
	const cards = ['a','b','c','d','e'];
	assert.deepEqual(Print.backSlots(cards), ['d','c','b','a',null,null,null,'e']);
});

test('uses dedicated full-resolution print sources instead of list thumbnails', () => {
	assert.equal(Print.source({printSource:'blob:sharp-card', thumbnail:'data:image/webp;base64,tiny'}), 'blob:sharp-card');
	assert.equal(Print.source({thumbnail:'data:image/webp;base64,tiny'}), '');
});
