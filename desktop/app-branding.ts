export type AppBuildChannel = 'dev' | 'beta' | 'stable';

export function resolveAppBuildChannel(packaged: boolean, version: string): AppBuildChannel {
  if (!packaged) return 'dev';
  return version.includes('-') ? 'beta' : 'stable';
}

export function appIconBaseName(channel: AppBuildChannel): string {
  return channel === 'stable' ? 'set-conjurer' : `set-conjurer-${channel}`;
}
