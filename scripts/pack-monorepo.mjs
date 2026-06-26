/**
 * pack-monorepo.mjs
 * Version: 1.0.0
 *
 * Packs Matterbridge with its workspace distribution files and without npm bundled dependencies.
 *
 * Usage:
 *   node scripts/pack-monorepo.mjs --tag <dev|edge|git|local|latest> [--scope <prefix>] [--dry-run]
 */

/* eslint-disable no-console */
/* eslint-disable jsdoc/require-jsdoc */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ANSI_GREEN = '\x1b[32m';
const ANSI_RESET = '\x1b[0m';

function green(text) {
  if (process.env.NO_COLOR || process.env.TERM === 'dumb' || !process.stdout?.isTTY) return text;
  return `${ANSI_GREEN}${text}${ANSI_RESET}`;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootPackagePath = path.join(root, 'package.json');
const args = process.argv.slice(2);
const option = (longName, shortName) => {
  const index = args.findIndex((value) => value === longName || value === shortName);
  return index < 0 ? undefined : args[index + 1];
};
const tag = option('--tag', '-t')?.toLowerCase();
const scope = option('--scope', '-s') ?? '@matterbridge';
const dryRun = args.includes('--dry-run');
if (!['dev', 'edge', 'git', 'local', 'latest'].includes(tag))
  throw new Error('Usage: node scripts/pack-monorepo.mjs --scope @matterbridge --tag <dev|edge|git|local|latest> [--dry-run]');
const read = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const run = (command, commandArgs) => {
  console.log(`$ ${command} ${commandArgs.map(JSON.stringify).join(' ')}`);
  const windows = process.platform === 'win32' && command === 'npm';
  const result = spawnSync(windows ? process.env.ComSpec || 'cmd.exe' : command, windows ? ['/d', '/s', '/c', command, ...commandArgs] : commandArgs, {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed: ${command}`);
};
const walk = async (directory) => {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(file)));
    else if (/\.(?:js|d\.ts)$/.test(entry.name)) result.push(file);
  }
  return result;
};
const rebaseExport = (value, relative) => {
  if (typeof value === 'string') return `./${path.posix.join(relative, value.slice(2))}`;
  return Object.fromEntries(
    Object.entries(value).map(([condition, target]) => [condition, typeof target === 'string' ? `./${path.posix.join(relative, target.slice(2))}` : target]),
  );
};
const originalRoot = await read(rootPackagePath);
const workspaces = await Promise.all(
  originalRoot.workspaces.map(async (relative) => ({
    relative,
    directory: path.join(root, relative),
    packagePath: path.join(root, relative, 'package.json'),
    package: await read(path.join(root, relative, 'package.json')),
  })),
);
const bins = ['bin/matterbridge.js', 'bin/mb_coap.js', 'bin/mb_health.js', 'bin/mb_mdns.js'].map((file) => path.join(root, file));
const backups = new Map(
  await Promise.all([rootPackagePath, ...workspaces.map(({ packagePath }) => packagePath), ...bins].map(async (file) => [file, await fs.readFile(file, 'utf8')])),
);

console.log(`tag: ${tag}`);
console.log(`scope prefix: ${scope}`);
console.log(`workspace packages: ${workspaces.length}`);
console.log(`dry-run: ${dryRun ? 'yes' : 'no'}\n`);

try {
  console.log(green('phase 1/6: synchronizing package versions'));
  if (tag !== 'latest') run('node', ['scripts/version.mjs', tag]);
  run('node', ['scripts/sync-workspaces.mjs', '--scope', scope]);

  console.log(`\n${green('phase 2/6: building workspace distributions')}`);
  run('npm', ['run', 'build']);

  console.log(`\n${green('phase 3/6: rewriting workspace imports for packed self-resolution')}`);
  const names = new Map(workspaces.map(({ package: workspacePackage }) => [workspacePackage.name, `${originalRoot.name}/internal/${workspacePackage.name.split('/').at(-1)}`]));
  let rewrittenFiles = 0;
  for (const directory of [path.join(root, 'dist'), ...workspaces.map(({ directory }) => path.join(directory, 'dist'))])
    for (const file of await walk(directory)) {
      let text = await fs.readFile(file, 'utf8');
      for (const [from, to] of names) text = text.replaceAll(from, to);
      await fs.writeFile(file, text);
      rewrittenFiles++;
    }
  for (const bin of bins) await fs.writeFile(bin, (await fs.readFile(bin, 'utf8')).replaceAll('@matterbridge/core', `${originalRoot.name}/internal/core`));
  console.log(`rewrote: ${rewrittenFiles} distribution files and ${bins.length} bin entrypoints`);

  console.log(`\n${green('phase 4/6: preparing packed package metadata')}`);
  const packed = await read(rootPackagePath);
  const dependencies = { ...(packed.dependencies ?? {}) };
  for (const { package: workspace } of workspaces)
    for (const [name, version] of Object.entries(workspace.dependencies ?? {}))
      if (!name.startsWith(scope)) {
        if (dependencies[name] && dependencies[name] !== version) throw new Error(`Dependency conflict: ${name}`);
        dependencies[name] = version;
      }
  for (const name of Object.keys(dependencies)) if (name.startsWith(scope)) delete dependencies[name];
  packed.dependencies = dependencies;
  delete packed.devDependencies;
  delete packed.scripts;
  delete packed.workspaces;
  delete packed.overrides;
  packed.files = [...new Set([...(packed.files ?? []), ...workspaces.flatMap(({ relative }) => [`${relative}/dist`, `${relative}/package.json`])])];
  for (const { relative, package: workspace } of workspaces) {
    const short = workspace.name.split('/').at(-1);
    for (const [subpath, exportValue] of Object.entries(workspace.exports ?? {})) {
      const suffix = subpath === '.' ? '' : subpath.slice(1);
      packed.exports[`./internal/${short}${suffix}`] = rebaseExport(exportValue, relative);
    }
  }
  await fs.writeFile(rootPackagePath, `${JSON.stringify(packed, null, 2)}\n`);
  console.log(`external dependencies: ${Object.keys(dependencies).length}`);
  console.log(`workspace exports: ${Object.keys(packed.exports).filter((key) => key.startsWith('./internal/')).length}`);

  console.log(`\n${green('phase 5/6: generating an external-only shrinkwrap')}`);
  await fs.rm(path.join(root, 'package-lock.json'), { force: true });
  await fs.rm(path.join(root, 'npm-shrinkwrap.json'), { force: true });
  run('npm', ['install', '--package-lock-only', '--no-fund', '--no-audit', '--omit=dev']);
  run('npm', ['shrinkwrap']);

  console.log(`\n${green('phase 6/6: packing root package')}`);
  run('npm', dryRun ? ['pack', '--dry-run'] : ['pack']);
} finally {
  await Promise.all([...backups].map(([file, text]) => fs.writeFile(file, text)));
  console.log('restored: package.json files and bin entrypoints');
}
