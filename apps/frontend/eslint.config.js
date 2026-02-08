// eslint.config.js

// This ESLint configuration is designed for a mixed JavaScript and TypeScript project with React.
// @ts-check

import url from 'node:url';
import path from 'node:path';

import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('eslint').Linter.Config[]} */
export default defineConfig([
  {
    name: 'Global Ignores',
    ignores: ['dist', 'node_modules', 'coverage', 'build'],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  // Spread strict type-aware configs directly
  // ...tseslint.configs.strictTypeChecked.map((config) => ({
  //   ...config,
  //   files: ['src/**/*.{ts,tsx}'],
  // })),
  // Prettier config disables formatting-related rules from ESLint
  prettierConfig,
  {
    name: 'Global Configuration Options',
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error', // Report unused eslint-disable directives
      reportUnusedInlineConfigs: 'error', // Report unused eslint-disable-line directives
    },
    settings: { react: { version: 'detect' } },
  },
  {
    // All JavaScript and TypeScript with React
    name: 'React',
    files: ['**/*.{js,jsx,ts,tsx}'],
    ...reactPlugin.configs.flat.recommended,
    ...reactPlugin.configs.flat['jsx-runtime'], // Add this if you are using React 17+
    ...reactHooks.configs['recommended-latest'],
    plugins: {
      react: reactPlugin,
      prettier: prettierPlugin,
      // eslint-plugin-react-hooks exports `configs.flat.*` which doesn't currently match ESLint's `Plugin` type.
      // Runtime is fine; this cast only quiets VS Code's @ts-check diagnostics.
      'react-hooks': /** @type {import('eslint').ESLint.Plugin} */ (reactHooks),
    },
    rules: {
      'prettier/prettier': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    name: 'JavaScript',
    files: ['**/*.{js,jsx}'],
    ...tseslint.configs.disableTypeChecked, // It includes its own language options, plugins and rules, designed to disable type-aware linting for the files it matches.
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off', // Disable base rule for unused variables
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_', // Ignore unused variables starting with _
          argsIgnorePattern: '^_', // Ignore unused arguments starting with _
          caughtErrorsIgnorePattern: '^_', // Ignore unused caught errors starting with _
        },
      ],
      'prettier/prettier': 'warn',
    },
  },
  {
    name: 'TypeScript',
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off', // Disable base rule for unused variables
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_', // Ignore unused variables starting with _
          argsIgnorePattern: '^_', // Ignore unused arguments starting with _
          caughtErrorsIgnorePattern: '^_', // Ignore unused caught errors starting with _
        },
      ],
      'prettier/prettier': 'warn',
    },
  },
]);
