import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import astro from 'eslint-plugin-astro'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-blue/**',
      '**/dist-green/**',
      '**/.astro/**',
      '**/.next/**',
      'apps/cms/src/migrations/**',
      'packages/shared-types/src/payload-types.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    // Standalone Node scripts (seed scripts, the EventLink sync, deploy
    // tooling) and CJS/config files — not bundled by Astro/Next, so they
    // need Node's globals (process, console, fetch, ...) declared directly
    // rather than inheriting a browser/DOM environment.
    files: ['scripts/**/*.{js,ts}', '**/*.config.{js,cjs,mjs,ts}', 'apps/cms/src/seed/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    rules: {
      // Unused vars are a real, cheap-to-fix signal (dead code, leftover
      // imports) — but underscore-prefixed args are the established
      // pattern in this codebase for intentionally-ignored parameters.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Payload's own config objects rely on `any` in a few structurally
      // unavoidable spots (hook signatures, dynamic field access) — warn
      // rather than block so it stays visible without blocking CI on
      // patterns Payload's own types require.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
