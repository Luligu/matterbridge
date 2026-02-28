// eslint.config.js

// This ESLint configuration is designed for a TypeScript project.

import { existsSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import vitest from '@vitest/eslint-plugin';
import { defineConfig } from 'eslint/config';
import jest from 'eslint-plugin-jest';
import jsdoc from 'eslint-plugin-jsdoc';
import n from 'eslint-plugin-n';
import prettier from 'eslint-plugin-prettier/recommended';
import promise from 'eslint-plugin-promise';
import pluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

const sourceFiles = ['**/*.{js,mjs,cjs,ts,mts,cts}'];
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default defineConfig([
  {
    name: 'Global Ignores',
    // This works faster in eslint 10.x and is recursive by default, so we don't need to specify '**/' in the patterns
    ignores: ['**/.cache', '**/build', '**/coverage', '**/dist', '**/jest', '**/node_modules', '**/screenshots', '**/temp', '**/vendor', '**/vite.config.ts'],
  },
  // Comment out this line if you want to enable strict type-checked rules, but be aware that it may cause many errors until you fix all type issues in your codebase
  ...tseslint.configs.strict.map((c) => ({ ...c, files: sourceFiles })),
  // Uncomment this line to enable strict type-checked rules, but be aware that it may cause many errors until you fix all type issues in your codebase
  // ...tseslint.configs.strictTypeChecked.map((c) => ({ ...c, files: sourceFiles })),
  { ...n.configs['flat/recommended-script'], files: sourceFiles },
  { ...promise.configs['flat/recommended'], files: sourceFiles },
  { ...jsdoc.configs['flat/recommended'], files: sourceFiles },
  prettier, // Prettier plugin must be the last plugin in the list and is intentionally not spread with a files property cause it can be used in all file types, not just source files
  {
    name: 'JavaScript & TypeScript Source Files',
    files: sourceFiles,
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error', // Report unused eslint-disable directives
      reportUnusedInlineConfigs: 'error', // Report unused eslint-disable-line directives
    },
    plugins: {
      js,
      n,
      promise,
      jsdoc,
      'simple-import-sort': pluginSimpleImportSort,
    },
    extends: ['js/recommended'],
    rules: {
      'no-console': 'warn', // Warn on console usage
      'spaced-comment': ['error', 'always'], // Require space after comment markers. Deprecated, but we still want to enforce it cause it's not handled by Prettier
      'no-unused-vars': 'warn', // Use the base rule for unused variables
      'simple-import-sort/imports': ['warn'],
      'simple-import-sort/exports': ['warn'],
      'n/prefer-node-protocol': 'error', // Prefer using 'node:' protocol for built-in modules
      'n/no-unsupported-features/node-builtins': ['error', { ignores: ['fetch'] }],
      'n/no-extraneous-import': 'off', // Allow imports from node_modules
      'n/no-unpublished-import': 'off', // Allow imports from unpublished packages
      'promise/always-return': 'warn', // Ensure promises always return a value
      'promise/catch-or-return': 'warn', // Ensure promises are either caught or returned
      'promise/no-nesting': 'warn', // Avoid nesting promises
      'jsdoc/tag-lines': ['error', 'any', { startLines: 1, endLines: 0 }], // Require a blank line before JSDoc comments
      'jsdoc/check-tag-names': ['warn', { definedTags: ['created', 'contributor', 'remarks'] }], // Allow custom tags
      'jsdoc/no-undefined-types': 'off',
      'prettier/prettier': 'warn', // Use Prettier for formatting
    },
  },
  {
    name: 'JavaScript Source Files',
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    name: 'TypeScript Source Files',
    files: ['**/src/**/*.{ts,mts,cts}'],
    ignores: ['**/src/**/*.test.{ts,mts,cts}', '**/src/**/*.spec.{ts,mts,cts}'], // Ignore test files
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: existsSync(path.join(__dirname, 'tsconfig.eslint.json')) ? './tsconfig.eslint.json' : './tsconfig.json', // Use a separate tsconfig for ESLint if it exists, otherwise fall back to the main tsconfig
      },
    },
    rules: {
      'no-redeclare': 'off', // Disable no-redeclare for TypeScript files since TypeScript already checks for redeclarations
      'no-undef': 'off', // Disable no-undef for TypeScript files since TypeScript already checks for undefined variables
      'no-unused-vars': 'off', // Disable base rule for unused variables and use the TypeScript-specific rule instead
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
      // Eventually we want to enable these rules, but they may cause many errors
      // '@typescript-eslint/no-floating-promises': 'error',
      // '@typescript-eslint/no-misused-promises': 'error',
      // '@typescript-eslint/require-await': 'warn',
    },
  },
  {
    name: 'Jest Test Files',
    files: ['**/*.spec.ts', '**/*.test.ts', '**/__test__/**/*.ts'],
    ignores: ['**/vitest'], // Ignore Vitest test files
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: './tsconfig.jest.json', // Use a separate tsconfig for Jest tests with "isolatedModules": true
      },
    },
    plugins: { jest },
    rules: {
      'no-undef': 'off', // Disable no-undef for TypeScript files since TypeScript already checks for undefined variables
      'no-unused-vars': 'off', // Disable base rule for unused variables and use the TypeScript-specific rule instead
      '@typescript-eslint/no-unused-vars': 'off', // Disable TypeScript rule for unused variables in test files
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' type in test files
      '@typescript-eslint/no-empty-function': 'off', // Allow empty functions in test files
      'jsdoc/require-jsdoc': 'off', // Disable JSDoc rule in test files

      // Recommended Jest rules
      ...jest.configs.recommended.rules,
    },
  },
  {
    name: 'Vitest Test Files',
    files: ['**/vitest/**/*.spec.ts', '**/vitest/**/*.test.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: './tsconfig.vitest.json', // Use a separate tsconfig for Vitest tests
      },
    },
    plugins: { vitest },
    rules: {
      'no-undef': 'off', // Disable no-undef for TypeScript files since TypeScript already checks for undefined variables
      'no-unused-vars': 'off', // Disable base rule for unused variables and use the TypeScript-specific rule instead
      '@typescript-eslint/no-unused-vars': 'off', // Disable TypeScript rule for unused variables in test files
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' type in test files
      '@typescript-eslint/no-empty-function': 'off', // Allow empty functions in test files
      'jsdoc/require-jsdoc': 'off', // Disable JSDoc rule in test files

      // Recommended Vitest rules
      ...vitest.configs.recommended.rules,
    },
  },
  {
    name: 'JSON Files',
    files: ['**/*.json'],
    ignores: ['**/devcontainer.json'], // Ignore devcontainer.json files
    plugins: { json },
    language: 'json/json',
    rules: {
      'json/no-duplicate-keys': 'error',
    },
  },
  {
    name: 'JSONC files',
    files: ['**/devcontainer.json', '**/*.jsonc'],
    plugins: { json },
    language: 'json/jsonc',
  },
  {
    name: 'Markdown Files',
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/commonmark',
    rules: {
      'markdown/no-html': 'off', // Allow HTML in Markdown files
    },
  },
]);
