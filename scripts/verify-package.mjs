import {existsSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {listPackage} from '@electron/asar';

const root = process.cwd();
const out = path.join(root, 'out');
if (!existsSync(out)) throw new Error('No packaged output exists. Run npm run package first.');
const forbidden = ['img/frames', 'img/setSymbols', 'about', 'gallery', 'converter', 'tutorial', '.git'];
const appPaths = process.platform === 'darwin'
  ? [path.join(out, 'Set Conjurer-darwin-arm64', 'Set Conjurer.app')]
  : [];
for (const appPath of appPaths.filter(existsSync)) {
  if (statSync(appPath).size === 0) throw new Error('The packaged app is empty.');
  const asarPath = path.join(appPath, 'Contents', 'Resources', 'app.asar');
  const inventory = listPackage(asarPath);
  for (const prefix of ['/img/frames/', '/img/setSymbols/', '/about/', '/gallery/', '/converter/', '/tutorial/', '/tests/', '/docs/', '/.git/']) {
    if (inventory.some((entry) => entry.startsWith(prefix))) throw new Error(`Forbidden packaged path: ${prefix}`);
  }
  for (const required of ['/dist/desktop/main.js', '/dist/desktop/preload.js', '/js/desktopBridge.js', '/generated/frame-definitions/manifest.json', '/core/standard-card-back.png']) {
    if (!inventory.includes(required)) throw new Error(`Required packaged path is missing: ${required}`);
  }
}
const config = readFileSync(path.join(root, 'forge.config.ts'), 'utf8');
for (const item of forbidden) {
  if (item === 'img/frames' && !config.includes('img\\/frames')) throw new Error('Frame assets are not excluded from the base installer.');
  if (item === 'img/setSymbols' && !config.includes('img\\/setSymbols')) throw new Error('Set-symbol assets are not excluded from the base installer.');
}
console.log('Packaged surface verification passed.');
