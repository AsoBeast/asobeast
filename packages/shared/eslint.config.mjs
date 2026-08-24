import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "max-lines": [
        "warn",
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["warn", 15],
      "max-params": ["warn", 4],
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: { "max-lines": "off" },
  },
);
