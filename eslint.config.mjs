import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

export default [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "node_modules/**", "backups/**", "out/**", ".claude/**", "**/.next/**", "**/node_modules/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // react-hooks v7 (React Compiler) heuristics flag the common "fetch in effect" pattern in the legacy
      // v1 pages that Modules 03/05 replace. Keep them visible as warnings; new code should avoid the pattern.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];
