/**
 * scan-deps.mjs
 * Version: 1.1.0
 *
 * Dependency-free scanner that checks declared/referenced dependency hygiene
 * for the `@matter/*` and `@matterbridge/*` imports across the monorepo.
 *
 * For every unit (the root `matterbridge` package and each workspace package) it:
 *   1) Collects every `@matter/*` and `@matterbridge/*` import, split into
 *      production sources (`src/`) and tests (`vitest/`, `test/`, `buntest/`).
 *   2) Flags `src` imports that are not declared in package.json `dependencies`.
 *   3) Flags `src` imports of workspace packages (`@matterbridge/*`) that are
 *      missing a TypeScript project reference in `tsconfig.build.json` and
 *      `tsconfig.build.production.json`.
 *   4) Flags test imports that are not declared in `dependencies` or
 *      `devDependencies` (tests compile via the no-emit per-package
 *      `tsconfig.json`, so they need no project reference).
 *   5) For workspace packages, flags declared `@matter/*` and
 *      `@matterbridge/*` dependencies that are not imported by production
 *      sources or tests. The root aggregate package is excluded because its
 *      exports and build entrypoints intentionally span workspace packages.
 *
 * matter.js is a single lockstep-versioned monorepo: `@matter/main` depends on
 * `@matter/{general,model,node,protocol,types}` and pulls `@matter/nodejs` as an
 * optionalDependency, and each of those in turn depends on the lower layers.
 * Declaring one `@matter/*` package therefore legitimately provides its whole
 * dependency closure. The scanner reads that closure from node_modules and
 * treats a `@matter/*` import as satisfied (with an informational note) when it
 * is reachable from a declared `@matter/*` package, so it does not flag the
 * intended high-level usage (e.g. depending on `@matter/main` and importing
 * `@matter/node`).
 *
 * Exit code is 0 when every unit is compliant, 1 otherwise. Compliant units are
 * printed in green, issues in red, and transitively-satisfied notes in dark
 * grey; colors are disabled when stdout is not a TTY or `NO_COLOR` is set.
 *
 * Usage:
 *   node scripts/scan-deps.mjs
 */

/* eslint-disable no-console */
/* eslint-disable jsdoc/require-jsdoc */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ROOT_PACKAGE_JSON = join(ROOT, 'package.json');

// ANSI colors: green for compliant, red for issues, dark grey for transitively
// satisfied notes. Disabled when output is not a TTY or NO_COLOR is set.
const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const green = (s) => (COLOR ? `\x1b[32m${s}\x1b[0m` : s);
const red = (s) => (COLOR ? `\x1b[31m${s}\x1b[0m` : s);
const grey = (s) => (COLOR ? `\x1b[90m${s}\x1b[0m` : s);

// Directories never worth descending into while collecting source files.
const SKIP = new Set(['node_modules', 'dist', 'build', '.cache', 'coverage', '.git', 'mock']);

// Matches `import ... from '...'`, `export ... from '...'`, dynamic `import('...')`
// and bare `import '...'` statements, capturing the module specifier.
const IMPORT_RE = /(?:import|export)\b[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;

// Builds the list of units to scan: the root package plus every workspace.
function buildUnits() {
  const rootPackage = JSON.parse(readFileSync(ROOT_PACKAGE_JSON, 'utf8'));
  const workspacePaths = Array.isArray(rootPackage.workspaces) ? rootPackage.workspaces : rootPackage.workspaces?.packages || [];
  const units = [
    {
      id: 'root (matterbridge)',
      dirName: null,
      packageName: rootPackage.name,
      srcDirs: [
        { d: join(ROOT, 'src'), kind: 'src' },
        { d: join(ROOT, 'vitest'), kind: 'test' },
        { d: join(ROOT, 'test'), kind: 'test' },
        { d: join(ROOT, 'buntest'), kind: 'test' },
      ],
      pkgJson: ROOT_PACKAGE_JSON,
      tsBuild: join(ROOT, 'tsconfig.build.json'),
      tsProd: join(ROOT, 'tsconfig.build.production.json'),
    },
  ];
  for (const workspacePath of workspacePaths) {
    const dir = join(ROOT, workspacePath);
    const pkgJson = join(dir, 'package.json');
    if (!existsSync(pkgJson)) throw new Error(`Workspace package.json not found: ${workspacePath}`);
    const pkg = JSON.parse(readFileSync(pkgJson, 'utf8'));
    const dirName = workspacePath.split(/[\\/]/).at(-1);
    units.push({
      id: dirName,
      dirName,
      packageName: pkg.name,
      srcDirs: [
        { d: join(dir, 'src'), kind: 'src' },
        { d: join(dir, 'vitest'), kind: 'test' },
        { d: join(dir, 'test'), kind: 'test' },
        { d: join(dir, 'buntest'), kind: 'test' },
      ],
      pkgJson,
      tsBuild: join(dir, 'tsconfig.build.json'),
      tsProd: join(dir, 'tsconfig.build.production.json'),
    });
  }
  return units;
}

// Recursively collects every `.ts` file (excluding declaration files) under `d`.
function walk(d, acc = []) {
  if (!existsSync(d)) return acc;
  for (const e of readdirSync(d)) {
    if (SKIP.has(e)) continue;
    const f = join(d, e);
    let st;
    try {
      st = statSync(f);
    } catch {
      continue; // Ignore broken or cyclic symlinks.
    }
    if (st.isDirectory()) walk(f, acc);
    else if (/\.ts$/.test(e) && !/\.d\.ts$/.test(e)) acc.push(f);
  }
  return acc;
}

// Reduces a module specifier to its base package name (`@scope/name/sub` -> `@scope/name`).
function basePkg(spec) {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

// Returns a map of base package name -> set of files importing it, restricted to
// `@matter/*` and `@matterbridge/*` specifiers.
function collectImports(files) {
  const map = new Map();
  for (const f of files) {
    const txt = readFileSync(f, 'utf8');
    IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = IMPORT_RE.exec(txt))) {
      const spec = m[1] || m[2] || m[3];
      if (!spec) continue;
      if (spec.startsWith('@matter/') || spec.startsWith('@matterbridge/')) {
        const b = basePkg(spec);
        if (!map.has(b)) map.set(b, new Set());
        map.get(b).add(f);
      }
    }
  }
  return map;
}

// Reads the `dependencies` + `optionalDependencies` of an installed package
// from the root node_modules. Returns null when the package is not installed.
const matterDepsCache = new Map();
function installedMatterDeps(name) {
  if (matterDepsCache.has(name)) return matterDepsCache.get(name);
  const p = join(ROOT, 'node_modules', name, 'package.json');
  let result = null;
  if (existsSync(p)) {
    const d = JSON.parse(readFileSync(p, 'utf8'));
    result = Object.keys({ ...d.dependencies, ...d.optionalDependencies }).filter((k) => k.startsWith('@matter/'));
  }
  matterDepsCache.set(name, result);
  return result;
}

// Expands a set of declared package names into the closure of `@matter/*`
// packages they provide, following each declared `@matter/*` package's
// dependency tree (incl. optionalDependencies) as installed in node_modules.
// Returns a Map of provided `@matter/*` package -> the declared root it came
// from ('self' when the package itself is declared), so callers can explain why
// an undeclared import still resolves.
function matterClosure(declaredNames) {
  const provided = new Map();
  for (const root of declaredNames) {
    if (!root.startsWith('@matter/')) continue;
    const stack = [root];
    while (stack.length) {
      const name = stack.pop();
      if (provided.has(name)) continue;
      provided.set(name, name === root ? 'self' : root);
      for (const dep of installedMatterDeps(name) || []) {
        if (!provided.has(dep)) stack.push(dep);
      }
    }
  }
  return provided;
}

// Returns whether a declared scoped dependency is used directly or, for a
// `@matter/*` package, provides an imported package through its dependency tree.
function isDependencyUsed(name, importedNames) {
  if (importedNames.has(name)) return true;
  if (!name.startsWith('@matter/')) return false;
  const provided = matterClosure([name]);
  return [...importedNames].some((importedName) => importedName.startsWith('@matter/') && provided.has(importedName));
}

// Reads a tsconfig (tolerating // and /* */ comments) and returns the set of
// referenced workspace directory names.
function refSet(tsPath) {
  if (!existsSync(tsPath)) return null;
  const txt = readFileSync(tsPath, 'utf8')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const json = JSON.parse(txt);
  const names = new Set();
  for (const r of json.references || []) {
    const mm = /\.\.\/([^/]+)\//.exec(r.path) || /packages\/([^/]+)\//.exec(r.path);
    if (mm) names.add(mm[1]);
  }
  return names;
}

function main() {
  let problems = 0;
  const units = buildUnits();
  const workspaceDirs = new Map(units.filter((u) => u.dirName).map((u) => [u.packageName, u.dirName]));

  for (const u of units) {
    const pkg = JSON.parse(readFileSync(u.pkgJson, 'utf8'));
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};
    const peerDeps = pkg.peerDependencies || {};
    const allDeps = { ...deps, ...devDeps, ...peerDeps };
    const where = (b) => (b in deps ? 'deps' : b in devDeps ? 'devDeps' : b in peerDeps ? 'peerDeps' : 'ABSENT');

    const srcFiles = u.srcDirs.filter((x) => x.kind === 'src').flatMap((x) => walk(x.d));
    const testFiles = u.srcDirs.filter((x) => x.kind === 'test').flatMap((x) => walk(x.d));
    const srcImports = collectImports(srcFiles);
    const testImports = collectImports(testFiles);
    const importedNames = new Set([...srcImports.keys(), ...testImports.keys()]);

    const prodRefs = refSet(u.tsProd);
    const buildRefs = refSet(u.tsBuild);

    // `@matter/*` packages reachable from what each scope declares, used to
    // accept the intended lockstep-monorepo usage instead of flagging it.
    const srcClosure = matterClosure(Object.keys(deps));
    const allClosure = matterClosure(Object.keys(allDeps));

    const issues = [];
    const notes = [];

    // Production sources must declare their imports and (for workspace packages)
    // carry matching project references in both build tsconfigs.
    for (const base of srcImports.keys()) {
      if (!(base in deps)) {
        const via = srcClosure.get(base);
        if (via) notes.push(`SRC import of '${base}' satisfied transitively via declared '${via}'`);
        else issues.push(`SRC import of '${base}' but NOT in "dependencies" (found in: ${where(base)})`);
      }
      if (base.startsWith('@matterbridge/')) {
        const dirName = workspaceDirs.get(base);
        if (dirName && dirName !== u.dirName) {
          if (prodRefs && !prodRefs.has(dirName)) issues.push(`SRC import of '${base}' but missing reference in tsconfig.build.production.json`);
          if (buildRefs && !buildRefs.has(dirName)) issues.push(`SRC import of '${base}' but missing reference in tsconfig.build.json`);
        }
      }
    }

    // Test imports only need to be declared as a runtime or dev dependency.
    for (const base of testImports.keys()) {
      if (!(base in allDeps)) {
        const via = allClosure.get(base);
        if (via) notes.push(`TEST import of '${base}' satisfied transitively via declared '${via}'`);
        else issues.push(`TEST import of '${base}' but NOT in dependencies or devDependencies`);
      }
    }

    // Workspace package declarations must be used directly or, for Matter
    // packages, provide an imported package transitively. Root is an aggregate
    // package whose exports and build entrypoints span workspace packages.
    if (u.dirName) {
      for (const [field, declared] of [
        ['dependencies', deps],
        ['devDependencies', devDeps],
      ]) {
        for (const name of Object.keys(declared)) {
          if ((name.startsWith('@matter/') || name.startsWith('@matterbridge/')) && !isDependencyUsed(name, importedNames)) {
            issues.push(`'${name}' declared in "${field}" but not imported`);
          }
        }
      }
    }

    console.log(`\n### ${u.id}`);
    console.log(`  src  @matter*/imports: ${[...srcImports.keys()].sort().join(', ') || '(none)'}`);
    console.log(`  test @matter*/imports: ${[...testImports.keys()].sort().join(', ') || '(none)'}`);
    for (const n of notes) console.log(grey('  ℹ ' + n));
    if (issues.length === 0) {
      console.log(green('  ✓ compliant'));
    } else {
      problems += issues.length;
      for (const i of issues) console.log(red('  ✗ ' + i));
    }
  }

  const total = `\n=== TOTAL ISSUES: ${problems} ===`;
  console.log(problems === 0 ? green(total) : red(total));
  process.exit(problems === 0 ? 0 : 1);
}

main();
