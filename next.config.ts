import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  turbopack: {
    resolveAlias: {
      // monaco-emacs does `require("monaco-editor")`, which resolves to the AMD `min` build; point it at
      // the ESM API so it shares the bundled instance used by the workspace (src/lib/editor/monaco.ts).
      "monaco-editor": "monaco-editor/esm/vs/editor/editor.api.js",
    },
  },
};

export default nextConfig;
