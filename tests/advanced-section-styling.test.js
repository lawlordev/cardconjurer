const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const styles = fs.readFileSync(path.join(__dirname, '../css/style-9.css'), 'utf8');

test('Advanced section toggles keep section styling instead of generic control chrome', () => {
	assert.match(
		styles,
		/\.creator-workspace button:not\(\.sets-tab\):not\(\.card-specific-advanced-toggle\),/,
	);
	assert.match(
		styles,
		/\.creator-workspace button:not\(\.sets-tab\):not\(\.card-specific-advanced-toggle\):not\(\.selected\):not\(:disabled\):hover,/,
	);
	assert.match(
		styles,
		/\.creator-workspace \.collapsible:not\(\.frame-advanced-toggle\):hover/,
	);
});
