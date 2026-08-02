//Create objects for common properties across available frames
var masks = [{src:'/img/frames/m15/split/fuse/top.png', name:'Top Half'}, {src:'/img/frames/m15/split/fuse/bottom.png', name:'Bottom Half'}];
//defines available frames
availableFrames = [
	{name:'White Frame', src:'/img/frames/m15/split/fuse/w.png', masks:masks},
	{name:'Blue Frame', src:'/img/frames/m15/split/fuse/u.png', masks:masks},
	{name:'Black Frame', src:'/img/frames/m15/split/fuse/b.png', masks:masks},
	{name:'Red Frame', src:'/img/frames/m15/split/fuse/r.png', masks:masks},
	{name:'Green Frame', src:'/img/frames/m15/split/fuse/g.png', masks:masks},
	{name:'Multicolored Frame', src:'/img/frames/m15/split/fuse/m.png', masks:masks},
	{name:'Artifact Frame', src:'/img/frames/m15/split/fuse/a.png', masks:masks},
	{name:'Land Frame', src:'/img/frames/m15/split/fuse/l.png', masks:masks}
];
//disables/enables the "Load Frame Version" button
document.querySelector('#loadFrameVersion').disabled = false;
//defines process for loading this version, if applicable
document.querySelector('#loadFrameVersion').onclick = async function() {
	// Notification
	notify('At this time, second pieces of art must still be added manually with external software. Apologies for the inconvenience!', 10);
	//resets things so that every frame doesn't have to
	await resetCardIrregularities();
	//sets card version
	card.version = 'fuse';
	//art bounds
	card.artBounds = {x:0.158, y:0.0534, width:0.3734, height:0.3886};
	autoFitArt();
	//set symbol bounds
	// Calibrated from DSK at 1069 / 181 / 24. Symbols keep their aspect ratio
	// and align to the card-edge side of the rotated target.
	card.setSymbolBounds = {x:1142/2010, y:216/2814, width:147/2010, height:70/2814, fitWidth:146.423184, fitHeight:69.5294808, vertical:'center', horizontal:'center', visualHorizontal:'right', visualVertical:'top', rotation:-90, fallback:{x:1069, y:181, zoom:24}};
	resetSetSymbol();
	//watermark bounds
	card.watermarkBounds = {x:0.5, y:0.7762, width:0.75, height:0.2305};
	resetWatermark();
	//text
	loadTextOptions({
		mana: {name:'Mana Cost (Left)', text:'', x:0.0847, y:0.8943, width:0.5367, height:71/2100, oneLine:true, size:71/1638, align:'right', shadowX:-0.001, shadowY:0.0029, manaCost:true, manaSpacing:0, rotation:-90},
		title: {name:'Title (Left)', text:'', x:0.072, y:0.8943, width:0.5367, height:0.0543, oneLine:true, font:'belerenb', size:0.0381, rotation:-90},
		type: {name:'Type (Left)', text:'', x:0.55, y:0.8943, width:0.5367, height:0.0286, oneLine:true, font:'belerenb', size:0.0286, rotation:-90},
		rules: {name:'Rules Text (Left)', text:'', x:0.6087, y:0.8896, width:0.5174, height:0.1986, size:0.0362, rotation:-90},
		pt: {name:'PT Text (Left)', text:'', x:0.8440, y:0.8296, width:0.828, height:0.12, size:0.0286, font:'belerenbsc', oneLine:true, align:'center', rotation:-90},
		mana2: {name:'Mana Cost (Right)', text:'', x:0.0847, y:0.4381, width:0.5367, height:71/2100, oneLine:true, size:71/1638, align:'right', shadowX:-0.001, shadowY:0.0029, manaCost:true, manaSpacing:0, rotation:-90},
		title2: {name:'Title (Right)', text:'', x:0.072, y:0.4381, width:0.5367, height:0.0543, oneLine:true, font:'belerenb', size:0.0381, rotation:-90},
		type2: {name:'Type (Right)', text:'', x:0.55, y:0.4381, width:0.5367, height:0.0286, oneLine:true, font:'belerenb', size:0.0286, rotation:-90},
		rules2: {name:'Rules Text (Right)', text:'', x:0.6087, y:0.4334, width:0.5174, height:0.1986, size:0.0362, rotation:-90},
		pt2: {name:'PT Text (Right)', text:'', x:0.8440, y:0.3734, width:0.828, height:0.12, size:0.0286, font:'belerenbsc', oneLine:true, align:'center', rotation:-90},
		reminder: {name:'Reminder', text:'Fuse {i}(You may cast one or both halves of this card from your hand.){/i}', x:0.9067, y:0.8943, width:1.1754, height:0.0286, oneLine:true, size:0.0286, rotation:-90, align:"center"}
	});
}
//loads available frames
loadFramePack();
