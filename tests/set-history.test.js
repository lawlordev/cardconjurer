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

test('workspace deltas retain only changed entities and apply atomically', () => {
	const before = {
		sets: [{id: 'a', name: 'Alpha'}, {id: 'b', name: 'Beta'}],
		cards: [{id: 'one', setId: 'a', title: 'Before'}, {id: 'two', setId: 'a', art: 'set-conjurer://user-asset/' + 'a'.repeat(64) + '.png'}],
		activeSetId: 'a'
	};
	const after = {
		sets: before.sets,
		cards: [{id: 'one', setId: 'b', title: 'After'}, before.cards[1]],
		activeSetId: 'b'
	};
	const delta = Model.createStateDelta(before, after);
	assert.deepEqual(delta.sets, []);
	assert.equal(delta.cards.length, 1);
	assert.equal(JSON.stringify(delta).includes('user-asset'), false);
	assert.deepEqual(Model.applyStateDelta(after, delta, 'before'), before);
	assert.deepEqual(Model.applyStateDelta(before, delta, 'after'), after);
});

test('one thousand cards and forty edits keep history independent of workspace and art size', () => {
	const art = 'set-conjurer://user-asset/' + 'b'.repeat(64) + '.webp';
	const cards = Array.from({length: 1000}, (_, index) => ({id: `card-${index}`, setId: 'set', art, title: `Card ${index}`}));
	let history = Model.createHistory();
	for (let index = 0; index < 40; index++) {
		const before = {sets: [{id: 'set'}], cards, activeSetId: 'set'};
		const afterCards = cards.slice();
		afterCards[0] = {...cards[0], title: `Edit ${index}`};
		const delta = Model.createStateDelta(before, {...before, cards: afterCards});
		history = Model.pushHistory(history, {label: `Edit ${index}`, timestamp: index * 2000, delta});
	}
	const serialized = JSON.stringify(history);
	assert.equal(history.entries.length, 40);
	assert.ok(serialized.length < 25_000, `history should stay bounded, received ${serialized.length} bytes`);
	assert.equal(serialized.includes('card-999'), false);
	assert.equal(serialized.includes('data:image'), false);
});

test('coalesced deltas preserve the first before value and latest after value', () => {
	const original = {sets: [], cards: [{id: 'card', title: ''}], activeSetId: null};
	const first = {...original, cards: [{id: 'card', title: 'A'}]};
	const second = {...original, cards: [{id: 'card', title: 'AB'}]};
	let history = Model.createHistory();
	history = Model.pushHistory(history, {label: 'Edit', coalescingKey: 'card-edit', timestamp: 100, delta: Model.createStateDelta(original, first)});
	history = Model.pushHistory(history, {label: 'Edit', coalescingKey: 'card-edit', timestamp: 200, delta: Model.createStateDelta(first, second)});
	assert.equal(history.entries.length, 1);
	const undone = Model.undoHistory(history, second);
	assert.deepEqual(undone.state, original);
	assert.deepEqual(Model.redoHistory(undone.history, original).state, second);
});
