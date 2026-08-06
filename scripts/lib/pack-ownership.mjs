import {readFileSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const config = JSON.parse(readFileSync(path.join(root, 'packs', 'config.json'), 'utf8'));

export const PACK_IDS = Object.freeze([...config.packIds]);
export const BASE_RUNTIME_ASSETS = Object.freeze([...config.baseRuntimeAssets]);

const normalize = (value) => value.replace(/\\/g, '/').replace(/^\.\//, '');

function registry() {
  const context = {window: {}};
  vm.createContext(context);
  vm.runInContext(readFileSync(path.join(root, 'js', 'frameRegistry.js'), 'utf8'), context, {filename: 'frameRegistry.js'});
  return context.window.FRAME_REGISTRY;
}

function searchPackIds() {
  const source = readFileSync(path.join(root, 'js', 'frameSearch.js'), 'utf8');
  return [...source.matchAll(/\[\s*'(?:[^'\\]|\\.)*'\s*,\s*'([^']+)'\s*\]/g)].map((match) => match[1]);
}

export function buildOwnershipGraph() {
  const frameRegistry = registry();
  const logicalPacks = new Map(PACK_IDS.map((id) => [id, {id, sources: new Set(), prefixes: new Set(config.dynamicAssetPrefixes[id] || [])}]));
  const sourceConsumers = new Map();
  const prefixConsumers = new Map();
  const candidates = new Set([...searchPackIds(), ...Object.keys(frameRegistry.components)]);

  for (const packName of candidates) {
    let definition;
    try { definition = frameRegistry.definition(packName); } catch { continue; }
    const category = PACK_IDS.includes(definition.category) ? definition.category : 'standard';
    const assetPack = frameRegistry.components[packName]?.assetPack || packName;
    const source = `js/frames/pack${assetPack}.js`;
    const record = logicalPacks.get(category);
    try {
      const contents = readFileSync(path.join(root, source), 'utf8');
      record.sources.add(source);
      if (!sourceConsumers.has(source)) sourceConsumers.set(source, new Set());
      sourceConsumers.get(source).add(category);
      for (const match of contents.matchAll(/\/img\/frames\/([^/'"`$}]+)/g)) {
        const prefix = `img/frames/${match[1]}/`;
        record.prefixes.add(prefix);
        if (!prefixConsumers.has(prefix)) prefixConsumers.set(prefix, new Set());
        prefixConsumers.get(prefix).add(category);
      }
    } catch {}
  }

  prefixConsumers.set('img/setSymbols/', new Set(['set-symbols']));
  for (const [id, value] of logicalPacks) for (const prefix of value.prefixes) {
    if (!prefixConsumers.has(prefix)) prefixConsumers.set(prefix, new Set());
    prefixConsumers.get(prefix).add(id);
  }

  return {
    packIds: [...PACK_IDS],
    baseRuntimeAssets: [...BASE_RUNTIME_ASSETS],
    packs: [...logicalPacks.values()].map((value) => ({id: value.id, sources: [...value.sources].sort(), prefixes: [...value.prefixes].sort()})),
    sourceConsumers: Object.fromEntries([...sourceConsumers].map(([key, value]) => [key, [...value].sort()])),
    prefixConsumers: Object.fromEntries([...prefixConsumers].map(([key, value]) => [key, [...value].sort()]))
  };
}

const packagePatterns = [
  /^forge\.config\.ts$/,
  /^package(?:-lock)?\.json$/,
  /^desktop\/(?:main|preload)\.ts$/,
  /^desktop\/ipc\//,
  /^desktop\/services\//,
  /^scripts\/(?:verify-package|test-electron|test-windows-installer)\./,
  /^\.github\/workflows\/(?:ci|release-app)\.ya?ml$/,
  /^resources\/(?:icons|pack-compatibility\.json)/
];

const packContractPatterns = [
  /^packs\//,
  /^scripts\/(?:build-frame-pack-release|compile-frame-packs|validate-frame-packs|classify-ci-changes)\.mjs$/,
  /^scripts\/lib\/pack-ownership\.mjs$/,
  /^\.github\/workflows\/release-frame-packs\.ya?ml$/
];

export function classifyPaths(inputPaths, graph = buildOwnershipGraph()) {
  const paths = [...new Set(inputPaths.map(normalize).filter(Boolean))];
  const packs = new Set();
  const assetPacks = new Set();
  const reasons = [];
  let app = false;
  let packageLane = false;
  let packContract = false;
  let unknownPackPath = false;

  const selectPacks = (ids, reason) => {
    ids.forEach((id) => packs.add(id));
    reasons.push(reason);
  };
  const selectAssetPacks = (ids, reason) => {
    ids.forEach((id) => assetPacks.add(id));
    selectPacks(ids, reason);
  };

  for (const file of paths) {
    if (graph.baseRuntimeAssets.includes(file)) {
      app = true; packageLane = true;
      reasons.push(`${file}: app-owned renderer runtime asset`);
      continue;
    }
    if (file.startsWith('img/setSymbols/')) {
      selectAssetPacks(['set-symbols'], `${file}: set-symbol payload`);
      continue;
    }
    if (file === 'js/mseKeywordCatalog.js') {
      selectAssetPacks(['keywords'], `${file}: keyword payload`);
      continue;
    }
    if (file.startsWith('img/frames/')) {
      const matching = Object.entries(graph.prefixConsumers)
        .filter(([prefix]) => file.startsWith(prefix))
        .flatMap(([, ids]) => ids);
      if (matching.length) selectAssetPacks(matching, `${file}: owned frame payload`);
      else {
        unknownPackPath = true;
        selectAssetPacks(graph.packIds, `${file}: unmapped frame payload; fail closed`);
      }
      continue;
    }
    if (/^js\/frames\/pack.*\.js$/.test(file)) {
      const consumers = graph.sourceConsumers[file] || [];
      selectPacks(consumers.length ? consumers : graph.packIds, `${file}: frame definition`);
      if (!consumers.length) unknownPackPath = true;
      continue;
    }
    if (/^js\/(?:frameRegistry|frameSearch)\.js$/.test(file) || /^js\/frames\/(?:version|group|mana)/i.test(file)) {
      app = true;
      selectPacks(graph.packIds, `${file}: shared frame metadata/runtime`);
    }
    if (file === 'scripts/compile-mse-keywords.mjs' || file.startsWith('vendor/mse/')) {
      selectPacks(['keywords'], `${file}: keyword source/tooling`);
    }
    if (packContractPatterns.some((pattern) => pattern.test(file))) {
      packContract = true;
      selectPacks(graph.packIds, `${file}: pack contract/tooling`);
    }
    if (packagePatterns.some((pattern) => pattern.test(file))) packageLane = true;
    if (!file.startsWith('docs/planning/') && !file.startsWith('img/frames/') && !file.startsWith('img/setSymbols/')) app = true;
  }

  return {
    app,
    package: packageLane,
    packContract,
    materializePackAssets: assetPacks.size > 0,
    assetPacks: [...assetPacks].sort(),
    allPacks: packs.size === graph.packIds.length,
    unknownPackPath,
    packs: [...packs].sort(),
    paths,
    reasons: [...new Set(reasons)]
  };
}

export function sparsePatternsForPacks(packIds, graph = buildOwnershipGraph()) {
  const selected = new Set(packIds);
  const patterns = new Set();
  for (const pack of graph.packs) if (selected.has(pack.id)) {
    pack.sources.forEach((source) => patterns.add(`/${source}`));
    pack.prefixes.forEach((prefix) => patterns.add(prefix.endsWith('/') ? `/${prefix}**` : `/${prefix}`));
  }
  if (selected.has('set-symbols')) patterns.add('/img/setSymbols/**');
  if (selected.has('keywords')) patterns.add('/js/mseKeywordCatalog.js');
  graph.baseRuntimeAssets.forEach((asset) => patterns.delete(`/${asset}`));
  return [...patterns].sort();
}
