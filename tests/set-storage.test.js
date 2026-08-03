const test = require('node:test');
const assert = require('node:assert/strict');
const Storage = require('../js/setStorage.js');

test('desktop storage normalizes missing or corrupted state to an empty workspace', () => {
	const empty = {sets: [], cards: [], histories: {}, activeSetId: null, revision: 0};
	assert.deepEqual(Storage.normalizeState(null), empty);
	assert.deepEqual(Storage.normalizeState(undefined), empty);
	assert.deepEqual(Storage.normalizeState([]), empty);
});

test('desktop storage preserves valid collections while repairing missing fields', () => {
	const set = {id: 'set-1'};
	assert.deepEqual(Storage.normalizeState({sets: [set], revision: '12'}), {
		sets: [set], cards: [], histories: {}, activeSetId: null, revision: 12
	});
});
