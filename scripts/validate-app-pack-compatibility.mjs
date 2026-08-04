import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PACK_IDS} from './lib/pack-ownership.mjs';

const descriptor = JSON.parse(readFileSync('resources/pack-compatibility.json', 'utf8'));
const releaseChannel = process.argv[2] || null;
if (descriptor.schemaVersion !== 1) throw new Error('Unsupported pack compatibility descriptor schema.');
if (!Array.isArray(descriptor.supportedPackSchemas) || !descriptor.supportedPackSchemas.includes(2) || !descriptor.supportedPackSchemas.includes(3)) throw new Error('The application must declare its supported pack schemas.');
for (const id of ['set-symbols', 'standard']) {
  if (!PACK_IDS.includes(id) || !/^\d+\.\d+\.\d+/.test(descriptor.requiredPacks?.[id] || '')) throw new Error(`Missing required-pack compatibility floor for ${id}.`);
}
const pin = descriptor.catalog || {};
if ((pin.knownGoodTag === null) !== (pin.sha256 === null)) throw new Error('Catalog tag and checksum must either both be set or both be null for the legacy transition.');
if (pin.knownGoodTag !== null && !/^packs-v\d+\.\d+\.\d+/.test(pin.knownGoodTag)) throw new Error('The known-good catalog tag is invalid.');
if (pin.sha256 !== null && !/^[a-f0-9]{64}$/i.test(pin.sha256)) throw new Error('The known-good catalog checksum is invalid.');
if (releaseChannel === 'stable' && pin.knownGoodTag === null) throw new Error('Stable application releases require an immutable known-good frame-pack catalog pin.');
const digest = createHash('sha256').update(JSON.stringify(descriptor)).digest('hex');
console.log(`Pack compatibility descriptor validated (${digest.slice(0, 12)}; ${pin.knownGoodTag || 'legacy schema-2 discovery'}).`);
