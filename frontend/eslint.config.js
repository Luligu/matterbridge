import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    name: 'Global Ignores',
    ignores: ['dist', 'node_modules', 'coverage', 'build'],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    name: 'All JavaScript and TypeScript with React',
    files: ['**/*.{js,jsx,ts,tsx}'],
    ...reactPlugin.configs.flat.recommended,
    ...reactPlugin.configs.flat['jsx-runtime'], // Add this if you are using React 17+
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
    settings: {
      react: {
        version: '19.1.1'
      }
    }
  },
  {
    name: 'JavaScript',
    files: ['**/*.{js,jsx}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    name: 'TypeScript',
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];