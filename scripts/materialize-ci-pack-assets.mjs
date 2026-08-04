import {spawnSync} from 'node:child_process';
import {buildOwnershipGraph, sparsePatternsForPacks} from './lib/pack-ownership.mjs';

const packIds = (process.argv[2] || '').split(',').map((value) => value.trim()).filter(Boolean);
if (!packIds.length) throw new Error('Pass the comma-separated logical pack IDs selected by classification.');
const patterns = sparsePatternsForPacks(packIds, buildOwnershipGraph());
if (!patterns.length) throw new Error(`No sparse paths were resolved for ${packIds.join(', ')}.`);
const result = spawnSync('git', ['sparse-checkout', 'add', '--no-cone', '--stdin'], {
  input: `${patterns.join('\n')}\n`, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit']
});
if (result.status !== 0) throw new Error('Git could not expand the sparse checkout for the selected packs.');
console.log(`Materialized ${patterns.length} ownership-derived sparse path(s) for ${packIds.join(', ')}.`);
