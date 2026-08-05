const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const workspace = fs.readFileSync(path.join(__dirname, '../js/setWorkspace.js'), 'utf8');
const creator = fs.readFileSync(path.join(__dirname, '../js/creator-23.js'), 'utf8');

function functionSource(name, source = workspace) {
	const asyncStart = source.indexOf(`async function ${name}(`);
	const start = asyncStart === -1 ? source.indexOf(`function ${name}(`) : asyncStart;
	assert.notEqual(start, -1, `${name} should exist`);
	const bodyStart = source.indexOf('{', start);
	let depth = 0;
	for (let index = bodyStart; index < source.length; index++) {
		if (source[index] === '{') depth++;
		else if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
	}
	throw new Error(`Could not extract ${name}`);
}

test('single-card PNG and JPG exports do not require artist credit', () => {
	const exports = [];
	const notifications = [];
	const context = {
		card: {infoArtist: '', artSource: 'data:image/png;base64,ART', artZoom: 1},
		cardCanvas: {
			toDataURL(type) {
				return `data:${type};base64,IMAGE`;
			}
		},
		getCardName() { return 'Untitled Card'; },
		notify(message) { notifications.push(message); },
		console,
		window: {
			setConjurerDesktop: {
				files: {
					saveExport(request) {
						exports.push(request);
						return Promise.resolve();
					}
				}
			}
		}
	};
	vm.createContext(context);
	vm.runInContext(`${functionSource('downloadCard', creator)}\ndownloadCard();\ndownloadCard(false, true);`, context);

	assert.deepEqual(exports.map(({suggestedName, extension, content}) => ({suggestedName, extension, content})), [
		{suggestedName: 'Untitled Card.png', extension: 'png', content: 'IMAGE'},
		{suggestedName: 'Untitled Card.jpg', extension: 'jpg', content: 'IMAGE'}
	]);
	assert.deepEqual(notifications, []);
});

test('set image ZIPs use the native save dialog in the desktop app', () => {
	const download = functionSource('downloadSetImages');
	const stream = functionSource('streamZipToDesktop');
	assert.match(download, /formatInput \? formatInput\.value : 'png'/);
	assert.match(download, /await restoreWorkspace\(\); closeZipDialog\(\)/);
	assert.match(download, /files\.beginArchive/);
	assert.match(stream, /generateInternalStream\(\{type:'uint8array',streamFiles:true\}\)/);
	assert.match(stream, /batchBytes = 2 \* 1024 \* 1024/);
	assert.match(stream, /new Uint8Array\(chunkBytes\)/);
	assert.match(stream, /if \(chunkBytes < batchBytes\) return/);
	assert.match(stream, /files\.appendArchive/);
	assert.match(download, /files\.completeArchive/);
	assert.match(download, /files\.saveArchive/);
	assert.match(download, /files\.cancelArchive/);
	assert.doesNotMatch(download, /encoding:'base64'/);
	assert.match(download, /if \(result\.canceled\)/);
	assert.match(download, /finally \{ if \(archiveId\)/);
});

test('set image ZIPs retain the browser download fallback', () => {
	const download = functionSource('downloadSetImages');
	assert.match(download, /zip\.generateAsync\(\{type:'blob'\}/);
	assert.match(download, /link\.download=zipName/);
});

test('set image ZIP progress uses a modal with themed cancellation', () => {
	const dialog = functionSource('ensureZipDialog');
	const open = functionSource('openZipDialog');
	const styles = fs.readFileSync(path.join(__dirname, '../css/style-9.css'), 'utf8');
	assert.match(dialog, /sets-dialog desktop-onboarding sets-zip-dialog/);
	assert.match(dialog, /desktop-pack-progress-track/);
	assert.match(dialog, /creator-app-action sets-zip-cancel/);
	assert.match(dialog, /addEventListener\('cancel'/);
	assert.match(open, /dialog\.showModal\(\)/);
	assert.match(open, /--sets-zip-backdrop/);
	assert.match(styles, /\.sets-zip-dialog::backdrop \{ background: var\(--sets-zip-backdrop,#0b0f16\); \}/);
	assert.doesNotMatch(functionSource('renderCardsTab'), /sets-zip-progress/);
});

test('set image ZIP rendering leaves the visible preview and thumbnails alone', () => {
	const download = functionSource('downloadSetImages');
	const load = functionSource('loadActiveCard');
	const blob = functionSource('canvasBlob');
	const creator = fs.readFileSync(path.join(__dirname, '../js/creator-23.js'), 'utf8');
	assert.match(download, /zipRendering = true; root\.cardConjurerSuppressPreviewRender = true/);
	assert.match(download, /renderWorkspace\(\); await loadActiveCard\(\); \}\s*await new Promise[\s\S]*zipRendering = false; root\.cardConjurerSuppressPreviewRender = previousPreviewSuppression/);
	assert.match(load, /zipRendering \? false : await updateThumbnail/);
	assert.match(blob, /cardCanvas\.toBlob/);
	assert.doesNotMatch(blob, /previewCanvas/);
	assert.match(creator, /if \(!window\.cardConjurerSuppressPreviewRender\)/);
});
