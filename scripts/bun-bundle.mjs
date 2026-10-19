/**
 * bun-bundle.mjs
 * Version: 2.0.0
 *
 * Bundles the package with `Bun.build` and the type declarations with rollup + rollup-plugin-dts.
 *
 * Every entry of the package.json `exports` map is bundled, not only the package entrypoint:
 * the `bun` condition (the TypeScript source) is the bundler entry, the `types` condition (the
 * tsc emitted declaration) is the rollup entry, and the `import` condition gives the output
 * name, with its leading `dist` directory replaced by `build`. So `./src/module.ts` is bundled
 * into `build/module.js` and `dist/module.d.ts` into `build/module.d.ts`.
 * Wildcard exports are expanded into sorted source files, preserving their matched subpaths.
 *
 * The tsc declarations must exist before the declaration bundle runs, so this script emits them
 * first with `cleanBuildDts`, unless `--no-declaration-build` is passed. `Bun.build` produces the
 * JavaScript, so that build only emits the declarations. The clean variant is used because every
 * build flavour shares the same dist directory, so a stale build of another flavour would
 * otherwise be considered up to date and bundled as is.
 *
 * The packages listed in `bundledPackages` are bundled in, every other bare import (node builtins
 * and external dependencies) stays external in both bundles. That list is the workspace packages
 * plus any dependency named there explicitly.
 *
 * Usage:
 *   bun scripts/bun-bundle.mjs                          Development bundle (sourcemaps, not minified)
 *   bun scripts/bun-bundle.mjs --production             Production bundle (minified, no sourcemaps)
 *   bun scripts/bun-bundle.mjs --watch                  Development bundle, rebuilt on change
 *   bun scripts/bun-bundle.mjs --workspaces             Also bundle every workspace package
 *   bun scripts/bun-bundle.mjs --no-declaration-build   Reuse the existing dist declarations
 *   bun scripts/bun-bundle.mjs --dry-run, -n            List the bundles without building or writing anything
 *   bun scripts/bun-bundle.mjs --version, -v            Show the script version
 *   bun scripts/bun-bundle.mjs --help, -h               Show the help
 *
 * The script runs only when executed directly. Importing it exposes `main` without side effects.
 */

/* oxlint-disable no-console */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, watch as watchDir } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';

const scriptVersion = '2.0.0';

const require = createRequire(import.meta.url);

// The settings of the current run, assigned by main() before any bundling starts.
let root = path.resolve(import.meta.dirname, '..');
let production = false;
/** @type {Set<string>} */
let bundledPackages = new Set();

/**
 * Builds the help text.
 *
 * @returns {string} The usage message.
 */
const usage = () =>
  [
    'Usage: bun scripts/bun-bundle.mjs [--production] [--watch] [--workspaces] [--no-declaration-build] [--dry-run|-n]',
    '',
    '  --production              Production bundle (minified, no sourcemaps)',
    '  --watch                   Rebuild the JavaScript on change',
    '  --workspaces              Also bundle every workspace package',
    '  --no-declaration-build    Reuse the existing dist declarations',
    '  --dry-run, -n             List the bundles without building or writing anything',
    '  --version, -v             Show the script version',
    '  --help, -h                Show this help message',
  ].join('\n');

/**
 * Reports whether an import specifier is a bare package specifier.
 *
 * A bare specifier names a package (`node:fs`, `rollup`, `@matterbridge/utils`)
 * rather than a file, so it is the only kind that can be externalized or bundled by name.
 *
 * @param {string} specifier - The import specifier to test.
 * @returns {boolean} True for a bare specifier, false for a relative or absolute path.
 */
const isBare = (specifier) => !specifier.startsWith('.') && !path.isAbsolute(specifier);

/**
 * Reads the package.json of a package directory.
 *
 * @param {string} dir - The absolute path of the package directory.
 * @returns {Record<string, any>} The parsed package manifest.
 */
const readManifest = (dir) => JSON.parse(readFileSync(path.resolve(dir, 'package.json'), 'utf8'));

/**
 * Splits a bare specifier into its package name and its export subpath.
 *
 * @param {string} specifier - The bare specifier, for example `@matterbridge/test/setupTest`.
 * @returns {{ name: string, subpath: string }} The package name and the `exports` key of the subpath.
 */
const parseSpecifier = (specifier) => {
  const segments = specifier.split('/');
  const scoped = specifier.startsWith('@');
  const name = segments.slice(0, scoped ? 2 : 1).join('/');
  const rest = segments.slice(scoped ? 2 : 1);
  return { name, subpath: rest.length > 0 ? `./${rest.join('/')}` : '.' };
};

/**
 * Resolves the declaration file of a bundled package specifier.
 *
 * rollup has no node resolution of its own, so the `types` condition of the package `exports`
 * map is read here to turn a bare specifier into the absolute path of its .d.ts file. Packages
 * without an `exports` map fall back to the top level `types` or `typings` field.
 *
 * @param {string} specifier - The bare specifier, for example `@matterbridge/test/setupTest`.
 * @returns {string | null} The absolute path of the declaration file, or null when it cannot be resolved.
 */
const resolveBundledDeclaration = (specifier) => {
  const { name, subpath } = parseSpecifier(specifier);

  let manifestPath;
  try {
    manifestPath = require.resolve(`${name}/package.json`, { paths: [root] });
  } catch {
    return null;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const target = manifest.exports?.[subpath];
  const fallback = subpath === '.' ? (manifest.types ?? manifest.typings ?? null) : null;
  const types = typeof target === 'string' ? fallback : (target?.types ?? fallback);
  if (!types) return null;

  const resolved = path.resolve(path.dirname(manifestPath), types);
  return existsSync(resolved) ? resolved : null;
};

/**
 * Collects the bundle entries of a package from its `exports` map.
 *
 * Every export condition set that carries a `bun` source and an `import` output is bundled.
 * Export targets without those conditions (a bare string target, or a conditions object that
 * only points at already built files) are skipped, since there is no source to bundle.
 *
 * @param {string} dir - The absolute path of the package directory.
 * @returns {{ subpath: string, source: string, outfile: string, declaration: string | null, declarationOutfile: string }[]} The entries to bundle.
 */
const getEntries = (dir) => {
  const { exports: map } = readManifest(dir);
  const entries = [];

  for (const [subpath, target] of Object.entries(map ?? {})) {
    if (!target || typeof target === 'string') continue;
    const { bun: source, import: output, types } = target;
    if (!source || !output) continue;

    /** @type {string} */
    const sourcePattern = source;
    const wildcard = sourcePattern.indexOf('*');
    const sources = wildcard === -1 ? [sourcePattern] : [...new Bun.Glob(sourcePattern.replaceAll('*', '**/*')).scanSync({ cwd: dir, onlyFiles: true })].toSorted();

    for (const sourceFile of sources) {
      // A package export star can include nested paths; use the same match in every target.
      const normalizedSource = sourceFile.startsWith('./') ? sourceFile : `./${sourceFile}`;
      const match = wildcard === -1 ? '' : normalizedSource.slice(wildcard, normalizedSource.length - (sourcePattern.length - wildcard - 1));
      const expandedOutput = output.replaceAll('*', match);
      const relative = expandedOutput.replace(/^\.\//, '');
      const outfile = path.resolve(dir, 'build', relative.startsWith('dist/') ? relative.slice('dist/'.length) : path.basename(relative));

      entries.push({
        subpath: subpath.replaceAll('*', match),
        source: path.resolve(dir, sourceFile),
        outfile,
        declaration: types ? path.resolve(dir, types.replaceAll('*', match)) : null,
        declarationOutfile: outfile.replace(/\.js$/, '.d.ts'),
      });
    }
  }

  return entries;
};

/**
 * Collects workspace package directories in declaration order, expanding glob patterns and removing duplicates.
 *
 * @returns {string[]} The absolute paths of the workspace package directories.
 */
const getWorkspaceDirs = () => {
  const { workspaces: patterns = [] } = readManifest(root);
  /** @type {Set<string>} */
  const dirs = new Set();
  for (const pattern of Array.isArray(patterns) ? patterns : (patterns.packages ?? [])) {
    for (const match of new Bun.Glob(pattern).scanSync({ cwd: root, onlyFiles: false })) {
      const dir = path.resolve(root, match);
      if (existsSync(path.resolve(dir, 'package.json'))) dirs.add(dir);
    }
  }
  return [...dirs];
};

/**
 * Reports whether a bare specifier belongs to a package that is bundled into the output.
 *
 * @param {string} specifier - The bare specifier to test.
 * @returns {boolean} True when the package is bundled, false when it stays external.
 */
const isBundled = (specifier) => bundledPackages.has(parseSpecifier(specifier).name);

/**
 * Cleans and builds the tsc declarations the declaration bundles are assembled from.
 *
 * The root build references the workspace projects, so a single run emits the declarations of
 * every package.
 *
 * @returns {void}
 */
const buildDeclarations = () => {
  const script = 'cleanBuildDts';
  console.log(`Cleaning and building the declarations with "bun run ${script}"...`);
  const result = spawnSync('bun', ['run', script], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    throw new Error(`"bun run ${script}" failed with exit code ${result.status ?? 'unknown'}.`);
  }
};

/**
 * Bundles the source of a single export entry with `Bun.build`.
 *
 * `Bun.build` writes into a directory, so `naming` pins the file name of the single entrypoint
 * to the name the `exports` map declares.
 *
 * @param {{ source: string, outfile: string }} entry - The entry to bundle.
 * @returns {Promise<void>} Resolves when the bundle has been written.
 */
const bundleJavaScript = async (entry) => {
  const result = await Bun.build({
    entrypoints: [entry.source],
    outdir: path.dirname(entry.outfile),
    naming: path.basename(entry.outfile),
    // The bun target resolves the `bun` export condition, so the workspace packages are bundled
    // straight from their TypeScript sources, and the output carries the `// @bun` pragma.
    target: 'bun',
    format: 'esm',
    sourcemap: production ? 'none' : 'linked',
    minify: production,
    // Report the failure below with the entry name instead of the generic "Bundle failed" error.
    throw: false,
    plugins: [
      {
        name: 'externalize-unbundled-packages',
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            // Returning null defers to the default resolution, which bundles the module.
            if (!isBare(args.path) || isBundled(args.path)) return null;
            return { path: args.path, external: true };
          });
        },
      },
    ],
  });

  if (!result.success) {
    throw new AggregateError(result.logs, `Failed to bundle ${path.relative(root, entry.source)}.`);
  }

  const bytes = result.outputs.reduce((total, output) => total + output.size, 0);
  console.log(`  ${path.relative(root, entry.outfile)} (${(bytes / 1024).toFixed(1)} kb)`);
};

/**
 * Bundles the tsc declarations of a single export entry with rollup and rollup-plugin-dts.
 *
 * @param {{ subpath: string, declaration: string | null, declarationOutfile: string }} entry - The entry to bundle.
 * @returns {Promise<void>} Resolves when the declaration bundle has been written.
 */
const bundleDeclarations = async (entry) => {
  if (!entry.declaration) return;
  if (!existsSync(entry.declaration)) {
    throw new Error(`Declaration entry not found: ${entry.declaration}. Run the build without --no-declaration-build.`);
  }

  const bundle = await rollup({
    input: entry.declaration,
    external: (specifier) => isBare(specifier) && !isBundled(specifier),
    plugins: [
      {
        name: 'resolve-bundled-declarations',
        resolveId(specifier) {
          if (!isBare(specifier) || !isBundled(specifier)) return null;
          return resolveBundledDeclaration(specifier);
        },
      },
      dts({ respectExternal: true }),
    ],
    onwarn(warning, warn) {
      // The declarations are emitted by tsc, circular type references between them are expected.
      if (warning.code === 'CIRCULAR_DEPENDENCY') return;
      warn(warning);
    },
  });

  await bundle.write({ file: entry.declarationOutfile, format: 'es' });
  await bundle.close();
};

/**
 * Bundles every export entry of a package into its build directory.
 *
 * @param {string} dir - The absolute path of the package directory.
 * @param {boolean} [declarations] - Whether to bundle the declarations as well. Defaults to true.
 * @returns {Promise<void>} Resolves when every entry of the package has been bundled.
 */
const bundlePackage = async (dir, declarations = true) => {
  const entries = getEntries(dir);
  if (entries.length === 0) {
    const name = path.relative(root, dir);
    console.warn(`No bundleable exports found in ${name === '' ? '.' : name}, skipping.`);
    return;
  }

  rmSync(path.resolve(dir, 'build'), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

  for (const entry of entries) {
    await bundleJavaScript(entry);
    if (declarations) await bundleDeclarations(entry);
  }
};

/**
 * Rebuilds a package whenever one of its sources changes.
 *
 * `Bun.build` has no watch mode of its own, so the src directory is watched here. The rebuild is
 * debounced because an editor save raises several events for a single write, and it skips the
 * declarations, which would need a full tsc build on every keystroke.
 *
 * @param {string} dir - The absolute path of the package directory.
 * @returns {void}
 */
const watchPackage = (dir) => {
  const srcDir = path.resolve(dir, 'src');
  if (!existsSync(srcDir)) return;

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  watchDir(srcDir, { recursive: true }, () => {
    clearTimeout(timer);
    // oxlint-disable-next-line typescript/no-misused-promises -- The async rebuild handles its errors internally.
    timer = setTimeout(async () => {
      try {
        await bundlePackage(dir, false);
      } catch (error) {
        console.error(error);
      }
    }, 100);
  });
};

/**
 * Bundles the package, and with `--workspaces` every workspace package.
 *
 * @param {string[]} [args] - Command line arguments, without the runtime and script paths.
 * @param {string} [rootDir] - The absolute path of the root package directory.
 * @returns {Promise<number>} The exit code.
 */
export const main = async (args = process.argv.slice(2), rootDir = path.resolve(import.meta.dirname, '..')) => {
  if (args.includes('--version') || args.includes('-v')) {
    console.log(scriptVersion);
    return 0;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return 0;
  }

  root = rootDir;
  production = args.includes('--production');
  // The packages inlined into the output instead of resolved at runtime by the consumer. The
  // workspace packages are always bundled; every other name listed here is bundled as well, so its
  // consumers do not have to install it. Everything not listed stays an external import.
  bundledPackages = new Set([...getWorkspaceDirs().map((dir) => readManifest(dir).name), 'node-ansi-logger']);

  const dirs = [root, ...(args.includes('--workspaces') ? getWorkspaceDirs() : [])];

  if (args.includes('--dry-run') || args.includes('-n')) {
    for (const dir of dirs) {
      for (const entry of getEntries(dir)) {
        console.log(`[dry-run] Would bundle ${path.relative(root, entry.source)} -> ${path.relative(root, entry.outfile)}`);
      }
    }
    return 0;
  }

  if (!args.includes('--no-declaration-build')) buildDeclarations();

  for (const dir of dirs) {
    await bundlePackage(dir);
  }

  console.log(`Bundled the ${production ? 'production' : 'development'} exports.`);

  if (args.includes('--watch')) {
    for (const dir of dirs) {
      watchPackage(dir);
    }
    console.log('Watching for changes...');
  }
  return 0;
};

if (import.meta.main) process.exitCode = await main();
