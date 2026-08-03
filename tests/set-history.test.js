const test = require('node:test');
const assert = require('node:assert/strict');
const Model = require('../js/setModel.js');

test('history coalesces typing, undoes, redoes and clears redo on a new action', () => {
	let history = Model.createHistory();
	history = Model.pushHistory(history, {label: 'Edit name', coalescingKey: 'name', timestamp: 100, before: {name: ''}, after: {name: 'A'}});
	history = Model.pushHistory(history, {label: 'Edit name', coalescingKey: 'name', timestamp: 200, before: {name: 'A'}, after: {name: 'AB'}});
	assert.equal(history.entries.length, 1);
	let undo = Model.undoHistory(history);
	assert.deepEqual(undo.state, {name: ''});
	let redo = Model.redoHistory(undo.history);
	assert.deepEqual(redo.state, {name: 'AB'});
	undo = Model.undoHistory(redo.history);
	history = Model.pushHistory(undo.history, {label: 'Other', timestamp: 5000, before: {name: ''}, after: {name: 'C'}});
	assert.equal(history.entries.length, 1);
	assert.equal(Model.redoHistory(history).state, null);
});

test('history retains only the latest forty complete actions across set snapshots', () => {
	let history = Model.createHistory();
	for (let index = 0; index < 45; index++) {
		history = Model.pushHistory(history, {label: 'Action ' + index, timestamp: index * 2000, before: {value: index}, after: {value: index + 1}});
	}
	assert.equal(history.entries.length, 40);
	assert.equal(history.entries[0].label, 'Action 5');
	assert.equal(history.cursor, 40);
});

test('a cross-set snapshot is restored atomically', () => {
	let history = Model.createHistory();
	const before = {sets: [{id: 'a'}, {id: 'b'}], cards: [{id: 'card', setId: 'a'}]};
	const after = {sets: [{id: 'a'}, {id: 'b'}], cards: [{id: 'card', setId: 'b'}]};
	history = Model.pushHistory(history, {label: 'Move card', timestamp: 1, before, after});
	assert.deepEqual(Model.undoHistory(history).state, before);
});
