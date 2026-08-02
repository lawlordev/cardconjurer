//checks to see if it needs to run
if (!loadedVersions.includes('/js/frames/versionNeoBasics.js')) {
	loadedVersions.push('/js/frames/versionNeoBasics.js');
	loadScript('/js/frames/manaSymbolsMysticalArchiveJP.js');
}

registerCardSpecificTextTools({
	key: 'neoBasics',
	title: 'Kamigawa Basics',
	description: 'Card text uses the normal fields. Title-bar sizing is available in Layout.',
	layoutDescription: 'Stretch the vertical title treatment and its matching text bounds.',
	layoutHTML: `
		<section class="layout-control-group">
			<div class="layout-control-heading"><h3>Title treatment</h3><p>Resize the frame and title text area together</p></div>
			<label class="layout-control-field"><span>Title bar height</span><span class="layout-input-shell"><input id="nb-change" class="input" type="number" min="330" max="1000" step="10" oninput="stretchNeoBasics();"><small>px</small></span></label>
		</section>`,
	onRender: () => {
		document.querySelector('#nb-change').value = Math.round((card.text?.title?.height || 500 / 2100) * 2100 - 170);
	}
});

function stretchNeoBasics() {
	const change = [0, (parseInt(document.querySelector('#nb-change').value) - 330) / 2100];
	// var targets = []
	// document.querySelector('#targets').value.split(' ').forEach(item => targets.push(parseInt(item)));
	card.frames.forEach(frame => {
		if (frame.src.includes('neo/basics/') && 'stretch' in frame) {
			frame.stretch[0].change = change;
			// frame.stretch[0].targets = targets;
			frame.stretch[1].change = change;
			frame.stretch[2].change = change;
			frame.stretch[3].change = change;
			card.text.title.height = change[1] + 500 / 2100;
			drawTextBuffer();
			stretchSVG(frame);
		}
	});
}
