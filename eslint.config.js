// eslint.config.js

// This ESLint configuration is designed for a TypeScript project.

import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginImport from 'eslint-plugin-import';
import pluginN from 'eslint-plugin-n';
import pluginPromise from 'eslint-plugin-promise';
import pluginJsdoc from 'eslint-plugin-jsdoc';
import pluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import pluginJest from 'eslint-plugin-jest';
import pluginVitest from '@vitest/eslint-plugin';

export default defineConfig([
  {
    name: 'Global Ignores',
    ignores: ['dist', 'node_modules', 'coverage', 'build/', 'frontend/', 'frontend/public/', 'frontend/build/'],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  // Comment the previous line and uncomment the following line if you want to use strict with type checking
  // ...tseslint.configs.strictTypeChecked,
  pluginImport.flatConfigs.recommended,
  pluginN.configs['flat/recommended-script'],
  pluginPromise.configs['flat/recommended'],
  pluginJsdoc.configs['flat/recommended'],
  pluginPrettierRecommended, // Prettier plugin must be the last plugin in the list
  {
    name: 'Global Configuration',
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error', // Report unused eslint-disable directives
      reportUnusedInlineConfigs: 'error', // Report unused eslint-disable-line directives
    },
    rules: {
      'no-console': 'warn', // Warn on console usage
      'spaced-comment': ['error', 'always'], // Require space after comment markers
      'no-unused-vars': 'warn', // Use the base rule for unused variables
      'import/order': ['warn', { 'newlines-between': 'always' }],
      'import/no-unresolved': 'off', // Too many false errors with named exports
      'import/named': 'off', // Too many false errors with named exports
      'n/prefer-node-protocol': 'error', // Prefer using 'node:' protocol for built-in modules
      'n/no-extraneous-import': 'off', // Allow imports from node_modules
      'n/no-unpublished-import': 'off', // Allow imports from unpublished packages
      'promise/always-return': 'warn', // Ensure promises always return a value
      'promise/catch-or-return': 'warn', // Ensure promises are either caught or returned
      'promise/no-nesting': 'warn', // Avoid nesting promises
      'jsdoc/tag-lines': ['error', 'any', { startLines: 1, endLines: 0 }], // Require a blank line before JSDoc comments
      'prettier/prettier': 'warn', // Use Prettier for formatting
    },
  },
  {
    name: 'JavaScript Source Files',
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    name: 'TypeScript Source Files',
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts', 'src/**/*.spec.ts'], // Ignore test files
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    rules: {
      // Override/add rules specific to typescript files here
      'no-unused-vars': 'off', // Disable base rule for unused variables in test files
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
      'n/no-process-exit': 'off', // Disallow process.exit() in source files
      'promise/catch-or-return': 'off', // Disable rule for catching or returning promises in source files
      'promise/always-return': 'off', // Disable rule for always returning a value in promises in source files
      'import/order': 'off', // Disable import order rule in test files
      'jsdoc/no-undefined-types': 'off', // Disable JSDoc rule in test files
      'jsdoc/require-jsdoc': 'off', // Disable JSDoc rule in test files
      'jsdoc/require-returns': 'off', // Disable JSDoc rule in test files
      'jsdoc/require-returns-type': 'off', // Disable JSDoc rule in test files
      'jsdoc/require-returns-description': 'off', // Disable JSDoc rule in test files
      'jsdoc/require-param-type': 'off', // Disable JSDoc rule in test files
      'jsdoc/require-param-description': 'off', // Disable JSDoc rule in test files
      'jsdoc/check-tag-names': 'off', // Disable JSDoc rule in test files
    },
  },
  {
    name: 'Jest Test Files',
    files: ['**/*.spec.ts', '**/*.test.ts', 'test/**/*.ts'],
    ignores: ['vitest'], // Ignore Vitest test files
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.jest.json', // Use a separate tsconfig for Jest tests with "isolatedModules": true
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    plugins: {
      jest: pluginJest, // Add Jest plugin for test files
    },
    rules: {
      // Override/add rules specific to test files here
      'no-unused-vars': 'off', // Disable base rule for unused variables in test files
      '@typescript-eslint/no-unused-vars': 'off', // Disable TypeScript rule for unused variables in test files
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' type in test files
      '@typescript-eslint/no-empty-function': 'off', // Allow empty functions in test files

      'import/order': 'off', // Disable import order rule in test files
      'jsdoc/no-undefined-types': 'off', // Disable JSDoc rule in test files
      'jsdoc/require-jsdoc': 'off', // Disable JSDoc rule in test files
      'jsdoc/require-returns': 'off', // Disable JSDoc rule in test files
      'jsdoc/require-returns-type': 'off', // Disable JSDoc rule in test files
      'jsdoc/require-returns-description': 'off', // Disable JSDoc rule in test files
      'jsdoc/require-param-type': 'off', // Disable JSDoc rule in test files
      'jsdoc/require-param-description': 'off', // Disable JSDoc rule in test files
      'jsdoc/check-tag-names': 'off', // Disable JSDoc rule in test files
      // Recommended Jest rules
      ...pluginJest.configs.recommended.rules,
    },
  },
  {
    name: 'Vitest Test Files',
    files: ['vitest/*.spec.ts', 'vitest/*.test.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.jest.json', // Or your shared tsconfig
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    plugins: {
      vitest: pluginVitest,
    },
    rules: {
      // Override/add rules specific to test files here
      'no-unused-vars': 'off', // Disable base rule for unused variables in test files
      '@typescript-eslint/no-unused-vars': 'off', // Disable TypeScript rule for unused variables in test files
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' type in test files
      '@typescript-eslint/no-empty-function': 'off', // Allow empty functions in test files

      // Recommended Vitest rules
      ...pluginVitest.configs.recommended.rules,
    },
  },
]);
