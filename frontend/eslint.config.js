// eslint.config.js

// This ESLint configuration is designed for a mixed JavaScript and TypeScript project with React.

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  {
    name: 'Global Ignores',
    ignores: ['dist', 'node_modules', 'coverage', 'build', '*.config.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
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
        tsconfigRootDir: resolve(__dirname),
        sourceType: 'module',
        ecmaVersion: 'latest',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error', // Report unused eslint-disable directives
      reportUnusedInlineConfigs: 'error', // Report unused eslint-disable-line directives
    },
    settings: {
      react: {
        version: '19.1.1'
      }
    }
  },
  {
    name: 'All JavaScript and TypeScript with React',
    files: ['**/*.{js,jsx,ts,tsx}'],
    ...reactPlugin.configs.flat.recommended,
    ...reactPlugin.configs.flat['jsx-runtime'], // Add this if you are using React 17+
    ...reactHooks.configs['recommended-latest'],
  },
  {
    name: 'JavaScript',
    files: ['**/*.{js,jsx}'],
    ...tseslint.configs.disableTypeChecked,
    rules: {
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
    },
  },
  {
    name: 'TypeScript',
    files: ['**/*.{ts,tsx}'],
    rules: {
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
    },
  },
];