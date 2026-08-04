import {createHash} from 'node:crypto';
import {readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';

const tag = process.argv[2];
if (!/^packs-v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(tag || '')) throw new Error('Use an immutable packs-vX.Y.Z tag.');
const root = process.cwd();
const output = path.join(root, 'build', 'frame-pack-release');
rmSync(output, {recursive: true, force: true}); mkdirSync(output, {recursive: true});
const registryContext = {window: {}}; vm.createContext(registryContext);
vm.runInContext(readFileSync(path.join(root, 'js', 'frameRegistry.js'), 'utf8'), registryContext);
const registry = registryContext.window.FRAME_REGISTRY;
const searchSource = readFileSync(path.join(root, 'js', 'frameSearch.js'), 'utf8');
const packIds = [...searchSource.matchAll(/\[\s*'(?:[^'\\]|\\.)*'\s*,\s*'([^']+)'\s*\]/g)].map((match) => match[1]);
const groups = new Map(['set-symbols','standard','booster-fun','tokens','basics','legacy','custom'].map((id) => [id, new Set()]));

for (const pack of new Set(packIds.concat(Object.keys(registry.components)))) {
  const definition = registry.definition(pack); const category = definition.category || 'standard';
  const assetPack = registry.components[pack]?.assetPack || pack;
  const script = path.join(root, 'js', 'frames', `pack${assetPack}.js`);
  if (!statSafe(script)) continue;
  const source = readFileSync(script, 'utf8');
  for (const match of source.matchAll(/\/img\/frames\/([^/'"`$}]+)/g)) groups.get(category)?.add(match[1]);
}

function statSafe(file) { try { return statSync(file).isFile(); } catch { return false; } }
function walk(directory) {
  const result = [];
  for (const entry of readdirSync(directory, {withFileTypes:true})) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(target)); else result.push(path.relative(root, target));
  }
  return result;
}
const catalog = {schemaVersion: 1, packs: []};
for (const [id, directories] of groups) {
  const files = id === 'set-symbols'
    ? walk(path.join(root, 'img', 'setSymbols'))
    : [...directories].flatMap((directory) => { const target = path.join(root, 'img', 'frames', directory); return statSafe(target) ? [path.relative(root, target)] : (() => { try { return walk(target); } catch { return []; } })(); });
  const expanded = files.reduce((total, file) => { try { return total + statSync(path.join(root, file)).size; } catch { return total; } }, 0);
  const manifestName = `frame-pack-${id}-manifest.json`;
  writeFileSync(path.join(output, manifestName), `${JSON.stringify({schemaVersion:1, id, version:tag.replace(/^packs-v/,''), files:[...new Set(files)].sort(), installedBytes:expanded}, null, 2)}\n`);
  const archiveName = `set-conjurer-pack-${id}-${tag.replace(/^packs-v/,'')}.zip`;
  const fileList = [...new Set(files)].sort().join('\n');
  const zip = spawnSync('zip', ['-q', '-@', path.join(output, archiveName)], {cwd:root, input:fileList, encoding:'utf8'});
  if (zip.status !== 0) throw new Error(`zip failed for ${id}: ${zip.stderr}`);
  const archive = readFileSync(path.join(output, archiveName));
  catalog.packs.push({id, version:tag.replace(/^packs-v/,''), url:`https://github.com/lawlordev/cardconjurer/releases/download/${tag}/${archiveName}`, sha256:createHash('sha256').update(archive).digest('hex'), archiveBytes:archive.length, installedBytes:expanded});
}
writeFileSync(path.join(output, 'frame-packs.json'), `${JSON.stringify(catalog, null, 2)}\n`);
writeFileSync(path.join(output, 'SHA256SUMS'), `${catalog.packs.map((pack) => `${pack.sha256}  ${path.basename(pack.url)}`).join('\n')}\n`);
console.log(`Built ${catalog.packs.length} immutable frame-pack archives.`);
