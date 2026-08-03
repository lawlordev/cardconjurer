import {mkdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';

const id = process.argv[2] || 'standard';
if (id !== 'standard') throw new Error('The local developer build only seeds the required Standard pack.');
const root = process.cwd();
const destination = path.join(root, 'build', 'local-pack-seed', id);
await rm(destination, {recursive: true, force: true});
await mkdir(destination, {recursive: true});
await writeFile(path.join(destination, 'manifest.json'), `${JSON.stringify({schemaVersion: 1, id, version: '1.0.0-local', developmentSource: root}, null, 2)}\n`);
await writeFile(path.join(destination, 'source-root.txt'), `${root}\n`);
console.log(`Created local-only ${id} seed pointing at ${root}.`);
