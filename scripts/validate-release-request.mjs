import {readFileSync} from 'node:fs';

const [tag, channel] = process.argv.slice(2);
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const tagPattern = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

if (!tagPattern.test(tag || '')) throw new Error('Release tag must use vX.Y.Z or vX.Y.Z-prerelease format.');
if (tag !== `v${version}`) throw new Error(`Release tag ${tag} does not match package version ${version}.`);
if (!['beta', 'stable'].includes(channel)) throw new Error('Release channel must be beta or stable.');
const prerelease = version.includes('-');
if (channel === 'stable' && prerelease) throw new Error('A stable release cannot use a prerelease package version.');
if (channel === 'beta' && !prerelease) throw new Error('A beta release must use a prerelease package version.');

console.log(`Validated ${channel} release ${tag} for package version ${version}.`);
