const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadFrameRegistry() {
	const source = fs.readFileSync(path.join(__dirname, '../js/frameRegistry.js'), 'utf8');
	const context = vm.createContext({window: {}});
	vm.runInContext(source, context);
	return context.window.FRAME_REGISTRY;
}

function functionSource(source, name) {
	const start = source.indexOf(`function ${name}(`);
	assert.notEqual(start, -1, `${name} should exist`);
	const bodyStart = source.indexOf('{', start);
	let depth = 0;
	for (let index = bodyStart; index < source.length; index++) {
		if (source[index] === '{') depth++;
		else if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
	}
	throw new Error(`Could not extract ${name}`);
}

test('tall planeswalker profiles use planeswalker holo stamps', () => {
	const registry = loadFrameRegistry();
	const expectedBounds = {x: 0.4394, y: 0.9015, width: 0.1214, height: 0.051};

	for (const profile of ['PlaneswalkerTall', 'PlaneswalkerTallBorderless']) {
		const stamp = registry.stampFor(profile, 'Multicolored');
		assert.equal(stamp.name, 'Multicolored Holo Stamp');
		assert.equal(stamp.src, '/img/frames/planeswalker/holo/m.png');
		assert.deepEqual({...stamp.bounds}, expectedBounds);
	}
});

test('modern directional faces inherit an appropriate default holo stamp', () => {
	const registry = loadFrameRegistry();
	const standardBounds = {x:0.436, y:0.9034, width:0.128, height:0.0458};
	const standardProfiles = [
		'M15TransformFront','M15TransformBackNew','TransformBorderlessBack',
		'ModalRegular','ModalRegularBack'
	];
	for (const profile of standardProfiles) {
		const stamp = registry.stampFor(profile, 'Black');
		assert.equal(stamp.name, 'Black Holo Stamp', profile);
		assert.equal(stamp.src, '/img/frames/m15/holoStamps/m15HoloStampB.png', profile);
		assert.deepEqual({...stamp.bounds}, standardBounds, profile);
	}
	assert.equal(registry.stampFor('ModalRegularBack', 'Colorless').src, '/img/frames/m15/holoStamps/m15HoloStampC.png');
	for (const profile of ['NeonInkTransformFront','NeonInkTransformBack']) {
		const stamp = registry.stampFor(profile, 'Black');
		assert.equal(stamp.name, 'Holo Stamp', profile);
		assert.equal(stamp.src, '/img/frames/m15/holoStamps/stamp.png', profile);
		assert.deepEqual({...stamp.bounds}, {x:0.4554, y:0.9172, width:0.0894, height:0.032}, profile);
	}

	const planeswalker = registry.stampFor('PlaneswalkerMDFCBack', 'Red');
	assert.equal(planeswalker.src, '/img/frames/planeswalker/holo/r.png');
	const equinox = registry.stampFor('EquinoxBack', 'Green');
	assert.equal(equinox.src, '/img/frames/m15/equinox/stamps/g.png');
});

test('modern profiles default to a stamp without adding one to older or non-card layouts', () => {
	const registry = loadFrameRegistry();
	for (const profile of ['Aftermath','NeonInk','MysticalArchiveSOA']) {
		assert.equal(registry.defaultHoloStampAllowed(profile), true, profile);
		assert.ok(registry.stampFor(profile, 'Multicolored'), profile);
	}
	assert.equal(registry.stampFor('Aftermath', 'Multicolored').src, '/img/frames/m15/holoStamps/m15HoloStampM.png');
	assert.equal(registry.stampFor('MysticalArchiveSOA', 'Multicolored').src, '/img/frames/m15/holoStamps/stamp.png');
	for (const profile of ['8thTransformBack','ABU','Flip','TokenRegular-1','EOEBasics','Classicshifted']) {
		assert.equal(registry.defaultHoloStampAllowed(profile), false, profile);
		assert.equal(registry.stampFor(profile, 'Multicolored'), null, profile);
	}
	// A frame can still opt in explicitly even when its parent is a legacy style.
	assert.ok(registry.stampFor('PlaneswalkerSeventh', 'Blue'));
	const autoFrame = fs.readFileSync(path.join(__dirname, '../js/autoFrame.js'), 'utf8');
	assert.match(functionSource(autoFrame, 'autoFrameFromAvailableFrames'), /semanticHoloStampAllowed && name\.includes\('Holo Stamp'\)/);
});

test('automatic frame selection resolves land and planeswalker stamps without a missing color variable', () => {
	const autoFrame = fs.readFileSync(path.join(__dirname, '../js/autoFrame.js'), 'utf8');
	const registry = loadFrameRegistry();
	const context = vm.createContext({FRAME_REGISTRY: registry});
	vm.runInContext(functionSource(autoFrame, 'selectAutomaticHoloStamp'), context);
	vm.runInContext(functionSource(autoFrame, 'automaticHoloStampColorForFrame'), context);

	assert.equal(context.automaticHoloStampColorForFrame('Land', {item: {name: 'Blue Land Frame'}}, 'Land'), 'Blue');
	assert.equal(context.automaticHoloStampColorForFrame('Land', {item: {name: 'Multicolored Land Frame'}}, 'Legendary Land'), 'Multicolored');
	assert.equal(context.automaticHoloStampColorForFrame('Land', {item: {name: 'Land Frame'}}, 'Land'), 'Land');
	assert.equal(context.automaticHoloStampColorForFrame('Blue', {item: {name: 'Red Frame'}}, 'Creature'), 'Blue');
	assert.equal(context.automaticHoloStampColorForFrame('Colorless', {item: {name: 'Artifact Frame'}}, ''), 'Artifact');
	assert.equal(context.automaticHoloStampColorForFrame('Colorless', {item: {name: 'White Frame'}}, ''), 'White');
	assert.equal(context.automaticHoloStampColorForFrame('Vehicle', {item: {name: 'Artifact Frame'}}, 'Artifact — Vehicle'), 'Artifact');

	const landStamp = context.selectAutomaticHoloStamp([
		{name: 'Blue Holo Stamp', src: '/blue.png', bounds: {x: 1}},
		{name: 'Land Holo Stamp', src: '/land.png', bounds: {x: 1}},
	], 'M15Regular-1', 'Blue');
	assert.equal(landStamp.name, 'Blue Holo Stamp');
	assert.deepEqual(Array.from(landStamp.masks), []);
	const fallbackLandStamp = context.selectAutomaticHoloStamp([
		{name: 'Blue Land Holo Stamp', src: '/wrong-pack.png'},
	], 'M15Regular-1', 'Land');
	assert.equal(fallbackLandStamp.name, 'Land Holo Stamp');
	assert.equal(fallbackLandStamp.src, '/img/frames/m15/holoStamps/m15HoloStampL.png');

	const planeswalkerStamp = context.selectAutomaticHoloStamp([], 'PlaneswalkerTall', 'Multicolored');
	assert.equal(planeswalkerStamp.name, 'Multicolored Holo Stamp');
	assert.equal(planeswalkerStamp.src, '/img/frames/planeswalker/holo/m.png');
	assert.match(functionSource(autoFrame, 'autoFrameFromAvailableFrames'), /automaticHoloStampColorForFrame\(desiredColor, selectedVariant, typeLine\)/);
	assert.match(functionSource(autoFrame, 'autoFrameFromAvailableFrames'), /selectAutomaticHoloStampLayers\(frameOptions, selectedProfile, stampColor, rarity\)/);
});

test('automatic stamp selection preserves Booster Fun and Universes Beyond artwork', () => {
	const autoFrame = fs.readFileSync(path.join(__dirname, '../js/autoFrame.js'), 'utf8');
	const registry = loadFrameRegistry();
	const context = vm.createContext({FRAME_REGISTRY: registry});
	vm.runInContext(functionSource(autoFrame, 'selectAutomaticHoloStamp'), context);

	const paranormal = context.selectAutomaticHoloStamp([
		{name:'Artifact Holo Stamp', src:'/img/frames/m15/paranormal/stamp/a.png', bounds:{x:858/2010, y:2532/2814, width:284/2010, height:131/2814}}
	], 'Paranormal', 'Artifact');
	assert.equal(paranormal.src, '/img/frames/m15/paranormal/stamp/a.png');
	assert.equal(paranormal.bounds.width, 284/2010);

	const spreeUb = context.selectAutomaticHoloStamp([
		{name:'White Holo Stamp', src:'/img/frames/m15/ub/regular/stamp/w.png', bounds:{x:0.4254, y:0.9005, width:0.1494, height:0.0486}}
	], 'SpreeUB', 'White');
	assert.equal(spreeUb.src, '/img/frames/m15/ub/regular/stamp/w.png');
	assert.equal(spreeUb.bounds.width, 0.1494);

	const oilSlick = context.selectAutomaticHoloStamp([
		{name:'Colorless Holostamp', src:'/img/frames/m15/oilslick/cStamp.png', bounds:{x:0.4247, y:0.9038, width:0.15, height:0.0495}}
	], 'OilSlick', 'Colorless');
	assert.equal(oilSlick.src, '/img/frames/m15/oilslick/cStamp.png');

	const tardis = context.selectAutomaticHoloStamp([
		{name:'Gold Holo Stamp', src:'/img/frames/tardis/stamp.png'},
		{name:'Gray Holo Stamp', src:'/img/frames/tardis/grayStamp.png'}
	], 'TARDIS', 'Blue');
	assert.equal(tardis.src, '/img/frames/tardis/stamp.png');

	const elemental = context.selectAutomaticHoloStamp([
		{name:'Triangle Holo Stamp', src:'/triangle.png'},
		{name:'Round Holo Stamp', src:'/round.png'}
	], 'Elemental', 'Red');
	assert.equal(elemental.src, '/round.png');
	const sourceMaterial = context.selectAutomaticHoloStamp([
		{name:'Triangle Holo Stamp', src:'/triangle.png'},
		{name:'Round Holo Stamp', src:'/round.png'}
	], 'FCA', 'Red');
	assert.equal(sourceMaterial.src, '/triangle.png');
});

test('legacy Universes Beyond profiles use matte triangle stamps at common and uncommon', () => {
	const autoFrame = fs.readFileSync(path.join(__dirname, '../js/autoFrame.js'), 'utf8');
	const registry = loadFrameRegistry();
	const context = vm.createContext({FRAME_REGISTRY: registry});
	vm.runInContext(functionSource(autoFrame, 'selectAutomaticHoloStamp'), context);

	for (const profile of ['UB','SpreeUB','ModalUB','RoomUB','SagaUB','TARDIS','Pipboy','MemoryCorridor','SagaLTR','FCA']) {
		assert.equal(registry.usesUniversesBeyondHoloStamp(profile), true, profile);
		assert.equal(registry.automaticHoloStampAllowedForRarity(profile, 'C'), true, profile);
		assert.equal(registry.automaticHoloStampAllowedForRarity(profile, 'U'), true, profile);
	}
	for (const profile of ['SewerTMT','PixelTMT','ShowcasePanel']) {
		assert.equal(registry.usesUniversesBeyondHoloStamp(profile), false, profile);
		assert.equal(registry.automaticHoloStampAllowedForRarity(profile, 'C'), false, profile);
		assert.equal(registry.automaticHoloStampAllowedForRarity(profile, 'R'), true, profile);
	}

	const spreeCommon = context.selectAutomaticHoloStamp([
		{name:'White Holo Stamp', src:'/triangle-holo.png'},
		{name:'Gray Holo Stamp', src:'/triangle-matte.png'}
	], 'SpreeUB', 'White', 'C');
	assert.equal(spreeCommon.src, '/triangle-matte.png');

	const sagaUncommon = context.selectAutomaticHoloStamp([
		{name:'Holo Stamp', src:'/saga-holo.png'},
		{name:'Gray Stamp', src:'/saga-matte.png'}
	], 'SagaUB', 'Blue', 'U');
	assert.equal(sagaUncommon.src, '/saga-matte.png');

	const sourceMaterialCommon = context.selectAutomaticHoloStamp([
		{name:'Triangle Holo Stamp', src:'/triangle-holo.png'},
		{name:'Grey Triangle Stamp', src:'/triangle-matte.png'},
		{name:'Grey Round Stamp', src:'/oval-matte.png'}
	], 'FCA', 'Blue', 'C');
	assert.equal(sourceMaterialCommon.src, '/triangle-matte.png');

	const modalFallback = registry.stampFor('ModalUB', 'Blue', 'U');
	assert.equal(modalFallback.name, 'Gray Holo Stamp');
	assert.equal(modalFallback.src, '/img/frames/m15/ub/regular/stamp/gray.png');
});

test('Booster Fun cutouts compose with a separate foil oval', () => {
	const autoFrame = fs.readFileSync(path.join(__dirname, '../js/autoFrame.js'), 'utf8');
	const registry = loadFrameRegistry();
	const context = vm.createContext({FRAME_REGISTRY: registry});
	vm.runInContext(functionSource(autoFrame, 'selectAutomaticHoloStamp'), context);
	vm.runInContext(functionSource(autoFrame, 'selectAutomaticHoloStampLayers'), context);

	const layers = context.selectAutomaticHoloStampLayers([
		{name:'Artifact Holo Stamp', src:'/sewer-cutout.png', bounds:{x:0.34, width:0.32}},
		{name:'Plain Holo Stamp', src:'/foil-oval.png', bounds:{x:0.456, width:0.0894}}
	], 'SewerTMT', 'Artifact', 'R');
	assert.deepEqual(Array.from(layers, layer => layer.src), ['/foil-oval.png', '/sewer-cutout.png']);
	assert.deepEqual(Array.from(layers[0].masks), []);
	assert.deepEqual(Array.from(layers[1].masks), []);

	const ordinaryLayers = context.selectAutomaticHoloStampLayers([
		{name:'Artifact Holo Stamp', src:'/complete-stamp.png'}
	], 'Paranormal', 'Artifact', 'R');
	assert.deepEqual(Array.from(ordinaryLayers, layer => layer.src), ['/complete-stamp.png']);
});

test('lands inherit their holo stamp color from the rendered frame', () => {
	const autoFrame = fs.readFileSync(path.join(__dirname, '../js/autoFrame.js'), 'utf8');
	const context = vm.createContext({});
	vm.runInContext(functionSource(autoFrame, 'automaticHoloStampColors'), context);

	assert.deepEqual(Array.from(context.automaticHoloStampColors({pinline: 'UL'}, 'Land')), ['U']);
	assert.deepEqual(Array.from(context.automaticHoloStampColors({pinline: 'RL'}, 'Land')), ['R']);
	assert.deepEqual(Array.from(context.automaticHoloStampColors({pinline: 'ML'}, 'Legendary Land')), ['M']);
	assert.deepEqual(Array.from(context.automaticHoloStampColors({pinline: 'L'}, 'Land')), ['L']);
	assert.deepEqual(Array.from(context.automaticHoloStampColors({pinline: 'UL', pinlineRight: 'GL'}, 'Land')), ['G', 'U']);
	assert.deepEqual(Array.from(context.automaticHoloStampColors({pinline: 'U'}, 'Creature')), ['U']);
	assert.deepEqual(Array.from(context.automaticHoloStampColors({pinline: 'U', pinlineRight: 'G'}, 'Creature')), ['G', 'U']);
	assert.match(autoFrame, /automaticHoloStampColors\(properties, type_line\)/);
});
