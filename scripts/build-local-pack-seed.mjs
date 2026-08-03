import {mkdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const packIds = ['standard', 'booster-fun', 'tokens', 'basics', 'legacy', 'custom'];
const requested = process.argv[2] || 'all';
const selected = requested === 'all' ? packIds : [requested];
if (selected.some((id) => !packIds.includes(id))) throw new Error(`Unknown frame pack: ${requested}`);

const seedRoot = path.join(root, 'build', 'local-pack-seed');
await rm(seedRoot, {recursive: true, force: true});
for (const id of selected) {
	const destination = path.join(seedRoot, id);
	await mkdir(destination, {recursive: true});
	await writeFile(path.join(destination, 'manifest.json'), `${JSON.stringify({schemaVersion: 1, id, version: '1.0.0-local', developmentSource: root}, null, 2)}\n`);
	await writeFile(path.join(destination, 'source-root.txt'), `${root}\n`);
}
console.log(`Created local-only seeds for ${selected.join(', ')} pointing at ${root}.`);
