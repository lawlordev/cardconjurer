const LEGACY_MINIMUM_APP_VERSION = '0.1.0-beta.1';

export function minimumAppVersionForPack(id) {
  return id === 'keywords' ? '0.1.0-beta.5' : LEGACY_MINIMUM_APP_VERSION;
}

export function bootstrapCatalogV3FromV2(catalog, generatedAt = new Date().toISOString()) {
  if (catalog?.schemaVersion !== 2 || !Array.isArray(catalog.packs)) {
    throw new Error('The previous frame-pack catalog is invalid.');
  }
  const seen = new Set();
  const packs = catalog.packs.map((pack) => {
    if (!pack || typeof pack.id !== 'string' || seen.has(pack.id) || typeof pack.version !== 'string' ||
        !Array.isArray(pack.archives) || pack.archives.length < 1 || !Number.isSafeInteger(pack.archiveBytes) ||
        !Number.isSafeInteger(pack.installedBytes)) {
      throw new Error('The previous frame-pack catalog cannot be bootstrapped safely.');
    }
    seen.add(pack.id);
    return {
      id: pack.id,
      versions: [{
        version: pack.version,
        packSchema: 3,
        rendererApiVersion: 1,
        minimumAppVersion: LEGACY_MINIMUM_APP_VERSION,
        revoked: false,
        archives: pack.archives.map((archive) => ({...archive})),
        archiveBytes: pack.archiveBytes,
        installedBytes: pack.installedBytes,
        legacySource: {catalogSchemaVersion: 2, manifestDigestAvailable: false}
      }]
    };
  });
  return {schemaVersion: 3, generatedAt, rendererApiVersion: 1, packs};
}
