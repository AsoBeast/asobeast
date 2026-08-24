import pluginQuery from "@tanstack/eslint-plugin-query";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...pluginQuery.configs["flat/recommended"],
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "max-lines": [
        "warn",
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "warn",
        { max: 150, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["warn", 15],
      "max-params": ["warn", 4],
    },
  },
  {
    files: ["src/components/ui/**", "e2e/**"],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      complexity: "off",
    },
  },
]);

export default eslintConfig;
