const assert = require('node:assert/strict');
const test = require('node:test');
const {readFileSync} = require('node:fs');

test('CI uses blobless sparse checkout and an aggregate required gate', () => {
  const workflow = readFileSync('.github/workflows/ci.yaml', 'utf8');
  assert.match(workflow, /filter:\s*blob:none/);
  assert.match(workflow, /fetch-depth:\s*\$\{\{ github\.event_name == 'pull_request' && 2 \|\| 0 \}\}/);
  assert.match(workflow, /cancel-in-progress:\s*\$\{\{ github\.event_name == 'pull_request' \}\}/);
  assert.match(workflow, /sparse-checkout-cone-mode:\s*false/);
  assert.match(workflow, /name:\s*required/);
  assert.match(workflow, /report-checkout-surface\.mjs --expect-sparse/);
});
