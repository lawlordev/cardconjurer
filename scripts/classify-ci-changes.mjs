import {execFileSync} from 'node:child_process';
import {appendFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {buildOwnershipGraph, classifyPaths, sparsePatternsForPacks} from './lib/pack-ownership.mjs';

const argumentsMap = new Map();
for (let index = 2; index < process.argv.length; index += 2) argumentsMap.set(process.argv[index], process.argv[index + 1]);
const base = argumentsMap.get('--base') || process.env.GITHUB_BASE_SHA || process.env.GITHUB_EVENT_BEFORE;
const head = argumentsMap.get('--head') || process.env.GITHUB_HEAD_SHA || process.env.GITHUB_SHA || 'HEAD';
if (!base || /^0+$/.test(base)) throw new Error('A non-zero base SHA is required for safe change classification.');

// Both values are immutable event SHAs, so a direct tree comparison is safer
// and faster than discovering a merge base in a shallow pull-request clone.
const output = execFileSync('git', ['diff', '--name-status', '--find-renames', base, head], {encoding: 'utf8'});
const changedPaths = output.trim().split(/\r?\n/).filter(Boolean).flatMap((line) => {
  const fields = line.split('\t');
  return /^[RC]/.test(fields[0]) ? fields.slice(1, 3) : fields.slice(1, 2);
});
const graph = buildOwnershipGraph();
const result = classifyPaths(changedPaths, graph);
result.sparsePatterns = result.materializePackAssets ? sparsePatternsForPacks(result.packs, graph) : [];

mkdirSync('build', {recursive: true});
writeFileSync('build/ci-classification.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));

if (process.env.GITHUB_OUTPUT) {
  const values = {
    app: result.app,
    package: result.package,
    pack_contract: result.packContract,
    materialize_pack_assets: result.materializePackAssets,
    all_packs: result.allPacks,
    unknown_pack_path: result.unknownPackPath,
    packs: result.packs.join(',')
  };
  for (const [key, value] of Object.entries(values)) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

if (result.unknownPackPath) {
  console.error('::error::At least one pack-related path was not mapped. All packs were selected conservatively; update packs/config.json or the ownership graph.');
}
