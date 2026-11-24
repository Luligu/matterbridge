/**
 * run-chip-test.mjs
 * Version: 1.5.0
 *
 * Manage the `luligu/matterbridge:chip-test` docker container and run the Matter CHIP test suite defined
 * in chipTests.json, logging full results to chipTests.log and just the pass/fail summary to
 * chipTestsSummary.log. The image already bundles a full Matterbridge instance (built from the `dev`
 * branch at image-build time) started with `--novirtual`, so there is nothing to install, build, or add
 * by default. With `--start --plugin`, the prepared plugin in cwd is copied into the container,
 * configured from chipTests.json.config, and registered with Matterbridge. Otherwise `--start` just
 * brings the container up and waits for Matterbridge's root server node to come
 * online, and the test list runs against that instance as-is.
 *
 * chipTests.json shape:
 *   "resetClusterGlobs"   (optional) Filename globs (matched against files under Matterbridge's node
 *                          storage directory for the bridged endpoints) cleared by a "resetBefore": true or
 *                          "resetAfter": true test entry — see below. Defaults to an empty array; a test
 *                          entry using either flag with nothing configured here fails loudly instead of
 *                          silently doing nothing. Only needs entries for cluster state that's actually
 *                          persisted to disk — the container restart that "resetBefore"/"resetAfter" also
 *                          performs already clears any cluster state kept purely in memory, with no glob
 *                          needed for that.
 *   "patches"             (optional) Filenames under docker/chip-test/patches/, each copied into the
 *                          container right after it (re)starts, overwriting the same-named file under
 *                          src/python_testing/ for a ".py" patch (a Python test) or under
 *                          src/app/tests/suites/certification/ for anything else (a YAML certification
 *                          test) — see below. Defaults to an empty array.
 *   "pairs"               (optional) Manual pairing codes tried in order by --start, right after the
 *                          container is ready, to pair both fabrics (chip-tool's "alpha" and the Python test
 *                          framework's) with the first code that commissions, e.g. ["34970112332"] for the
 *                          --native root node. Skipped when alpha is already paired (the image's baked-in
 *                          fabrics). Defaults to an empty array (no pairing).
 *   "tests"                (optional) The unified list of CHIP tests to run, YAML certification tests and
 *                          Python tests mixed together — see below. Defaults to an empty array.
 * Each tests entry has:
 *   "name"                 Human-readable label, matched (case-insensitively, substring) by --test.
 *   "test"                 Required. The test identifier. A filename ending in ".py" is run as a Python test
 *                          (src/python_testing/<test>, e.g. "TC_PS_2_1.py"); anything else is run as a YAML
 *                          certification test with no extension (e.g. "Test_TC_PS_2_1"), through chip-tool's
 *                          websocket test runner, scripts/tests/chipyaml/chiptool.py. chip-tool's own
 *                          persistent storage inside the image already holds a fabric paired with the
 *                          matterbridge instance, so each YAML invocation just spawns a short-lived
 *                          `chip-tool interactive server`, runs the one test, and tears it down again — no
 *                          separate commissioning step needed.
 *   "endpoint"             (optional) Endpoint number, passed as "--endpoint <n>" ahead of "args" as the
 *                          first CLI arg after the test name. Also pinned into the running Matterbridge
 *                          instance before the test runs (see setActiveTestEndpoint()), via a "SetTestEndpoint"
 *                          command written into the CHIP test app-pipe — chipTests.ts reads that pin so
 *                          GeneralDiagnostics.TestEventTrigger handlers, which get no endpoint field on the
 *                          wire, can target the one endpoint the test names instead of broadcasting to every
 *                          endpoint that implements the affected cluster. Written before every test (as "none"
 *                          when unset), so a pin never leaks from one test into the next.
 *   "args"                 (optional) Array of strings, each split on whitespace and appended as CLI args
 *                          after the test name (and after "--endpoint", if set), e.g. ["--PICS /root/matterbridge.pics"].
 *   "input"                (optional) String piped to the test's stdin, for tests that prompt for
 *                          interactive confirmation (for example "y\ny\n").
 *   "skip"                 (optional) true to keep the entry listed (documenting that it exists and why it
 *                          doesn't run) without ever invoking it — see below.
 *   "comment"              (optional) Free text printed under a failing/skipped result in the summary log.
 *   "resetBefore"/"resetAfter"   (optional) Clear resetClusterGlobs and restart the container before/after
 *                          this test — see below.
 *   "unpairBefore"/"pairBefore"/"unpairAfter"/"pairAfter"   (optional) Decommission/re-commission both
 *                          baked-in fabrics before/after this test — see below. "pairBefore"/"pairAfter"
 *                          also accept a string: the manual pairing code to commission with (e.g.
 *                          "34970112332" for the --native root node) instead of the image's fixed one.
 *   "revokeWindowBefore"   (optional) Revoke any commissioning window left open by a previous test — see
 *                          below.
 *   "resetControllerBefore"   (optional) Unpair every fabric, delete the chip-tool and Python controller
 *                          storage and pair both fabrics again before this test — see below. true pairs with
 *                          the top-level "pairs" codes (the image's fixed one when empty), a string with that
 *                          manual pairing code.
 *
 * Usage:
 *   bun scripts/run-chip-test.mjs --start          Create and start the chip-test container, then pair with "pairs".
 *   bun scripts/run-chip-test.mjs --start --local  Create and start the chip-test container from the local matterbridge:chip-test image (no pull).
 *   bun scripts/run-chip-test.mjs --start --plugin Copy and register the prepared plugin in cwd (also accepts --local).
 *   bun scripts/run-chip-test.mjs --start --native Copy this repo into the container and run it with Bun instead of
 *                                                   the image's Matterbridge, with all pairing data removed (also accepts --local).
 *   bun scripts/run-chip-test.mjs --stop           Stop the chip-test container.
 *   bun scripts/run-chip-test.mjs                  Run the tests listed in chipTests.json inside the running container.
 *   bun scripts/run-chip-test.mjs --test NAME       Run only the tests whose "name" or "test" property includes NAME (case-insensitive).
 *
 * A chipTests.json entry may set "resetBefore": true to clear persisted stateful cluster storage (matched
 * via "resetClusterGlobs", above) and restart the matterbridge process before that test runs, and/or
 * "resetAfter": true to do the same after that test runs (before the next one starts) — without recreating
 * the container (no docker rm/pull).This is much cheaper than --start.
 * "resetBefore" is for tests that depend on starting from a clean, un-allocated device state; "resetAfter"
 * is for tests that leave dirty residue (e.g. an unclosed session, a mutated attribute) that would otherwise
 * leak into whichever test runs next — put it on the test that causes the residue, not the one affected by
 * it, so the fix travels with the test that needs it even if the surrounding list is reordered.
 * Each tests entry may also set a "comment" string, printed under a failing/skipped result
 * in the summary log, and a "skip": true flag to leave the test listed (documenting that it exists and why
 * it doesn't run) without ever invoking it — for tests that can never pass against this image (e.g. ones
 * requiring the CSA reference app's --app-pipe debug hook, which Matterbridge doesn't implement).
 *
 * A chipTests.json entry may also set "unpairBefore"/"pairBefore"/"unpairAfter"/"pairAfter" (all optional,
 * independently combinable) to fully decommission and/or re-commission both of the image's baked-in fabrics
 * (chip-tool CLI's "alpha" identity and the Python test framework's default_controller — see
 * docker/chip-test/pairing.json for the fixed pairing credentials this re-pairs from) around that test.
 * Unlike "resetBefore"/"resetAfter" (a lightweight storage-glob-plus-restart reset), this gives a genuinely
 * fresh fabric/event-log state — needed for tests that assert on zero pre-existing events or an empty ACL,
 * which a plain restart can't provide since Matterbridge's event log and fabric table survive it. Unpairing
 * has alpha remove every other fabric with RemoveFabric and then unpair itself. Pairing
 * back both fabrics takes two steps because a commissioning window closes as soon as one commissioning
 * succeeds: chip-tool's "alpha" re-pairs first with the fixed factory code (only valid from a fully
 * decommissioned, 0-fabric device), then alpha opens a fresh Enhanced Commissioning window whose one-time
 * manual code (parsed from chip-tool's own output) commissions the Python fabric. Order within a single test
 * entry is resetControllerBefore → unpairBefore → pairBefore → revokeWindowBefore → (test runs) → unpairAfter → pairAfter.
 *
 * A chipTests.json entry may also set "resetControllerBefore" for the controllers' own residue: every Python test
 * loads the same admin_storage.json, and each fabric a test creates for another administrator (NewFabricAdmin,
 * e.g. TH2 of TC_TIMESYNC_2_13) stays there, so a long run fills the CHIP_CONFIG_MAX_FABRICS (16) slots of the
 * controller's FabricTable and NewController() fails with "CHIP Error 0x0000000B: No memory". It unpairs every
 * fabric of the DUT (as unpairBefore), deletes the chip-tool and Python controller storage (as --start), restarts
 * the DUT, then pairs both fabrics again (as pairBefore). The restart with no fabrics starts the fabric indexes
 * again at 1, so alpha is fabric 1 and the Python fabric 2, as after --start: tests that expect FabricIndex 1
 * (Test_TC_GRPKEY_2_1) need it after any earlier re-pair. Use it only where a full run needs it.
 *
 * A chipTests.json entry may also set "revokeWindowBefore": true — a much cheaper alternative to
 * unpairBefore/pairBefore for one specific kind of residue: a previous test that opens a commissioning
 * window (e.g. via AdministratorCommissioning) as part of its own steps and doesn't revoke it afterwards.
 * A window left open blocks ArmFailSafe ("kBusyWithOtherAdmin") for any later test that needs one, so
 * revokeWindowBefore sends RevokeCommissioning (from alpha, which works regardless of which fabric opened
 * the window) to close it without touching either fabric's pairing.
 *
 * The top-level "patches" array names files under docker/chip-test/patches/ that fix a known bug or gap in a
 * test file baked into the image (e.g. a stale hand-coded namespace whitelist that predates a spec version
 * the image otherwise supports correctly) without waiting for that fix to land upstream and a new image to
 * be published. Each entry is a plain filename, copied over the same-named file in the container: a ".py"
 * name (e.g. "TC_DeviceBasicComposition.py") goes under src/python_testing/; anything else (e.g.
 * "Test_TC_OO_2_3.yaml") goes under src/app/tests/suites/certification/, matching the extension a YAML
 * certification test's own file actually has on disk even though chipTests.json's own "test" entries
 * reference that same test without the extension. Applied once by start(), right after the container comes
 * up — not reapplied by resetContainerState()'s restart, since that only restarts the matterbridge process
 * and never touches the container's filesystem.
 *
 * start() also copies every docker/chip-test/*.pics file over the same-named file under /root/ in the
 * container, right alongside applying "patches" — the image already bakes in its own copy of each file at
 * build time (see §1 of the CHIP-test harness rules), but rebuilding and republishing the image is far more
 * expensive than a local .pics edit, so this keeps a freshly-started container always in sync with whatever
 * is checked in locally, the same way "patches" does for test files, without needing a manual `docker cp`
 * after every --start.
 */

/* oxlint-disable no-console */

import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const scriptVersion = '1.5.0';

const root = process.cwd();
const containerName = 'chip-test';
const image = 'luligu/matterbridge:chip-test';
// Image built locally by `npm run docker:build:local:chip-test`, used by `--start --local` (never pulled).
const localImage = 'matterbridge:chip-test';
const testsFile = path.resolve(root, 'chipTests.json');
const logFile = path.resolve(root, 'chipTests.log');
const summaryLogFile = path.resolve(root, 'chipTestsSummary.log');
// Local source of files named by chipTests.json's "patches" array, copied over the same-named file under
// remotePythonTestingDir/remoteCertificationDir in the container by applyPatches() — see the "patches" doc
// comment above.
const patchesDir = path.resolve(root, 'docker/chip-test/patches');
// Local source of the hand-verified PICS files (see §1 of the CHIP-test harness rules), copied over the
// same-named file under /root/ in the container by copyPicsFiles() — see the "patches" doc comment above.
const picsDir = path.resolve(root, 'docker/chip-test');
const remotePythonTestingDir = '/root/connectedhomeip/src/python_testing';
const remoteCertificationDir = '/root/connectedhomeip/src/app/tests/suites/certification';
// Node storage for the bridged endpoints; only stateful cluster attributes that get written during a
// test create a file here, so these globs only ever remove test-mutated state, never device identity.
const matterstorageRoot = '/root/.matterbridge/matterstorage/Matterbridge';
// The CHIP test app-pipe (createChipTestAppPipe() in chipTests.ts), used here to pin chipTests.ts's
// chipTestActiveEndpointId to a test's "endpoint" before it runs — see setActiveTestEndpoint() below.
const chipTestAppPipePath = '/tmp/matterbridge-chip-test-app-pipe';
// Printed once Matterbridge's root server node has finished coming online after a (re)start; polled from
// `docker logs` so the next test doesn't race a not-yet-ready device.
let readyLogMarker = 'Server node for Matterbridge is online';
// The image bakes in two already-commissioned fabrics against fixed, reusable pairing credentials (see
// docker/chip-test/pairing.json): chip-tool's own CLI ("alpha" commissioner identity) and the Python test
// framework's default_controller (its own separate admin_storage.json-backed fabric). Both conventionally
// use node id 112233 (kTestControllerNodeId) but are otherwise unrelated fabrics/root CAs.
const chipToolBin = '/root/connectedhomeip/out/host/chip-tool';
const dutNodeId = '0x12344321';
const fixedManualPairingCode = '31778512365'; // discriminator 3535 / passcode 20252025 — only valid once, from a fully decommissioned (0-fabric) device.
const fixedDiscriminator = '3535';
const commissioningWindowTimeoutSeconds = '300';
const commissioningWindowPakeIterations = '10000';
// --native: where the repo is copied in the container, the marker logged once the native root node is up, and
// the files and folders of the repo left out of the copy (rebuilt or reinstalled inside the container).
const nativeRemoteDir = '/root/matterbridge-native';
const nativeInitializedFile = `${nativeRemoteDir}/.native-initialized`;
const nativeReadyLogMarker = 'Matterbridge native started';
const nativeExcludes = new Set(['node_modules', '.git', 'coverage', 'temp', 'dist', 'heap_profiles', 'heap_snapshots']);
// The first start of a --native container removes all pairing data (the image's Matterbridge storage and the
// chip-tool and Python controller storage), installs the dependencies with the image's Bun, then runs the native root node.
// Later restarts (resetBefore/resetAfter) only run the native root node again.
// The chip-tool CLI storage (/tmp/chip_tool_*) and the Python controller storage (admin_storage.json and /tmp/chip_*).
const controllerStorage = '/root/connectedhomeip/admin_storage.json /tmp/chip_*';
const nativeCommand = [
  'set -e',
  `if [ ! -f ${nativeInitializedFile} ]; then`,
  `  rm -rf /root/.matterbridge ${controllerStorage}`,
  `  cd ${nativeRemoteDir} && bun install --frozen-lockfile`,
  `  touch ${nativeInitializedFile}`,
  'fi',
  `cd ${nativeRemoteDir}`,
  'exec bun run ./src/module.ts',
].join('\n');

/**
 * @typedef {object} ChipTest
 * @property {string} name Human-readable label.
 * @property {string} test Test identifier.
 * @property {number} [endpoint] Endpoint number.
 * @property {string[]} [args] Extra arguments.
 * @property {string} [comment] Comment shown in the summary.
 * @property {'python' | 'yaml'} kind Test kind.
 * @property {boolean} [skip] Skip the test.
 * @property {string} [input] Text piped to the test stdin.
 * @property {boolean} [resetBefore] Reset the cluster state before the test.
 * @property {boolean} [resetAfter] Reset the cluster state after the test.
 * @property {boolean} [unpairBefore] Unpair both fabrics before the test.
 * @property {boolean} [unpairAfter] Unpair both fabrics after the test.
 * @property {boolean | string} [pairBefore] Pair both fabrics before the test, with this manual pairing code when a string.
 * @property {boolean | string} [pairAfter] Pair both fabrics after the test, with this manual pairing code when a string.
 * @property {boolean} [revokeWindowBefore] Revoke the commissioning window before the test.
 * @property {boolean | string} [resetControllerBefore] Unpair, delete the controller storage and pair both fabrics again before the test,
 * with this manual pairing code when a string, else with the top-level "pairs" codes.
 */

/**
 * @typedef {object} TestResult
 * @property {string} label Result label.
 * @property {boolean} passed Whether the test passed.
 * @property {boolean} [skipped] Whether the test was skipped.
 * @property {string} [comment] Comment shown in the summary.
 * @property {number} [endpoint] Endpoint number.
 * @property {number} [durationMs] Test duration in milliseconds.
 */

/** @type {{ name: string, [key: string]: unknown } | undefined} */
let pluginConfig;
/** @type {string[]} */
let resetClusterGlobs = [];
/** @type {string[]} */
let patches = [];
/** @type {string[]} */
let pairs = [];
/** @type {ChipTest[]} */
let allTests = [];

class ExitError extends Error {
  /**
   * Create a CLI exit error.
   *
   * @param {string} message Error message.
   * @param {number} [code] Exit status.
   */
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

/**
 * Throw an ExitError.
 *
 * @param {string} message Error message.
 * @param {number} [code] Exit status.
 * @returns {never} Never returns.
 */
function fail(message, code = 1) {
  throw new ExitError(message, code);
}

/**
 * Run a command synchronously.
 *
 * @param {string} command Command to run.
 * @param {string[]} args Command arguments.
 * @param {{ capture?: boolean }} [options] Run options.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} The command result.
 */
function run(command, args, options = {}) {
  const { capture = false } = options;
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true,
  });

  if (result.error) {
    fail(`Failed to run "${command} ${args.join(' ')}": ${result.error.message}`);
  }

  return result;
}

/**
 * Run a command synchronously and fail on a non-zero exit status.
 *
 * @param {string} command Command to run.
 * @param {string[]} args Command arguments.
 * @param {{ capture?: boolean }} [options] Run options.
 * @returns {import('node:child_process').SpawnSyncReturns<string>} The command result.
 */
function runOrFail(command, args, options) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    fail(`Command failed (exit ${result.status}): ${command} ${args.join(' ')}`);
  }
  return result;
}

/**
 * Block the thread for the given time.
 *
 * @param {number} ms Milliseconds to sleep.
 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Matterbridge and chip-tool both colorize their log/console output with ANSI escapes even without a TTY,
// which can split matched text across escape sequences (e.g. "Matterbridge " <esc> "is online"); strip them
// before pattern-matching captured output.
/**
 * Remove ANSI escape sequences.
 *
 * @param {string} text Text to clean.
 * @returns {string} The text without ANSI escapes.
 */
function stripAnsi(text) {
  // oxlint-disable-next-line no-control-regex -- Matches the ANSI escape character.
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

function printHelp() {
  console.log(`run-chip-test.mjs v${scriptVersion}

Manage the luligu/matterbridge:chip-test docker container and run the Matter CHIP test suite defined in
chipTests.json.

Usage:
  bun scripts/run-chip-test.mjs --start          Create and start the chip-test container, then pair with "pairs".
  bun scripts/run-chip-test.mjs --start --local  Create and start the chip-test container from the local matterbridge:chip-test image (no pull).
  bun scripts/run-chip-test.mjs --start --native Copy this repo into the container and run it with Bun instead of the image's Matterbridge.
  bun scripts/run-chip-test.mjs --start --plugin Copy and register the prepared plugin in cwd (also accepts --local).
  bun scripts/run-chip-test.mjs --stop           Stop the chip-test container.
  bun scripts/run-chip-test.mjs                  Run the tests listed in chipTests.json inside the running container.
  bun scripts/run-chip-test.mjs --test NAME      Run only the tests whose "name" or "test" property includes NAME (case-insensitive).
  bun scripts/run-chip-test.mjs --help           Show this help.
  bun scripts/run-chip-test.mjs --version        Show the script version.`);
}

/**
 * Create and start the chip-test container.
 *
 * @param {boolean} [local] Use the locally built image.
 * @param {boolean} [plugin] Copy and register the plugin in cwd.
 * @param {boolean} [native] Copy this repo and run it instead of the image's Matterbridge.
 */
function start(local = false, plugin = false, native = false) {
  console.log('Removing any existing chip-test container...');
  run('docker', ['rm', containerName, '-f']);

  // A locally built image exists only in the local docker image store, so it is used as is, never pulled.
  const startImage = local ? localImage : image;
  if (local) {
    console.log(`Using the local ${startImage} image...`);
  } else {
    console.log(`Pulling ${startImage}...`);
    runOrFail('docker', ['pull', startImage]);
  }

  // The container needs an IPv6 link-local address (e.g. chip-tool's own traffic to fe80::.../UDP:5540), so
  // a plain IPv4-only network breaks it — create it with --ipv6 if a fresh host doesn't already have it.
  if (run('docker', ['network', 'inspect', 'matterbridge'], { capture: true }).status !== 0) {
    console.log('Creating the matterbridge docker network...');
    runOrFail('docker', ['network', 'create', '--ipv6', 'matterbridge']);
  }

  console.log(native ? 'Creating the chip-test container for the native root node...' : 'Starting the chip-test container...');
  runOrFail('docker', [
    native ? 'create' : 'run',
    native ? '-it' : '-dit',
    '--network',
    'matterbridge',
    '--restart',
    'unless-stopped',
    '--stop-timeout',
    '60',
    '--name',
    containerName,
    '-p',
    '8585:8283',
    '-v',
    `${path.join(root, 'temp')}:/tmp/matter_testing/logs`,
    // Opts in to createChipTestsDevices(), which — together with the image's
    // own baked-in MATTERBRIDGE_CHIP_TEST=1 (also read by the --native root node) — adds all device types under the aggregator endpoint.
    // Without this, the aggregator stays empty (Descriptor-only), as chipTests.md's Endpoint 1 section
    // previously documented.
    '-e',
    `MATTERBRIDGE_DEMO_DEVICES=${plugin ? '' : '1'}`,
    // --native replaces the image's `matterbridge --docker --novirtual` command with nativeCommand.
    ...(native ? ['-e', 'MATTERBRIDGE_INTERFACE=eth0', startImage, 'sh', '-c', nativeCommand] : [startImage]),
  ]);

  if (native) copyNativeRepo();
  const startedAt = new Date().toISOString();
  if (native) runOrFail('docker', ['start', containerName]);
  // The first native start installs the dependencies, so it gets a longer timeout.
  waitForContainerReady(startedAt, native ? 600000 : undefined);
  applyPatches();
  copyPicsFiles();
  if (plugin) addPlugin();
  pairOnStart();
  console.log('Chip-test container ready.');
}

/**
 * Copy this repo, without the excluded files and folders, into the created (not yet started) container.
 */
function copyNativeRepo() {
  console.log(`Copying ${root} into the container...`);
  const copyDir = mkdtempSync(path.join(tmpdir(), 'matterbridge-chip-native-'));
  try {
    const repoDir = path.join(copyDir, 'repo');
    cpSync(root, repoDir, {
      recursive: true,
      verbatimSymlinks: true,
      filter: (source) => {
        const name = path.basename(source);
        return !nativeExcludes.has(name) && !name.endsWith('.log') && !name.endsWith('.tsbuildinfo');
      },
    });
    runOrFail('docker', ['cp', `${repoDir}/.`, `${containerName}:${nativeRemoteDir}`]);
  } finally {
    rmSync(copyDir, { recursive: true, force: true });
  }
}

// Copies each file named in chipTests.json's "patches" array from docker/chip-test/patches/ over the
// same-named file in the container — under remotePythonTestingDir for a ".py" patch (a Python test), or
// remoteCertificationDir for anything else (a YAML certification test) — see the "patches" doc comment above.
function applyPatches() {
  for (const patch of patches) {
    console.log(`Applying patch ${patch}...`);
    const localPath = path.join(patchesDir, patch);
    const remoteDir = patch.endsWith('.py') ? remotePythonTestingDir : remoteCertificationDir;
    runOrFail('docker', ['cp', localPath, `${containerName}:${remoteDir}/${patch}`]);
  }
}

// Copies every docker/chip-test/*.pics file over the same-named file under /root/ in the container, so a
// freshly-started container always picks up local .pics edits without a separate manual `docker cp` step —
// see the "patches" doc comment above.
function copyPicsFiles() {
  if (!existsSync(picsDir)) return;
  const picsFiles = readdirSync(picsDir).filter((name) => name.endsWith('.pics'));
  for (const picsFile of picsFiles) {
    console.log(`Copying PICS file ${picsFile}...`);
    const localPath = path.join(picsDir, picsFile);
    runOrFail('docker', ['cp', localPath, `${containerName}:/root/${picsFile}`]);
  }
}

// Copies the already-built plugin and its test configuration, then registers it before restarting.
function addPlugin() {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- loadChipTestsFile(true) has already validated "config" before start() calls this.
  const config = /** @type {{ name: string, [key: string]: unknown }} */ (pluginConfig);
  const pluginName = config.name;
  const remoteDir = `/root/Matterbridge/${pluginName}`;
  console.log(`Copying plugin ${pluginName} into the container...`);
  runOrFail('docker', ['exec', containerName, 'mkdir', '-p', remoteDir, '/root/.matterbridge']);
  const configDir = mkdtempSync(path.join(tmpdir(), 'matterbridge-chip-plugin-'));
  try {
    const pluginDir = path.join(configDir, 'plugin');
    const localMatterbridge = path.join(root, 'node_modules', 'matterbridge');
    cpSync(root, pluginDir, { recursive: true, verbatimSymlinks: true, filter: (source) => source !== localMatterbridge });
    runOrFail('docker', ['cp', `${pluginDir}/.`, `${containerName}:${remoteDir}`]);
    const configPath = path.join(configDir, `${pluginName}.config.json`);
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    runOrFail('docker', ['cp', configPath, `${containerName}:/root/.matterbridge/${pluginName}.config.json`]);
  } finally {
    rmSync(configDir, { recursive: true, force: true });
  }
  runOrFail('docker', ['exec', containerName, 'matterbridge', '--add', pluginName]);
  readyLogMarker = `Configured plugin ${pluginName} type `;
  const restartedAt = new Date().toISOString();
  runOrFail('docker', ['restart', containerName]);
  waitForContainerReady(restartedAt);
}

function stop() {
  console.log('Stopping the chip-test container...');
  run('docker', ['stop', containerName]);
  console.log('Chip-test container stopped.');
}

// Waits for matterbridge to finish (re)commissioning its server node after a (re)start by polling the
// container logs (only lines emitted since `sinceIso`) for readyLogMarker, so the next test doesn't race a
// not-yet-ready device. `docker logs` is cumulative for the container's whole lifetime, so without a
// `--since` anchor a second/subsequent restart would immediately re-match the marker line left over from
// an earlier boot still sitting in the tail window, returning a false "ready" before the new boot actually
// gets there.
/**
 * Wait until the container logs the ready marker.
 *
 * @param {string} sinceIso ISO timestamp passed to docker logs --since.
 * @param {number} [timeoutMs] Timeout in milliseconds.
 * @param {number} [pollMs] Poll interval in milliseconds.
 */
function waitForContainerReady(sinceIso, timeoutMs = 45000, pollMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = run('docker', ['logs', '--since', sinceIso, containerName], { capture: true });
    const plainOutput = stripAnsi(`${result.stdout ?? ''}${result.stderr ?? ''}`);
    if (plainOutput.includes(readyLogMarker)) {
      return;
    }
    sleepSync(pollMs);
  }
  console.warn(`Timed out waiting for "${readyLogMarker}" in container logs; continuing anyway.`);
}

// Clears persisted stateful cluster storage and restarts the container (docker restart, not a full
// recreate: no docker rm/pull), so tests that need a clean, un-allocated device state can run fast without
// paying the full --start cost between every test. The container restart alone already clears any cluster
// state that's kept purely in memory and never written to disk — resetClusterGlobs only needs entries for
// state that *is* persisted and would otherwise survive the restart.
function resetContainerState() {
  if (resetClusterGlobs.length === 0) {
    fail(`A test set "resetBefore": true or "resetAfter": true, but ${testsFile} has no (or an empty) "resetClusterGlobs" array to clear.`);
  }

  console.log('Resetting stateful cluster storage...');
  const findExpr = resetClusterGlobs.map((glob) => `-name '${glob}'`).join(' -o ');
  run('docker', ['exec', containerName, 'sh', '-c', `find ${matterstorageRoot} -type f \\( ${findExpr} \\) -delete`]);

  restartContainer();
}

/**
 * Restart the container and wait for the node to be online again.
 */
function restartContainer() {
  // A container started with --native logs the native ready marker instead of Matterbridge's.
  if (isNativeContainer()) readyLogMarker = nativeReadyLogMarker;
  console.log('Restarting matterbridge...');
  const restartedAt = new Date().toISOString();
  runOrFail('docker', ['restart', containerName]);
  waitForContainerReady(restartedAt);
}

// Pins chipTests.ts's chipTestActiveEndpointId to `endpointId` (or clears it when undefined) by writing a
// "SetTestEndpoint" command into the CHIP test app-pipe, so GeneralDiagnostics.TestEventTrigger handlers with
// no endpoint field of their own can target the one endpoint the running test actually names in its "endpoint"
// field, instead of broadcasting to every candidate endpoint. Called before every test (see runTests()), even
// one with no "endpoint" set, so a pin from a previous test never leaks into one that doesn't expect it.
/**
 * Pin the active test endpoint through the app-pipe.
 *
 * @param {number | undefined} endpointId Endpoint id, or undefined to clear the pin.
 */
function setActiveTestEndpoint(endpointId) {
  const command = endpointId === undefined ? { Name: 'SetTestEndpoint' } : { Name: 'SetTestEndpoint', EndpointId: endpointId };
  run('docker', ['exec', containerName, 'sh', '-c', `printf '%s\\n' '${JSON.stringify(command)}' > ${chipTestAppPipePath}`]);
}

// Fallback of unpairFabrics() when chip-tool's alpha fabric is not paired, so it cannot remove the Python test
// framework's fabric: the default_controller keeps its own fabric in admin_storage.json, separate from chip-tool
// CLI's storage, so this throwaway script (copied in, run, deleted) calls ChipDeviceController.UnpairDevice().
// The script skips the wildcard subscription and the DUT cleanup of MatterBaseTest: after the RemoveFabric both would
// run over the removed fabric (ACL restore and reachability check) and wait for their timeouts, about 20 s in all.
const unpairPythonFabricScript = `import matter.clusters as Clusters
from matter.testing.decorators import async_test_body
from matter.testing.matter_testing import MatterBaseTest
from matter.testing.runner import default_matter_test_main

class UnpairDefaultFabric(MatterBaseTest):
    # No wildcard subscription: restoring its ACL entry over the removed fabric would wait 10 s.
    disable_wildcard_subscription = True

    @async_test_body
    async def test_unpair(self):
        # Expire a fail-safe the last test left armed (TC_CGEN_2_6 fails CommissioningComplete on purpose): its expiry reverts the
        # pending fabric, and the next commissioning would otherwise get BusyWithOtherAdmin. Without an armed fail-safe it does nothing.
        # The 5 s timeout bounds the operational discovery (45 s) when this fabric is not on the node: then there is nothing to unpair.
        try:
            await self.default_controller.SendCommand(self.dut_node_id, 0, Clusters.GeneralCommissioning.Commands.ArmFailSafe(expiryLengthSeconds=0, breadcrumb=0), interactionTimeoutMs=5000)
        except Exception as error:
            print(f"ArmFailSafe(0) failed, the fabric is not on the node: {error}")
            return
        try:
            await self.default_controller.UnpairDevice(self.dut_node_id)
        except Exception as error:
            # The expired fail-safe already removed a pending fabric.
            print(f"UnpairDevice failed: {error}")
        # The fabric is removed: no DUT baseline, so the framework cleanup skips its 10 s reachability check.
        self._original_acl = None

if __name__ == "__main__":
    default_matter_test_main()
`;

/**
 * Read fabric indexes of the DUT from chip-tool's alpha fabric.
 *
 * @param {string[]} attribute The OperationalCredentials attribute to read, followed by any extra chip-tool arguments.
 * @param {RegExp} pattern A global pattern whose first group is a fabric index in chip-tool's output.
 * @returns {number[]} The fabric indexes, empty when the read fails (e.g. alpha is not paired).
 */
function readFabricIndexes([attribute, ...extra], pattern) {
  // --timeout 5: when alpha is not on the node, chip-tool would otherwise wait 45 s for the operational discovery to time out.
  const result = run(
    'docker',
    ['exec', containerName, chipToolBin, 'operationalcredentials', 'read', attribute, dutNodeId, '0', ...extra, '--commissioner-name', 'alpha', '--timeout', '5'],
    { capture: true },
  );
  return [...stripAnsi(`${result.stdout ?? ''}${result.stderr ?? ''}`).matchAll(pattern)].map((match) => Number(match[1]));
}

// Removes both of the image's baked-in fabrics (chip-tool CLI's "alpha" identity and the Python test
// framework's default_controller), leaving Matterbridge fully decommissioned and advertising commissionable
// again under the fixed factory pairing code (see docker/chip-test/pairing.json) — the only state
// `pairFabrics()` can re-pair from. Alpha removes every other fabric with RemoveFabric (reading the unfiltered
// Fabrics list), then unpairs itself: a few chip-tool calls. The Python controller's UnpairDevice() is the fallback
// when alpha is not paired, detected by the 5 s --timeout of the alpha read. Tolerant of a fabric already being absent
// (e.g. a previous run left things partially decommissioned), since `run()` here doesn't fail the script on a
// nonzero exit.
function unpairFabrics() {
  const [ownFabricIndex] = readFabricIndexes(['current-fabric-index'], /CurrentFabricIndex:\s*(\d+)/g);
  if (ownFabricIndex === undefined) {
    console.log('The chip-tool (alpha) fabric is not paired: unpairing the Python test-framework fabric with its own controller...');
    const scriptPath = path.join(tmpdir(), 'matterbridge-chip-unpair-fabric.py');
    writeFileSync(scriptPath, unpairPythonFabricScript);
    const remoteScript = 'src/python_testing/__unpair_default_fabric.py';
    runOrFail('docker', ['cp', scriptPath, `${containerName}:/root/connectedhomeip/${remoteScript}`]);
    run('docker', ['exec', containerName, 'python3', remoteScript]);
    run('docker', ['exec', containerName, 'rm', '-f', remoteScript]);
    return;
  }
  for (const fabricIndex of readFabricIndexes(['fabrics', '--fabric-filtered', '0'], /\bFabricIndex:\s*(\d+)/g)) {
    if (fabricIndex === ownFabricIndex) continue;
    console.log(`Removing fabric ${fabricIndex} from the chip-tool (alpha) fabric...`);
    run('docker', ['exec', containerName, chipToolBin, 'operationalcredentials', 'remove-fabric', String(fabricIndex), dutNodeId, '0', '--commissioner-name', 'alpha']);
  }
  console.log('Unpairing the chip-tool (alpha) fabric...');
  run('docker', ['exec', containerName, chipToolBin, 'pairing', 'unpair', dutNodeId, '--commissioner-name', 'alpha']);
}

// Re-pairs both fabrics from a fully decommissioned (0-fabric) device: first chip-tool's "alpha" identity
// using the fixed factory pairing code (only valid once, from 0 fabrics), then — since a commissioning
// window closes as soon as one commissioning succeeds — has alpha open a fresh Enhanced Commissioning window
// and parses the one-time manual pairing code chip-tool prints for it, to commission the Python test
// framework's fabric through that window.
/**
 * Check whether the running container was started with --native.
 *
 * @returns {boolean} Whether the container runs the native root node.
 */
function isNativeContainer() {
  return run('docker', ['exec', containerName, 'test', '-f', nativeInitializedFile], { capture: true }).status === 0;
}

/**
 * Pair both fabrics at --start with the first of the top-level "pairs" codes that commissions.
 * Skipped when "pairs" is empty or alpha is already paired (the image's baked-in fabrics).
 */
function pairOnStart() {
  if (pairs.length === 0) return;
  if (readFabricIndexes(['current-fabric-index'], /CurrentFabricIndex:\s*(\d+)/g).length > 0) {
    console.log('The chip-tool (alpha) fabric is already paired: skipping "pairs".');
    return;
  }
  pairFabrics(pairs);
}

/**
 * Pair the chip-tool (alpha) and the Python test framework fabrics.
 *
 * @param {boolean | string | string[]} pair The "pairBefore"/"pairAfter" value: a manual pairing code, or true for the image's fixed one;
 * or the "pairs" codes, tried in order until alpha commissions.
 */
function pairFabrics(pair) {
  const manualPairingCodes = Array.isArray(pair) ? pair : [typeof pair === 'string' ? pair : fixedManualPairingCode];
  // The native root node requires the Terms and Conditions version 1 and acknowledgements 1 in the chip-test image (TC_CGEN_2_5 ... 2_11):
  // the commissioner sends SetTCAcknowledgements whenever they are given, so they are given only to the native node.
  const tcArgs = isNativeContainer() ? ['--tc-acknowledgements', '1', '--tc-acknowledgements-version', '1'] : [];
  const paired = manualPairingCodes.some((manualPairingCode) => {
    console.log(`Pairing the chip-tool (alpha) fabric with the manual pairing code ${manualPairingCode}...`);
    return run('docker', ['exec', containerName, chipToolBin, 'pairing', 'code', dutNodeId, manualPairingCode, ...tcArgs, '--commissioner-name', 'alpha']).status === 0;
  });
  if (!paired) fail(`Could not pair the chip-tool (alpha) fabric with the manual pairing code ${manualPairingCodes.join(', ')}.`);

  console.log('Opening a new commissioning window from the alpha fabric...');
  const openResult = runOrFail(
    'docker',
    [
      'exec',
      containerName,
      chipToolBin,
      'pairing',
      'open-commissioning-window',
      dutNodeId,
      '1', // Enhanced Commissioning Method — Basic (0) needs the BC feature, which Matterbridge doesn't implement.
      commissioningWindowTimeoutSeconds,
      commissioningWindowPakeIterations,
      fixedDiscriminator,
      '--commissioner-name',
      'alpha',
    ],
    { capture: true },
  );
  const plainOutput = stripAnsi(`${openResult.stdout ?? ''}${openResult.stderr ?? ''}`);
  const match = plainOutput.match(/Manual pairing code:\s*\[(\d+)\]/);
  if (!match) {
    fail("Could not parse the freshly-opened commissioning window's manual pairing code from chip-tool output.");
  }

  console.log("Pairing the Python test-framework fabric through alpha's freshly-opened window...");
  runOrFail('docker', [
    'exec',
    containerName,
    'python3',
    'src/python_testing/TC_DeviceBasicComposition.py',
    '--commission-only',
    '--commissioning-method',
    'on-network',
    '--manual-code',
    match[1],
    '--dut-node-id',
    dutNodeId,
  ]);
}

// Closes any commissioning window left open by a previous test (e.g. one that opens a window as part of its
// own steps and doesn't revoke it), without touching either fabric — much cheaper than unpairFabrics()
// + pairFabrics() for this specific residue. RevokeCommissioning requires a timed invoke and works from any
// admin fabric, not just the one that opened the window, so alpha can always issue it. Tolerant of there
// being no window open (nonzero exit from `run()` here doesn't fail the script).
function revokeCommissioningWindow() {
  console.log('Revoking any open commissioning window...');
  run('docker', [
    'exec',
    containerName,
    chipToolBin,
    'administratorcommissioning',
    'revoke-commissioning',
    dutNodeId,
    '0',
    '--commissioner-name',
    'alpha',
    '--timedInteractionTimeoutMs',
    '5000',
  ]);
}

/**
 * Unpair every fabric of the DUT, delete the chip-tool and Python controller storage, restart the DUT, then pair both fabrics again.
 * The restart with no fabrics starts the fabric indexes of the DUT again at 1, as after --start: alpha is fabric 1 and the Python fabric 2.
 *
 * @param {boolean | string} pair The "resetControllerBefore" value: a manual pairing code, or true for the top-level "pairs" codes
 * (the image's fixed one when "pairs" is empty).
 */
function resetControllers(pair) {
  unpairFabrics();
  console.log('Deleting the chip-tool and Python controller storage...');
  runOrFail('docker', ['exec', containerName, 'sh', '-c', `rm -rf ${controllerStorage}`]);
  restartContainer();
  pairFabrics(typeof pair === 'string' || pairs.length === 0 ? pair : pairs);
}

// Reads chipTests.json once, populating resetClusterGlobs/allTests. Must run before anything that
// references those, so it's the first thing main() does.
function loadChipTestsFile(plugin = false) {
  let raw;
  try {
    raw = readFileSync(testsFile, 'utf8');
  } catch (error) {
    fail(`Unable to read ${testsFile}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const parsed = JSON.parse(raw);
  if (plugin) {
    pluginConfig = parsed.config;
    if (!pluginConfig || typeof pluginConfig.name !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(pluginConfig.name)) {
      fail(`Expected a "config" object with a valid plugin "name" in ${testsFile}`);
    }
    const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (packageJson.name !== pluginConfig.name) {
      fail(`Plugin package name must match config.name (${pluginConfig.name}) in ${testsFile}`);
    }
  }

  resetClusterGlobs = parsed.resetClusterGlobs ?? [];
  if (!Array.isArray(resetClusterGlobs)) {
    fail(`Expected "resetClusterGlobs" to be an array in ${testsFile}`);
  }

  patches = parsed.patches ?? [];
  if (!Array.isArray(patches)) {
    fail(`Expected "patches" to be an array in ${testsFile}`);
  }

  pairs = parsed.pairs ?? [];
  if (!Array.isArray(pairs) || pairs.some((code) => typeof code !== 'string')) {
    fail(`Expected "pairs" to be an array of manual pairing code strings in ${testsFile}`);
  }

  const tests = parsed.tests ?? [];
  if (!Array.isArray(tests)) {
    fail(`Expected "tests" to be an array in ${testsFile}`);
  }

  for (const test of tests) {
    if (!test.test) {
      fail(`Missing "test" name for entry ${JSON.stringify(test)} in ${testsFile}`);
    }
  }

  // A "test" filename ending in ".py" is a Python test (src/python_testing/<test>); anything else is a YAML
  // certification test name run through chip-tool's websocket test runner.
  allTests = tests.map((test) => ({ ...test, kind: test.test.endsWith('.py') ? 'python' : 'yaml' }));
}

/**
 * Build the endpoint and extra arguments of a test.
 *
 * @param {ChipTest} test Test entry.
 * @returns {string[]} The arguments.
 */
function buildArgs(test) {
  const scriptArgs = [];
  if (test.endpoint !== undefined) {
    scriptArgs.push('--endpoint', String(test.endpoint));
  }
  for (const entry of test.args ?? []) {
    scriptArgs.push(...entry.split(/\s+/).filter(Boolean));
  }
  return scriptArgs;
}

// Builds the argv (after "docker exec -i containerName") for a single test, dispatching on test.kind:
//   - "python": python3 src/python_testing/<test.test> <args...>
//   - "yaml":   python3 scripts/tests/chipyaml/chiptool.py tests <test.test> <args...>
//               Spawns a short-lived "chip-tool interactive server" for the duration of this one test,
//               reusing chip-tool's own persisted fabric pairing baked into the image.
/**
 * Build the docker exec argv of a test.
 *
 * @param {ChipTest} test Test entry.
 * @returns {string[]} The argv.
 */
function buildExecArgs(test) {
  const args = buildArgs(test);
  if (test.kind === 'yaml') {
    return ['python3', 'scripts/tests/chipyaml/chiptool.py', 'tests', test.test, ...args];
  }
  return ['python3', `src/python_testing/${test.test}`, ...args];
}

/**
 * Filter the tests by name or test identifier.
 *
 * @param {ChipTest[]} tests Tests to filter.
 * @param {string | undefined} nameFilter Case-insensitive substring.
 * @returns {ChipTest[]} The matching tests.
 */
function filterTests(tests, nameFilter) {
  if (!nameFilter) {
    return tests;
  }

  const needle = nameFilter.toLowerCase();
  const filtered = tests.filter((test) => test.name.toLowerCase().includes(needle) || test.test.toLowerCase().includes(needle));
  if (filtered.length === 0) {
    fail(`No test found with "name" or "test" including ${JSON.stringify(nameFilter)}`);
  }
  return filtered;
}

// The compact ✅/❌/⏭️ line(s) for one test result, shared between the live per-test append to summaryLogFile
// and the final recap block written to both log files.
/**
 * Format the summary line(s) of a result.
 *
 * @param {TestResult} result Test result.
 * @returns {string[]} The summary lines.
 */
function formatResultLines(result) {
  const icon = result.skipped ? '⏭️' : result.passed ? '✅' : '❌';
  // Endpoint (when the entry pins one) and the duration of the test run itself, excluding the before/after steps.
  const details = [];
  if (result.endpoint !== undefined) details.push(`endpoint ${result.endpoint}`);
  if (result.durationMs !== undefined) details.push(formatDuration(result.durationMs));
  const line = `${icon} ${result.label}${details.length ? ` [${details.join(', ')}]` : ''}`;
  return (result.skipped || !result.passed) && result.comment ? [line, `   ↳ ${result.comment}`] : [line];
}

// Formats a millisecond duration as "1h 02m 03s", omitting leading zero-valued units.
/**
 * Format a duration.
 *
 * @param {number} ms Duration in milliseconds.
 * @returns {string} The formatted duration.
 */
function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (hours > 0 || minutes > 0) parts.push(`${minutes.toString().padStart(hours > 0 ? 2 : 1, '0')}m`);
  parts.push(`${seconds.toString().padStart(hours > 0 || minutes > 0 ? 2 : 1, '0')}s`);
  return parts.join(' ');
}

/**
 * Run the selected tests.
 *
 * @param {string} [nameFilter] Case-insensitive substring.
 */
function runTests(nameFilter) {
  const tests = filterTests(allTests, nameFilter);
  const startTime = Date.now();
  const startedAt = `Chip tests run started at ${new Date(startTime).toISOString()}\n\n`;
  writeFileSync(logFile, startedAt);
  // Written incrementally (header now, one result appended as each test finishes, final status appended last)
  // rather than only at the end, so a run that's killed or times out partway through still leaves a readable,
  // up-to-date summary instead of an empty or stale file.
  writeFileSync(summaryLogFile, startedAt);

  /** @type {TestResult[]} */
  const results = [];
  for (const test of tests) {
    const label = `${test.name} (${test.test})`;

    if (test.skip) {
      console.log(`SKIP: ${label}`);
      appendFileSync(logFile, `=== ${label} ===\nSkipped ("skip": true set in ${testsFile})\n\n`);
      const testResult = { label, passed: false, skipped: true, comment: test.comment, endpoint: test.endpoint };
      results.push(testResult);
      appendFileSync(summaryLogFile, `${formatResultLines(testResult).join('\n')}\n`);
      continue;
    }

    const execArgs = buildExecArgs(test);
    const commandLine = execArgs.join(' ');

    if (test.resetBefore) {
      appendFileSync(logFile, `--- reset stateful cluster storage before ${label} ---\n`);
      resetContainerState();
    }

    if (test.resetControllerBefore) {
      appendFileSync(logFile, `--- reset the controllers and pair both fabrics again before ${label} ---\n`);
      resetControllers(test.resetControllerBefore);
    }
    if (test.unpairBefore) {
      appendFileSync(logFile, `--- unpair both fabrics before ${label} ---\n`);
      unpairFabrics();
    }
    if (test.pairBefore) {
      appendFileSync(logFile, `--- pair both fabrics before ${label} ---\n`);
      pairFabrics(test.pairBefore);
    }
    if (test.revokeWindowBefore) {
      appendFileSync(logFile, `--- revoke any open commissioning window before ${label} ---\n`);
      revokeCommissioningWindow();
    }

    appendFileSync(logFile, `--- pin active test endpoint to ${test.endpoint ?? 'none'} before ${label} ---\n`);
    setActiveTestEndpoint(test.endpoint);

    console.log(`Running: ${label}`);
    appendFileSync(logFile, `=== ${label} ===\n${commandLine}\n`);

    const testStartTime = Date.now();
    const result = spawnSync('docker', ['exec', '-i', containerName, ...execArgs], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      input: test.input ?? '',
      // Some tests (e.g. TC_DeviceBasicComposition.py, which logs the entire read-out device composition
      // tree) produce well over Node's default 1MB maxBuffer, which otherwise kills the child and returns
      // status: null with error.code 'ENOBUFS' instead of a real exit code — indistinguishable from a crash
      // in the summary log without inspecting result.error.
      maxBuffer: Infinity,
    });
    const durationMs = Date.now() - testStartTime;

    appendFileSync(logFile, `${result.stdout ?? ''}${result.stderr ?? ''}\n`);

    const passed = result.status === 0;
    appendFileSync(logFile, `Result: ${passed ? 'PASS' : 'FAIL'} (exit ${result.status})\n\n`);
    console.log(passed ? `PASS: ${label}` : `FAIL: ${label} (exit ${result.status})`);

    const testResult = { label, passed, comment: test.comment, endpoint: test.endpoint, durationMs };
    results.push(testResult);
    appendFileSync(summaryLogFile, `${formatResultLines(testResult).join('\n')}\n`);

    if (test.resetAfter) {
      appendFileSync(logFile, `--- reset stateful cluster storage after ${label} ---\n`);
      resetContainerState();
    }

    if (test.unpairAfter) {
      appendFileSync(logFile, `--- unpair both fabrics after ${label} ---\n`);
      unpairFabrics();
    }
    if (test.pairAfter) {
      appendFileSync(logFile, `--- pair both fabrics after ${label} ---\n`);
      pairFabrics(test.pairAfter);
    }
  }

  const executedResults = results.filter((result) => !result.skipped);
  const skippedCount = results.length - executedResults.length;
  const passedCount = executedResults.filter((result) => result.passed).length;
  const resultLines = results.flatMap(formatResultLines);
  const summary = `Summary: ${passedCount}/${executedResults.length} tests passed${skippedCount ? ` (${skippedCount} skipped)` : ''}.`;

  const endedAt = `Chip tests run ended at ${new Date().toISOString()} (total duration ${formatDuration(Date.now() - startTime)})\n`;
  appendFileSync(logFile, `${resultLines.join('\n')}\n\n${summary}\n${endedAt}`);
  appendFileSync(summaryLogFile, `\n${summary}\n${endedAt}`);
  console.log(resultLines.join('\n'));
  console.log(summary);

  const unexpectedFailures = executedResults.filter((result) => !result.passed && !result.comment);
  if (unexpectedFailures.length > 0) {
    process.exitCode = 1;
  }
}

/**
 * Dispatch the command line arguments.
 *
 * @param {string[]} args Command line arguments.
 */
function cli(args) {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(scriptVersion);
    return;
  }

  const plugin = args.includes('--plugin');
  if (plugin && !args.includes('--start')) fail('--plugin requires --start');
  if (args.includes('--native') && !args.includes('--start')) fail('--native requires --start');
  if (args.includes('--native') && plugin) fail('--native cannot be combined with --plugin');
  loadChipTestsFile(plugin);

  if (args.includes('--start')) {
    const native = args.includes('--native');
    if (native) readyLogMarker = nativeReadyLogMarker;
    start(args.includes('--local'), plugin, native);
    return;
  }

  if (args.includes('--stop')) {
    stop();
    return;
  }

  const testFlagIndex = args.indexOf('--test');
  if (testFlagIndex === -1) {
    runTests();
    return;
  }

  const nameFilter = args[testFlagIndex + 1];
  if (!nameFilter) {
    fail('--test requires a NAME argument');
  }
  runTests(nameFilter);
}

/**
 * Run the CLI.
 *
 * @param {string[]} [args] Command line arguments, without the runtime and script paths.
 * @returns {number} The exit code.
 */
export function main(args = process.argv.slice(2)) {
  try {
    cli(args);
    return typeof process.exitCode === 'number' ? process.exitCode : 0;
  } catch (error) {
    if (error instanceof ExitError) {
      if (error.message) console.error(error.message);
      return error.code;
    }
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

// `import.meta.main` needs Node.js 22.18 or 24.2; older runtimes fall back to comparing the executed script path.
if (import.meta.main ?? path.resolve(process.argv[1] ?? '') === import.meta.filename) process.exitCode = main();
