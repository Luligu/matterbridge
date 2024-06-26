// @ts-check
/*

prettier.config.js

Prettier:

How to install:
  npm install --save-dev prettier eslint-config-prettier eslint-plugin-prettier

  
Add package.json scripts:  
*/
// "format": "prettier --write \"src/**/*.{js,jsx,ts,tsx,json,css,md}\"",
// "format:check": "prettier --check \"src/**/*.{js,jsx,ts,tsx,json,css,md}\"",

/* 

Add .prettierignore  

# Ignore artifacts:
dist
node_modules
build
coverage

# Ignore all HTML files:
*/
// **/*.html

export default {
  printWidth: 250, // default 80
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true, // default false
  quoteProps: 'preserve', // default 'as-needed'
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
