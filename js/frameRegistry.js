/*
 * Semantic frame registry
 *
 * This file intentionally describes relationships between packs rather than
 * image paths. Pack scripts remain the source of truth for assets and layout.
 */
window.FRAME_REGISTRY = (() => {
	const colorIdentityNames = {W:'White', U:'Blue', B:'Black', R:'Red', G:'Green'};
	const colorIdentityCombinationNames = {
		W:'White', U:'Blue', B:'Black', R:'Red', G:'Green',
		WU:'Azorius', WB:'Orzhov', UB:'Dimir', UR:'Izzet', BR:'Rakdos',
		BG:'Golgari', RG:'Gruul', RW:'Boros', GW:'Selesnya', GU:'Simic',
		WUB:'Esper', UBR:'Grixis', BRG:'Jund', RGW:'Naya', GWU:'Bant',
		WBG:'Abzan', URW:'Jeskai', BGU:'Sultai', RWB:'Mardu', GUR:'Temur',
		WUBR:'Yore-Tiller', UBRG:'Glint-Eye', BRGW:'Dune-Brood',
		RGWU:'Ink-Treader', GWUB:'Witch-Maw'
	};
	const colorIdentityGroups = {
		'One Color': ['W','U','B','R','G'],
		'Two Colors': ['WU','WB','UB','UR','BR','BG','RG','RW','GW','GU'],
		'Three Colors': ['WUB','UBR','BRG','RGW','GWU','WBG','URW','BGU','RWB','GUR'],
		'Four Colors': ['WUBR','UBRG','BRGW','RGWU','GWUB']
	};
	const canonicalColorOrders = Object.values(colorIdentityGroups).flat().concat('WUBRG');
	const canonicalColorOrderBySet = new Map(canonicalColorOrders.map(order => [
		order.split('').sort((a, b) => 'WUBRG'.indexOf(a) - 'WUBRG'.indexOf(b)).join(''),
		order
	]));
	const colorIdentityChoices = Object.entries(colorIdentityGroups).flatMap(([group, values]) => values.map(value => ({
		value:value,
		label:colorIdentityCombinationNames[value] || value.split('').map(color => colorIdentityNames[color]).join(' + '),
		group:group
	})));
	colorIdentityChoices.push(
		{value:'WUBRG', label:'Five Colors'},
		{value:'M', label:'Gold'}
	);

	const components = {
		M15LegendCrowns: {slot:'crown', family:'regular', when:'legendary'},
		LegendCrownsEtched: {slot:'crown', family:'etched', when:'legendary'},
		M15LegendCrownsFloating: {slot:'crown', family:'borderless', when:'legendary'},
		UBLegendCrownsFloating: {slot:'crown-variant', family:'borderless', mode:'select', control:'Legend Crown', default:'Floating Legend Crown', value:'Universes Beyond Legend Crown', requiresLayer:'legend-crown'},
		UBLegendCrowns: {slot:'crown', family:'universes-beyond', when:'legendary'},
		M15InnerCrowns: {slot:'inner-crown', family:'regular', when:'legendary && enchantment', layer:'above:crown'},
		InnerCrownsEtched: {slot:'inner-crown', family:'etched', when:'legendary && enchantment', layer:'above:crown'},
		M15Miracle: {slot:'miracle', family:'regular', mode:'checkbox', label:'Miracle', incompatibleLayer:'legend-crown'},
		M15DarkPT: {slot:'power-toughness-variant', family:'regular', mode:'checkbox', control:'Power/Toughness Box', option:'Dark', requiresLayer:'power-toughness'},
		M15HoloStamps: {slot:'holo-stamp', family:'all', when:'rarity:R|M|S'},
		'M15Nickname-2': {slot:'nickname', family:'regular', when:'hasNickname'},
		M15SmoothNickname: {slot:'nickname-crown', family:'borderless', when:'hasNickname && legendary'},
		M15Borders: {slot:'border-color', family:'regular', mode:'select', control:'Border Color', default:'Black', choices:['White Border','Silver Border','Gold Border'], suppressHoloStamp:true},
		M15CIPips: {slot:'color-identity', family:'regular', mode:'select', control:'Color Indicator', default:'None', choices:colorIdentityChoices, whenNoMana:true, cascade:true},
		TheList: {slot:'list-stamp', family:'regular', mode:'checkbox', label:'The List', layer:'top'},
		Brawl: {slot:'crown-variant', family:'regular', mode:'select', control:'Legend Crown', default:'Normal Legend Crown', value:'Brawl', requiresLayer:'legend-crown'},
		ShatteredGlass: {slot:'crown-variant', family:'regular', mode:'select', default:'Normal', review:true},
		PlaneswalkerHoloStamps: {slot:'holo-stamp', family:'planeswalker', when:'rarity:R|M|S'},
		PlaneswalkerMDFCFlipsideColor: {
			slot:'flipside-color', family:'planeswalker', mode:'select', control:'Flipside Color',
			default:'Match Front', assetPack:'PlaneswalkerMDFC', whenPacks:['PlaneswalkerMDFC','PlaneswalkerMDFCBack'],
			automaticFromFlipsideText:true,
			choices:[
				{value:'W', label:'White'}, {value:'U', label:'Blue'}, {value:'B', label:'Black'},
				{value:'R', label:'Red'}, {value:'G', label:'Green'}, {value:'M', label:'Multicolored'}
			]
		},
		PlaneswalkerTransformIcons: {slot:'transform-icon', family:'planeswalker', mode:'select', control:'Transform Icon', default:'Sun', defaultsByPack:{PlaneswalkerTransformBack:'Crescent Moon', PlaneswalkerTransformBackDBL:'Crescent Moon'}, defaultIsChoice:true, whenPacks:['PlaneswalkerTransformFront','PlaneswalkerTransformBack','PlaneswalkerTransformFrontDBL','PlaneswalkerTransformBackDBL'], choices:['Sun','Crescent Moon','Full Moon','Emrakul','Compass','Land','Planeswalker Ember','Planeswalker Spark','Lesson']},
		M15TransformTypes: {slot:'transform-icon', family:'regular', mode:'select', control:'Transform Icon', default:'Up Arrow', defaultIsChoice:true, whenPacks:['M15TransformFront','M15TransformBack','SagaDFC'], choices:['Up Arrow','Down Arrow','Sun','Crescent Moon','Full Moon','Emrakul','Compass','Land','Planeswalker Ember','Planeswalker Spark','Lesson','Closed Fan','Open Fan','Meld']},
		M15TransformTypesBack: {slot:'transform-icon', family:'regular', mode:'select', control:'Transform Icon', default:'Down Arrow', defaultIsChoice:true, whenPacks:['M15TransformBackNew'], choices:['Up Arrow','Down Arrow','Sun','Crescent Moon','Full Moon','Emrakul','Compass','Land','Planeswalker Ember','Planeswalker Spark','Lesson','Closed Fan','Open Fan','Meld']},
		TransformLegendCrowns: {slot:'crown', family:'transform', when:'legendary'},
		TransformLegendCrownsFloating: {slot:'crown', family:'transform-borderless', when:'legendary'},
		TransformLegendCrownsFloatingBackRight: {slot:'crown', family:'transform-borderless-back', when:'legendary'},
		TransformLegendCrownsNickname: {slot:'nickname-crown', family:'transform-borderless', when:'legendary && hasNickname'},
		ModalLegendCrowns: {slot:'crown', family:'modal', when:'legendary'},
		ModalLegendCrownsFloating: {slot:'crown', family:'modal-borderless', when:'legendary'},
		ModalLegendCrownsNickname: {slot:'nickname-crown', family:'modal', when:'legendary && hasNickname'},
		ModalLegendCrownsBrawl: {slot:'crown-variant', family:'modal', mode:'select', control:'Variant', default:'Default', value:'Brawl', requiresLayer:'legend-crown'},
		ClassicshiftedPlaneswalkerTransform: {slot:'transform-addons', family:'classicshifted-planeswalker'},
		ClassicshiftedDFC: {slot:'mdfc-addons', family:'classicshifted'},
		ClassicshiftedTransform: {slot:'transform-addons', family:'classicshifted'},
		ClassicshiftedCIPips: {slot:'color-identity', family:'classicshifted', mode:'select', control:'Color Indicator', default:'None', choices:colorIdentityChoices, whenNoMana:true, cascade:true},
		StoneCutterDeluxeNicknameAddons: {slot:'nickname', family:'stonecutter', when:'hasNickname'},
		StoneCutterDeluxePlaneswalkerTransformAddons: {slot:'transform-addons', family:'stonecutter-planeswalker'},
		StoneCutterDeluxeDFC: {slot:'mdfc-addons', family:'stonecutter'},
		StoneCutterDeluxeTransformAddons: {slot:'transform-addons', family:'stonecutter'}
	};

	// Metadata for catalog profiles that need deterministic, non-color-based
	// composition. Keeping this here prevents one-off layout packs from silently
	// failing when the global default color changes.
	const profiles = {
		Leveler: {powerToughnessPattern:'{color} PT'},
		Planechase: {
			standaloneFrame:'Planar Frame (1)',
			standaloneFrameByType:{phenomenon:'Planar Frame (Phenomenon)'}
		},
		Vanguard: {standaloneFrame:'Vanguard Frame'},
		Cardback: {standaloneFrame:'Cardback'}
	};

	const variants = {
		M15Nyx: {parent:'M15Regular-1', when:'enchantment', precedence:30},
		M15Snow: {parent:'M15Regular-1', when:'snow', precedence:40},
		M15Lands: {parent:'M15Regular-1', when:'land', precedence:20},
		Class: {parent:'M15Regular-1', when:'class', precedence:60},
		Case: {parent:'M15Regular-1', when:'case', precedence:60},
		SagaRegular: {parent:'M15Regular-1', when:'saga', precedence:60},
		SagaCreature: {parent:'SagaRegular', groupParent:'M15Regular-1', when:'saga-creature', precedence:80},
		ClassUB: {parent:'UB', when:'class', precedence:60},
		CaseUB: {parent:'UB', when:'case', precedence:60},
		SagaUB: {parent:'UB', when:'saga', precedence:60},
		SagaCreatureUB: {parent:'SagaUB', groupParent:'UB', when:'saga-creature', precedence:80},
		EtchedNyx: {parent:'Etched', when:'enchantment', precedence:30},
		EtchedSnow: {parent:'Etched', when:'snow', precedence:40},
		PrototypeExtended: {parent:'Prototype', mode:'checkbox', label:'Extended (Puma) Art'},
		StationBorderless: {parent:'StationRegular', mode:'select', control:'Style', value:'Borderless'},
		GenericShowcase: {parent:'M15Regular-1', mode:'select', control:'Style', value:'Borderless'},
		Borderless: {parent:'M15Regular-1', mode:'select', control:'Style', value:'Borderless (Alt)'},
		M15ClearTextboxes: {parent:'M15Regular-1', mode:'select', control:'Style', value:'Full Art'},
		M15BoxTopper: {parent:'M15Regular-1', mode:'select', control:'Style', value:'Extended Art'},
		M15ExtendedArtShort: {parent:'M15Regular-1', mode:'select', control:'Style', value:'Extended Art (Shorter Textbox)'},
		SDCC15: {
			parent:'M15Regular-1', mode:'select', control:'Style', value:'Blackout', standaloneFrame:'Frame',
			standaloneAccessories:[{name:'Power/Toughness', when:'creature-or-pt'}]
		},
		UBFull: {parent:'UB', mode:'select', control:'Style', value:'Full Art', whenBaseOnly:true},
		UBExtendedArt: {parent:'UB', mode:'select', control:'Style', value:'Extended Art', whenBaseOnly:true},
		DoubleFeatureTransform: {parent:'DoubleFeature', mode:'select', control:'Transform', value:'Front'},
		EquinoxFront: {parent:'Equinox', mode:'select', control:'Transform', value:'Front'},
		EquinoxBack: {parent:'Equinox', mode:'select', control:'Transform', value:'Back'},
		PlaneswalkerDBL: {parent:'DoubleFeature', when:'planeswalker', precedence:100},
		PlaneswalkerRegular: {parent:'M15Regular-1', when:'planeswalker', precedence:100},
		PlaneswalkerBorderless: {parent:'PlaneswalkerRegular', mode:'select', control:'Style', value:'Borderless'},
		PlaneswalkerBoxTopper: {parent:'PlaneswalkerRegular', mode:'select', control:'Style', value:'Extended Art'},
		PlaneswalkerTall: {parent:'PlaneswalkerRegular', mode:'select', control:'Style', value:'Tall Text'},
		PlaneswalkerTallBorderless: {parent:'PlaneswalkerBorderless', groupParent:'PlaneswalkerRegular', mode:'select', control:'Style', value:'Tall Text (Borderless)'},
		PlaneswalkerCompleated: {parent:'PlaneswalkerRegular', mode:'select', control:'Style', value:'Compleated'},
		PlaneswalkerNickname: {parent:'PlaneswalkerBorderless', groupParent:'PlaneswalkerRegular', mode:'select', control:'Style', value:'Nickname'},
		PlaneswalkerSDCC15: {parent:'PlaneswalkerRegular', mode:'select', control:'Style', value:'Blackout', standaloneFrame:'Frame'},
		PlaneswalkerMDFC: {
			parent:'PlaneswalkerBorderless', groupParent:'PlaneswalkerRegular', mode:'select', control:'Style', value:'MDFC',
			face:'front', composeParent:{profile:'PlaneswalkerRegular', masks:['Frame', 'Pinline', 'Border']}
		},
		PlaneswalkerMDFCBack: {
			parent:'PlaneswalkerBorderless', groupParent:'PlaneswalkerRegular', mode:'select', control:'Style', value:'MDFC (Back)',
			assetPack:'PlaneswalkerMDFC', face:'back', composeParent:{profile:'PlaneswalkerRegular', masks:['Frame', 'Pinline', 'Border']}
		},
		PlaneswalkerTransformFront: {parent:'PlaneswalkerRegular', mode:'select', control:'Style', value:'Transform (Front)'},
		PlaneswalkerTransformBack: {parent:'PlaneswalkerRegular', mode:'select', control:'Style', value:'Transform (Back)'},
		PlaneswalkerTransformFrontDBL: {parent:'PlaneswalkerDBL', mode:'select', control:'Style', value:'Transform (Front)'},
		PlaneswalkerTransformBackDBL: {parent:'PlaneswalkerDBL', mode:'select', control:'Style', value:'Transform (Back)'},
		M15TransformFront: {parent:'M15Regular-1', mode:'select', control:'Style', value:'Transform (Front)'},
		M15TransformBack: {parent:'M15Regular-1', mode:'select', control:'Style', value:'Transform (Back)'},
		M15TransformBackNew: {parent:'M15Regular-1', mode:'select', control:'Style', value:'Transform (Back - New)'},
		'8thTransformFront': {parent:'8th', mode:'select', control:'Style', value:'Transform (Front)'},
		'8thTransformBack': {parent:'8th', mode:'select', control:'Style', value:'Transform (Back)'},
		SagaDFC: {parent:'SagaRegular', mode:'select', control:'Transform', value:'Front'},
		TransformBorderlessFront: {parent:'GenericShowcase', groupParent:'M15Regular-1', mode:'select', control:'Style', value:'Borderless — Transform (Front)'},
		TransformBorderlessBack: {parent:'GenericShowcase', groupParent:'M15Regular-1', mode:'select', control:'Style', value:'Borderless — Transform (Back)'},
		TransformBorderlessAltFront: {parent:'Borderless', groupParent:'M15Regular-1', mode:'select', control:'Style', value:'Borderless (Alt) — Transform (Front)'},
		TransformBorderlessAltBack: {parent:'Borderless', groupParent:'M15Regular-1', mode:'select', control:'Style', value:'Borderless (Alt) — Transform (Back)'},
		TransformExtendedFront: {parent:'M15BoxTopper', groupParent:'M15Regular-1', mode:'select', control:'Style', value:'Extended Art — Transform (Front)'},
		TransformExtendedBack: {parent:'M15BoxTopper', groupParent:'M15Regular-1', mode:'select', control:'Style', value:'Extended Art — Transform (Back)'},
		NeonInkTransformFront: {parent:'NeonInk', mode:'select', control:'Transform', value:'Front'},
		NeonInkTransformBack: {parent:'NeonInk', mode:'select', control:'Transform', value:'Back'},
		ModalRegular: {parent:'M15Regular-1', mode:'select', control:'Style', value:'Modal DFC (Front)', face:'front'},
		ModalRegularBack: {parent:'M15Regular-1', mode:'select', control:'Style', value:'Modal DFC (Back)', assetPack:'ModalRegular', face:'back'},
		ModalBorderless: {parent:'GenericShowcase', groupParent:'M15Regular-1', mode:'select', control:'Style', value:'Borderless — Modal DFC'},
		ModalExtended: {parent:'M15BoxTopper', groupParent:'M15Regular-1', mode:'select', control:'Style', value:'Extended Art — Modal DFC'},
		ModalNickname: {parent:'ModalRegular', when:'hasNickname'},
		ModalShort: {parent:'ModalRegular', mode:'checkbox', label:'Short Textbox'},
		ModalShortNickname: {parent:'ModalShort', when:'hasNickname'},
		'PromoRegular-1': {parent:'PromoOpenHouse', mode:'profile-option'},
		IkoShort: {parent:'PromoRegular-1', mode:'checkbox', label:'Short Text'},
		PromoNyx: {parent:'PromoOpenHouse', when:'enchantment'},
		PromoNickname: {parent:'PromoOpenHouse', when:'hasNickname'},
		PromoGenericShowcase: {parent:'PromoOpenHouse', mode:'select', control:'Style', value:'Showcase'},
		NeonInkTransformFrontTextless: {parent:'NeonInkTextless', mode:'select', control:'Transform', value:'Front'},
		NeonInkTransformBackTextless: {parent:'NeonInkTextless', mode:'select', control:'Transform', value:'Back'},
		PlaneswalkerSeventh: {parent:'Seventh', when:'planeswalker'},
		OldFloatingShort: {parent:'OldFloating', mode:'checkbox', label:'Short Text'},
		ClassicshiftedNickname: {parent:'Classicshifted', when:'hasNickname'},
		ClassicshiftedLands: {parent:'Classicshifted', when:'land'},
		ClassicshiftedPlaneswalker: {parent:'Classicshifted', when:'planeswalker'},
		StoneCutterDeluxePlaneswalker: {parent:'StoneCutterDeluxe', when:'planeswalker'},
		StoneCutterDeluxePlaneswalkerExtended: {parent:'StoneCutterDeluxePlaneswalker', mode:'select', control:'Art Coverage', value:'Extended'}
	};

	const categories = {
		'booster-fun': new Set([
			'ShowcasePanel','PixelTMT','SewerTMT','MysticalArchiveSOA','FableECL','NeonInk','Elemental','BorderlessStellarSights','PosterStellarSights','FCA','Draconic','Ghostfire','JapanShowcase','JapanShowcaseNicknames','Paranormal','BloomburrowBorderless','Woodland','MemoryCorridor','BreakingNews','Vault','Wanted','ShowcaseMagnified','Dossier','IxalanLegends1','IxalanLegends2','IxalanLegends3','Scroll','Pipboy','EnchantingTales','TARDIS','Ring','IxalanCoin','Crystal','Ravnica','Tarkir','OilSlick','DMUStainedGlass','SNCGilded','SNCArtDeco','SNCSkyscraper','NeoNinja','NeoSamurai','NeoNeon','DoubleFeature','Fang','Equinox','EternalNight','DNDSourcebook','DNDModule','MH2','MysticalArchive','MysticalArchiveJP','Praetors','Kaldheim-2','KaldheimNonleg','CommanderLegends','ZendikarRising','M21','M15NyxShowcase','Storybook','StorybookWOE','StorybookMUL','ExpeditionZNR-1','SignatureSpellbook','Ixalan','Invocation','InvocationMUL','Invention','ExpeditionBFZ-1','SDCC15','SagaLTR','GenericShowcase','MagicFest','AKHInvocationExtended','TextlessInvention','SeventhTextless','NeonInkTextless','BurningRevelation','NEONeonShort','SNCGildedColored','SNCGildedTextless','EquinoxTextless','MysticalArchiveJPEN'
		]),
		tokens: new Set(['ModalHelper','TokenRegular-1','TokenTextless-1','TokenTextlessBorderless','TokenTall-1','TokenShort-1','TokenMonarch','TokenMarker','TokenInitiative','TokenDayNight','Emblem','JMPFront','J22Front','TokenRegularM15','TokenTextlessM15','TokenOld','TokenUnglued','Dungeon','Cardback']),
		basics: new Set(['EOEBasics','NeoBasics','TextlessBasics2022','TextlessBasics2022UB','TextlessBasicsSNC','TextlessBasics','ZendikarBasic-1','FullartBasicRoundBottom','Unfinity','Unstable','Unhinged','SeventhSnowLands']),
		legacy: new Set(['8thColorshifted','8th','8thUB','8thPlaytest','Planechase','Seventh','SeventhButFifth','Fourth','Legends','ABU','FutureRegular','OldSaga','OldFloating']),
		custom: new Set(['Classicshifted','ClassicshiftedSaga','StoneCutterDeluxe','StoneCutterDeluxeExtended','StoneCutterDeluxeSaga','StoneCutterDeluxeClass','StoneCutterDeluxeCase','Cartoony','CustomNeon','FeuerAmeiseIxalan','FeuerAmeiseKaldheim','CustomCelidAsap','CustomMagraoKaldheim','Pokemon','Circuit','MiscCustom','CustomDeckCover','SimpleInventions','Tapped','CustomDualLands','Vanguard'])
	};

	const families = {
		regular: new Set(['M15Regular-1','Prepare','StationRegular','Omen','Spree','Case','Class','M15Mutate','Adventure','M15Devoid','Leveler','Conspiracy','Colorshifted','M15ClearTextboxes','M15BoxTopper','M15ExtendedArtShort','FNM','FullText','FullTextAlt','SagaRegular','SimpleInventions','Circuit']),
		borderless: new Set(['GenericShowcase','StationBorderless','OilSlick','M15Nickname']),
		'borderless-alt': new Set(['Borderless']),
		'universes-beyond': new Set(['UB','CaseUB','ClassUB','UBFull','UBExtendedArt','SagaUB']),
		etched: new Set(['Etched']),
		planeswalker: new Set(['PlaneswalkerRegular','PlaneswalkerBorderless']),
		saga: new Set(['SagaRegular','SagaUB','SagaCreature','SagaCreatureUB'])
	};

	const engines = new Map([
		['M15Regular-1','M15Regular-1'], ['M15RegularNew','M15RegularNew'], ['M15Eighth','M15Eighth'],
		['UB','UB'], ['UBNew','UBNew'], ['Circuit','Circuit'], ['Etched','Etched'], ['Praetors','Praetors'],
		['Seventh','Seventh'], ['M15BoxTopper','M15BoxTopper'], ['M15ExtendedArtShort','M15ExtendedArtShort'],
		['8th','8th'], ['Borderless','Borderless'], ['M15EighthUB','M15EighthUB'], ['FullArtNew','FullArtNew'],
		['JapanShowcase','JapanShowcase'], ['Vault','Vault'], ['Adventure','Adventure'], ['Omen','Omen'], ['Prepare','Prepare']
	]);

	const stampStyles = {
		Class: {
			name:'Holo Stamp',
			src:'/img/frames/saga/stamp.png',
			bounds:{x:0.438, y:0.912, width:0.124, height:0.0372}
		},
		Case: {
			name:'Holo Stamp',
			src:'/img/frames/saga/stamp.png',
			bounds:{x:0.438, y:0.912, width:0.124, height:0.0372}
		},
		PlaneswalkerRegular: {coloredPath:'/img/frames/planeswalker/holo/{color}.png', bounds:{x:0.4394, y:0.9015, width:0.1214, height:0.051}},
		PlaneswalkerBorderless: {coloredPath:'/img/frames/planeswalker/holo/{color}.png', bounds:{x:0.4394, y:0.9015, width:0.1214, height:0.051}},
		PlaneswalkerTall: {coloredPath:'/img/frames/planeswalker/holo/{color}.png', bounds:{x:0.4394, y:0.9015, width:0.1214, height:0.051}},
		PlaneswalkerTallBorderless: {coloredPath:'/img/frames/planeswalker/holo/{color}.png', bounds:{x:0.4394, y:0.9015, width:0.1214, height:0.051}},
		PlaneswalkerSeventh: {coloredPath:'/img/frames/planeswalker/holo/{color}.png', bounds:{x:0.4394, y:0.9015, width:0.1214, height:0.051}}
	};

	const frameColoredCrowns = new Set(['Class', 'Case', 'SagaRegular', 'ClassUB', 'CaseUB', 'SagaUB']);

	const categoryLabels = {
		all:'All', standard:'Standard', 'booster-fun':'Booster Fun', tokens:'Tokens', basics:'Basics', legacy:'Legacy', custom:'Custom'
	};

	const review = [
		'Choose precedence for Snow + Enchantment + Land combinations.',
		'Decide whether Extended Art and Borderless become one Art Coverage option.',
		'Complete family-specific holo-stamp defaults.',
		'Confirm embedded legend-crown providers for Booster Fun profiles.',
		'Confirm that Shattered Glass should be a crown variant rather than a complete profile.'
	];

	function kind(pack) {
		if (components[pack]) return 'component';
		if (variants[pack]) return 'variant';
		return 'profile';
	}

	function category(pack) {
		for (const [categoryName, packs] of Object.entries(categories)) {
			if (packs.has(pack)) return categoryName;
		}
		return 'standard';
	}

	function family(pack) {
		for (const [familyName, packs] of Object.entries(families)) {
			if (packs.has(pack)) return familyName;
		}
		return pack;
	}

	function definition(pack) {
		return {
			id: pack,
			kind: kind(pack),
			category: category(pack),
			family: family(pack),
			engine: engines.get(pack) || null,
			details: components[pack] || variants[pack] || profiles[pack] || null
		};
	}

	function collectorDefinition(pack) {
		const frameCategory = category(pack);
		const frameFamily = family(pack);
		if (frameCategory === 'tokens') return {category:'token', groupKey:'tokens', groupLabel:'Tokens'};
		if (frameCategory === 'custom') return {category:'custom', groupKey:'custom:' + frameFamily, groupLabel:frameFamily};
		if (frameCategory === 'booster-fun') {
			if (/borderless/i.test(frameFamily)) return {category:'borderless', groupKey:'borderless', groupLabel:'Borderless'};
			return {category:'booster-fun', groupKey:'booster-fun:' + frameFamily, groupLabel:frameFamily};
		}
		if (frameCategory === 'legacy') return {category:'special', groupKey:'special:' + frameFamily, groupLabel:frameFamily};
		if (/borderless|extended|showcase/i.test(frameFamily)) return {category:'borderless', groupKey:'borderless', groupLabel:'Borderless'};
		return {category:'main', groupKey:'main', groupLabel:'Main Set'};
	}

	function automaticVariant(pack, typeLine = '') {
		const normalizedType = typeLine.toLowerCase();
		const packFamily = family(pack);

		if (normalizedType.includes('planeswalker')) {
			// Customize choices can become the active auto-frame profile. Treat an
			// already-selected Planeswalker style as its own valid automatic variant
			// so typing the type line can always reload its frame and text layout.
			if (pack.startsWith('Planeswalker')) return pack;
			if (pack === 'DoubleFeature') return 'PlaneswalkerDBL';
			if (pack === 'Seventh') return 'PlaneswalkerSeventh';
			if (pack === 'Classicshifted') return 'ClassicshiftedPlaneswalker';
			if (pack === 'StoneCutterDeluxe' || pack === 'StoneCutterDeluxeExtended') return 'StoneCutterDeluxePlaneswalker';
			if (packFamily === 'regular') return 'PlaneswalkerRegular';
			if (packFamily === 'borderless' || packFamily === 'borderless-alt') return 'PlaneswalkerBorderless';
			return null;
		}

		if (/\bsaga\b/.test(normalizedType) && /\bcreature\b/.test(normalizedType)) {
			if (packFamily === 'universes-beyond') return 'SagaCreatureUB';
			if (packFamily === 'regular') return 'SagaCreature';
		}

		const enchantmentSubtype = /\b(class|case|saga)\b/.exec(normalizedType)?.[1];
		if (!enchantmentSubtype) return null;
		if (packFamily === 'regular') {
			return {class:'Class', case:'Case', saga:'SagaRegular'}[enchantmentSubtype];
		}
		if (packFamily === 'universes-beyond') {
			return {class:'ClassUB', case:'CaseUB', saga:'SagaUB'}[enchantmentSubtype];
		}
		return null;
	}

	function profileForType(pack, typeLine = '') {
		if (String(typeLine).toLowerCase().includes('planeswalker')) return pack;
		let profile = pack;
		const visited = new Set();
		while (variants[profile] && !visited.has(profile)) {
			visited.add(profile);
			const details = variants[profile];
			if (details.when === 'planeswalker') return details.parent;
			profile = details.parent;
		}
		return pack;
	}

	function stampFor(pack, colorName) {
		const style = stampStyles[pack];
		if (!style) return null;
		if (!style.coloredPath) return JSON.parse(JSON.stringify(style));
		const color = ({White:'w', Blue:'u', Black:'b', Red:'r', Green:'g', Multicolored:'m', Artifact:'a', Land:'l', Vehicle:'a', Colorless:'l'})[colorName] || 'w';
		return {
			name: colorName + ' Holo Stamp',
			src: style.coloredPath.replace('{color}', color),
			bounds: {...style.bounds}
		};
	}

	function nicknameFor(colorCode, maskToRightHalf = false) {
		var normalized = String(colorCode || 'W').toUpperCase();
		var assetCode = 'W';
		if (normalized.includes('L')) assetCode = 'L';
		else if (normalized === 'A' || normalized === 'V') assetCode = 'A';
		else if (normalized === 'C') assetCode = 'C';
		else if (normalized.length > 1 || normalized === 'M') assetCode = 'M';
		else if ('WUBRG'.includes(normalized)) assetCode = normalized;
		var colorName = ({W:'White', U:'Blue', B:'Black', R:'Red', G:'Green', M:'Multicolored', A:'Artifact', L:'Land', C:'Colorless'})[assetCode];
		return {
			name: colorName + ' Nickname Add-on',
			src: '/img/frames/m15/nickname/addons/m15NicknameTitle' + assetCode + '.png',
			masks: maskToRightHalf ? [{src:'/img/frames/maskRightHalf.png', name:'Right Half'}] : [],
			bounds: {x:0.0494, y:0.0405, width:0.9014, height:0.1053}
		};
	}

	function semanticComponentColors(pack, colors) {
		if (frameColoredCrowns.has(pack) && colors.length > 1) return ['M'];
		return colors;
	}

	function canonicalColors(colors) {
		const uniqueColors = [...new Set((colors || []).map(color => String(color).toUpperCase()).filter(color => 'WUBRG'.includes(color)))];
		const key = uniqueColors.slice().sort((a, b) => 'WUBRG'.indexOf(a) - 'WUBRG'.indexOf(b)).join('');
		return (canonicalColorOrderBySet.get(key) || uniqueColors.join('')).split('').filter(Boolean);
	}

	const namedManaTokens = new Set([
		'UNTAP','OLDTAP','ORIGINALTAP','PURPLE','INF','ALCHEMY','CHAOS','TK',
		'PLANESWALKER','BRUSH','WHITEBRUSH','H','A','E','P','T'
	]);

	function tokenizeManaCost(value) {
		const source = String(value || '');
		const tokens = [];
		let joinNextToken = false;
		const pushToken = rawToken => {
			const token = String(rawToken || '').toUpperCase();
			if (!token) return;
			if (joinNextToken && tokens.length) {
				tokens[tokens.length - 1] += '/' + token;
				joinNextToken = false;
			} else {
				tokens.push(token);
			}
		};

		for (let index = 0; index < source.length;) {
			const character = source[index];
			if (/\s/.test(character)) {
				index++;
				continue;
			}
			if (character === '{') {
				const end = source.indexOf('}', index + 1);
				if (end < 0) {
					pushToken(source.slice(index + 1));
					break;
				}
				pushToken(source.slice(index + 1, end));
				index = end + 1;
				continue;
			}
			if (character === '/') {
				if (tokens.length) joinNextToken = true;
				index++;
				continue;
			}
			const remainder = source.slice(index);
			const signedNumber = /^[+-]\d+/.exec(remainder)?.[0];
			if (signedNumber) {
				pushToken(signedNumber);
				index += signedNumber.length;
				continue;
			}
			const number = /^\d+/.exec(remainder)?.[0];
			if (number) {
				pushToken(number);
				index += number.length;
				continue;
			}
			const word = /^[a-z]+/i.exec(remainder)?.[0];
			if (word) {
				if (namedManaTokens.has(word.toUpperCase())) {
					pushToken(word);
				} else {
					word.split('').forEach(pushToken);
				}
				index += word.length;
				continue;
			}
			pushToken(character);
			index++;
		}
		return tokens;
	}

	function normalizeManaCost(value) {
		const tokens = tokenizeManaCost(value);
		if (!tokens.length) return '';
		const isColor = token => /^[WUBRG]$/.test(token);
		const isGeneric = token => /^(?:\d+|X|Y|Z|C|S)$/.test(token);
		if (tokens.every(token => isColor(token) || isGeneric(token))) {
			const orderedColors = canonicalColors(tokens.filter(isColor));
			const counts = tokens.filter(isColor).reduce((result, color) => {
				result[color] = (result[color] || 0) + 1;
				return result;
			}, {});
			const normalizedColors = orderedColors.flatMap(color => Array(counts[color] || 0).fill(color));
			return tokens.filter(isGeneric).concat(normalizedColors).join(' ');
		}
		return tokens.join(' ');
	}

	return Object.freeze({
		components,
		profiles,
		variants,
		families,
		categories,
		engines,
		stampStyles,
		frameColoredCrowns,
		categoryLabels,
		review,
		definition,
		collectorDefinition,
		automaticVariant,
		profileForType,
		stampFor,
		nicknameFor,
		semanticComponentColors,
		canonicalColors,
		tokenizeManaCost,
		normalizeManaCost,
		kind,
		category,
		family,
		engine: pack => engines.get(pack) || null,
		isCatalogProfile: pack => kind(pack) === 'profile'
	});
})();
