import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import {BASE_RUNTIME_ASSETS, PACK_IDS, buildOwnershipGraph} from './lib/pack-ownership.mjs';

const packsArgument = process.argv[process.argv.indexOf('--packs') + 1] || PACK_IDS.join(',');
const selected = [...new Set(packsArgument.split(',').map((value) => value.trim()).filter(Boolean))];
const validateAssets = process.argv.includes('--assets');
for (const id of selected) if (!PACK_IDS.includes(id)) throw new Error(`Unknown logical pack: ${id}`);

const graph = buildOwnershipGraph();
const errors = [];
const literalAssets = new Map();
for (const pack of graph.packs.filter((item) => selected.includes(item.id))) {
  if (!pack.sources.length && !['set-symbols', 'keywords'].includes(pack.id)) errors.push(`${pack.id}: no frame definition sources were resolved`);
  for (const source of pack.sources) {
    if (!existsSync(source)) {
      errors.push(`${pack.id}: missing definition source ${source}`);
      continue;
    }
    const contents = readFileSync(source, 'utf8');
    for (const match of contents.matchAll(/['"`](\/img\/(?:frames|setSymbols)\/[^'"`$}]+)['"`]/g)) {
      const asset = match[1].replace(/^\//, '');
      if (!literalAssets.has(asset)) literalAssets.set(asset, new Set());
      literalAssets.get(asset).add(pack.id);
    }
  }
}

function exactCaseExists(relative) {
  let directory = process.cwd();
  for (const segment of relative.split('/')) {
    let names;
    try { names = readdirSync(directory); } catch { return false; }
    if (!names.includes(segment)) return false;
    directory = path.join(directory, segment);
  }
  return existsSync(directory);
}

if (validateAssets) for (const [asset, consumers] of literalAssets) {
  if (BASE_RUNTIME_ASSETS.includes(asset)) continue;
  if (!exactCaseExists(asset)) errors.push(`${[...consumers].join(',')}: missing or wrong-case asset ${asset}`);
  else if (!statSync(asset).isFile() || statSync(asset).size < 1) errors.push(`${[...consumers].join(',')}: empty asset ${asset}`);
}

const ownershipPrefixes = graph.packs.filter((item) => selected.includes(item.id)).flatMap((item) => item.prefixes);
if (validateAssets && selected.includes('keywords') && (!exactCaseExists('js/mseKeywordCatalog.js') || statSync('js/mseKeywordCatalog.js').size < 1)) errors.push('keywords: missing or empty js/mseKeywordCatalog.js');
if (validateAssets && !ownershipPrefixes.length && !selected.some((id) => ['set-symbols', 'keywords'].includes(id))) errors.push('No ownership-derived asset prefixes were selected.');
if (errors.length) throw new Error(`Content-pack validation failed:\n${errors.join('\n')}`);
console.log(`Validated ${selected.join(', ')} (${literalAssets.size} literal asset references${validateAssets ? ', assets checked' : ', metadata only'}).`);
