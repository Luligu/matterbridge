// @ts-check
// eslint.config.js 2.0.0

// This ESLint configuration is designed for a TypeScript project using ESM modules.

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
import prettier from 'eslint-plugin-prettier';
import importsort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

const sourceFiles = ['**/*.{js,mjs,cjs,ts,mts,cts}'];
const typescriptFiles = ['**/src/**/*.{ts,mts,cts}', '**/vitest/**/*.spec.{ts,mts,cts}', '**/vitest/**/*.test.{ts,mts,cts}'];
const jestTestFiles = ['**/*.spec.{ts,mts,cts}', '**/*.test.{ts,mts,cts}', '**/__test__/**/*.{ts,mts,cts}'];
const vitestTestFiles = ['**/vitest/**/*.spec.{ts,mts,cts}', '**/vitest/**/*.test.{ts,mts,cts}'];
const configDirname = path.dirname(url.fileURLToPath(import.meta.url));

export default defineConfig([
  {
    name: 'Global Ignores',
    ignores: ['**/.cache', '**/build', '**/coverage', '**/dist', '**/jest', '**/node_modules', '**/screenshots', '**/temp', '**/vendor', '**/apps', '**/chip'],
  },
  {
    name: 'JavaScript & TypeScript Source Files',
    files: sourceFiles,
    plugins: {
      js,
      n,
      jsdoc,
      'simple-import-sort': importsort,
      prettier,
    },
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error', // Report unused eslint-disable directives
      reportUnusedInlineConfigs: 'error', // Report unused eslint-disable-line directives
    },
    extends: [js.configs.recommended, n.configs['flat/recommended-module'], jsdoc.configs['flat/recommended']],
    rules: {
      'no-console': 'warn', // Warn on console usage
      'spaced-comment': ['error', 'always'], // Require space after comment markers. Deprecated, but we still want to enforce it cause it's not handled by Prettier
      'no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_', // Ignore unused variables starting with _
          argsIgnorePattern: '^_', // Ignore unused arguments starting with _
          caughtErrorsIgnorePattern: '^_', // Ignore unused caught errors starting with _
        },
      ],
      'require-await': 'off', // Allow async functions that don't use await
      'n/prefer-node-protocol': 'error', // Prefer using 'node:' protocol for built-in modules
      'n/no-unsupported-features/node-builtins': ['error', { ignores: ['fetch'] }],
      'n/no-extraneous-import': 'off', // Allow imports from node_modules
      'n/no-unpublished-import': 'off', // Allow imports from unpublished packages
      'jsdoc/tag-lines': ['error', 'any', { startLines: 1, endLines: 0 }], // Require a blank line before JSDoc comments
      'jsdoc/check-tag-names': ['warn', { definedTags: ['created', 'contributor', 'remarks'] }], // Allow custom tags
      'jsdoc/no-undefined-types': 'off',
      'simple-import-sort/imports': ['warn'],
      'simple-import-sort/exports': ['warn'],
      'prettier/prettier': 'warn', // Use Prettier for formatting
    },
  },
  {
    name: 'TypeScript Source Files',
    files: typescriptFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        tsconfigRootDir: configDirname,
        project: existsSync(path.join(configDirname, 'tsconfig.eslint.json')) ? './tsconfig.eslint.json' : './tsconfig.json', // Use a separate tsconfig for ESLint if it exists, otherwise fall back to the main tsconfig
      },
    },
    // Comment out this line if you want to enable strict type-checked rules, but be aware that it may cause many errors until you fix all type issues in your codebase
    extends: [...tseslint.configs.strict],
    // Uncomment this line to enable strict type-checked rules, but be aware that it may cause many errors until you fix all type issues in your codebase
    // extends: [...tseslint.configs.strictTypeChecked],
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
      // '@typescript-eslint/no-floating-promises': 'error', // Require unhandled promises to be explicitly voided or awaited
      // '@typescript-eslint/no-misused-promises': 'error', // Disallow promises in non-async callbacks or boolean conditions
      // '@typescript-eslint/await-thenable': 'error', // Disallow awaiting non-Promise values
      // '@typescript-eslint/return-await': ['error', 'in-try-catch'], // Require return await inside try-catch so rejections are caught locally
      // '@typescript-eslint/only-throw-error': 'error', // Require only Error objects to be thrown or rejected
      // '@typescript-eslint/promise-function-async': 'warn', // Require Promise-returning functions to be async
      // '@typescript-eslint/require-await': 'warn', // Disallow async functions without any await expression
    },
  },
  {
    name: 'Jest Test Files',
    files: jestTestFiles,
    ignores: vitestTestFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        tsconfigRootDir: configDirname,
        project: './tsconfig.jest.json', // Use a separate tsconfig for Jest tests with "isolatedModules": true
      },
    },
    extends: [jest.configs['flat/recommended']],
    rules: {
      'no-undef': 'off', // Disable no-undef for TypeScript files since TypeScript already checks for undefined variables
      'no-unused-vars': 'off', // Disable base rule for unused variables and use the TypeScript-specific rule instead
      '@typescript-eslint/no-unused-vars': 'off', // Disable TypeScript rule for unused variables in test files
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' type in test files
      '@typescript-eslint/no-empty-function': 'off', // Allow empty functions in test files
      '@typescript-eslint/no-floating-promises': 'off', // Require unhandled promises to be explicitly voided or awaited
      '@typescript-eslint/no-misused-promises': 'off', // Disallow promises in non-async callbacks or boolean conditions
      '@typescript-eslint/await-thenable': 'off', // Disallow awaiting non-Promise values
      '@typescript-eslint/return-await': 'off', // Require return await inside try-catch so rejections are caught locally
      '@typescript-eslint/only-throw-error': 'off', // Require only Error objects to be thrown or rejected
      '@typescript-eslint/promise-function-async': 'off', // Require Promise-returning functions to be async
      '@typescript-eslint/require-await': 'off', // Disallow async functions without any await expression
      'jsdoc/require-jsdoc': 'off', // Disable JSDoc rule in test files
    },
  },
  {
    name: 'Vitest Test Files',
    files: vitestTestFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        tsconfigRootDir: configDirname,
        project: './tsconfig.vitest.json', // Use a separate tsconfig for Vitest tests
      },
    },
    extends: [vitest.configs.recommended],
    rules: {
      'no-undef': 'off', // Disable no-undef for TypeScript files since TypeScript already checks for undefined variables
      'no-unused-vars': 'off', // Disable base rule for unused variables and use the TypeScript-specific rule instead
      '@typescript-eslint/no-unused-vars': 'off', // Disable TypeScript rule for unused variables in test files
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' type in test files
      '@typescript-eslint/no-empty-function': 'off', // Allow empty functions in test files
      '@typescript-eslint/no-floating-promises': 'off', // Require unhandled promises to be explicitly voided or awaited
      '@typescript-eslint/no-misused-promises': 'off', // Disallow promises in non-async callbacks or boolean conditions
      '@typescript-eslint/await-thenable': 'off', // Disallow awaiting non-Promise values
      '@typescript-eslint/return-await': 'off', // Require return await inside try-catch so rejections are caught locally
      '@typescript-eslint/only-throw-error': 'off', // Require only Error objects to be thrown or rejected
      '@typescript-eslint/promise-function-async': 'off', // Require Promise-returning functions to be async
      '@typescript-eslint/require-await': 'off', // Disallow async functions without any await expression
      'jsdoc/require-jsdoc': 'off', // Disable JSDoc rule in test files
    },
  },
  {
    name: 'JSON Files',
    files: ['**/*.json'],
    ignores: ['**/devcontainer.json', '**/package-lock.json'], // Ignore devcontainer.json and package-lock.json files
    plugins: { json, prettier },
    language: 'json/json',
    extends: ['json/recommended'],
    rules: {
      'json/no-unsafe-values': 'off',
      'prettier/prettier': 'warn', // Use Prettier for formatting
    },
  },
  {
    name: 'JSONC files',
    files: ['**/devcontainer.json', '**/*.jsonc'],
    plugins: { json, prettier },
    language: 'json/jsonc',
    extends: ['json/recommended'],
    rules: {
      'json/no-unsafe-values': 'off',
      'prettier/prettier': 'warn', // Use Prettier for formatting
    },
  },
  {
    name: 'Markdown Files',
    files: ['**/*.md'],
    plugins: { markdown, prettier },
    extends: ['markdown/recommended'],
    rules: {
      'prettier/prettier': 'warn', // Use Prettier for formatting
    },
  },
]);
