import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const outputRoot = path.join(root, 'generated', 'frame-definitions');
await mkdir(outputRoot, {recursive: true});

const registryContext = {window: {}};
vm.createContext(registryContext);
vm.runInContext(await readFile(path.join(root, 'js', 'frameRegistry.js'), 'utf8'), registryContext, {filename: 'frameRegistry.js'});
const registry = registryContext.window.FRAME_REGISTRY;
const assetPacks = [...new Set(Object.entries(registry.components).map(([name, details]) => details.assetPack || name))].sort();
const compiled = [];
const failed = [];

for (const pack of assetPacks) {
  const sourcePath = path.join(root, 'js', 'frames', `pack${pack}.js`);
  try {
    const source = await readFile(sourcePath, 'utf8');
    const element = {disabled: false, checked: false, value: '', onclick: null, style: {}, classList: {add() {}, remove() {}}};
    const context = {
      availableFrames: [],
      document: {querySelector: () => element, querySelectorAll: () => [], getElementById: () => element},
      loadFramePack() {}, loadFramePacks() {}, notify() {}, addTextbox() {}, card: {}, window: {}, console
    };
    vm.createContext(context);
    vm.runInContext(source, context, {filename: sourcePath, timeout: 1000});
    const frames = JSON.parse(JSON.stringify(context.availableFrames));
    await writeFile(path.join(outputRoot, `${pack}.json`), `${JSON.stringify({pack, frames}, null, 2)}\n`);
    compiled.push({pack, frameCount: frames.length});
  } catch (error) {
    failed.push({pack, reason: error instanceof Error ? error.message : String(error)});
  }
}

await writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify({schemaVersion: 1, compiled, failed}, null, 2)}\n`);
if (failed.length) {
  console.error(`Could not compile ${failed.length} component packs.`);
  failed.forEach((item) => console.error(`${item.pack}: ${item.reason}`));
  process.exitCode = 1;
} else {
  console.log(`Compiled ${compiled.length} component frame packs.`);
}
