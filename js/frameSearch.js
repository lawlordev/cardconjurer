const frameNames = new Map ([
	//standard
	['Regular Frames', 'M15Regular-1'],
	['Enchantment Frames (Nyx)', 'M15Nyx'],
	['Legend Crowns', 'M15LegendCrowns'],
	['Legend Crowns (Etched)', 'LegendCrownsEtched'],
	['Floating Legend Crowns', 'M15LegendCrownsFloating'],
	['Floating Legend Crowns (Universes Beyond)', 'UBLegendCrownsFloating'],
	['Legend Crowns (Universes Beyond)', 'UBLegendCrowns'],
	['Inner Crowns', 'M15InnerCrowns'],
	['Inner Crowns (Etched)', 'InnerCrownsEtched'],
	['Miracle', 'M15Miracle'],
	['Holo Stamps', 'M15HoloStamps'],
	['Nicknames', 'M15Nickname-2'],
	['Smooth Nickname Legend Crowns', 'M15SmoothNickname'],
	['Dark Power/Toughness', 'M15DarkPT'],
	['Colored Borders', 'M15Borders'],
	['Color Identity Pips', 'M15CIPips'],
	['"The List" Stamp', 'TheList'],
	['Lands', 'M15Lands'],
	['Prepare (Secrets of Strixhaven)', 'Prepare'],
	['Stations', 'StationRegular'],
	['Borderless Stations', 'StationBorderless'],
	['Omens (Tarkir Dragonstorm)', 'Omen'],
	['Rooms (Duskmourn)', 'Room'],
	['Rooms (Universes Beyond)', 'RoomUB'],
	['Spree (Outlaws of Thunder Junction)', 'Spree'],
	['Spree (Universes Beyond)', 'SpreeUB'],
	['Cases (Murders at Karlov Manor)', 'Case'],
	['Cases (Universes Beyond)', 'CaseUB'],
	['Battles (March of the Machine)', 'Battle'],
	['Prototype (Brothers\' War)', 'Prototype'],
	['Prototype (Extended Art) (Brothers\' War)', 'PrototypeExtended'],
	['Attractions (Unfinity)', 'Attraction'],
	['Class (D&D)', 'Class'],
	['Class (Universes Beyond)', 'ClassUB'],
	['Snow (Kaldheim)', 'M15Snow'],
	['Mutate (Ikoria)', 'M15Mutate'],
	['Nyx (Theros)', 'M15Nyx'],
	['Adventures (Eldraine)', 'Adventure'],
	['Devoid (Zendikar)', 'M15Devoid'],
	['Aftermath (Amonkhet)', 'Aftermath'],
	['Flip (Kamigawa)', 'Flip'],
	['Levelers (Zendikar)', 'Leveler'],
	['Split Cards', 'Split'],
	['Fuse Cards', 'Fuse'],
	['Conspiracies (Draft Matters)', 'Conspiracy'],
	['Colorshifted (Planar Chaos)', 'Colorshifted'],
	['Brawl Legend Crowns', 'Brawl'],
	// Showcase
	['Showcase Panel (MSH)', 'ShowcasePanel'],
	['Pixel (TMT)', 'PixelTMT'],
	['Sewer (TMT)', 'SewerTMT'],
	['Mystical Archive (SOA)', 'MysticalArchiveSOA'],
	['Fable (ECL)', 'FableECL'],
	['Neon Ink (TLA)', 'NeonInk'],
	['Avatar Elemental (TLA)', 'Elemental'],
	['Borderless Stellar Sights (EOS)', 'BorderlessStellarSights'],
	['Poster Stellar Sights (EOS)', 'PosterStellarSights'],
	['Borderless Source Material', 'FCA'],
	['Draconic (TDM)', 'Draconic'],
	['Ghostfire (TDM)', 'Ghostfire'],
	['Japan Showcase', 'JapanShowcase'],
	['Japan Showcase Nicknames', 'JapanShowcaseNicknames'],
	['Paranormal (DSK)', 'Paranormal'],
	['Bloomburrow Borderless (BLB)', 'BloomburrowBorderless'],
	['Woodland (BLB)', 'Woodland'],
	['Memory Corridor (ACR) (Assassin\'s Creed)', 'MemoryCorridor'],
	['Breaking News (OTP)', 'BreakingNews'],
	['Vault (BIG)', 'Vault'],
	['Wanted Poster (OTJ)', 'Wanted'],
	['Showcase Magnified (MKM)', 'ShowcaseMagnified'],
	['Dossier (MKM)', 'Dossier'],
	['Legends of Ixalan - Pattern 1 (LCI)', 'IxalanLegends1'],
	['Legends of Ixalan - Pattern 2 (LCI)', 'IxalanLegends2'],
	['Legends of Ixalan - Pattern 3 (LCI)', 'IxalanLegends3'],
	['Scrolls of Middle-earth (LTR)', 'Scroll'],
	['Pip-Boy (PIP)', 'Pipboy'],
	['Enchanting Tales (WOT)', 'EnchantingTales'],
	['TARDIS (WHO)', 'TARDIS'],
	['Ring (LTR)', 'Ring'],
	['Ixalan Coin (MOM)', 'IxalanCoin'],
	['Ikoria Crystal (MOM)', 'Crystal'],
	['Ravnica City (MOM)', 'Ravnica'],
	['Tarkir Sketch (MOM)', 'Tarkir'],
	['Oil Slick (ONE)', 'OilSlick'],
	['Shattered Glass (BOT)', 'ShatteredGlass'],
	['Stained Glass (DMU)', 'DMUStainedGlass'],
	['Golden Age (SNC)', 'SNCGilded'],
	['Art Deco (SNC)', 'SNCArtDeco'],
	['Skyscraper (SNC)', 'SNCSkyscraper'],
	['Ninja (NEO)', 'NeoNinja'],
	['Samurai (NEO)', 'NeoSamurai'],
	['Neon (NEO)', 'NeoNeon'],
	['Double Feature (DBL)', 'DoubleFeature'],
	['Double Feature: Transform (DBL)', 'DoubleFeatureTransform'],
	['Fang (VOW)', 'Fang'],
	['Equinox: Single-faced (MID)', 'Equinox'],
	['Equinox: Transform Front (MID)', 'EquinoxFront'],
	['Equinox: Transform Back (MID)', 'EquinoxBack'],
	['Eternal Night (MID)', 'EternalNight'],
	['DND Sourcebook (AFR)', 'DNDSourcebook'],
	['DND Module (AFR)', 'DNDModule'],
	['Sketch Cards (MH2)', 'MH2'],
	['Mystical Archive (STA)', 'MysticalArchive'],
	['Japanese Mystical Archive (STA)', 'MysticalArchiveJP'],
	['Phyrexian', 'Praetors'],
	['Kaldheim (KHM)', 'Kaldheim-2'],
	['Nonlegendary Kaldheim (KHM)', 'KaldheimNonleg'],
	['Commander Legends (CMR)', 'CommanderLegends'],
	['Zendikar Rising (ZNR)', 'ZendikarRising'],
	['M21 Signature Spellbooks (M21)', 'M21'],
	['Theros Beyond Death (THB)', 'M15NyxShowcase'],
	['Eldraine Storybooks: Adventures (ELD)', 'Storybook'],
	['Eldraine Storybooks: Adventures (WOE)', 'StorybookWOE'],
	['Eldraine Storybooks (MOM)', 'StorybookMUL'],
	['Borderless', 'GenericShowcase'],
	['Borderless (Alt)', 'Borderless'],
	['Fullart', 'M15ClearTextboxes'],
	['Nickname ("Godzilla")', 'M15Nickname'],
	['Extended Art (Regular)', 'M15BoxTopper'],
	['Extended Art (Shorter Textbox)', 'M15ExtendedArtShort'],
	['FNM Promo (Inverted Promos)', 'FNM'],
	['Universes Beyond', 'UB'],
	['Universes Beyond (Full art)', 'UBFull'],
	['Universes Beyond (Extended art)', 'UBExtendedArt'],
	['Full Text', 'FullText'],
	['Full Text (Alt)', 'FullTextAlt'],
	['Etched', 'Etched'],
	['Etched (Nyx)', 'EtchedNyx'],
	['Etched (Snow)', 'EtchedSnow'],
	['ZNR Expeditions (2020)', 'ExpeditionZNR-1'],
	['Signature Spellbook (Jace/Gideon)', 'SignatureSpellbook'],
	['Ixalan Maps', 'Ixalan'],
	['Amonkhet Invocations (u/Smyris)', 'Invocation'],
	['Amonkhet Invocations (Multiverse Legends)', 'InvocationMUL'],
	['Kaladesh Inventions', 'Invention'],
	['BFZ Expeditions (2015)', 'ExpeditionBFZ-1'],
	['SDCC15 (Blackout)', 'SDCC15'],
	['Innistrad: Double Feature Planeswalkers', 'PlaneswalkerDBL'],
	['Future Shifted', 'FutureRegular'],
	//planeswalker
	['Planeswalker', 'PlaneswalkerRegular'],
	['Planeswalker Borderless', 'PlaneswalkerBorderless'],
	['Planeswalker Extended Art', 'PlaneswalkerBoxTopper'],
	['Planeswalker Tall', 'PlaneswalkerTall'],
	['Planeswalker Tall Borderless', 'PlaneswalkerTallBorderless'],
	['Planeswalker Compleated', 'PlaneswalkerCompleated'],
	['Planeswalker Holo Stamps', 'PlaneswalkerHoloStamps'],
	['Planeswalker Nickname', 'PlaneswalkerNickname'],
	['Planeswalker Blackout (SDCC15)', 'PlaneswalkerSDCC15'],
	['Planeswalker MDFC', 'PlaneswalkerMDFC'],
	['Planeswalker Transform (Front)', 'PlaneswalkerTransformFront'],
	['Planeswalker Transform (Back)', 'PlaneswalkerTransformBack'],
	['Double Feature Planeswalker Transform (Front)', 'PlaneswalkerTransformFrontDBL'],
	['Double Feature Planeswalker Transform (Back)', 'PlaneswalkerTransformBackDBL'],
	['Planeswalker Transform Icons', 'PlaneswalkerTransformIcons'],
	//saga
	['Sagas', 'SagaRegular'],
	['Sagas (Universes Beyond)', 'SagaUB'],
	['Sagas (Scrolls of Middle-earth) (LTR)', 'SagaLTR'],
	['Saga Creatures (Summons)', 'SagaCreature'],
	['Saga Creatures (Universes Beyond) (Summons) (FIN)', 'SagaCreatureUB'],
	//dfc
	['Transform (Front)', 'M15TransformFront'],
	['Transform (Back)', 'M15TransformBack'],
	['Transform (Back) (New)', 'M15TransformBackNew'],
	['Color Identity Pips', 'M15CIPips'],
	['Transform Icons', 'M15TransformTypes'],
	['Sagas (Front)', 'SagaDFC'],
	['Borderless (Front)', 'TransformBorderlessFront'],
	['Borderless (Back)', 'TransformBorderlessBack'],
	['Borderless Alt (Front)', 'TransformBorderlessAltFront'],
	['Borderless Alt (Back/Right)', 'TransformBorderlessAltBack'],
	['Extended Art (Front)', 'TransformExtendedFront'],
	['Extended Art (Back)', 'TransformExtendedBack'],
	['SDCC15 (Blackout)', 'TransformSDCC15'],
	['DFC Legend Crowns', 'TransformLegendCrowns'],
	['DFC Floating Legend Crowns', 'TransformLegendCrownsFloating'],
	['DFC Floating Legend Crowns (Back/Right)', 'TransformLegendCrownsFloatingBackRight'],
	['DFC Nickname Legend Crowns', 'TransformLegendCrownsNickname'],
	['Neon Ink Transform (Front) (TLA)', 'NeonInkTransformFront'],
	['Neon Ink Transform (Back) (TLA)', 'NeonInkTransformBack'],
	//modal
	['Modal DFC', 'ModalRegular'],
	['Modal DFC Borderless', 'ModalBorderless'],
	['Modal DFC Extended Art', 'ModalExtended'],
	['Modal DFC Nickname', 'ModalNickname'],
	['Modal DFC Short', 'ModalShort'],
	['Modal DFC Short-Nickname', 'ModalShortNickname'],
	['Modal DFC Legend Crowns', 'ModalLegendCrowns'],
	['Modal DFC Floating Legend Crowns', 'ModalLegendCrownsFloating'],
	['Modal DFC Nickname Legend Crowns', 'ModalLegendCrownsNickname'],
	['Modal DFC Brawl Legend Crowns', 'ModalLegendCrownsBrawl'],
	['DFC Helper Cards', 'ModalHelper'],
	//token
	['Regular Tokens', 'TokenRegular-1'],
	['Textless Tokens', 'TokenTextless-1'],
	['Borderless Textless Tokens', 'TokenTextlessBorderless'],
	['Tall Tokens', 'TokenTall-1'],
	['Short Tokens', 'TokenShort-1'],
	['Monarch Token', 'TokenMonarch'],
	['Marker Card', 'TokenMarker'],
	['Initiative Token', 'TokenInitiative'],
	['Day/Night Marker', 'TokenDayNight'],
	['Planeswalker Emblems', 'Emblem'],
	['Jumpstart Front Cards', 'JMPFront'],
	['Jumpstart 2022 Front Cards', 'J22Front'],
	['Regular Tokens (Bordered M15)', 'TokenRegularM15'],
	['Textless Tokens (Bordered M15)', 'TokenTextlessM15'],
	['Original Tokens (Old Bordered)', 'TokenOld'],
	['Unglued Tokens', 'TokenUnglued'],
	//misc
	['Future Shifted', 'FutureRegular'],
	['Colorshifted', '8thColorshifted'],
	['8th Edition', '8th'],
	['8th Edition Universes Beyond', '8thUB'],
	['Eighth Edition', '8th'],
	['Eighth Edition (Transform Front)', '8thTransformFront'],
	['Eighth Edition (Transform Back)', '8thTransformBack'],
	['Eighth Edition Universes Beyond', '8thUB'],
	['Seventh Edition', 'Seventh'],
	['Fifth Edition', 'SeventhButFifth'],
	['Fourth Edition', 'Fourth'],
	['Legends Multicolored', 'Legends'],
	['Alpha/Beta/Unlimited', 'ABU'],
	['8th Edition Playtest Cards', '8thPlaytest'],
	['Playtest Cards', 'Playtest'],
	['Dungeon (AFR)', 'Dungeon'],
	['Planechase', 'Planechase'],
	['Vanguard', 'Vanguard'],
	['Cardback', 'Cardback'],
	//promo
	['Promos', 'PromoOpenHouse'],
	['Promo Borderless Frames', 'PromoRegular-1'],
	['Promo Borderless Frames (Extra Short)', 'IkoShort'],
	['Promo Nyx Frames', 'PromoNyx'],
	['Promo Extended Art Frames', 'PromoExtended'],
	['Promo Nickname Frames', 'PromoNickname'],
	['Promo Generic Showcase', 'PromoGenericShowcase'],
	//textless
	['Edge of Eternities Basics (EOE)', 'EOEBasics'],
	['Kamigawa Basics (NEO)', 'NeoBasics'],
	['Fullart Basics (2022)', 'TextlessBasics2022'],
	['Fullart Basics (Universes Beyond)', 'TextlessBasics2022UB'],
	['Fullart Basics (SNC)', 'TextlessBasicsSNC'],
	['Fullart Basics (THB)', 'TextlessBasics'],
	['Fullart Basics (ZEN)', 'ZendikarBasic-1'],
	['Fullart Snow Basics', 'FullartBasicRoundBottom'],
	['Unfinity Basics (UNF)', 'Unfinity'],
	['Unstable Basics (UST)', 'Unstable'],
	['Unhinged Basics (UNH)', 'Unhinged'],
	['Generic Showcase', 'TextlessGenericShowcase'],
	['Magic Fest Promos', 'MagicFest'],
	['Extended Art Invocations', 'AKHInvocationExtended'],
	['Textless Inventions', 'TextlessInvention'],
	['Textless Seventh', 'SeventhTextless'],
	['Neon Ink Textless(TLA)', 'NeonInkTextless'],
	['Neon Ink Transform Textless (Front) (TLA)', 'NeonInkTransformFrontTextless'],
	['Neon Ink Transform Textless (Back) (TLA)', 'NeonInkTransformBackTextless'],
	//custom
	['Misc Custom Frames', 'MiscCustom'],
	['Deck Covers', 'CustomDeckCover'],
	['Simple Inventions', 'SimpleInventions'],
	['Tapped (Horizontal M15)', 'Tapped'],
	['Textless Duals', 'CustomDualLands'],
	['Seventh Edition Planeswalkers', 'PlaneswalkerSeventh'],
	['Seventh Edition Sagas', 'OldSaga'],
	['Seventh Edition Snow Lands', 'SeventhSnowLands'],
	['Floating Old Border', 'OldFloating'],
	['Floating Old Border (Short)', 'OldFloatingShort'],
	['Burning Revelation (SLD)', 'BurningRevelation'],
	['Classicshifted', 'Classicshifted'],
	['Classicshifted Nickname', 'ClassicshiftedNickname'],
	['Classicshifted Lands', 'ClassicshiftedLands'],
	['Classicshifted Planeswalkers', 'ClassicshiftedPlaneswalker'],
	['Classicshifted Planeswalker Transform Addons', 'ClassicshiftedPlaneswalkerTransform'],
	['Classicshifted Sagas', 'ClassicshiftedSaga'],
	['Classicshifted MDFC Addons', 'ClassicshiftedDFC'],
	['Classicshifted Transform Addons', 'ClassicshiftedTransform'],
	['Classicshifted Color Identity Pips', 'ClassicshiftedCIPips'],
	['StoneCutter', 'StoneCutterDeluxe'],
	['StoneCutter Nickname Addons', 'StoneCutterDeluxeNicknameAddons'],
	['StoneCutter Extended Art', 'StoneCutterDeluxeExtended'],
	['StoneCutter Planeswalkers', 'StoneCutterDeluxePlaneswalker'],
	['StoneCutter Planeswalkers Extended', 'StoneCutterDeluxePlaneswalkerExtended'],
	['StoneCutter Planeswalkers  Transform Addons', 'StoneCutterDeluxePlaneswalkerTransformAddons'],
	['StoneCutter Sagas', 'StoneCutterDeluxeSaga'],
	['StoneCutter Class(y)', 'StoneCutterDeluxeClass'],
	['StoneCutter Case', 'StoneCutterDeluxeCase'],
	['StoneCutter MDFC Addons', 'StoneCutterDeluxeDFC'],
	['StoneCutter Transform Addons', 'StoneCutterDeluxeTransformAddons'],
	['Short Neon (NEO)', 'NEONeonShort'],
	['Colored Golden Age (SNC)', 'SNCGildedColored'],
	['Textless Golden Age (SNC)', 'SNCGildedTextless'],
	['Textless Equinox (MID)', 'EquinoxTextless'],
	['Horizontal Japanese Mystical Archive (STA)', 'MysticalArchiveJPEN'],
	['Brawl Legend Crowns', 'Brawl'],
	['Cartoony - Sheepwave', 'Cartoony'],
	['Neon - Elry', 'CustomNeon'],
	['Ixalan - @feuer_ameise', 'FeuerAmeiseIxalan'],
	['Kaldheim, Fullart - @feuer_ameise', 'FeuerAmeiseKaldheim'],
	['Celid\'s Asap', 'CustomCelidAsap'],
	['Magrao\'s Kaldheim', 'CustomMagraoKaldheim'],
	['Pokemon', 'Pokemon'],
	['Circuit', 'Circuit'],
]);

var activeFramePack = 'M15Regular-1';
var activeFrameCustomizationPack = null;
var activeFrameComponentOptions = {};
var frameComponentPackCache = new Map();
var frameTranslatedSvgCache = new Map();
var frameCustomizeTypeDefaults = null;
var frameCustomizeTypeObject = null;
var activeFrameCategory = 'all';
var frameCatalogPreviewObserver;
var frameCatalogSelectionToken = 0;

// Color-indicator adjustments in card pixels (the card canvas is 1500 x 2100).
// Add or change a frame profile here when its indicator needs a small nudge.
// Positive x moves right; positive y moves down.
const FRAME_COLOR_INDICATOR_OFFSETS = {
	default: {x:0, y:-6},
	'M15Regular-1': {x:0, y:-6},
	PlaneswalkerRegular: {x:0, y:-3},
	PlaneswalkerTall: {x:0, y:-3},
	PlaneswalkerCompleated: {x:0, y:-3},
	PlaneswalkerBorderless: {x:0, y:-3},
	PlaneswalkerTallBorderless: {x:0, y:-3},
	SagaRegular: {x:0, y:-5},
	SagaUB: {x:0, y:-5},
	Class: {x:0, y:-5},
	ClassUB: {x:0, y:-5},
	Case: {x:0, y:-5},
	CaseUB: {x:0, y:-5}
};

function frameSearch(str) {
	const matchingFrame = Array.from(frameNames.entries()).find(item => item[0].toLowerCase() == str.toLowerCase());
	if (!matchingFrame) return;
	const matchingTile = Array.from(document.querySelectorAll('.frame-catalog-item')).find(item => item.dataset.pack == matchingFrame[1]);
	selectFrameCatalogItem(matchingFrame[0], matchingFrame[1], matchingTile);
}

function renderFrameCatalog() {
	const catalog = document.querySelector('#frameCatalog');
	if (!catalog) return;
	catalog.addEventListener('wheel', scrollFrameCatalogWithWheel, {passive: false});
	renderFrameCategoryFilters();

	frameCatalogPreviewObserver = new IntersectionObserver(entries => {
		entries.forEach(entry => {
			if (!entry.isIntersecting) return;
			frameCatalogPreviewObserver.unobserve(entry.target);
			loadFrameCatalogPreview(entry.target);
		});
	}, {root: catalog, rootMargin: '0px 240px'});

	frameNames.forEach((pack, name) => {
		if (typeof FRAME_REGISTRY != 'undefined' && !FRAME_REGISTRY.isCatalogProfile(pack)) return;
		const definition = typeof FRAME_REGISTRY == 'undefined' ? {category:'standard', family:pack} : FRAME_REGISTRY.definition(pack);
		const tile = document.createElement('button');
		tile.type = 'button';
		tile.className = 'frame-catalog-item';
		tile.dataset.name = name.toLowerCase();
		tile.dataset.pack = pack;
		tile.dataset.category = definition.category;
		tile.dataset.family = definition.family;
		tile.title = name;
		tile.setAttribute('aria-label', 'Load ' + name);
		tile.onclick = () => selectFrameCatalogItem(name, pack, tile);

		const preview = document.createElement('span');
		preview.className = 'frame-catalog-preview';
		const image = document.createElement('img');
		image.src = '/img/blackThumb.png';
		image.alt = '';
		image.dataset.pack = pack;
		preview.appendChild(image);

		const label = document.createElement('span');
		label.className = 'frame-catalog-title';
		label.textContent = name;

		tile.appendChild(preview);
		tile.appendChild(label);
		const selected = pack == activeFramePack;
		tile.classList.toggle('selected', selected);
		tile.setAttribute('aria-pressed', selected ? 'true' : 'false');
		catalog.appendChild(tile);
		frameCatalogPreviewObserver.observe(image);
	});

	updateFrameCatalogCount(catalog.querySelectorAll('.frame-catalog-item').length);
	const defaultTile = Array.from(catalog.querySelectorAll('.frame-catalog-item')).find(item => item.dataset.pack == activeFramePack);
	const defaultFrame = Array.from(frameNames.entries()).find(item => item[1] == activeFramePack);
	if (defaultTile && defaultFrame) return selectFrameCatalogItem(defaultFrame[0], defaultFrame[1], defaultTile);
}

function renderFrameCategoryFilters() {
	const container = document.querySelector('#frameCategoryFilters');
	if (!container) return;
	const labels = typeof FRAME_REGISTRY == 'undefined' ? {all:'All'} : FRAME_REGISTRY.categoryLabels;
	Object.entries(labels).forEach(([category, label]) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'frame-category-filter' + (category == activeFrameCategory ? ' selected' : '');
		button.dataset.category = category;
		button.textContent = label;
		button.onclick = () => selectFrameCategory(category);
		container.appendChild(button);
	});
}

function selectFrameCategory(category) {
	activeFrameCategory = category;
	document.querySelectorAll('.frame-category-filter').forEach(button => button.classList.toggle('selected', button.dataset.category == category));
	const search = document.querySelector('#frameSearch');
	filterFrameCatalog(search ? search.value : '');
}

function scrollFrameCatalogWithWheel(event) {
	if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
	const catalog = event.currentTarget;
	const maximumScroll = catalog.scrollWidth - catalog.clientWidth;
	const nextScroll = Math.max(0, Math.min(maximumScroll, catalog.scrollLeft + event.deltaY));
	if (nextScroll == catalog.scrollLeft) return;
	catalog.scrollLeft = nextScroll;
	event.preventDefault();
}

async function loadFrameCatalogPreview(image) {
	try {
		const response = await fetch('/js/frames/pack' + image.dataset.pack + '.js');
		if (!response.ok) throw new Error('Preview source could not be loaded');
		const source = await response.text();
		const previewSources = selectFrameCatalogPreviewSources(source);
		if (!previewSources.length) throw new Error('Preview image could not be found');
		setFrameCatalogPreview(image, previewSources);
	} catch (error) {
		image.closest('.frame-catalog-item').classList.add('preview-unavailable');
	}
}

function selectFrameCatalogPreviewSources(source) {
	const availableFramesIndex = source.search(/availableFrames\s*=/);
	const frameSource = availableFramesIndex >= 0 ? source.slice(availableFramesIndex) : source;
	const arrayStart = frameSource.indexOf('[');
	const arrayEnd = arrayStart < 0 ? -1 : findFrameCatalogArrayEnd(frameSource, arrayStart);
	const arraySource = arrayStart < 0 || arrayEnd < 0 ? '' : frameSource.slice(arrayStart + 1, arrayEnd)
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/.*$/gm, '');
	const options = parseFrameCatalogOptions(arraySource);
	const accessoryPattern = /power\s*\/\s*toughness|\bpinline\b|\bholostamp\b|\bholo stamp\b|\bstamp\b|\bcrown\b|\boutline\b|\btextbox\b|\bmask\b|\btype icon\b/i;
	const previewOptions = options.filter(option => !accessoryPattern.test(option.name));
	const preferredNames = [/\bcolorless\b/i, /\beldrazi\b/i, /\bartifact\b/i, /\bwhite\b/i];
	const orderedOptions = [];
	for (const namePattern of preferredNames) {
		orderedOptions.push(...previewOptions.filter(option => namePattern.test(option.name)));
	}
	orderedOptions.push(...previewOptions.filter(option => /\bframe\b/i.test(option.name)), ...previewOptions, ...options);
	const fallbackSource = arraySource.match(/\bsrc\s*:\s*(['"])([^'"]+)\1/)?.[2];
	if (fallbackSource) orderedOptions.push({name:'Fallback', src:fallbackSource});
	return orderedOptions.map(option => option.src).filter((src, index, sources) => src && sources.indexOf(src) == index);
}

function findFrameCatalogArrayEnd(source, arrayStart) {
	let depth = 0;
	let quote = '';
	let escaped = false;
	for (let index = arrayStart; index < source.length; index++) {
		const character = source[index];
		if (quote) {
			if (escaped) escaped = false;
			else if (character == '\\') escaped = true;
			else if (character == quote) quote = '';
			continue;
		}
		if (character == "'" || character == '"' || character == '`') {
			quote = character;
			continue;
		}
		if (character == '[') depth++;
		else if (character == ']' && --depth == 0) return index;
	}
	return -1;
}

function parseFrameCatalogOptions(arraySource) {
	const options = [];
	let objectStart = -1;
	let objectDepth = 0;
	let quote = '';
	let escaped = false;
	for (let index = 0; index < arraySource.length; index++) {
		const character = arraySource[index];
		if (quote) {
			if (escaped) escaped = false;
			else if (character == '\\') escaped = true;
			else if (character == quote) quote = '';
			continue;
		}
		if (character == "'" || character == '"' || character == '`') {
			quote = character;
			continue;
		}
		if (character == '{') {
			if (objectDepth++ == 0) objectStart = index;
		} else if (character == '}' && --objectDepth == 0 && objectStart >= 0) {
			const objectSource = arraySource.slice(objectStart, index + 1);
			const name = frameCatalogLiteralProperty(objectSource, 'name');
			const src = frameCatalogLiteralProperty(objectSource, 'src');
			if (name && src) options.push({name:name, src:src});
			objectStart = -1;
		}
	}
	return options;
}

function frameCatalogLiteralProperty(source, property) {
	const match = source.match(new RegExp('\\b' + property + '\\s*:\\s*([\\\'"])((?:\\\\.|(?!\\1)[\\s\\S])*)\\1'));
	return match ? match[2].replace(/\\(['"\\])/g, '$1') : '';
}

function setFrameCatalogPreview(image, sources) {
	const candidates = sources.flatMap(source => {
		const thumbnail = source.replace(/\.png$/i, 'Thumb.png').replace(/\.svg$/i, 'Thumb.png');
		return thumbnail == source ? [source] : [thumbnail, source];
	}).filter((source, index, allSources) => allSources.indexOf(source) == index);
	let candidateIndex = 0;
	image.onerror = function() {
		candidateIndex++;
		if (candidateIndex < candidates.length) {
			this.src = frameCatalogUri(candidates[candidateIndex]);
			return;
		}
		this.onerror = null;
		this.closest('.frame-catalog-item').classList.add('preview-unavailable');
		this.src = '/img/blackThumb.png';
	};
	image.src = frameCatalogUri(candidates[0]);
}

function frameCatalogUri(source) {
	return typeof fixUri == 'function' ? fixUri(source) : source;
}

async function selectFrameCatalogItem(name, pack, tile) {
	const selectionToken = ++frameCatalogSelectionToken;
	activeFramePack = pack;
	activeFrameCustomizationPack = null;
	activeFrameComponentOptions = {};
	renderFrameCustomize(pack);
	document.querySelectorAll('.frame-catalog-item').forEach(item => {
		const selected = item == tile;
		item.classList.toggle('selected', selected);
		item.setAttribute('aria-pressed', selected ? 'true' : 'false');
	});

	const catalog = document.querySelector('#frameCatalog');
	const status = document.querySelector('#frameCatalogStatus');
	if (catalog) catalog.classList.add('loading');
	if (status) status.textContent = 'Loading ' + name + '...';

	try {
		await loadScript('/js/frames/pack' + pack + '.js');
		if (selectionToken != frameCatalogSelectionToken) return;
		await updateAutomaticFrameFromCatalog(pack);
		if (status) status.textContent = name + ' loaded. Choose an image and mask below.';
	} catch (error) {
		if (selectionToken != frameCatalogSelectionToken) return;
		console.error('Failed to load frame pack "' + pack + '".', error);
		if (tile) tile.classList.add('load-failed');
		if (status) status.textContent = name + ' could not be loaded.';
	} finally {
		if (selectionToken == frameCatalogSelectionToken && catalog) catalog.classList.remove('loading');
	}
}

function frameCustomizationDefaultLabel(control) {
	if (control === 'Transform') return 'No';
	if (control === 'Variant') return 'Default';
	return 'Normal';
}

function framePackDisplayName(pack) {
	return Array.from(frameNames.entries()).find(entry => entry[1] === pack)?.[0] || pack;
}

function frameFlipsideTextColors() {
	const value = String(window.card?.text?.flipSideReminder?.text || '');
	const manaTokens = [];
	for (const match of value.matchAll(/\{([^{}]+)\}/g)) {
		const token = match[1].trim().toUpperCase();
		if (/^(?:\d+|[WUBRGCXYZS]|[WUBRG2]\/[WUBRGP])$/.test(token)) manaTokens.push(token);
	}
	const withoutCodes = value.replace(/\{[^{}]*\}/g, '').trim();
	if (!manaTokens.length && withoutCodes && /^[\s\dWUBRGCXYZSP/+-]+$/i.test(withoutCodes)) {
		manaTokens.push(...FRAME_REGISTRY.tokenizeManaCost(withoutCodes));
	}
	return FRAME_REGISTRY.canonicalColors(manaTokens.flatMap(token =>
		String(token).toUpperCase().split('').filter(character => 'WUBRG'.includes(character))
	));
}

function frameHasCustomizableLayer(requirement) {
	return (window.card?.frames || []).some(frame => {
		const name = String(frame.name || '');
		if (requirement === 'power-toughness') return /power\s*\/\s*toughness/i.test(name) && !/cutout/i.test(name);
		if (requirement === 'legend-crown') return /\bcrown\b/i.test(name) && !/(inner|outline|border cover|nickname|icon)/i.test(name);
		return true;
	});
}

function renderFrameCustomize(basePack = activeFramePack) {
	const section = document.querySelector('#frameCustomize');
	const container = document.querySelector('#frameCustomizeControls');
	if (!section || !container || typeof FRAME_REGISTRY === 'undefined') return;
	container.innerHTML = '';

	const roots = new Set([basePack]);
	const typeLine = window.card?.text?.type?.text || '';
	const manaCost = window.card?.text?.mana?.text || '';
	if (manaCost.trim() && activeFrameComponentOptions['color-identity']) delete activeFrameComponentOptions['color-identity'];
	const automaticPack = FRAME_REGISTRY.automaticVariant(basePack, typeLine);
	if (automaticPack) roots.add(automaticPack);
	if (activeFrameCustomizationPack) roots.add(activeFrameCustomizationPack);
	if (roots.has('PlaneswalkerTallBorderless') || roots.has('PlaneswalkerNickname') || roots.has('PlaneswalkerMDFC') || roots.has('PlaneswalkerMDFCBack')) {
		roots.add('PlaneswalkerBorderless');
	}
	if (roots.has('PlaneswalkerBorderless')) {
		roots.add('PlaneswalkerRegular');
	}
	const planeswalkerContext = Array.from(roots).some(pack => pack.startsWith('Planeswalker'));

	const customizations = Object.entries(FRAME_REGISTRY.variants).filter(([pack, details]) => {
		const groupParent = details.groupParent || details.parent;
		if ((!roots.has(details.parent) && !roots.has(groupParent)) || !['select', 'checkbox'].includes(details.mode)) return false;
		if (details.whenBaseOnly && automaticPack && automaticPack !== basePack) return false;
		if (planeswalkerContext && details.control === 'Transform') return false;
		if (planeswalkerContext && groupParent === 'M15Regular-1' && details.control === 'Style') return false;
		if (planeswalkerContext && pack === 'M15DarkPT') return false;
		if (details.requiresLayer && !frameHasCustomizableLayer(details.requiresLayer)) {
			if (pack === 'M15DarkPT') delete activeFrameComponentOptions['power-toughness-variant'];
			return false;
		}
		return true;
	});
	const applicableFamilies = new Set(Array.from(roots).flatMap(pack => [pack.toLowerCase(), FRAME_REGISTRY.family(pack).toLowerCase()]));
	if (Array.from(roots).some(pack => pack.startsWith('Modal'))) applicableFamilies.add('modal');
	if (Array.from(roots).some(pack => pack.startsWith('Planeswalker'))) applicableFamilies.add('planeswalker');
	const componentCustomizations = Object.entries(FRAME_REGISTRY.components).filter(([pack, details]) => {
		if (details.review || !['select', 'checkbox'].includes(details.mode)) return false;
		if (planeswalkerContext && ['M15Miracle', 'Brawl'].includes(pack)) return false;
		const familyMatches = applicableFamilies.has(String(details.family).toLowerCase()) ||
			(planeswalkerContext && pack === 'M15CIPips');
		if (!familyMatches) return false;
		if (details.whenNoMana && manaCost.trim()) return false;
		if (details.automaticFromFlipsideText && frameFlipsideTextColors().length) return false;
		if (details.requiresLayer && !frameHasCustomizableLayer(details.requiresLayer)) {
			delete activeFrameComponentOptions[details.slot];
			return false;
		}
		return !details.whenPacks || details.whenPacks.some(pack => roots.has(pack));
	});

	const selectGroups = new Map();
	customizations.forEach(([pack, details]) => {
		if (details.mode !== 'select') return;
		const control = details.control || 'Style';
		const groupParent = details.groupParent || details.parent;
		const key = groupParent + '::' + control;
		if (!selectGroups.has(key)) selectGroups.set(key, {parent:groupParent, control:control, options:[]});
		selectGroups.get(key).options.push({pack:pack, value:details.value || framePackDisplayName(pack)});
	});

	selectGroups.forEach(group => {
		const label = document.createElement('div');
		label.className = 'frame-customize-field';
		const title = document.createElement('span');
		title.textContent = group.control;
		const select = document.createElement('select');
		select.className = 'input frame-customize-input';
		select.setAttribute('aria-label', group.control);
		const defaultOption = document.createElement('option');
		defaultOption.value = group.parent;
		defaultOption.textContent = frameCustomizationDefaultLabel(group.control);
		select.appendChild(defaultOption);
		group.options.forEach(option => {
			const element = document.createElement('option');
			element.value = option.pack;
			element.textContent = option.value;
			select.appendChild(element);
		});
		const effectivePack = activeFrameCustomizationPack || automaticPack;
		select.value = group.options.some(option => option.pack === effectivePack) ? effectivePack : group.parent;
		select.onchange = () => applyFrameCustomization(select.value, select);
		label.append(title, select);
		container.appendChild(label);
	});

	customizations.forEach(([pack, details]) => {
		if (details.mode !== 'checkbox') return;
		if (pack === 'M15DarkPT') {
			container.appendChild(renderFrameCheckboxControl(
				details.control,
				details.option,
				activeFrameComponentOptions['power-toughness-variant']?.pack === pack,
				checkbox => applyFrameComponentCustomization('power-toughness-variant', checkbox.checked ? pack + '::' : '')
			));
			return;
		}
		container.appendChild(renderFrameCheckboxControl(
			details.control || details.label || framePackDisplayName(pack),
			details.option || 'Enabled',
			activeFrameCustomizationPack === pack,
			checkbox => applyFrameCustomization(checkbox.checked ? pack : details.parent, checkbox)
		));
	});

	const componentSelectGroups = new Map();
	componentCustomizations.forEach(([pack, details]) => {
		if (details.mode !== 'select') return;
		const control = details.control || framePackDisplayName(pack);
		const key = details.slot + '::' + control;
		if (!componentSelectGroups.has(key)) componentSelectGroups.set(key, {slot:details.slot, control:control, defaultLabel:details.default || 'Default', defaultIsChoice:Boolean(details.defaultIsChoice), options:[], cascade:Boolean(details.cascade)});
		else if (details.defaultIsChoice) componentSelectGroups.get(key).defaultIsChoice = true;
		const options = details.choices?.length ? details.choices.map(choice => {
			const frame = typeof choice === 'string' ? choice : choice.value;
			const label = typeof choice === 'string' ? choice : choice.label;
			const optionGroup = typeof choice === 'string' ? null : choice.group;
			return {pack:pack, frame:frame, label:label, group:optionGroup};
		}).filter(choice => details.defaultIsChoice || choice.frame !== details.default) : [{pack:pack, frame:null, label:details.value || framePackDisplayName(pack)}];
		componentSelectGroups.get(key).options.push(...options);
	});

	componentSelectGroups.forEach(group => {
		if (group.cascade) {
			container.appendChild(renderFrameCascadeControl(group));
			return;
		}
		const label = document.createElement('div');
		label.className = 'frame-customize-field';
		const title = document.createElement('span');
		title.textContent = group.control;
		const select = document.createElement('select');
		select.className = 'input frame-customize-input';
		select.setAttribute('aria-label', group.control);
		const defaultOption = document.createElement('option');
		defaultOption.value = '';
		defaultOption.textContent = group.defaultLabel;
		if (!group.defaultIsChoice) select.appendChild(defaultOption);
		group.options.forEach(option => {
			const element = document.createElement('option');
			element.value = option.pack + '::' + (option.frame || '');
			element.textContent = option.label;
			select.appendChild(element);
		});
		const selected = activeFrameComponentOptions[group.slot];
		select.value = selected ? selected.pack + '::' + (selected.frame || '') : '';
		select.onchange = () => applyFrameComponentCustomization(group.slot, select.value);
		label.append(title, select);
		container.appendChild(label);
	});

	componentCustomizations.forEach(([pack, details]) => {
		if (details.mode !== 'checkbox') return;
		container.appendChild(renderFrameCheckboxControl(
			details.control || details.label || framePackDisplayName(pack),
			details.option || 'Enabled',
			activeFrameComponentOptions[details.slot]?.pack === pack,
			checkbox => applyFrameComponentCustomization(details.slot, checkbox.checked ? pack + '::' : '')
		));
	});

	section.hidden = !container.children.length;
}

function renderFrameCheckboxControl(titleText, optionText, checked, onchange) {
	const field = document.createElement('div');
	field.className = 'frame-customize-field';
	const title = document.createElement('span');
	title.textContent = titleText;
	const label = document.createElement('label');
	label.className = 'checkbox-container input workspace-checkbox frame-customize-checkbox';
	label.textContent = optionText;
	const checkbox = document.createElement('input');
	checkbox.type = 'checkbox';
	checkbox.checked = checked;
	checkbox.onchange = () => onchange(checkbox);
	const checkmark = document.createElement('span');
	checkmark.className = 'checkmark';
	label.append(checkbox, checkmark);
	field.append(title, label);
	return field;
}

function renderFrameCascadeControl(group) {
	const field = document.createElement('div');
	field.className = 'frame-customize-field frame-cascade-field';
	const title = document.createElement('span');
	title.textContent = group.control;
	const cascade = document.createElement('div');
	cascade.className = 'frame-cascade';
	let cascadeCloseTimer = null;
	const trigger = document.createElement('button');
	trigger.type = 'button';
	trigger.className = 'input frame-cascade-trigger';
	trigger.setAttribute('aria-haspopup', 'menu');
	trigger.setAttribute('aria-expanded', 'false');
	const selected = activeFrameComponentOptions[group.slot];
	const selectedOption = selected ? group.options.find(option => option.pack === selected.pack && option.frame === selected.frame) : null;
	appendFrameColorChoiceContent(trigger, selectedOption || {label:group.defaultLabel, frame:''});
	trigger.onclick = () => {
		const open = !cascade.classList.contains('open');
		document.querySelectorAll('.frame-cascade.open').forEach(menu => menu.classList.remove('open'));
		cascade.classList.toggle('open', open);
		trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
	};

	const menu = document.createElement('div');
	menu.className = 'frame-cascade-menu';
	menu.setAttribute('role', 'menu');
	const addChoice = (parent, option, value, selectedChoice = false) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'frame-cascade-choice' + (selectedChoice ? ' selected' : '');
		appendFrameColorChoiceContent(button, option);
		button.setAttribute('role', 'menuitem');
		button.onclick = async event => {
			event.stopPropagation();
			cascade.classList.remove('open');
			trigger.setAttribute('aria-expanded', 'false');
			await applyFrameComponentCustomization(group.slot, value);
		};
		parent.appendChild(button);
	};
	addChoice(menu, {label:group.defaultLabel, frame:''}, '', !selected);

	const groupedOptions = new Map();
	group.options.forEach(option => {
		if (!option.group) return;
		if (!groupedOptions.has(option.group)) groupedOptions.set(option.group, []);
		groupedOptions.get(option.group).push(option);
	});
	groupedOptions.forEach((options, groupLabel) => {
		const submenuGroup = document.createElement('div');
		submenuGroup.className = 'frame-cascade-group';
		const groupButton = document.createElement('button');
		groupButton.type = 'button';
		groupButton.className = 'frame-cascade-group-trigger';
		groupButton.textContent = groupLabel;
		groupButton.setAttribute('aria-haspopup', 'menu');
		const arrow = document.createElement('span');
		arrow.textContent = '‹';
		arrow.setAttribute('aria-hidden', 'true');
		groupButton.appendChild(arrow);
		const submenu = document.createElement('div');
		submenu.className = 'frame-cascade-submenu';
		submenu.setAttribute('role', 'menu');
		let submenuCloseTimer = null;
		const positionSubmenu = () => requestAnimationFrame(() => {
			const bounds = groupButton.getBoundingClientRect();
			const top = Math.max(8, Math.min(bounds.top, window.innerHeight - submenu.offsetHeight - 8));
			// Slightly overlap the flyout with its parent row so there is no
			// one-pixel dead zone while the pointer crosses between them.
			submenu.style.left = (bounds.left + 3) + 'px';
			submenu.style.top = top + 'px';
		});
		const openSubmenu = () => {
			clearTimeout(submenuCloseTimer);
			menu.querySelectorAll('.frame-cascade-group.submenu-open').forEach(openGroup => {
				if (openGroup !== submenuGroup) openGroup.classList.remove('submenu-open');
			});
			submenuGroup.classList.add('submenu-open');
			positionSubmenu();
		};
		const gentlyCloseSubmenu = () => {
			clearTimeout(submenuCloseTimer);
			submenuCloseTimer = setTimeout(() => submenuGroup.classList.remove('submenu-open'), 260);
		};
		submenuGroup.onmouseenter = openSubmenu;
		submenuGroup.onmouseleave = gentlyCloseSubmenu;
		submenu.onmouseenter = openSubmenu;
		submenu.onmouseleave = gentlyCloseSubmenu;
		submenuGroup.onfocusin = openSubmenu;
		groupButton.onfocus = openSubmenu;
		groupButton.onclick = openSubmenu;
		options.forEach(option => addChoice(submenu, option, option.pack + '::' + option.frame, selected?.pack === option.pack && selected?.frame === option.frame));
		submenuGroup.append(groupButton, submenu);
		menu.appendChild(submenuGroup);
	});
	group.options.filter(option => !option.group).forEach(option => addChoice(menu, option, option.pack + '::' + option.frame, selected?.pack === option.pack && selected?.frame === option.frame));
	cascade.onmouseenter = () => clearTimeout(cascadeCloseTimer);
	cascade.onmouseleave = () => {
		clearTimeout(cascadeCloseTimer);
		cascadeCloseTimer = setTimeout(() => {
			cascade.classList.remove('open');
			trigger.setAttribute('aria-expanded', 'false');
		}, 320);
	};
	cascade.append(trigger, menu);
	field.append(title, cascade);
	return field;
}

function appendFrameColorChoiceContent(element, option) {
	const content = document.createElement('span');
	content.className = 'frame-color-choice-content';
	const value = option?.frame || '';
	if (value) {
		const icons = document.createElement('span');
		icons.className = 'frame-color-icons';
		icons.setAttribute('aria-hidden', 'true');
		if (value === 'M') {
			const gold = document.createElement('span');
			gold.className = 'frame-color-gold';
			icons.appendChild(gold);
		} else {
			value.split('').filter(color => 'WUBRG'.includes(color)).forEach(color => {
				const icon = document.createElement('img');
				icon.src = '/img/manaSymbols/' + color.toLowerCase() + '.svg';
				icon.alt = '';
				icons.appendChild(icon);
			});
		}
		content.appendChild(icons);
	}
	const name = document.createElement('span');
	name.className = 'frame-color-name';
	name.textContent = option?.label || '';
	content.appendChild(name);
	element.appendChild(content);
}

function enhanceWorkspaceSelect(select) {
	if (!select || select.dataset.workspaceSelectEnhanced === 'true') return;
	select.dataset.workspaceSelectEnhanced = 'true';
	select.classList.add('workspace-native-select');
	select.tabIndex = -1;
	select.setAttribute('aria-hidden', 'true');

	const dropdown = document.createElement('div');
	dropdown.className = 'frame-cascade workspace-select';
	const trigger = document.createElement('button');
	trigger.type = 'button';
	trigger.className = 'input frame-cascade-trigger workspace-select-trigger';
	trigger.id = select.id ? select.id + '-trigger' : '';
	trigger.setAttribute('aria-haspopup', 'listbox');
	trigger.setAttribute('aria-expanded', 'false');
	trigger.setAttribute('aria-label', select.getAttribute('aria-label') || select.previousElementSibling?.textContent?.trim() || 'Select an option');
	const menu = document.createElement('div');
	menu.className = 'frame-cascade-menu workspace-select-menu';
	menu.setAttribute('role', 'listbox');
	let closeTimer = null;

	const close = () => {
		dropdown.classList.remove('open');
		dropdown.classList.remove('open-up');
		trigger.setAttribute('aria-expanded', 'false');
	};
	const sync = () => {
		const selected = select.options[select.selectedIndex];
		trigger.textContent = selected?.textContent || select.getAttribute('placeholder') || 'Select';
		trigger.disabled = select.disabled;
		menu.querySelectorAll('.workspace-select-choice').forEach(choice => {
			const chosen = choice.dataset.value === select.value;
			choice.classList.toggle('selected', chosen);
			choice.setAttribute('aria-selected', chosen ? 'true' : 'false');
		});
	};
	const rebuild = () => {
		menu.innerHTML = '';
		Array.from(select.options).forEach(option => {
			const choice = document.createElement('button');
			choice.type = 'button';
			choice.className = 'frame-cascade-choice workspace-select-choice';
			choice.dataset.value = option.value;
			choice.textContent = option.textContent;
			choice.disabled = option.disabled;
			choice.setAttribute('role', 'option');
			choice.onclick = event => {
				event.preventDefault();
				event.stopPropagation();
				select.value = option.value;
				sync();
				close();
				select.dispatchEvent(new Event('input', {bubbles:true}));
				select.dispatchEvent(new Event('change', {bubbles:true}));
				trigger.focus();
			};
			menu.appendChild(choice);
		});
		sync();
	};

	trigger.onclick = event => {
		event.preventDefault();
		event.stopPropagation();
		if (trigger.disabled) return;
		const open = !dropdown.classList.contains('open');
		document.querySelectorAll('.frame-cascade.open').forEach(control => {
			control.classList.remove('open');
			control.querySelector('[aria-expanded]')?.setAttribute('aria-expanded', 'false');
		});
		if (open) {
			rebuild();
			dropdown.classList.add('open');
			trigger.setAttribute('aria-expanded', 'true');
			requestAnimationFrame(() => {
				const triggerBounds = trigger.getBoundingClientRect();
				const availableBelow = window.innerHeight - triggerBounds.bottom - 8;
				const availableAbove = triggerBounds.top - 8;
				dropdown.classList.toggle('open-up', menu.offsetHeight > availableBelow && availableAbove > availableBelow);
			});
		}
	};
	dropdown.onmouseenter = () => clearTimeout(closeTimer);
	dropdown.onmouseleave = () => {
		clearTimeout(closeTimer);
		closeTimer = setTimeout(close, 320);
	};
	select.addEventListener('change', sync);
	new MutationObserver(rebuild).observe(select, {childList:true, subtree:true, attributes:true});
	dropdown.append(trigger, menu);
	select.insertAdjacentElement('afterend', dropdown);
	if (select.id) {
		document.querySelectorAll(`label[for="${select.id}"]`).forEach(label => label.htmlFor = trigger.id);
	}
	rebuild();
}

function initializeWorkspaceSelects() {
	const workspace = document.querySelector('.creator-workspace');
	if (!workspace) return;
	const enhanceAll = root => {
		if (root.matches?.('select.input')) enhanceWorkspaceSelect(root);
		root.querySelectorAll?.('select.input').forEach(enhanceWorkspaceSelect);
	};
	enhanceAll(workspace);
	new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
		if (node.nodeType === Node.ELEMENT_NODE) enhanceAll(node);
	}))).observe(workspace, {childList:true, subtree:true});
}

async function applyFrameComponentCustomization(slot, value) {
	if (!value) {
		delete activeFrameComponentOptions[slot];
	} else {
		const separator = value.indexOf('::');
		const selection = {
			pack: separator < 0 ? value : value.slice(0, separator),
			frame: separator < 0 ? null : (value.slice(separator + 2) || null)
		};
		activeFrameComponentOptions[slot] = selection;
		// Component packs are edited frequently during local prototyping. Drop the
		// parsed definition whenever the selection changes so manual bounds edits
		// are picked up without restarting the server.
		if (['127.0.0.1', 'localhost'].includes(window.location.hostname)) {
			frameComponentPackCache.delete(selection.pack);
		}
	}
	const section = document.querySelector('#frameCustomize');
	if (section) section.classList.add('loading');
	try {
		await autoFrame();
		// Component removal can change text bounds without adding a replacement
		// layer, so redraw text explicitly instead of leaving the shifted raster.
		if (typeof drawTextBuffer === 'function') drawTextBuffer(0);
		renderFrameCustomize(activeFramePack);
	} finally {
		if (section) section.classList.remove('loading');
	}
}

function getActiveFrameColorIdentityColors() {
	if ((window.card?.text?.mana?.text || '').trim()) return null;
	const selection = activeFrameComponentOptions['color-identity'];
	if (!selection?.frame) return null;
	if (selection.frame === 'M') return ['W', 'U', 'B'];
	return selection.frame.split('').filter(color => 'WUBRG'.includes(color));
}

async function loadFrameComponentDefinitions(pack) {
	const assetPack = FRAME_REGISTRY?.components?.[pack]?.assetPack || pack;
	if (frameComponentPackCache.has(assetPack)) return frameComponentPackCache.get(assetPack);
	const localDevelopment = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
	const response = await fetch('/js/frames/pack' + assetPack + '.js', localDevelopment ? {cache:'no-store'} : undefined);
	if (!response.ok) throw new Error('Could not load component pack ' + pack);
	const source = await response.text();
	const fakeElement = {disabled:false, onclick:null, checked:false, value:''};
	const fakeDocument = {querySelector:() => fakeElement, querySelectorAll:() => []};
	const evaluatePack = new Function('document', 'loadFramePack', 'loadFramePacks', 'notify', 'availableFrames', source + '\nreturn availableFrames;');
	const frames = evaluatePack(fakeDocument, () => {}, () => {}, () => {}, []);
	frameComponentPackCache.set(assetPack, frames);
	return frames;
}

function frameCustomizeColorName(colors, typeLine) {
	const normalizedType = String(typeLine || '').toLowerCase();
	if (normalizedType.includes('land')) return 'Land';
	if (normalizedType.includes('vehicle')) return 'Vehicle';
	if (normalizedType.includes('artifact')) return 'Artifact';
	if (colors.length > 1) return 'Multicolored';
	if (colors.length === 1) return ({W:'White', U:'Blue', B:'Black', R:'Red', G:'Green'})[colors[0]] || 'White';
	return 'Colorless';
}

async function applyActiveFrameComponents(colors, typeLine, requestId) {
	const componentRoots = new Set([activeFramePack, activeFrameCustomizationPack].filter(Boolean));
	const automaticFlipsideColors = frameFlipsideTextColors();
	const hasPlaneswalkerMDFC = componentRoots.has('PlaneswalkerMDFC') || componentRoots.has('PlaneswalkerMDFCBack');
	const planeswalkerMDFCFace = componentRoots.has('PlaneswalkerMDFCBack') ? 'back' : 'front';
	Object.entries(FRAME_REGISTRY?.components || {}).forEach(([componentPack, details]) => {
		if (!details.defaultIsChoice || activeFrameComponentOptions[details.slot]) return;
		const matchingPack = details.whenPacks?.find(pack => componentRoots.has(pack));
		if (!matchingPack) return;
		const defaultFrame = details.defaultsByPack?.[matchingPack] || details.default;
		activeFrameComponentOptions[details.slot] = {pack:componentPack, frame:defaultFrame};
	});
	const manaCost = window.card?.text?.mana?.text || '';
	const isLegendary = String(typeLine || '').toLowerCase().includes('legendary');
	const selections = Object.entries(activeFrameComponentOptions).filter(([slot]) => {
		const selection = activeFrameComponentOptions[slot];
		const details = FRAME_REGISTRY?.components?.[selection?.pack] || FRAME_REGISTRY?.variants?.[selection?.pack];
		if (details?.requiresLayer && !frameHasCustomizableLayer(details.requiresLayer)) return false;
		if (slot === 'color-identity') return !manaCost.trim();
		if (slot === 'crown-variant') return isLegendary;
		if (slot === 'flipside-color') return hasPlaneswalkerMDFC && !automaticFlipsideColors.length;
		return true;
	});
	if (hasPlaneswalkerMDFC && automaticFlipsideColors.length) {
		selections.push(['flipside-color', {
			pack:'PlaneswalkerMDFCFlipsideColor',
			frame:automaticFlipsideColors.length > 1 ? 'M' : automaticFlipsideColors[0]
		}]);
	}
	const hasColorIdentity = selections.some(([slot]) => slot === 'color-identity');
	const typeText = card.text?.type;
	if (typeText) {
		if (hasColorIdentity) {
			if (frameCustomizeTypeObject !== typeText) {
				frameCustomizeTypeObject = typeText;
				frameCustomizeTypeDefaults = {x:typeText.x || 0, width:typeText.width || 1};
			}
			// Official indicators sit immediately left of the typeline. The old
			// 255/1500 inset left roughly 70 px of empty space; 194/1500 matches
			// the original {right66} placement while preserving wider layouts.
			const indicatorTypeX = Math.max(frameCustomizeTypeDefaults.x, 194 / 1500);
			const typeRightEdge = frameCustomizeTypeDefaults.x + frameCustomizeTypeDefaults.width;
			typeText.x = indicatorTypeX;
			typeText.width = Math.max(0.1, typeRightEdge - indicatorTypeX);
		} else if (frameCustomizeTypeDefaults && frameCustomizeTypeObject === typeText) {
			typeText.x = frameCustomizeTypeDefaults.x;
			typeText.width = frameCustomizeTypeDefaults.width;
			frameCustomizeTypeDefaults = null;
			frameCustomizeTypeObject = null;
		} else if (!hasColorIdentity) {
			frameCustomizeTypeDefaults = null;
			frameCustomizeTypeObject = null;
		}
	}
	if (!selections.length) return;

	const colorName = frameCustomizeColorName(colors, typeLine);
	const layers = [];
	let borderPlacement = null;
	let replacePowerToughness = false;
	for (const [slot, selection] of selections) {
		const definitions = await loadFrameComponentDefinitions(selection.pack);
		const clone = frame => {
			const result = JSON.parse(JSON.stringify(frame));
			result.frameCustomizeSlot = slot;
			result.frameCustomizePack = selection.pack;
			result.masks = result.masks || [];
			return result;
		};
		if (selection.pack === 'M15DarkPT') {
			const source = definitions.find(frame => frame.name === colorName + ' Power/Toughness') || definitions.find(frame => /power\s*\/\s*toughness/i.test(frame.name || ''));
			if (source) {
				const powerToughness = clone(source);
				powerToughness.masks = [];
				layers.unshift(powerToughness);
				replacePowerToughness = true;
			}
		} else if (selection.pack === 'PlaneswalkerMDFCFlipsideColor') {
			const colorName = ({W:'White', U:'Blue', B:'Black', R:'Red', G:'Green', M:'Multicolored'})[selection.frame];
			const source = definitions.find(frame => frame.name === colorName + ` Frame (${planeswalkerMDFCFace === 'back' ? 'Back' : 'Front'})`);
			if (source) {
				const flipside = clone(source);
				flipside.masks = flipside.masks.filter(mask => ['Reminder', 'Flipside'].includes(mask.name));
				layers.unshift(flipside);
			}
		} else if (selection.pack === 'M15Miracle') {
			const source = definitions.find(frame => frame.name === colorName + ' Miracle Frame') || definitions[0];
			if (source) layers.push(clone(source));
		} else if (selection.pack === 'M15Borders') {
			const source = definitions.find(frame => frame.name === selection.frame);
			if (source) {
				const border = clone(source);
				const borderIndex = card.frames.findIndex(frame =>
					(frame.masks || []).some(mask => /^(?:full )?border$/i.test(mask.name || ''))
				);
				if (borderIndex >= 0) {
					border.masks = JSON.parse(JSON.stringify(card.frames[borderIndex].masks || []));
					borderPlacement = {layer:border, index:borderIndex, replace:true};
				} else {
					border.masks = border.masks.filter(mask => mask.name === 'Full Border');
					const baseFrameIndex = card.frames.findIndex(frame => {
						const bounds = frame.bounds || {};
						const isFullCard = (bounds.x || 0) === 0 && (bounds.y || 0) === 0 &&
							(bounds.width || 1) === 1 && (bounds.height || 1) === 1;
						return isFullCard && !(frame.masks || []).length && /\bframe\b/i.test(frame.name || '');
					});
					if (baseFrameIndex >= 0) borderPlacement = {layer:border, index:baseFrameIndex, replace:false};
					else layers.push(border);
				}
			}
		} else if (selection.pack === 'M15CIPips' || selection.pack === 'ClassicshiftedCIPips') {
			const pipColors = colors.length ? colors.slice(0, 5) : ['W'];
			const pipNames = {W:'White Pip', U:'Blue Pip', B:'Black Pip', R:'Red Pip', G:'Green Pip'};
			const indicatorPosition = frameColorIndicatorPosition();
			const indicatorOffsetX = indicatorPosition.x - 150;
			const indicatorOffsetY = indicatorPosition.y - 1242;
			const base = definitions.find(frame => frame.name.includes('Pip Base'));
			if (base) {
				const positionedBase = clone(base);
				if (positionedBase.bounds) {
					positionedBase.bounds.x += indicatorOffsetX / 1500;
					positionedBase.bounds.y = indicatorPosition.y / 2100 - positionedBase.bounds.height / 2;
				}
				layers.push(positionedBase);
			}
			if (selection.frame === 'M') {
				const gold = clone(definitions[0]);
				gold.name = 'Gold Color Indicator';
				gold.src = frameGoldColorIndicator(indicatorPosition.x, indicatorPosition.y);
				gold.masks = [];
				layers.unshift(gold);
				continue;
			}
			const standardMasks = {
				2:['First Half','Second Half']
			}[pipColors.length];
			for (const [index, color] of pipColors.entries()) {
				const source = definitions.find(frame => frame.name === pipNames[color]);
				if (!source) continue;
				const pip = clone(source);
				pip.src = await frameTranslatedSvgAsset(pip.src, indicatorOffsetX, indicatorOffsetY);
				if (standardMasks) {
					pip.masks = pip.masks.filter(mask => mask.name === standardMasks[index]);
					for (const mask of pip.masks) mask.src = await frameTranslatedSvgAsset(mask.src, indicatorOffsetX, indicatorOffsetY);
				} else {
					pip.masks = pipColors.length > 1 ? [{src:frameColorIdentityMask(index, pipColors.length, indicatorPosition.x, indicatorPosition.y), name:'Color Indicator Segment ' + (index + 1)}] : [];
				}
				layers.unshift(pip);
			}
		} else if (selection.pack === 'TheList') {
			const source = definitions.find(frame => frame.name === 'Post-M15') || definitions[0];
			if (source) layers.unshift(clone(source));
		} else if (selection.pack === 'Brawl' || selection.pack === 'ModalLegendCrownsBrawl') {
			const crownColor = colorName === 'Vehicle' ? 'Artifact' : colorName;
			const crown = definitions.find(frame => frame.name === crownColor + ' Crown') || definitions[0];
			const cover = definitions.find(frame => frame.name.includes('Border Cover'));
			if (cover) layers.push(clone(cover));
			if (crown) {
				const fullCrown = clone(crown);
				fullCrown.masks = [];
				layers.unshift(fullCrown);
			}
		} else {
			const source = definitions.find(frame => frame.name === selection.frame) || definitions[0];
			if (source) layers.unshift(clone(source));
		}
	}
	if (!layers.length && !borderPlacement) return;
	if (requestId && typeof autoFrameRequestId !== 'undefined' && requestId !== autoFrameRequestId) return;
	if (borderPlacement) {
		const frameList = document.querySelector('#frame-list');
		const currentElement = frameList?.children[borderPlacement.index] || null;
		if (borderPlacement.replace) card.frames.splice(borderPlacement.index, 1, borderPlacement.layer);
		else card.frames.splice(borderPlacement.index, 0, borderPlacement.layer);
		await addFrame([], borderPlacement.layer);
		const borderElement = frameList?.firstElementChild;
		if (borderElement && currentElement) {
			if (borderPlacement.replace) currentElement.replaceWith(borderElement);
			else currentElement.before(borderElement);
		}
	}
	if (replacePowerToughness) {
		const frameList = document.querySelector('#frame-list');
		for (let index = card.frames.length - 1; index >= 0; index--) {
			if (!/power\s*\/\s*toughness/i.test(card.frames[index].name || '') || /cutout/i.test(card.frames[index].name || '')) continue;
			card.frames.splice(index, 1);
			frameList?.children[index]?.remove();
		}
	}
	card.frames.unshift(...layers);
	for (const layer of layers.slice().reverse()) await addFrame([], layer);
}

function frameColorIndicatorProfile() {
	return activeFrameCustomizationPack ||
		(typeof automaticVariantPack !== 'undefined' && automaticVariantPack) ||
		document.querySelector('#autoFrame')?.dataset.profile ||
		activeFramePack ||
		'default';
}

function frameColorIndicatorOffset() {
	let profile = frameColorIndicatorProfile();
	const visited = new Set();
	while (profile && !visited.has(profile)) {
		if (FRAME_COLOR_INDICATOR_OFFSETS[profile]) return FRAME_COLOR_INDICATOR_OFFSETS[profile];
		visited.add(profile);
		profile = typeof FRAME_REGISTRY === 'undefined' ? null : FRAME_REGISTRY.definition(profile)?.details?.parent;
	}
	return FRAME_COLOR_INDICATOR_OFFSETS.default;
}

function frameColorIndicatorPosition() {
	const typeText = card.text?.type;
	const offset = frameColorIndicatorOffset();
	if (!typeText) return {x:150 + offset.x, y:1242 + offset.y};
	const regularTypeCenter = 0.5625 + 0.0548 / 2;
	const regularIndicatorCenter = 1242 / 2100;
	return {
		x: 150 + offset.x,
		y: Math.round((typeText.y + typeText.height / 2 + regularIndicatorCenter - regularTypeCenter) * 2100) + offset.y
	};
}

async function frameTranslatedSvgAsset(source, offsetX, offsetY) {
	if ((!offsetX && !offsetY) || !source?.toLowerCase().includes('.svg')) return source;
	const key = source + '::' + offsetX + '::' + offsetY;
	if (frameTranslatedSvgCache.has(key)) return frameTranslatedSvgCache.get(key);
	const response = await fetch(source);
	if (!response.ok) return source;
	const original = await response.text();
	const svgStart = original.indexOf('<svg');
	const openingEnd = original.indexOf('>', svgStart);
	const closingStart = original.lastIndexOf('</svg>');
	if (svgStart < 0 || openingEnd < 0 || closingStart < 0) return source;
	const translated = original.slice(svgStart, openingEnd + 1) +
		'<g transform="translate(' + offsetX + ' ' + offsetY + ')">' +
		original.slice(openingEnd + 1, closingStart) +
		'</g></svg>';
	const result = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(translated);
	frameTranslatedSvgCache.set(key, result);
	return result;
}

function frameColorIdentityMask(index, count, centerX = 150, centerY = 1242) {
	const radius = 24;
	const firstSegmentStart = count === 3 ? 90 : 180 - (180 / count);
	const startAngle = firstSegmentStart + (360 * index / count);
	const endAngle = firstSegmentStart + (360 * (index + 1) / count);
	const point = angle => {
		const radians = angle * Math.PI / 180;
		return [centerX + radius * Math.cos(radians), centerY + radius * Math.sin(radians)];
	};
	const start = point(startAngle);
	const end = point(endAngle);
	const largeArc = (360 / count) > 180 ? 1 : 0;
	const path = `M ${centerX} ${centerY} L ${start[0]} ${start[1]} A ${radius} ${radius} 0 ${largeArc} 1 ${end[0]} ${end[1]} Z`;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="2100" viewBox="0 0 1500 2100"><path d="${path}" fill="white"/></svg>`;
	return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function frameGoldColorIndicator(centerX = 150, centerY = 1242) {
	const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="2100" viewBox="0 0 1500 2100"><circle cx="' + centerX + '" cy="' + centerY + '" r="22" fill="#d9ad45"/></svg>';
	return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

async function applyFrameCustomization(pack, sourceControl) {
	const section = document.querySelector('#frameCustomize');
	if (section) section.classList.add('loading');
	document.querySelectorAll('#frameCustomizeControls input, #frameCustomizeControls select').forEach(control => {
		if (control === sourceControl) return;
		if (control.tagName === 'SELECT') control.selectedIndex = 0;
		else control.checked = false;
	});
	try {
		const packDetails = FRAME_REGISTRY?.definition(pack)?.details;
		const assetPack = packDetails?.assetPack || pack;
		const planeswalkerTransformDefaults = {
			PlaneswalkerTransformFront:'Sun',
			PlaneswalkerTransformBack:'Crescent Moon',
			PlaneswalkerTransformFrontDBL:'Sun',
			PlaneswalkerTransformBackDBL:'Crescent Moon'
		};
		if (planeswalkerTransformDefaults[pack]) {
			activeFrameComponentOptions['transform-icon'] = {pack:'PlaneswalkerTransformIcons', frame:planeswalkerTransformDefaults[pack]};
		} else if (pack.startsWith('Planeswalker')) {
			delete activeFrameComponentOptions['transform-icon'];
		} else if (pack === 'M15TransformFront') {
			activeFrameComponentOptions['transform-icon'] = {pack:'M15TransformTypes', frame:'Up Arrow'};
		} else if (pack === 'M15TransformBack') {
			activeFrameComponentOptions['transform-icon'] = {pack:'M15TransformTypes', frame:'Down Arrow'};
		} else if (pack === 'M15TransformBackNew') {
			// Keep the default in the same overlay layer as every replacement.
			// This prevents the icon from jumping between baked and overlay bounds.
			activeFrameComponentOptions['transform-icon'] = {pack:'M15TransformTypesBack', frame:'Down Arrow'};
		} else {
			const transformIcon = activeFrameComponentOptions['transform-icon'];
			if (transformIcon && ['M15TransformTypes','M15TransformTypesBack'].includes(transformIcon.pack)) {
				delete activeFrameComponentOptions['transform-icon'];
			}
		}
		await loadScript('/js/frames/pack' + assetPack + '.js');
		activeFrameCustomizationPack = pack === activeFramePack ? null : pack;
		await updateAutomaticFrameFromCatalog(pack);
		renderFrameCustomize(activeFramePack);
	} finally {
		if (section) section.classList.remove('loading');
	}
}

async function updateAutomaticFrameFromCatalog(pack) {
	const autoFrameInput = document.querySelector('#autoFrame');
	if (!autoFrameInput) return;
	const engine = typeof FRAME_REGISTRY == 'undefined' ? pack : (FRAME_REGISTRY.engine(pack) || pack);
	autoFrameInput.value = engine;
	autoFrameInput.dataset.profile = pack;
	localStorage.setItem('autoFrame', engine);
	localStorage.setItem('selectedFrameProfile', pack);
	const automaticToggle = document.querySelector('#automaticallyUpdateFrame');
	if (!automaticToggle || !automaticToggle.checked) return;
	const layoutButton = document.querySelector('#loadFrameVersion');
	if (layoutButton && typeof layoutButton.onclick == 'function' && !layoutButton.disabled) {
		await layoutButton.onclick();
	}
	autoFramePack = engine;
	await autoFrame();
}

function filterFrameCatalog(value) {
	const query = value.trim().toLowerCase();
	let visibleFrames = 0;
	document.querySelectorAll('.frame-catalog-item').forEach(item => {
		const matchesSearch = !query || item.dataset.name.includes(query);
		const matchesCategory = activeFrameCategory == 'all' || item.dataset.category == activeFrameCategory;
		const visible = matchesSearch && matchesCategory;
		item.hidden = !visible;
		if (visible) visibleFrames++;
	});
	const catalog = document.querySelector('#frameCatalog');
	if (catalog) catalog.scrollLeft = 0;
	updateFrameCatalogCount(visibleFrames);
}

function clearFrameCatalogSearch() {
	const search = document.querySelector('#frameSearch');
	if (!search) return;
	search.value = '';
	filterFrameCatalog('');
	search.focus();
}

function updateFrameCatalogCount(visibleFrames) {
	const count = document.querySelector('#frameCatalogCount');
	if (!count) return;
	const totalFrames = document.querySelectorAll('.frame-catalog-item').length;
	count.textContent = visibleFrames == totalFrames ? totalFrames + ' frames' : visibleFrames + ' of ' + totalFrames;
}

initializeWorkspaceSelects();
window.frameCatalogReadyPromise = Promise.resolve(renderFrameCatalog());
