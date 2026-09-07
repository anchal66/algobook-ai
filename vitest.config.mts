import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: [
      { find: "server-only", replacement: path.resolve(__dirname, "src/test/server-only-stub.ts") },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "src") + "/$1" },
    ],
  },
});
