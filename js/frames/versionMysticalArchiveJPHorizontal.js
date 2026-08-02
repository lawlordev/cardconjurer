//checks to see if it needs to run
if (!loadedVersions.includes('/js/frames/versionMysticalArchiveJPHorizontal.js')) {
	loadedVersions.push('/js/frames/versionMysticalArchiveJPHorizontal.js');
	loadScript('/js/frames/manaSymbolsMysticalArchiveJP.js');
}

registerCardSpecificTextTools({
	key: 'mysticalArchiveHorizontal',
	title: 'Mystical Archive (Horizontal)',
	description: 'Card text uses the normal fields. Decorative bar sizing is available in Layout.',
	layoutDescription: 'Stretch the title and type bars while keeping their text bounds aligned.',
	layoutHTML: `
		<section class="layout-control-group">
			<div class="layout-control-heading"><h3>Decorative bars</h3><p>Resize the frame and matching text bounds together</p></div>
			<div class="layout-control-grid">
				<label class="layout-control-field"><span>Title bar width</span><span class="layout-input-shell"><input id="mah-change1" class="input" type="number" min="100" max="1000" step="5" oninput="stretchMysticalArchiveHorizontal();"><small>px</small></span></label>
				<label class="layout-control-field"><span>Type bar width</span><span class="layout-input-shell"><input id="mah-change2" class="input" type="number" min="150" max="1000" step="5" oninput="stretchMysticalArchiveHorizontal();"><small>px</small></span></label>
			</div>
		</section>`,
	onRender: () => {
		document.querySelector('#mah-change1').value = Math.round((card.text?.title?.width || 270 / 1500) * 1500);
		document.querySelector('#mah-change2').value = Math.round(((card.text?.type?.width || 430 / 1500) - 430 / 1500) * 1260 + 430);
	}
});

function stretchMysticalArchiveHorizontal() {
	// compute changes
	const change1 = [(parseInt(document.querySelector('#mah-change1').value) - 270) / 1500, 0];
	const change2 = [(parseInt(document.querySelector('#mah-change2').value) - 430) / 1260, 0];
	// change textbox sizes
	card.text.title.width = change1[0] + 270 / 1500;
	card.text.type.width = change2[0] + 430 / 1500;
	drawTextBuffer();
	// resize SVGs
	card.frames.forEach(frame => {
		if (frame.src.includes('Archive/jp/horizontal') && 'stretch' in frame) {
			frame.stretch[0].change = change1;
			frame.stretch[1].change = change2;
			frame.stretch[2].change = change2;
			stretchSVG(frame);
		}
	});
}
