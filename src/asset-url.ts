/** Public resources work at the origin root and at a static-hosting subpath. */
declare const __RHINE_MODELS__: Record<string, string>;
export const assetUrl = (path: string) => {
  const key = path.replace(/^\//, "");
  const env = (import.meta as { env?: { PROD?: boolean; BASE_URL?: string } }).env;
  const versioned =
    env?.PROD && typeof __RHINE_MODELS__ !== "undefined"
      ? (__RHINE_MODELS__[key] ?? key)
      : key;
  return `${env?.BASE_URL ?? "/"}${versioned}`;
};
