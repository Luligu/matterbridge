/* eslint-disable no-console */
import { execFileSync, spawn } from 'node:child_process';
import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const isWindows = process.platform === 'win32';

const BIN_ENTRYPOINTS = {
  tsc: ['typescript', 'bin/tsc'],
  jest: ['jest', 'bin/jest.js'],
  eslint: ['eslint', 'bin/eslint.js'],
  prettier: ['prettier', 'bin/prettier.cjs'],
};

/**
 * An Error subtype that carries a desired process exit code.
 */
class ExitError extends Error {
  /**
   * @param {number} code The desired exit code.
   * @param {string} message The error message.
   */
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Prints CLI usage text.
 */
function printUsage() {
  const msg = `\
Usage: mb-run [--reset] [--clean] [--build|--build-production] [--watch] [--test] [--lint|--lint-fix] [--format|--format-check] [--version [dev|edge|git|local|next|alpha|beta]]

Runs the same operations as the root package.json scripts, but executes the local
binaries in node_modules/.bin directly (does not call npm scripts).

Notes:
- If multiple flags are provided, tasks run in this order: reset → clean → build/build-production → test → lint → format → watch
- --reset empties .cache/ and node_modules/ (keeps directories for devcontainer named volumes), then runs npm install and build
- --test sets NODE_OPTIONS="--experimental-vm-modules --no-warnings" like the existing scripts
- --lint-fix runs eslint with --fix
- --format-check runs prettier with --check
- --build prefers per-workspace tsconfig.build.json when present
- --build-production prefers tsconfig.production.build.json, else tsconfig.production.json
- --version updates versions for root and all configured workspaces
`;

  console.log(msg);
}

/**
 * Prints usage text for the --version mode.
 */
function printVersionUsage() {
  const msg = [
    'Usage: node scripts/mb-run.mjs  --version [dev|edge|git|local|next|alpha|beta]',
    'Updates package.json + package-lock.json (root and workspaces) version to:',
    '  <baseVersion>-<dev|edge|git|local|next|alpha|beta>-<yyyymmdd>-<7charSha>',
    'Or with no tag, strips the suffix back to <baseVersion>.',
  ].join('\n');

  console.log(msg);
}

/**
 * Validates and normalizes the version tag.
 *
 * @param {string | undefined} tag Tag.
 * @returns {'dev' | 'edge' | 'git' | 'local' | 'next' | 'alpha' | 'beta'} Normalized tag.
 */
function parseVersionTag(tag) {
  const normalized = String(tag ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'dev' || normalized === 'edge' || normalized === 'git' || normalized === 'local' || normalized === 'next' || normalized === 'alpha' || normalized === 'beta') {
    return normalized;
  }
  throw new ExitError(1, 'Missing or invalid --version tag (expected dev, edge, git, local, next, alpha, or beta).');
}

/**
 * Formats a Date as yyyymmdd.
 *
 * @param {Date} date Date.
 * @returns {string} yyyymmdd string.
 */
function formatYyyymmdd(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Returns a 7-char git SHA from the current repo.
 *
 * @param {string} cwd Repo root.
 * @returns {string} sha7.
 */
function shortSha7FromGit(cwd) {
  const out = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const sha = String(out).trim();
  if (!/^[0-9a-f]{7}$/i.test(sha)) {
    throw new Error(`Unexpected git short SHA output: ${JSON.stringify(sha)}`);
  }
  return sha.toLowerCase();
}

/**
 * Gets the git 7-char SHA, throwing a user-friendly error if unavailable.
 *
 * @param {string} cwd Repo root.
 * @returns {string} sha7.
 */
function getShortSha7(cwd) {
  try {
    return shortSha7FromGit(cwd);
  } catch (err) {
    throw new ExitError(1, `Unable to determine git short SHA. (${err instanceof Error ? err.message : String(err)})`);
  }
}

/**
 * Extracts a base semver x.y.z from a version string.
 *
 * Accepts either a plain version (x.y.z) or a previously tagged version
 * (x.y.z-<tag>-<yyyymmdd>-<7charSha>). In both cases it returns x.y.z.
 *
 * @param {unknown} version Version.
 * @returns {string} Base semver.
 */
function extractBaseSemver(version) {
  const trimmed = String(version ?? '').trim();
  const match = /^([0-9]+\.[0-9]+\.[0-9]+)(?:-.+)?$/.exec(trimmed);
  if (!match) {
    throw new ExitError(1, `package.json version must start with plain x.y.z (got: ${JSON.stringify(trimmed)})`);
  }
  return match[1];
}

/**
 * Updates root package.json (and package-lock.json) version.
 *
 * @param {'dev' | 'edge' | 'git' | 'local' | 'next' | 'alpha' | 'beta' | null} tag Tag; null strips suffix.
 * @returns {Promise<string>} The version that was applied.
 */
async function updateRootVersion(tag) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const raw = await readFile(packageJsonPath, 'utf8');
  const pkg = JSON.parse(raw);

  const currentVersion = pkg.version;
  const baseVersion = extractBaseSemver(currentVersion);
  const nextVersion = tag ? `${baseVersion}-${tag}-${formatYyyymmdd(new Date())}-${getShortSha7(repoRoot)}` : baseVersion;

  // Use npm so package-lock.json is updated too, and update only the packages declared in the root workspaces.
  // Allow same version so re-running can resync package-lock.json or out-of-sync workspace versions.
  await runCommand(
    'npm',
    ['version', nextVersion, '--workspaces', '--include-workspace-root', '--no-workspaces-update', '--no-git-tag-version', '--ignore-scripts', '--allow-same-version'],
    {
      cwd: repoRoot,
    },
  );

  return nextVersion;
}

/**
 *  Checks if the current package.json scripts indicate we're running in a plugin context.
 *
 * @returns {Promise<boolean>} True if we're in a plugin context.
 */
async function isPlugin() {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const raw = await readFile(packageJsonPath, 'utf8');
  const pkg = JSON.parse(raw);
  return pkg?.scripts?.start === 'matterbridge' || pkg?.scripts?.['dev:link'] === 'npm link --no-fund --no-audit matterbridge';
}

/**
 * Gets workspace package.json paths from the root package.json workspaces list.
 *
 * Supports explicit paths and simple globs ending in `/*` (e.g. `packages/*`).
 *
 * @returns {Promise<string[]>} Absolute paths to workspace package.json files.
 */
async function getWorkspacePackageJsonPaths() {
  const rootPackageJsonPath = path.join(repoRoot, 'package.json');
  const raw = await readFile(rootPackageJsonPath, 'utf8');
  const rootPkg = JSON.parse(raw);

  /** @type {unknown} */
  const workspacesConfig = rootPkg?.workspaces;
  /** @type {string[]} */
  let patterns = [];

  if (Array.isArray(workspacesConfig)) {
    patterns = workspacesConfig.filter((p) => typeof p === 'string');
  } else if (workspacesConfig && typeof workspacesConfig === 'object' && Array.isArray(workspacesConfig.packages)) {
    patterns = workspacesConfig.packages.filter((p) => typeof p === 'string');
  }

  if (patterns.length === 0) {
    return [];
  }

  // eslint-disable-next-line no-useless-escape
  const hasGlobChars = (s) => /[*?\[]/.test(s);

  /** @type {string[]} */
  const packageJsonPaths = [];

  for (const pattern of patterns) {
    const trimmed = pattern.trim();
    if (!trimmed) continue;

    if (!hasGlobChars(trimmed)) {
      const candidate = path.join(repoRoot, trimmed, 'package.json');
      if (await fileExists(candidate)) packageJsonPaths.push(candidate);
      continue;
    }

    // Support only simple "dir/*" style globs.
    // eslint-disable-next-line no-useless-escape
    if (trimmed.endsWith('/*') && trimmed.indexOf('*') === trimmed.length - 1 && !/[?\[]/.test(trimmed)) {
      const baseRel = trimmed.slice(0, -2);
      const baseAbs = path.join(repoRoot, baseRel);
      let entries;
      try {
        entries = await readdir(baseAbs, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const candidate = path.join(baseAbs, entry.name, 'package.json');
        if (await fileExists(candidate)) packageJsonPaths.push(candidate);
      }
      continue;
    }

    throw new ExitError(1, `Unsupported workspaces pattern in root package.json: ${JSON.stringify(trimmed)} (use explicit paths or a simple 'dir/*' glob)`);
  }

  return Array.from(new Set(packageJsonPaths));
}

/**
 * Updates inter-workspace dependency ranges to targetVersion.
 *
 * This prevents npm installs from trying to resolve workspace dependencies from
 * the public registry when using prerelease versions.
 *
 * @param {string} targetVersion The version to pin workspace deps to.
 * @returns {Promise<void>} Resolves when done.
 */
async function updateWorkspaceDependencyVersions(targetVersion) {
  const packageJsonPaths = await getWorkspacePackageJsonPaths();
  if (packageJsonPaths.length === 0) return;

  const workspacePkgs = await Promise.all(
    packageJsonPaths.map(async (p) => {
      const raw = await readFile(p, 'utf8');
      const pkg = JSON.parse(raw);
      const name = typeof pkg?.name === 'string' ? pkg.name : null;
      if (!name) {
        throw new ExitError(1, `Workspace package.json missing name: ${p}`);
      }
      return { path: p, name };
    }),
  );

  const workspaceNames = new Set(workspacePkgs.map((p) => p.name));
  const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

  await Promise.all(
    workspacePkgs.map(async ({ path: packageJsonPath, name: selfName }) => {
      const raw = await readFile(packageJsonPath, 'utf8');
      const pkg = JSON.parse(raw);
      let changed = false;

      for (const section of sections) {
        const deps = pkg?.[section];
        if (!deps || typeof deps !== 'object') continue;

        for (const depName of Object.keys(deps)) {
          if (!workspaceNames.has(depName)) continue;
          if (depName === selfName) continue;

          const current = String(deps[depName] ?? '');
          const prefix = current.startsWith('~') ? '~' : '^';
          const nextRange = `${prefix}${targetVersion}`;
          if (deps[depName] !== nextRange) {
            deps[depName] = nextRange;
            changed = true;
          }
        }
      }

      if (changed) {
        await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
      }
    }),
  );
}

/**
 * Resolves a `node_modules/.bin` shim path.
 *
 * @param {string} binName The executable name.
 * @returns {string} Absolute path to the shim.
 */
function binPath(binName) {
  const fileName = isWindows ? `${binName}.cmd` : binName;
  return path.resolve(repoRoot, 'node_modules', '.bin', fileName);
}

/**
 * Resolves the underlying Node entrypoint for a known tool.
 *
 * @param {string} binName The tool name.
 * @returns {string | null} Absolute path to the entrypoint if known.
 */
function entrypointPath(binName) {
  const spec = BIN_ENTRYPOINTS[binName];
  if (!spec) return null;
  const [pkg, rel] = spec;
  return path.resolve(repoRoot, 'node_modules', pkg, rel);
}

/**
 * Verifies the tool is installed.
 *
 * @param {string} binName The tool name.
 * @returns {Promise<void>} Resolves when the tool exists.
 */
async function assertBinExists(binName) {
  const entry = entrypointPath(binName);
  const p = entry ?? binPath(binName);
  try {
    await access(p);
  } catch {
    throw new ExitError(1, `Missing binary: ${p}. Did you run "npm install"?`);
  }
}

/**
 * Checks if a file path exists.
 *
 * @param {string} filePath File path.
 * @returns {Promise<boolean>} True if exists.
 */
async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Picks the best tsconfig path for a workspace for a given build mode.
 *
 * @param {'build' | 'production'} mode Build mode.
 * @returns {Promise<string>} Absolute path to chosen tsconfig.
 */
async function pickWorkspaceTsconfig(mode) {
  const candidates =
    mode === 'production' ? ['tsconfig.production.build.json', 'tsconfig.production.json', 'tsconfig.build.json', 'tsconfig.json'] : ['tsconfig.build.json', 'tsconfig.json'];

  for (const name of candidates) {
    const candidatePath = path.join(repoRoot, name);
    if (await fileExists(candidatePath)) {
      console.log(`Using ${name} for workspace ${repoRoot}...`);
      return candidatePath;
    }
  }
  // Fallback to root tsconfig.json (will error if missing, which is desirable since tsc requires a config).
  return path.join(repoRoot, 'tsconfig.json');
}

/**
 * Runs tsc in build mode, selecting per-workspace tsconfig files when available.
 *
 * @param {{ mode: 'build' | 'production', watch: boolean }} options Build options.
 * @returns {Promise<void>} Resolves when build completes.
 */
async function runWorkspaceBuild(options) {
  const configs = await pickWorkspaceTsconfig(options.mode);
  const args = ['-b', '--verbose', configs];
  if (options.watch) args.push('--watch');
  await runBin('tsc', args);
}

/**
 * Runs a tool and forwards stdio.
 *
 * @param {string} binName The tool name.
 * @param {string[]} args CLI args.
 * @param {{ env?: Record<string, string | undefined> }} [options] Spawn options.
 * @returns {Promise<void>} Resolves when the tool exits successfully.
 */
async function runBin(binName, args, options = {}) {
  await assertBinExists(binName);

  const entry = entrypointPath(binName);
  if (entry) {
    const child = spawn(process.execPath, [entry, ...args], {
      stdio: 'inherit',
      env: { ...process.env, ...options.env },
    });

    const exitCode = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0) {
      throw new ExitError(exitCode, `${binName} failed with exit code ${exitCode}`);
    }
    return;
  }

  const child = isWindows
    ? spawn('cmd.exe', ['/d', '/s', '/c', binPath(binName), ...args], {
        stdio: 'inherit',
        env: { ...process.env, ...options.env },
      })
    : spawn(binPath(binName), args, {
        stdio: 'inherit',
        env: { ...process.env, ...options.env },
      });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new ExitError(exitCode, `${binName} failed with exit code ${exitCode}`);
  }
}

/**
 * Removes a path if it exists.
 *
 * @param {string} targetPath Path to remove.
 * @returns {Promise<void>} Resolves when removed.
 */
async function removePath(targetPath) {
  await rm(targetPath, { recursive: true, force: true });
}

/**
 * Ensures a directory exists.
 *
 * @param {string} dirPath Directory path.
 * @returns {Promise<void>} Resolves when the directory exists.
 */
async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Empties a directory without removing it (devcontainer volume friendly).
 *
 * @param {string} dirPath Directory path.
 * @returns {Promise<void>} Resolves when emptied.
 */
async function emptyDir(dirPath) {
  await ensureDir(dirPath);
  const entries = await readdir(dirPath, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dirPath, entry.name);
      await removePath(entryPath);
    }),
  );
}

/**
 * Empties a directory only if it exists; does not create it.
 *
 * @param {string} dirPath Directory path.
 * @returns {Promise<void>} Resolves when emptied or when missing.
 */
async function emptyDirIfExists(dirPath) {
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dirPath, entry.name);
      await removePath(entryPath);
    }),
  );
}

/**
 * Removes all `.tsbuildinfo` files under a root, skipping node_modules.
 *
 * @param {string} rootDir Root directory.
 * @returns {Promise<void>} Resolves when done.
 */
async function removeTsBuildInfo(rootDir) {
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      // Missing directory or unreadable; ignore.
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        stack.push(path.join(current, entry.name));
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.tsbuildinfo')) {
        await removePath(path.join(current, entry.name));
      }
    }
  }
}

/**
 * Removes common build/test artifacts from workspace folders.
 *
 * @param {string} parentDir Parent directory that contains workspaces.
 * @param {{ ensureDirs: boolean }} [options] Options.
 * @returns {Promise<void>} Resolves when done.
 */
async function cleanWorkspaceArtifacts(parentDir, options = { ensureDirs: false }) {
  let workspaces;
  try {
    workspaces = await readdir(parentDir, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    workspaces
      .filter((d) => d.isDirectory())
      .map(async (d) => {
        const wsRoot = path.join(parentDir, d.name);
        await Promise.all([
          removePath(path.join(wsRoot, 'dist')),
          removePath(path.join(wsRoot, 'dist-jest')),
          removePath(path.join(wsRoot, 'coverage')),
          removePath(path.join(wsRoot, 'jest')),
          removePath(path.join(wsRoot, 'temp')),
          removePath(path.join(wsRoot, '.cache')),
          removePath(path.join(wsRoot, 'node_modules')),
          removePath(path.join(wsRoot, 'package-lock.json')),
          removePath(path.join(wsRoot, 'npm-shrinkwrap.json')),
        ]);

        const empty = options.ensureDirs ? emptyDir : emptyDirIfExists;
        await Promise.all([empty(path.join(wsRoot, '.cache')), empty(path.join(wsRoot, 'node_modules'))]);
      }),
  );
}

/**
 * Shared clean pipeline for both --clean and --reset.
 *
 * @param {{ emptyRootNodeModules: boolean, ensureWorkspaceDirs: boolean }} options Options.
 * @returns {Promise<void>} Resolves when done.
 */
async function commonClean(options) {
  await removeTsBuildInfo(repoRoot);

  await Promise.all([
    removePath(path.join(repoRoot, 'dist')),
    removePath(path.join(repoRoot, 'dist-jest')),
    removePath(path.join(repoRoot, 'coverage')),
    removePath(path.join(repoRoot, 'jest')),
    removePath(path.join(repoRoot, 'temp')),
    removePath(path.join(repoRoot, 'npm-shrinkwrap.json')),
  ]);

  await Promise.all([
    cleanWorkspaceArtifacts(path.join(repoRoot, 'packages'), { ensureDirs: options.ensureWorkspaceDirs }),
    cleanWorkspaceArtifacts(path.join(repoRoot, 'apps'), { ensureDirs: options.ensureWorkspaceDirs }),
  ]);

  // Always empty root .cache (don't create it on clean).
  const emptyRootCache = options.ensureWorkspaceDirs ? emptyDir : emptyDirIfExists;
  await emptyRootCache(path.join(repoRoot, '.cache'));

  if (options.emptyRootNodeModules) {
    await emptyDir(path.join(repoRoot, 'node_modules'));
  }
}

/**
 * Performs a reset-style clean without relying on node_modules tools.
 *
 * @returns {Promise<void>} Resolves when done.
 */
async function resetClean() {
  await commonClean({ emptyRootNodeModules: true, ensureWorkspaceDirs: false });
}

/**
 * Clean artifacts (like package.json clean) without reinstalling.
 *
 * @returns {Promise<void>} Resolves when done.
 */
async function cleanOnly() {
  await commonClean({ emptyRootNodeModules: false, ensureWorkspaceDirs: false });
}

/**
 * Runs an external command and forwards stdio.
 *
 * @param {string} command The executable to run.
 * @param {string[]} args CLI args.
 * @param {{ env?: Record<string, string | undefined>, cwd?: string }} [options] Spawn options.
 * @returns {Promise<void>} Resolves when the command exits successfully.
 */
async function runCommand(command, args, options = {}) {
  const resolvedCommand = isWindows && path.extname(command) === '' ? `${command}.cmd` : command;
  const isCmdShim = isWindows && ['.cmd', '.bat'].includes(path.extname(resolvedCommand).toLowerCase());
  const child = isCmdShim
    ? spawn('cmd.exe', ['/d', '/s', '/c', resolvedCommand, ...args], {
        stdio: 'inherit',
        env: { ...process.env, ...options.env },
        cwd: options.cwd,
      })
    : spawn(resolvedCommand, args, {
        stdio: 'inherit',
        env: { ...process.env, ...options.env },
        cwd: options.cwd,
      });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new ExitError(exitCode, `${resolvedCommand} failed with exit code ${exitCode}`);
  }
}

/**
 * CLI entrypoint.
 */
async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0) {
    printUsage();
    throw new ExitError(1, 'No arguments provided');
  }
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printUsage();
    return;
  }

  const known = new Set([
    '--build',
    '--build-production',
    '--clean',
    '--watch',
    '--test',
    '--lint',
    '--lint-fix',
    '--format',
    '--format-check',
    '--reset',
    '--version',
    '--help',
    '-h',
  ]);

  const versionIndex = rawArgs.indexOf('--version');
  const candidateVersionArg = versionIndex >= 0 ? rawArgs[versionIndex + 1] : undefined;
  const rawVersionTag = typeof candidateVersionArg === 'string' && !candidateVersionArg.startsWith('-') ? candidateVersionArg : undefined;

  const unknownFlags = rawArgs.filter((a) => a.startsWith('-') && !known.has(a));
  if (unknownFlags.length > 0) {
    printUsage();
    throw new ExitError(1, `Unknown argument(s): ${unknownFlags.join(' ')}`);
  }

  const unknownPositionals = rawArgs.filter((a, i) => !a.startsWith('-') && !(versionIndex >= 0 && rawVersionTag !== undefined && i === versionIndex + 1));
  if (unknownPositionals.length > 0) {
    printUsage();
    throw new ExitError(1, `Unknown argument(s): ${unknownPositionals.join(' ')}`);
  }

  /** @type {'dev' | 'edge' | 'git' | 'local' | 'next' | 'alpha' | 'beta' | null} */
  let versionTag = null;
  if (versionIndex >= 0 && rawVersionTag !== undefined) {
    try {
      versionTag = parseVersionTag(rawVersionTag);
    } catch {
      printVersionUsage();
      throw new ExitError(1, 'Invalid --version usage');
    }
  }

  const want = {
    clean: rawArgs.includes('--clean'),
    build: rawArgs.includes('--build'),
    buildProduction: rawArgs.includes('--build-production'),
    version: rawArgs.includes('--version'),
    watch: rawArgs.includes('--watch'),
    test: rawArgs.includes('--test'),
    lint: rawArgs.includes('--lint'),
    lintFix: rawArgs.includes('--lint-fix'),
    format: rawArgs.includes('--format'),
    formatCheck: rawArgs.includes('--format-check'),
    reset: rawArgs.includes('--reset'),
  };

  if (want.version) {
    // Run versioning first so subsequent steps see the updated package.json version.
    // (Intentionally does not run npm install.)
    const nextVersion = await updateRootVersion(versionTag);
    await updateWorkspaceDependencyVersions(nextVersion);
    await runCommand('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline'], {
      cwd: repoRoot,
    });
  }

  // Keep behavior deterministic; mimic common workflow ordering.
  if (want.reset) {
    await resetClean();

    await runCommand('npm', ['install', '--no-fund', '--no-audit']);
    if (await isPlugin()) await runCommand('npm', ['link', 'matterbridge', '--no-fund', '--no-audit'], { cwd: repoRoot });
    await runWorkspaceBuild({ mode: 'build', watch: false });

    // Avoid repeating work if the caller also provided --clean/--build.
    want.clean = false;
    want.build = false;
    want.buildProduction = false;
  }

  if (want.clean) {
    await cleanOnly();
  }

  if (want.buildProduction) {
    await runWorkspaceBuild({ mode: 'production', watch: false });
  } else if (want.build) {
    await runWorkspaceBuild({ mode: 'build', watch: false });
  }

  if (want.test) {
    await runBin('jest', ['--maxWorkers=100%'], {
      env: {
        NODE_OPTIONS: '--experimental-vm-modules --no-warnings',
      },
    });
  }

  if (want.lintFix) {
    console.log('Linting with fix...');
    await runBin('eslint', ['--cache', '--cache-location', '.cache/.eslintcache', '--fix', '--max-warnings=0', '.']);
    console.log('Lint fix complete.');
  } else if (want.lint) {
    console.log('Linting...');
    await runBin('eslint', ['--cache', '--cache-location', '.cache/.eslintcache', '--max-warnings=0', '.']);
    console.log('Lint complete.');
  }

  if (want.format) {
    await runBin('prettier', ['--cache', '--cache-location', '.cache/.prettiercache', '--write', '.']);
  } else if (want.formatCheck) {
    await runBin('prettier', ['--cache', '--cache-location', '.cache/.prettiercache', '--check', '.']);
  }

  if (want.watch) {
    // Keep watch consistent with the non-production build mode.
    await runWorkspaceBuild({ mode: 'build', watch: true });
  }
}

try {
  await main();
} catch (error) {
  const exitCode = error instanceof ExitError ? error.code : 1;

  console.error(error instanceof Error ? error.message : error);
  process.exitCode = exitCode;
}
