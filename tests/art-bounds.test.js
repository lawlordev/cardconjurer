const test = require('node:test');
const assert = require('node:assert/strict');
const ArtBounds = require('../js/artBounds.js');

const bounds = {x: 100, y: 200, width: 600, height: 400};

function placement(overrides = {}) {
	return Object.assign({
		x: 100,
		y: 100,
		zoom: 1,
		rotation: 0,
		imageWidth: 800,
		imageHeight: 600,
		bounds
	}, overrides);
}

test('clamps unrotated artwork at every art-bound edge', () => {
	const left = ArtBounds.constrainPlacement(placement({x: 500}));
	const right = ArtBounds.constrainPlacement(placement({x: -500}));
	const top = ArtBounds.constrainPlacement(placement({y: 500}));
	const bottom = ArtBounds.constrainPlacement(placement({y: -500}));
	assert.equal(left.x, 100);
	assert.equal(right.x, -100);
	assert.equal(top.y, 200);
	assert.equal(bottom.y, 0);
	[left, right, top, bottom].forEach(result => assert.equal(ArtBounds.coversBounds(placement(result)), true));
});

test('hard-stops a position-only movement without changing its other axis', () => {
	const result = ArtBounds.constrainMovement(placement({fromX: 0, fromY: 100, x: 500, y: 100}));
	assert.equal(result.x, 100);
	assert.equal(result.y, 100);
	assert.equal(ArtBounds.coversBounds(placement(result)), true);
	const reversed = ArtBounds.constrainMovement(placement({fromX: result.x, fromY: result.y, x: result.x - 10, y: result.y}));
	assert.equal(reversed.x, 90);
	assert.equal(reversed.y, 100);
});

test('slides along a fitted edge when the other axis has no spare room', () => {
	const result = ArtBounds.constrainMovement(placement({
		fromX: 0,
		fromY: 200,
		x: 50,
		y: 250,
		imageHeight: 400
	}));
	assert.equal(result.x, 50);
	assert.equal(result.y, 200);
	assert.equal(ArtBounds.coversBounds(placement(Object.assign({imageHeight: 400}, result))), true);
});

test('raises zoom to the smallest displayed value that covers the art bounds', () => {
	const result = ArtBounds.constrainPlacement(placement({x: 100, y: 200, zoom: 0.25}));
	assert.equal(result.zoom, 0.75);
	assert.equal(ArtBounds.coversBounds(placement(result)), true);
});

test('constrains rotated artwork using its real edges rather than its axis-aligned box', () => {
	const result = ArtBounds.constrainPlacement(placement({x: 600, y: 500, zoom: 1.4, rotation: 30}));
	assert.equal(ArtBounds.coversBounds(placement(Object.assign({}, result, {rotation: 30}))), true);
	assert.notEqual(result.x, 600);
	assert.notEqual(result.y, 500);
});

test('rotation increases minimum cover zoom when necessary', () => {
	const straight = ArtBounds.minimumZoom(placement({rotation: 0}));
	const rotated = ArtBounds.minimumZoom(placement({rotation: 45}));
	assert.equal(straight, 0.75);
	assert.ok(rotated > straight);
	const result = ArtBounds.constrainPlacement(placement({zoom: 0.75, rotation: 45}));
	assert.ok(result.zoom >= rotated);
	assert.equal(ArtBounds.coversBounds(placement(Object.assign({}, result, {rotation: 45}))), true);
});

test('zooms around the selected artwork point', () => {
	const result = ArtBounds.zoomAroundPoint({
		x: 20,
		y: 30,
		anchorX: 120,
		anchorY: 80,
		fromZoom: 1,
		toZoom: 2
	});
	assert.deepEqual(result, {x: -80, y: -20, zoom: 2});
	const sourcePointBefore = {
		x: (120 - 20) / 1,
		y: (80 - 30) / 1
	};
	const sourcePointAfter = {
		x: (120 - result.x) / result.zoom,
		y: (80 - result.y) / result.zoom
	};
	assert.deepEqual(sourcePointAfter, sourcePointBefore);
});
