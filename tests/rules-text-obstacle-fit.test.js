const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const creator = fs.readFileSync(path.join(__dirname, '../js/creator-23.js'), 'utf8');

function functionSource(name) {
	const start = creator.indexOf(`function ${name}(`);
	assert.notEqual(start, -1, `${name} should exist`);
	const bodyStart = creator.indexOf('{', start);
	let depth = 0;
	for (let index = bodyStart; index < creator.length; index++) {
		if (creator[index] === '{') depth++;
		else if (creator[index] === '}' && --depth === 0) return creator.slice(start, index + 1);
	}
	throw new Error(`Could not extract ${name}`);
}

function createContext(card) {
	const context = {card};
	vm.createContext(context);
	vm.runInContext([
		functionSource('isRulesOrAbilityText'),
		functionSource('textCollisionObstacles'),
		functionSource('renderedLinesCollideWithObstacles'),
		functionSource('drawTextCollisionGuidelines'),
		functionSource('collisionAwareTextObject'),
	].join('\n'), context);
	return context;
}

test('rules and ability fields opt into obstacle-aware fitting', () => {
	const context = createContext({height: 1407, frames: [], text: {}});
	assert.equal(context.isRulesOrAbilityText('rules', {name: 'Rules Text'}), true);
	assert.equal(context.isRulesOrAbilityText('ability3', {name: 'Ability 4'}), true);
	assert.equal(context.isRulesOrAbilityText('flavor', {name: 'Flavor Text'}), false);
	assert.equal(context.isRulesOrAbilityText('rules', {name: 'Rules Text', oneLine: true}), false);
});

test('ordinary rules text keeps its full box so short lines can fit beside obstacles', () => {
	const context = createContext({
		height: 1407,
		version: 'M15Regular-1',
		frames: [
			{name: 'Gold Holo Stamp', bounds: {x: 0.43, y: 0.9, width: 0.14, height: 0.05}},
			{name: 'White Frame'},
		],
		text: {
			pt: {name: 'Power/Toughness', text: '1/2', x: 0.79, y: 0.902, width: 0.14, height: 0.037},
		},
	});
	const obstacles = context.textCollisionObstacles();
	assert.equal(obstacles.length, 2);
	const rules = {name: 'Rules Text', x: 0.08, y: 0.63, width: 0.84, height: 0.29};
	const fitted = context.collisionAwareTextObject('rules', rules, {});
	assert.equal(fitted.height, 0.29);
	assert.equal(fitted.avoidTextObstacles.length, 2);
	assert.equal(rules.height, 0.29);
	assert.equal(rules.avoidTextObstacles, undefined);
});

test('Planeswalker abilities keep their full box and use rendered-line collision fitting', () => {
	const context = createContext({
		height: 1407,
		version: 'planeswalkerTall',
		frames: [{name: 'Red Holo Stamp', bounds: {x: 0.43, y: 0.9, width: 0.14, height: 0.05}}],
		text: {},
	});
	const ability = {name: 'Ability 3', x: 0.18, y: 0.82, width: 0.7467, height: 0.1};
	const fitted = context.collisionAwareTextObject('ability2', ability, {});
	assert.equal(fitted.height, 0.1);
	assert.equal(fitted.avoidTextObstacles.length, 1);
	assert.equal(ability.avoidTextObstacles, undefined);
});

test('only rendered lines that overlap a no-text area trigger fitting', () => {
	const context = createContext({height: 1407, frames: [], text: {}});
	context.scaleX = value => value * 1000;
	context.scaleY = value => value * 1400;
	context.scaleWidth = value => value * 1000;
	context.scaleHeight = value => value * 1400;
	const obstacle = [{x: 0.7, y: 0.8, width: 0.2, height: 0.1}];
	assert.equal(context.renderedLinesCollideWithObstacles(
		[{x: 0, y: 0, width: 750, height: 50}],
		{x: 100, y: 1100},
		obstacle,
	), true);
	assert.equal(context.renderedLinesCollideWithObstacles(
		[{x: 0, y: 0, width: 500, height: 50}],
		{x: 100, y: 1100},
		obstacle,
	), false);
	assert.equal(context.renderedLinesCollideWithObstacles(
		[{x: 0, y: 0, width: 750, height: 50}],
		{x: 100, y: 1069},
		obstacle,
	), false);
});

test('hidden frames and empty stat fields do not reduce available text height', () => {
	const context = createContext({
		height: 1407,
		frames: [{name: 'Gray Holo Stamp', opacity: '0', bounds: {x: 0.43, y: 0.9, width: 0.14, height: 0.05}}],
		text: {loyalty: {name: 'Loyalty', text: '', x: 0.8, y: 0.9, width: 0.14, height: 0.04}},
	});
	assert.deepEqual(Array.from(context.textCollisionObstacles()), []);
});

test('a Battle defense shield remains a no-text area before a defense value is entered', () => {
	const context = createContext({
		height: 2010,
		version: 'battle',
		frames: [{name: 'Blue Frame'}],
		text: {
			defense: {name: 'Defense', text: '', x: 1920 / 2100, y: 1320 / 1500, width: 86 / 2100, height: 123 / 1500},
		},
	});
	assert.deepEqual({...context.textCollisionObstacles()[0]}, {
		x: 1920 / 2100 - 0.035,
		y: 1320 / 1500 - 0.025,
		width: 86 / 2100 + 0.07,
		height: 123 / 1500 + 0.05,
	});
});

test('guidelines draw the active no-text areas with the established red overlay', () => {
	const context = createContext({
		height: 1407,
		frames: [{name: 'Gold Holo Stamp', bounds: {x: 0.43, y: 0.9, width: 0.14, height: 0.05}}],
		text: {},
	});
	context.scaleX = value => value * 1000;
	context.scaleY = value => value * 1400;
	context.scaleWidth = value => value * 1000;
	context.scaleHeight = value => value * 1400;
	const calls = [];
	const drawingContext = {
		save() { calls.push(['save']); },
		restore() { calls.push(['restore']); },
		fillRect(...values) { calls.push(['fillRect', ...values]); },
	};
	context.drawTextCollisionGuidelines(drawingContext);
	assert.equal(drawingContext.globalAlpha, 0.25);
	assert.equal(drawingContext.fillStyle, 'red');
	assert.deepEqual(calls, [
		['save'],
		['fillRect', 430, 1260, 140, 70],
		['restore'],
	]);
	assert.match(functionSource('drawCard'), /drawTextCollisionGuidelines\(cardContext\)/);
});

test('both guideline controls describe placement and no-text areas', () => {
	const creatorHtml = fs.readFileSync(path.join(__dirname, '../creator/index.html'), 'utf8');
	assert.equal((creatorHtml.match(/Show placement and no-text areas/g) || []).length, 2);
});
