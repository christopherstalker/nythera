import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      "@next/next/no-img-element": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off"
    }
  },
  globalIgnores([
    ".next/**",
    "dist/**",
    "node_modules/**",
    "output/**",
    ".codex-artifacts/**",
    ".codex-remote-attachments/**",
    ".codex-tmp/**",
    ".playwright-cli/**",
    "next-env.d.ts"
  ])
]);
