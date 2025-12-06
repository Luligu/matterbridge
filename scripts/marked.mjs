/* eslint-disable no-console */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { marked } from 'marked';

const ROOT_DIR = fileURLToPath(new URL('.', import.meta.url));
const MD_DIR = join(ROOT_DIR, '..');
console.log(`Generating marked HTML files from ${MD_DIR}`);
const DOCS_DIR = join(ROOT_DIR, '..', 'docs');
console.log(`Generating marked HTML files in ${DOCS_DIR}`);
const HEADER_PATH = join(ROOT_DIR, 'markedHeader.html');
const FOOTER_PATH = join(ROOT_DIR, 'markedFooter.html');

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
    const body = await marked.parse(markdown);

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
