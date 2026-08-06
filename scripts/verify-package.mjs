import {existsSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {listPackage} from '@electron/asar';
import {NtExecutable, NtExecutableResource, Resource} from 'resedit';

const root = process.cwd();
const out = path.join(root, 'out');
if (!existsSync(out)) throw new Error('No packaged output exists. Run npm run package first.');
const forbidden = ['img/frames', 'img/setSymbols', 'js/mseKeywordCatalog.js', 'about', 'gallery', 'converter', 'tutorial', '.git'];
const asarPaths = process.platform === 'darwin'
  ? [path.join(out, 'Set Conjurer-darwin-arm64', 'Set Conjurer.app', 'Contents', 'Resources', 'app.asar')]
  : [path.join(out, `Set Conjurer-${process.platform}-${process.arch}`, 'resources', 'app.asar')];
const packConfig = JSON.parse(readFileSync(path.join(root, 'packs', 'config.json'), 'utf8'));
const baseFrameAssets = packConfig.baseRuntimeAssets.map((asset) => `/${asset.replace(/\\/g, '/')}`);
for (const asarPath of asarPaths.filter(existsSync)) {
  if (statSync(asarPath).size === 0) throw new Error('The packaged app is empty.');
  const inventory = listPackage(asarPath).map((entry) => entry.replace(/\\/g, '/'));
  for (const prefix of ['/img/setSymbols/', '/about/', '/gallery/', '/converter/', '/data/images/', '/tutorial/', '/tests/', '/docs/', '/.git/', '/launcher']) {
    if (inventory.some((entry) => entry.startsWith(prefix))) throw new Error(`Forbidden packaged path: ${prefix}`);
  }
  if (inventory.includes('/js/mseKeywordCatalog.js')) throw new Error('Keyword payload is bundled in the base package.');
  const unexpectedFrames = inventory.filter((entry) => entry.startsWith('/img/frames/') && !baseFrameAssets.includes(entry));
  if (unexpectedFrames.length) throw new Error(`Unexpected frame asset in base package: ${unexpectedFrames[0]}`);
  for (const required of ['/dist/desktop/main.js', '/dist/desktop/preload.js', '/js/desktopBridge.js', '/generated/frame-definitions/manifest.json', '/resources/pack-compatibility.json', '/core/standard-card-back.png', '/node_modules/yauzl/index.js', ...baseFrameAssets]) {
    if (!inventory.includes(required)) throw new Error(`Required packaged path is missing: ${required}`);
  }
}
if (process.platform === 'win32') {
  const executablePath = path.join(out, `Set Conjurer-win32-${process.arch}`, 'set-conjurer.exe');
  const executable = NtExecutable.from(readFileSync(executablePath));
  const resources = NtExecutableResource.from(executable);
  const versionInfo = Resource.VersionInfo.fromEntries(resources.entries);
  const languages = versionInfo[0]?.getAllLanguagesForStringValues() || [];
  if (!languages.some((language) => versionInfo[0].getStringValues(language).SquirrelAwareVersion === '1')) {
    throw new Error('Packaged Windows executable is not marked Squirrel-aware.');
  }
}
const config = readFileSync(path.join(root, 'forge.config.ts'), 'utf8');
for (const item of forbidden) {
  if (item === 'img/frames' && !config.includes('excludedFramePayload')) throw new Error('Frame assets are not excluded from the base installer.');
  if (item === 'img/setSymbols' && !config.includes('img\\/setSymbols')) throw new Error('Set-symbol assets are not excluded from the base installer.');
  if (item === 'js/mseKeywordCatalog.js' && !config.includes('mseKeywordCatalog')) throw new Error('Keyword assets are not excluded from the base installer.');
}
console.log('Packaged surface verification passed.');
