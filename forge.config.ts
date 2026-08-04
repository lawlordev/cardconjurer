import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {readFileSync, readdirSync} from 'node:fs';

const includeDevelopmentPacks = process.env.SET_CONJURER_INCLUDE_DEV_PACKS === '1';
const signingIdentity = process.env.APPLE_SIGN_IDENTITY || '-';
const packConfig = JSON.parse(readFileSync(path.resolve('packs/config.json'), 'utf8')) as {baseRuntimeAssets: string[]};
const baseRuntimeNames = packConfig.baseRuntimeAssets.map((asset) => path.basename(asset).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const excludedFramePayload = new RegExp(`^\\/img\\/frames\\/(?!(?:${baseRuntimeNames.join('|')})$)`);

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Set Conjurer',
    executableName: 'set-conjurer',
    appBundleId: 'com.lawlordev.setconjurer',
    appCategoryType: 'public.app-category.graphics-design',
    asar: true,
    ...(process.env.SET_CONJURER_ELECTRON_ZIP_DIR ? {electronZipDir: process.env.SET_CONJURER_ELECTRON_ZIP_DIR} : {}),
    icon: path.resolve('resources/icons/set-conjurer'),
    osxSign: {
      identity: signingIdentity
    },
    ...(process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER
      ? {osxNotarize: {
          appleApiKey: process.env.APPLE_API_KEY,
          appleApiKeyId: process.env.APPLE_API_KEY_ID,
          appleApiIssuer: process.env.APPLE_API_ISSUER
        }}
      : {}),
    extraResource: includeDevelopmentPacks && require('node:fs').existsSync(path.resolve('build/local-pack-seed'))
      ? [path.resolve('build/local-pack-seed')]
      : [],
    protocols: [{
      name: 'Set Conjurer',
      schemes: ['set-conjurer']
    }],
    extendInfo: {
      CFBundleDisplayName: 'Set Conjurer',
      CFBundleName: 'Set Conjurer',
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'Set Conjurer Card',
          CFBundleTypeRole: 'Editor',
          LSHandlerRank: 'Owner',
          CFBundleTypeExtensions: ['cardconjurer-card']
        },
        {
          CFBundleTypeName: 'Set Conjurer Set',
          CFBundleTypeRole: 'Editor',
          LSHandlerRank: 'Owner',
          CFBundleTypeExtensions: ['cardconjurer-set']
        }
      ]
    },
    ignore: [
      /^\/(?:\.git|\.github|\.agents|\.codex)(?:\/|$)/,
      /^\/(?:about|askurza|converter|gallery|legal|phyrexian|theme|tutorial)(?:\/|$)/,
      /^\/docs(?:\/|$)/,
      /^\/tests(?:\/|$)/,
      /^\/data\/images(?:\/|$)/,
      excludedFramePayload,
      /^\/img\/setSymbols(?:\/|$)/,
      /^\/build(?:\/|$)/,
      /^\/out(?:\/|$)/,
      /^\/node_modules\/\.cache(?:\/|$)/,
      /^\/(?:dev_server\.py|start-dev-server\.ps1|docker-compose\.ya?ml|Dockerfile|Makefile)$/
    ]
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ['darwin']),
    new MakerDMG({
      name: `Set-Conjurer-${process.arch}`,
      overwrite: true,
      format: 'ULFO',
      ...(signingIdentity !== '-' ? {additionalDMGOptions: {
        'code-sign': {
          'signing-identity': signingIdentity,
          identifier: 'com.lawlordev.setconjurer'
        }
      }} : {})
    }),
    new MakerSquirrel({
      name: 'set_conjurer',
      authors: 'Jake Lawlor',
      description: 'A local-first desktop fork of Card Conjurer for creating custom card sets.',
      setupExe: 'Set-Conjurer-Windows-x64-Setup.exe',
      noMsi: true,
      // The release workflow signs Squirrel.exe before packaging. Rewriting its
      // icon here would invalidate that Authenticode signature.
      skipUpdateIcon: true
    })
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ],
  hooks: {
    postPackage: async (_forgeConfig, result) => {
      if (result.platform !== 'darwin' || signingIdentity !== '-') return;
      for (const outputPath of result.outputPaths) {
        const appBundle = readdirSync(outputPath).find((entry) => entry.endsWith('.app'));
        if (appBundle) execFileSync('codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', path.join(outputPath, appBundle)], {stdio: 'inherit'});
      }
    }
  }
};

export default config;
