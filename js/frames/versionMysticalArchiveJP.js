//checks to see if it needs to run
if (!loadedVersions.includes('/js/frames/versionMysticalArchiveJP.js')) {
	loadedVersions.push('/js/frames/versionMysticalArchiveJP.js');
	loadScript('/js/frames/manaSymbolsMysticalArchiveJP.js');
}

registerCardSpecificTextTools({
	key: 'mysticalArchive',
	title: 'Mystical Archive',
	description: 'Card text uses the normal fields. Decorative bar sizing is available in Layout.',
	layoutDescription: 'Stretch the vertical title bar and horizontal type bar.',
	layoutHTML: `
		<section class="layout-control-group">
			<div class="layout-control-heading"><h3>Decorative bars</h3><p>Resize the frame and matching text bounds together</p></div>
			<div class="layout-control-grid">
				<label class="layout-control-field"><span>Title bar height</span><span class="layout-input-shell"><input id="ma-change1" class="input" type="number" min="100" max="1000" step="5" oninput="stretchMysticalArchive();"><small>px</small></span></label>
				<label class="layout-control-field"><span>Type bar width</span><span class="layout-input-shell"><input id="ma-change2" class="input" type="number" min="150" max="1000" step="5" oninput="stretchMysticalArchive();"><small>px</small></span></label>
			</div>
		</section>`,
	onRender: () => {
		document.querySelector('#ma-change1').value = Math.round((card.text?.title?.height || 270 / 2100) * 2100);
		document.querySelector('#ma-change2').value = Math.round(((card.text?.type?.width || 430 / 1500) - 430 / 1500) * 1260 + 430);
	}
});

function stretchMysticalArchive() {
	const change1 = [0, (parseInt(document.querySelector('#ma-change1').value) - 270) / 2100];
	const change2 = [(parseInt(document.querySelector('#ma-change2').value) - 430) / 1260, 0];
	// var targets = []
	// document.querySelector('#ma-targets').value.split(' ').forEach(item => targets.push(parseInt(item)));
	card.frames.forEach(frame => {
		if (frame.src.includes('Archive/jp') && 'stretch' in frame) {
			frame.stretch[0].change = change1;
			card.text.title.height = change1[1] + 270 / 2100;
			frame.stretch[1].change = change2;
			frame.stretch[2].change = change2;
			card.text.type.width = change2[0] + 430 / 1500;
			drawTextBuffer();
			stretchSVG(frame);
		}
	});
}
