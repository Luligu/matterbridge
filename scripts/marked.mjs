/* eslint-disable no-console */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Marked, TextRenderer } from 'marked';

const ROOT_DIR = fileURLToPath(new URL('.', import.meta.url));
const MD_DIR = join(ROOT_DIR, '..');
console.log(`Generating marked HTML files from ${MD_DIR}`);
const DOCS_DIR = join(ROOT_DIR, '..', 'docs');
console.log(`Generating marked HTML files in ${DOCS_DIR}`);
const HEADER_PATH = join(ROOT_DIR, 'markedHeader.html');
const FOOTER_PATH = join(ROOT_DIR, 'markedFooter.html');

const HEADING_FALLBACK_PREFIX = 'heading';

const slugifyHeading = (text) => {
  const normalized = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase();

  return normalized
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const createSlugGenerator = () => {
  const counts = new Map();

  return (rawText) => {
    const base = slugifyHeading(rawText) || HEADING_FALLBACK_PREFIX;
    const usage = counts.get(base) ?? 0;
    counts.set(base, usage + 1);
    return usage > 0 ? `${base}-${usage}` : base;
  };
};

const createMarkdownParser = () => {
  const textRenderer = new TextRenderer();
  const nextSlug = createSlugGenerator();

  return new Marked({
    gfm: true,
    mangle: false,
    renderer: {
      heading(token) {
        const inlineHtml = this.parser.parseInline(token.tokens);
        const plainText = this.parser.parseInline(token.tokens, textRenderer).trim();
        const slug = nextSlug(plainText);
        return `<h${token.depth} id="${slug}">${inlineHtml}</h${token.depth}>\n`;
      },
    },
  });
};

// Replicates marked.ps1 targets for cross-platform doc generation.
const FILES_TO_RENDER = [
  { source: 'README-DEV.md', target: 'README-DEV.html' },
  { source: 'README-DOCKER.md', target: 'README-DOCKER.html' },
  { source: 'README-MACOS-PLIST.md', target: 'README-MACOS-PLIST.html' },
  { source: 'README-NGINX.md', target: 'README-NGINX.html' },
  { source: 'README-PODMAN.md', target: 'README-PODMAN.html' },
  { source: 'README-SERVICE-LOCAL.md', target: 'README-SERVICE-LOCAL.html' },
  { source: 'README-SERVICE-OPT.md', target: 'README-SERVICE-OPT.html' },
  { source: 'README-SERVICE.md', target: 'README-SERVICE.html' },
  { source: 'README.md', target: 'README.html' },
  { source: 'CHANGELOG.md', target: 'CHANGELOG.html' },
  { source: 'reflector/Reflector.md', target: 'reflector/Reflector.html' },
];

/**
 * Render configured markdown documents with the shared header and footer.
 *
 * @param {string} header HTML header template.
 * @param {string} footer HTML footer template.
 * @returns {Promise<void>} Resolves once all files are written.
 */
async function renderMarkdownFiles(header, footer) {
  for (const { source, target } of FILES_TO_RENDER) {
    const markdownPath = join(MD_DIR, source);
    const targetPath = join(DOCS_DIR, target);
    const markdown = await readFile(markdownPath, 'utf8');
    const parser = createMarkdownParser();
    const body = await parser.parse(markdown);

    await writeFile(targetPath, `${header}${body}${footer}`, 'utf8');
    console.log(`Rendered ${source} to ${target}`);
  }
}

/**
 * Apply post-processing replacements to generated HTML files.
 *
 * @param {string[]} htmlFiles HTML files to update.
 * @returns {Promise<void>} Resolves when replacements are applied.
 */
async function applyReplacements(htmlFiles) {
  for (const filePath of htmlFiles) {
    const originalContent = await readFile(filePath, 'utf8');
    let updatedContent = originalContent.replace(/\.md/g, '.html');
    updatedContent = updatedContent.replace(/ΓåÆ/g, '->');
    updatedContent = updatedContent.replace(/Γ£à/g, '&#x2714;');

    if (updatedContent !== originalContent) {
      await writeFile(filePath, updatedContent, 'utf8');
    }
  }
}

/**
 * Build HTML documentation mirroring the original PowerShell workflow.
 *
 * @returns {Promise<void>} Resolves on success.
 */
async function main() {
  const header = await readFile(HEADER_PATH, 'utf8');
  const footer = await readFile(FOOTER_PATH, 'utf8');

  await renderMarkdownFiles(header, footer);

  const htmlFiles = FILES_TO_RENDER.map(({ target }) => join(DOCS_DIR, target));
  await applyReplacements(htmlFiles);
}

main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`Failed to generate marked HTML files: ${message}\n`);
  process.exitCode = 1;
});
