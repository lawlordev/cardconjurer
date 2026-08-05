const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workspace = fs.readFileSync(path.join(__dirname, '../js/setWorkspace.js'), 'utf8');

function functionSource(name) {
	const asyncStart = workspace.indexOf(`async function ${name}(`);
	const start = asyncStart === -1 ? workspace.indexOf(`function ${name}(`) : asyncStart;
	assert.notEqual(start, -1, `${name} should exist`);
	const bodyStart = workspace.indexOf('{', start);
	let depth = 0;
	for (let index = bodyStart; index < workspace.length; index++) {
		if (workspace[index] === '{') depth++;
		else if (workspace[index] === '}' && --depth === 0) return workspace.slice(start, index + 1);
	}
	throw new Error(`Could not extract ${name}`);
}

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
