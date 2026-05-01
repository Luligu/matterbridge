// @ts-check
// prettier.config.js 2.0.0

// Config for Prettier

/** @type {import('prettier').Config} */
const prettierConfig = {
  printWidth: 180, // default 80
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true, // default false
  quoteProps: 'consistent', // default 'as-needed'
  jsxSingleQuote: false,
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  requirePragma: false,
  insertPragma: false,
  proseWrap: 'preserve',
  endOfLine: 'lf',
  embeddedLanguageFormatting: 'off', // default 'auto'
  singleAttributePerLine: false,
};

export default prettierConfig;
