// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jesteslint from 'eslint-plugin-jest';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';

export default [
  {
    name: 'global ignores',
    ignores: ['dist/', 'build/', 'node_modules/', 'coverage/', 'frontend/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  // ...tseslint.configs.strictTypeChecked,
  // ...tseslint.configs.stylisticTypeChecked,
  eslintPluginPrettier,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      /*
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
      */
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
    rules: {
      'no-console': 'warn',
      'no-undef': 'off',
      'spaced-comment': ['error', 'always'],
    },
  },
  {
    name: 'javascript',
    files: ['**/*.js'],
    // ...tseslint.configs.disableTypeChecked,
  },
  {
    name: 'typescript',
    files: ['**/*.ts'],
    ignores: ['**/__test__/*', '**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
  },
  {
    name: 'jest',
    files: ['**/__test__/*', '**/*.test.ts', '**/*.spec.ts'],
    // ...tseslint.configs.disableTypeChecked,
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      jest: jesteslint,
    },
    rules: {
      ...jesteslint.configs['flat/recommended'].rules,
    },
  },
];
