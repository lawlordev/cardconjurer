import {existsSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

if (process.platform !== 'darwin') {
  console.error('The macOS installer preview can only be built and opened on macOS.');
  process.exit(1);
}

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor < 24 || nodeMajor >= 26) {
  console.error(`The macOS installer preview requires Node 24 or 25; current runtime is ${process.versions.node}.`);
  process.exit(1);
}

const requestedArch = process.argv.find((argument) => argument.startsWith('--arch='))?.slice('--arch='.length);
const arch = requestedArch || process.arch;
if (!['arm64', 'x64'].includes(arch)) {
  console.error(`Unsupported macOS architecture: ${arch}. Use --arch=arm64 or --arch=x64.`);
  process.exit(1);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const makeResult = spawnSync(
  npmCommand,
  ['run', 'make:local', '--', '--platform=darwin', `--arch=${arch}`, '--targets=dmg'],
  {cwd: process.cwd(), env: process.env, stdio: 'inherit'}
);
if (makeResult.error) throw makeResult.error;
if (makeResult.status !== 0) process.exit(makeResult.status ?? 1);

function findDiskImages(directory) {
  const images = [];
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) images.push(...findDiskImages(entryPath));
    else if (entry.isFile() && entry.name.endsWith('.dmg')) images.push(entryPath);
  }
  return images;
}

const makeDirectory = path.resolve('out/make');
if (!existsSync(makeDirectory)) {
  console.error(`The installer build completed without creating ${makeDirectory}.`);
  process.exit(1);
}
const diskImage = findDiskImages(makeDirectory)
  .filter((candidate) => path.basename(candidate) === `Set-Conjurer-${arch}.dmg`)
  .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0];

if (!diskImage) {
  console.error(`No Set-Conjurer-${arch}.dmg was found beneath ${makeDirectory}.`);
  process.exit(1);
}

console.log(`Opening installer preview: ${diskImage}`);
const openResult = spawnSync('open', [diskImage], {stdio: 'inherit'});
if (openResult.error) throw openResult.error;
process.exit(openResult.status ?? 0);
