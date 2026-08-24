// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      'max-lines': [
        'warn',
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
      'max-lines-per-function': [
        'warn',
        { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      complexity: ['warn', 15],
      'max-depth': ['warn', 4],
      'max-params': ['warn', 4],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: [
      'src/**/*.spec.ts',
      'src/auth/auth.service.ts',
      'src/auth/platform-operator.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/common/tenancy/default-workspace'],
              message:
                'DEFAULT_WORKSPACE_ID belongs to bootstrap. Scope work with WorkspaceContext, or cross workspaces through CrossTenantAccess.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: { 'max-lines': 'off', 'max-lines-per-function': 'off' },
  },
  {
    files: ['src/store-providers/*.provider.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
