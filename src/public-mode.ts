// GitHub Pages is a public reading surface; local development keeps the editor.
declare const __ATLAS_PUBLIC__: boolean | undefined;
export const publicReadOnly =
  typeof __ATLAS_PUBLIC__ !== "undefined" && __ATLAS_PUBLIC__;
