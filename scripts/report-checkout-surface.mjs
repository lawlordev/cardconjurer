import {readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import {BASE_RUNTIME_ASSETS} from './lib/pack-ownership.mjs';

const root = process.cwd();
const expectSparse = process.argv.includes('--expect-sparse');
const allowlist = new Set(BASE_RUNTIME_ASSETS.map((item) => item.replace(/\\/g, '/')));
const ignoredDirectories = new Set(['.git', 'build', 'node_modules', 'out']);
const excludedApplicationPrefixes = ['about/', 'askurza/', 'converter/', 'data/images/', 'gallery/', 'legal/', 'phyrexian/', 'theme/', 'tutorial/', 'launcher'];
let files = 0;
let bytes = 0;
const forbidden = [];
const excludedApplicationPayload = [];

function walk(directory) {
  let entries = [];
  try { entries = readdirSync(directory, {withFileTypes: true}); } catch { return; }
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) walk(target);
    }
    else {
      const relative = path.relative(root, target).replace(/\\/g, '/');
      files += 1;
      bytes += statSync(target).size;
      if ((relative.startsWith('img/frames/') && !allowlist.has(relative)) || relative.startsWith('img/setSymbols/')) forbidden.push(relative);
      if (excludedApplicationPrefixes.some((prefix) => relative.startsWith(prefix))) excludedApplicationPayload.push(relative);
    }
  }
}

walk(root);
const missingBaseAssets = [...allowlist].filter((relative) => {
  try { return !statSync(path.join(root, relative)).isFile(); } catch { return true; }
});
const report = {files, bytes, mebibytes: Number((bytes / 1024 / 1024).toFixed(2)), forbiddenPackPayloadFiles: forbidden.length, excludedApplicationPayloadFiles: excludedApplicationPayload.length, missingBaseAssets};
console.log(JSON.stringify(report));
if (expectSparse && forbidden.length) throw new Error(`Sparse checkout materialized pack payload: ${forbidden.slice(0, 5).join(', ')}`);
if (expectSparse && excludedApplicationPayload.length) throw new Error(`Sparse checkout materialized legacy application payload: ${excludedApplicationPayload.slice(0, 5).join(', ')}`);
if (expectSparse && missingBaseAssets.length) throw new Error(`Sparse checkout omitted app-owned renderer assets: ${missingBaseAssets.join(', ')}`);
