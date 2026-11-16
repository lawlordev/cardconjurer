#!/usr/bin/env node
// Loom release driver for Set Conjurer.
//
// Usage: node scripts/loom-release.mjs <app|packs>
//
// Each unit wraps one existing manual GitHub workflow (see docs/desktop-release.md):
//   app   -> tags v<package.json version> at the release commit and dispatches
//            "Release Set Conjurer" (release-app.yaml) with publish=true, windows_signing=required.
//   packs -> picks the next packs-vX.Y.Z tag, selects the changed logical packs with the CI
//            classifier, tags the release commit and dispatches "Release Content Packs".
//
// Modes come from LOOM_RELEASE_MODE (plan | run | resume | check; default plan). Builds run in
// GitHub Actions with the repository's signing secrets; this device only needs `gh` logged in
// with permission to push tags and dispatch workflows. Run mode dispatches and exits 75 so Loom
// polls check mode until the workflow finishes, instead of blocking for an hour.

import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const unit = process.argv[2];
if (!['app', 'packs'].includes(unit)) fail('Usage: node scripts/loom-release.mjs <app|packs>');
const mode = process.env.LOOM_RELEASE_MODE || 'plan';
if (!['plan', 'run', 'resume', 'check'].includes(mode)) fail(`Unknown LOOM_RELEASE_MODE ${mode}.`);
const releaseDir = process.env.LOOM_RELEASE_DIR || '';
const sha = process.env.LOOM_RELEASE_SHA || git('rev-parse', 'HEAD');
const WAITING = 75;
const CHECK_AFTER_MINUTES = unit === 'app' ? 20 : 10;
const WORKFLOW = unit === 'app' ? 'release-app.yaml' : 'release-frame-packs.yaml';

function fail(message) {
  console.error(`release failed: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', options.quiet ? 'ignore' : 'inherit']}).trim();
}

function tryRun(command, args) {
  try { return run(command, args, {quiet: true}); } catch { return null; }
}

function git(...args) { return run('git', args); }
function gh(...args) { return run('gh', args); }

// Derive owner/name from origin: `gh repo view` would resolve this fork to its upstream parent.
const repo = process.env.LOOM_GITHUB_REPO || (git('remote', 'get-url', 'origin').match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/) || fail('origin is not a GitHub remote'))[1];

function readState() {
  const path = releaseDir && join(releaseDir, 'state.json');
  if (!path || !existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, 'utf8') || '{}'); } catch { return {}; }
}

function writeState(state) {
  if (releaseDir) writeFileSync(join(releaseDir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
}

function writePlan(lines) {
  const text = `${lines.join('\n')}\n`;
  if (releaseDir) writeFileSync(join(releaseDir, 'plan.md'), text);
  console.log(text);
}

function wait(state, message) {
  writeState(state);
  if (releaseDir) writeFileSync(join(releaseDir, 'wait.json'), `${JSON.stringify({message, check_after_minutes: CHECK_AFTER_MINUTES}, null, 2)}\n`);
  console.log(message);
  process.exit(WAITING);
}

// Returns the commit a remote tag points at, or null when the tag does not exist.
function remoteTagCommit(tag) {
  const out = tryRun('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`]);
  if (!out) return null;
  const lines = out.split('\n').map((line) => line.split('\t'));
  const peeled = lines.find(([, ref]) => ref.endsWith('^{}'));
  return (peeled || lines[0])[0];
}

function publishedRelease(tag) {
  const out = tryRun('gh', ['release', 'view', tag, '-R', repo, '--json', 'isDraft,assets,url']);
  if (!out) return null;
  const release = JSON.parse(out);
  return !release.isDraft && release.assets.length > 0 ? release : null;
}

function createTag(tag) {
  const existing = remoteTagCommit(tag);
  if (existing === sha) return;
  if (existing) fail(`Tag ${tag} already points at ${existing}, not ${sha}. Tags are immutable; bump the version instead.`);
  gh('api', `repos/${repo}/git/refs`, '-f', `ref=refs/tags/${tag}`, '-f', `sha=${sha}`, '--silent');
  console.log(`Created tag ${tag} at ${sha}.`);
}

function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function dispatch(fields) {
  const since = Date.now() - 60_000;
  const args = ['workflow', 'run', WORKFLOW, '-R', repo, '--ref', 'master'];
  for (const [key, value] of Object.entries(fields)) args.push('-f', `${key}=${value}`);
  const out = gh(...args);
  const fromUrl = out.match(/\/actions\/runs\/(\d+)/);
  if (fromUrl) return Number(fromUrl[1]);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    sleep(5000);
    const runs = JSON.parse(gh('run', 'list', '-R', repo, '--workflow', WORKFLOW, '--event', 'workflow_dispatch', '-L', '5', '--json', 'databaseId,createdAt'));
    const found = runs.find((item) => Date.parse(item.createdAt) >= since);
    if (found) return found.databaseId;
  }
  fail(`Dispatched ${WORKFLOW} but could not find its run.`);
}

function runStatus(runId) {
  return JSON.parse(gh('run', 'view', String(runId), '-R', repo, '--json', 'status,conclusion,url'));
}

// check / resume: follow a previously dispatched workflow run recorded in state.json.
function followRun(state) {
  if (!state.runId || !state.tag) fail('No dispatched workflow run in state.json; start a new release.');
  const status = runStatus(state.runId);
  if (status.status !== 'completed') {
    if (mode === 'check') process.exit(WAITING);
    wait(state, `Waiting for ${WORKFLOW} run ${status.url} to finish.`);
  }
  if (status.conclusion !== 'success') fail(`Workflow run ${status.url} finished with ${status.conclusion}.`);
  if (mode === 'check') process.exit(0);
  const release = publishedRelease(state.tag);
  if (!release) fail(`Workflow succeeded but no published release with assets exists for ${state.tag}.`);
  console.log(`Released ${state.tag}: ${release.url}`);
  process.exit(0);
}

function startRun(state, tag, fields) {
  if (state.runId && state.tag === tag) {
    const status = runStatus(state.runId);
    if (status.status !== 'completed' || status.conclusion === 'success') return followRun(state);
  }
  createTag(tag);
  const runId = dispatch(fields);
  wait({...state, tag, runId, sha}, `Dispatched ${WORKFLOW} for ${tag} (https://github.com/${repo}/actions/runs/${runId}); waiting for the build, signing and upload to finish.`);
}

function appRelease() {
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const tag = `v${version}`;
  const channel = version.includes('-') ? 'beta' : 'stable';
  const state = readState();
  if (mode === 'check' || mode === 'resume') return followRun(state);

  const tagCommit = remoteTagCommit(tag);
  const release = publishedRelease(tag);
  if (release && tagCommit === sha) {
    if (mode === 'plan') writePlan([`# Set Conjurer ${tag}`, '', `Already released from this commit: ${release.url}. Nothing to do.`]);
    else console.log(`${tag} is already released from ${sha}: ${release.url}`);
    return process.exit(0);
  }
  const problems = [];
  if (tagCommit && tagCommit !== sha) problems.push(`Tag ${tag} already exists at ${tagCommit.slice(0, 12)}. Bump "version" in package.json in a pull request before releasing.`);
  if (!existsSync(`docs/releases/${tag}.md`)) problems.push(`Release notes docs/releases/${tag}.md are missing; the publish job requires them.`);
  for (const [script, arg] of [['scripts/validate-release-request.mjs', [tag, channel]], ['scripts/validate-app-pack-compatibility.mjs', [channel]]]) {
    try { run('node', [script, ...arg], {quiet: true}); } catch (error) { problems.push(`${script} rejected the release: ${String(error.stderr || error.message).trim().split('\n').pop()}`); }
  }

  if (mode === 'plan') {
    writePlan([
      `# Set Conjurer ${tag} (${channel})`, '',
      `- Commit: ${sha}`,
      `- Creates tag \`${tag}\` at that commit and dispatches **Release Set Conjurer** with publish=true and windows_signing=required.`,
      '- GitHub Actions builds, signs and notarizes macOS arm64/x64 and Windows x64, then publishes a GitHub Release' + (channel === 'beta' ? ' marked as a prerelease.' : ' marked as latest.'),
      `- Release notes come from docs/releases/${tag}.md.`,
      '',
      problems.length ? `**Blocked:**\n${problems.map((problem) => `- ${problem}`).join('\n')}` : 'Preflight checks passed.'
    ]);
    return process.exit(problems.length ? 1 : 0);
  }
  if (problems.length) fail(problems.join(' '));
  return startRun(state, tag, {channel, tag, publish: 'true', windows_signing: 'required'});
}

function compareVersions(a, b) {
  const pa = a.split(/[.-]/).map(Number); const pb = b.split(/[.-]/).map(Number);
  for (let index = 0; index < 3; index += 1) if (pa[index] !== pb[index]) return pa[index] - pb[index];
  return 0;
}

function packsRelease() {
  const state = readState();
  if (mode === 'check' || mode === 'resume') return followRun(state);

  const releases = JSON.parse(gh('release', 'list', '-R', repo, '-L', '100', '--json', 'tagName,isDraft'))
    .filter((item) => !item.isDraft && /^packs-v\d+\.\d+\.\d+$/.test(item.tagName))
    .map((item) => item.tagName)
    .sort((a, b) => compareVersions(a.slice(7), b.slice(7)));
  const previous = releases.at(-1);
  if (!previous) fail('No earlier packs-vX.Y.Z release found; run the first content pack release by hand.');

  // A retry after a successful run must not ship again: reuse a pack tag that already points here.
  const shippedHere = (state.sha === sha && state.tag && publishedRelease(state.tag)) ? state.tag : (remoteTagCommit(previous) === sha ? previous : null);
  if (shippedHere) {
    const message = `Content packs at ${sha} are already released as ${shippedHere}.`;
    if (mode === 'plan') writePlan(['# Content packs', '', message]); else console.log(message);
    return process.exit(0);
  }

  tryRun('git', ['fetch', '--quiet', 'origin', `refs/tags/${previous}:refs/tags/${previous}`]);
  const classification = JSON.parse(run('node', ['scripts/classify-ci-changes.mjs', '--base', previous, '--head', sha], {quiet: true}));
  const selection = classification.allPacks || classification.unknownPackPath ? 'all' : classification.packs.join(',');
  const [major, minor, patch] = previous.slice(7).split('.').map(Number);
  const tag = state.sha === sha && state.tag ? state.tag : `packs-v${major}.${minor}.${patch + 1}`;
  const base = `https://github.com/${repo}/releases/download/${previous}`;

  if (!selection) {
    const message = `No content pack changed since ${previous}; nothing to release.`;
    if (mode === 'plan') writePlan(['# Content packs', '', message]); else console.log(message);
    return process.exit(0);
  }
  if (mode === 'plan') {
    writePlan([
      `# Content packs ${tag}`, '',
      `- Commit: ${sha}; previous pack release: ${previous}.`,
      `- Packs: ${selection}${classification.reasons?.length ? ` (${classification.reasons.join('; ')})` : ''}.`,
      `- Creates tag \`${tag}\` and dispatches **Release Content Packs** with publish=true, comparing against ${previous}'s catalogs.`,
      '- Publishes an immutable prerelease; it never becomes the latest application release.',
      '- Release the app afterwards if it must require the new packs (update resources/pack-compatibility.json first).'
    ]);
    return process.exit(0);
  }
  return startRun(state.sha === sha ? state : {sha}, tag, {
    tag, packs: selection,
    previous_catalog_url: `${base}/frame-packs.json`,
    previous_catalog_v3_url: `${base}/frame-pack-catalog-v3.json`,
    publish: 'true'
  });
}

if (unit === 'app') appRelease(); else packsRelease();
