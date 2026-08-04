import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const failures = [];
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if (['node_modules', 'dist', 'out', '.git'].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(target));
    else if (/\.(?:js|mjs|ts|html)$/.test(entry.name)) result.push(target);
  }
  return result;
}
for (const file of await files(root)) {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  if (relative === 'js/htmx.min.js' || relative.startsWith('docs/') || relative.startsWith('data/') || relative.startsWith('print/') || relative.startsWith('about/') || relative.startsWith('askurza/') || relative.startsWith('converter/') || relative.startsWith('gallery/') || relative.startsWith('legal/') || relative.startsWith('phyrexian/') || relative.startsWith('theme/') || relative.startsWith('tutorial/')) continue;
  const source = await readFile(file, 'utf8');
  if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(source)) failures.push(`${relative}: runtime code evaluation`);
  if (/https?:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)\/.*\.js/i.test(source)) failures.push(`${relative}: runtime CDN script`);
}
const main = await readFile(path.join(root, 'desktop/main.ts'), 'utf8');
for (const requirement of ['nodeIntegration: false', 'contextIsolation: true', 'sandbox: true', "setWindowOpenHandler", "will-navigate"]) {
  if (!main.includes(requirement)) failures.push(`desktop/main.ts: missing ${requirement}`);
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('Desktop security policy checks passed.');
