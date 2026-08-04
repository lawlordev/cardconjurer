import {createHash} from 'node:crypto';
import {createReadStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {BASE_RUNTIME_ASSETS as BASE_RUNTIME_ASSET_LIST, PACK_IDS} from './lib/pack-ownership.mjs';

const GITHUB_RELEASE_ASSET_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
const ARCHIVE_SOURCE_TARGET_BYTES = 256 * 1024 * 1024;
const BASE_RUNTIME_ASSETS = new Set(BASE_RUNTIME_ASSET_LIST);
const tag = process.argv[2];
if (!/^packs-v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(tag || '')) throw new Error('Use an immutable packs-vX.Y.Z tag.');
const argument = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null; };
const selectedPackIds = new Set((argument('--packs') || PACK_IDS.join(',')).split(',').map((value) => value.trim()).filter(Boolean));
for (const id of selectedPackIds) if (!PACK_IDS.includes(id)) throw new Error(`Unknown logical pack: ${id}`);
const previousCatalogPath = argument('--previous-catalog');
const previousCatalogV3Path = argument('--previous-catalog-v3');
const root = process.cwd();
const output = path.join(root, 'build', 'frame-pack-release');
rmSync(output, {recursive: true, force: true}); mkdirSync(output, {recursive: true});
const registryContext = {window: {}}; vm.createContext(registryContext);
vm.runInContext(readFileSync(path.join(root, 'js', 'frameRegistry.js'), 'utf8'), registryContext);
const registry = registryContext.window.FRAME_REGISTRY;
const searchSource = readFileSync(path.join(root, 'js', 'frameSearch.js'), 'utf8');
const packIds = [...searchSource.matchAll(/\[\s*'(?:[^'\\]|\\.)*'\s*,\s*'([^']+)'\s*\]/g)].map((match) => match[1]);
const groups = new Map(PACK_IDS.map((id) => [id, new Set()]));

for (const pack of new Set(packIds.concat(Object.keys(registry.components)))) {
  const definition = registry.definition(pack); const category = definition.category || 'standard';
  const assetPack = registry.components[pack]?.assetPack || pack;
  const script = path.join(root, 'js', 'frames', `pack${assetPack}.js`);
  if (!statSafe(script)) continue;
  const source = readFileSync(script, 'utf8');
  for (const match of source.matchAll(/\/img\/frames\/([^/'"`$}]+)/g)) groups.get(category)?.add(match[1]);
}

function statSafe(file) { try { return statSync(file).isFile(); } catch { return false; } }
async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
function walk(directory) {
  const result = [];
  for (const entry of readdirSync(directory, {withFileTypes:true})) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(target)); else result.push(path.relative(root, target));
  }
  return result;
}
function partition(files) {
  const parts = []; let current = []; let currentBytes = 0;
  for (const file of files) {
    const bytes = statSync(path.join(root, file)).size;
    if (bytes > ARCHIVE_SOURCE_TARGET_BYTES) throw new Error(`${file} is too large to package safely (${bytes} bytes).`);
    if (current.length && currentBytes + bytes > ARCHIVE_SOURCE_TARGET_BYTES) {
      parts.push(current); current = []; currentBytes = 0;
    }
    current.push(file); currentBytes += bytes;
  }
  if (current.length) parts.push(current);
  return parts;
}
const catalog = previousCatalogPath && existsSync(previousCatalogPath)
  ? JSON.parse(readFileSync(previousCatalogPath, 'utf8'))
  : {schemaVersion: 2, packs: []};
if (catalog.schemaVersion !== 2 || !Array.isArray(catalog.packs)) throw new Error('The previous frame-pack catalog is invalid.');
const catalogV3 = previousCatalogV3Path && existsSync(previousCatalogV3Path)
  ? JSON.parse(readFileSync(previousCatalogV3Path, 'utf8'))
  : {schemaVersion: 3, generatedAt: new Date().toISOString(), rendererApiVersion: 1, packs: []};
if (catalogV3.schemaVersion !== 3 || !Array.isArray(catalogV3.packs)) throw new Error('The previous schema-3 frame-pack catalog is invalid.');
const checksums = [];
let archiveCount = 0;
const packFiles = new Map();
for (const [id, directories] of groups) {
  const files = id === 'set-symbols'
    ? walk(path.join(root, 'img', 'setSymbols'))
    : [...directories].flatMap((directory) => { const target = path.join(root, 'img', 'frames', directory); return statSafe(target) ? [path.relative(root, target)] : (() => { try { return walk(target); } catch { return []; } })(); });
  packFiles.set(id, new Set(files.filter((file) => !BASE_RUNTIME_ASSETS.has(file.replace(/\\/g, '/')))));
}

// Every payload file has exactly one archive owner. Anything referenced by
// multiple optional categories is promoted to Standard, which is always present.
const owners = new Map();
for (const [id, files] of packFiles) for (const file of files) {
  if (!owners.has(file)) owners.set(file, []);
  owners.get(file).push(id);
}
for (const [file, ids] of owners) if (ids.length > 1) {
  ids.forEach((id) => packFiles.get(id).delete(file));
  packFiles.get('standard').add(file);
}
writeFileSync(path.join(output, 'frame-pack-ownership.json'), `${JSON.stringify({
  schemaVersion: 1,
  files: [...packFiles].flatMap(([id, files]) => [...files].map((file) => ({file, owner:id}))).sort((left, right) => left.file.localeCompare(right.file))
}, null, 2)}\n`);

for (const [id, files] of packFiles) {
  if (!selectedPackIds.has(id)) continue;
  const uniqueFiles = [...files].sort();
  const expanded = uniqueFiles.reduce((total, file) => { try { return total + statSync(path.join(root, file)).size; } catch { return total; } }, 0);
  const manifestName = `frame-pack-${id}-manifest.json`;
  const fileMetadata = [];
  for (const file of uniqueFiles) fileMetadata.push({path: file.replace(/\\/g, '/'), bytes: statSync(path.join(root, file)).size, sha256: await sha256(path.join(root, file))});
  const manifestBody = `${JSON.stringify({schemaVersion:3, id, version:tag.replace(/^packs-v/,''), files:uniqueFiles, fileMetadata, installedBytes:expanded}, null, 2)}\n`;
  writeFileSync(path.join(output, manifestName), manifestBody);
  const manifestSha256 = createHash('sha256').update(manifestBody).digest('hex');
  const archives = [];
  const parts = partition(uniqueFiles);
  for (const [index, partFiles] of parts.entries()) {
    const archiveName = `set-conjurer-pack-${id}-${tag.replace(/^packs-v/,'')}-part-${String(index + 1).padStart(2, '0')}.zip`;
    const archivePath = path.join(output, archiveName);
    const zip = spawnSync('zip', ['-q', '-@', archivePath], {cwd:root, input:partFiles.join('\n'), encoding:'utf8'});
    if (zip.status !== 0) throw new Error(`zip failed for ${id} part ${index + 1}: ${zip.stderr}`);
    const archiveBytes = statSync(archivePath).size;
    if (archiveBytes >= GITHUB_RELEASE_ASSET_LIMIT_BYTES) {
      throw new Error(`${archiveName} is ${archiveBytes} bytes; GitHub release assets must be smaller than 2 GiB.`);
    }
    const digest = await sha256(archivePath);
    console.log(`Checked ${archiveName}: ${archiveBytes} bytes (under 2 GiB).`);
    archives.push({url:`https://github.com/lawlordev/cardconjurer/releases/download/${tag}/${archiveName}`, sha256:digest, archiveBytes});
    checksums.push(`${digest}  ${archiveName}`);
    archiveCount += 1;
  }
  catalog.packs = catalog.packs.filter((pack) => pack.id !== id);
  catalog.packs.push({id, version:tag.replace(/^packs-v/,''), archives, archiveBytes:archives.reduce((total, archive) => total + archive.archiveBytes, 0), installedBytes:expanded});
  let history = catalogV3.packs.find((pack) => pack.id === id);
  if (!history) { history = {id, versions: []}; catalogV3.packs.push(history); }
  history.versions = history.versions.filter((version) => version.version !== tag.replace(/^packs-v/,''));
  history.versions.push({
    version: tag.replace(/^packs-v/,''), packSchema: 3, rendererApiVersion: 1, minimumAppVersion: '0.1.0-beta.1',
    revoked: false, archives, archiveBytes: archives.reduce((total, archive) => total + archive.archiveBytes, 0), installedBytes: expanded,
    manifest: {url:`https://github.com/lawlordev/cardconjurer/releases/download/${tag}/${manifestName}`, sha256:manifestSha256}
  });
}
catalog.packs.sort((left, right) => left.id.localeCompare(right.id));
catalogV3.generatedAt = new Date().toISOString();
catalogV3.packs.sort((left, right) => left.id.localeCompare(right.id));
writeFileSync(path.join(output, 'frame-packs.json'), `${JSON.stringify(catalog, null, 2)}\n`);
writeFileSync(path.join(output, 'frame-pack-catalog-v3.json'), `${JSON.stringify(catalogV3, null, 2)}\n`);
writeFileSync(path.join(output, 'SHA256SUMS'), `${checksums.join('\n')}\n`);
console.log(`Built ${archiveCount} immutable archives for ${catalog.packs.length} frame packs.`);
