/**
 * run-matterbridge-chip-tests.mjs
 * Version: 1.0.0
 *
 * Manage the `luligu/matterbridge:chip-test` docker container and run the Matter CHIP test suite defined
 * in chipTests.json, logging full results to chipTests.log and just the pass/fail summary to
 * chipTestsSummary.log. The image already bundles a full Matterbridge instance (built from the `dev`
 * branch at image-build time) started with `--novirtual`, so there is nothing to install, build, or add
 * here: `--start` just brings the container up and waits for Matterbridge's root server node to come
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
 *   "args"                 (optional) Array of strings, each split on whitespace and appended as CLI args
 *                          after the test name, e.g. ["--endpoint 0", "--PICS /root/matterbridge.pics"].
 *   "input"                (optional) String piped to the test's stdin, for tests that prompt for
 *                          interactive confirmation (for example "y\ny\n").
 *   "skip"                 (optional) true to keep the entry listed (documenting that it exists and why it
 *                          doesn't run) without ever invoking it — see below.
 *   "comment"              (optional) Free text printed under a failing/skipped result in the summary log.
 *   "resetBefore"/"resetAfter"   (optional) Clear resetClusterGlobs and restart the container before/after
 *                          this test — see below.
 *   "unpairBefore"/"pairBefore"/"unpairAfter"/"pairAfter"   (optional) Decommission/re-commission both
 *                          baked-in fabrics before/after this test — see below.
 *   "revokeWindowBefore"   (optional) Revoke any commissioning window left open by a previous test — see
 *                          below.
 *
 * Usage:
 *   node scripts/run-matterbridge-chip-tests.mjs --start          Create and start the chip-test container.
 *   node scripts/run-matterbridge-chip-tests.mjs --stop           Stop the chip-test container.
 *   node scripts/run-matterbridge-chip-tests.mjs                  Run the tests listed in chipTests.json inside the running container.
 *   node scripts/run-matterbridge-chip-tests.mjs --test NAME       Run only the tests whose "name" or "test" property includes NAME (case-insensitive).
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
 * which a plain restart can't provide since Matterbridge's event log and fabric table survive it. Pairing
 * back both fabrics takes two steps because a commissioning window closes as soon as one commissioning
 * succeeds: chip-tool's "alpha" re-pairs first with the fixed factory code (only valid from a fully
 * decommissioned, 0-fabric device), then alpha opens a fresh Enhanced Commissioning window whose one-time
 * manual code (parsed from chip-tool's own output) commissions the Python fabric. Order within a single test
 * entry is unpairBefore → pairBefore → revokeWindowBefore → (test runs) → unpairAfter → pairAfter.
 *
 * A chipTests.json entry may also set "revokeWindowBefore": true — a much cheaper alternative to
 * unpairBefore/pairBefore for one specific kind of residue: a previous test that opens a commissioning
 * window (e.g. via AdministratorCommissioning) as part of its own steps and doesn't revoke it afterwards.
 * A window left open blocks ArmFailSafe ("kBusyWithOtherAdmin") for any later test that needs one, so
 * revokeWindowBefore sends RevokeCommissioning (from alpha, which works regardless of which fabric opened
 * the window) to close it without touching either fabric's pairing.
 */

/* eslint-disable no-console */

import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const scriptVersion = '1.0.0';

const root = process.cwd();
const containerName = 'chip-test';
const image = 'luligu/matterbridge:chip-test';
const testsFile = resolve(root, 'chipTests.json');
const logFile = resolve(root, 'chipTests.log');
const summaryLogFile = resolve(root, 'chipTestsSummary.log');
// Node storage for the bridged endpoints; only stateful cluster attributes that get written during a
// test create a file here, so these globs only ever remove test-mutated state, never device identity.
const matterstorageRoot = '/root/.matterbridge/matterstorage/Matterbridge';
// Printed once Matterbridge's root server node has finished coming online after a (re)start; polled from
// `docker logs` so the next test doesn't race a not-yet-ready device.
const readyLogMarker = 'Server node for Matterbridge is online';
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

let resetClusterGlobs;
let allTests;

class ExitError extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

function fail(message, code = 1) {
  throw new ExitError(message, code);
}

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

function runOrFail(command, args, options) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    fail(`Command failed (exit ${result.status}): ${command} ${args.join(' ')}`);
  }
  return result;
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Matterbridge and chip-tool both colorize their log/console output with ANSI escapes even without a TTY,
// which can split matched text across escape sequences (e.g. "Matterbridge " <esc> "is online"); strip them
// before pattern-matching captured output.
function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

function printHelp() {
  console.log(`run-matterbridge-chip-tests.mjs v${scriptVersion}

Manage the luligu/matterbridge:chip-test docker container and run the Matter CHIP test suite defined in
chipTests.json.

Usage:
  node scripts/run-matterbridge-chip-tests.mjs --start          Create and start the chip-test container.
  node scripts/run-matterbridge-chip-tests.mjs --stop           Stop the chip-test container.
  node scripts/run-matterbridge-chip-tests.mjs                  Run the tests listed in chipTests.json inside the running container.
  node scripts/run-matterbridge-chip-tests.mjs --test NAME      Run only the tests whose "name" or "test" property includes NAME (case-insensitive).
  node scripts/run-matterbridge-chip-tests.mjs --help           Show this help.
  node scripts/run-matterbridge-chip-tests.mjs --version        Show the script version.`);
}

function start() {
  console.log('Removing any existing chip-test container...');
  run('docker', ['rm', containerName, '-f']);

  console.log(`Pulling ${image}...`);
  runOrFail('docker', ['pull', image]);

  // The container needs an IPv6 link-local address (e.g. chip-tool's own traffic to fe80::.../UDP:5540), so
  // a plain IPv4-only network breaks it — create it with --ipv6 if a fresh host doesn't already have it.
  if (run('docker', ['network', 'inspect', 'matterbridge'], { capture: true }).status !== 0) {
    console.log('Creating the matterbridge docker network...');
    runOrFail('docker', ['network', 'create', '--ipv6', 'matterbridge']);
  }

  console.log('Starting the chip-test container...');
  const startedAt = new Date().toISOString();
  runOrFail('docker', [
    'run',
    '-dit',
    '--network',
    'matterbridge',
    '--restart',
    'always',
    '--stop-timeout',
    '60',
    '--name',
    containerName,
    '-p',
    '8585:8283',
    '-v',
    `${join(root, 'temp')}:/tmp/matter_testing/logs`,
    // Opts in to createChipTestsDevices(), which — together with the image's
    // own baked-in MATTERBRIDGE_CHIP_TEST=1 — adds all device types under the aggregator endpoint.
    // Without this, the aggregator stays empty (Descriptor-only), as chipTests.md's Endpoint 1 section
    // previously documented.
    '-e',
    'MATTERBRIDGE_CHIP_TEST_DEVICES=1',
    image,
  ]);

  waitForContainerReady(startedAt);
  console.log('Chip-test container ready.');
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

  console.log('Restarting matterbridge...');
  const restartedAt = new Date().toISOString();
  runOrFail('docker', ['restart', containerName]);
  waitForContainerReady(restartedAt);
}

// The Python test framework's default_controller keeps its own fabric in admin_storage.json, separate from
// chip-tool CLI's storage, so there's no raw `chip-tool pairing unpair` equivalent for it — this throwaway
// script (copied in, run, deleted, per the "map a plugin's endpoints" pattern in
// .claude/rules/chip-tests/chip-tests.instructions.md §4) calls ChipDeviceController.UnpairDevice() instead.
const unpairPythonFabricScript = `from matter.testing.decorators import async_test_body
from matter.testing.matter_testing import MatterBaseTest
from matter.testing.runner import default_matter_test_main


class UnpairDefaultFabric(MatterBaseTest):
    @async_test_body
    async def test_unpair(self):
        await self.default_controller.UnpairDevice(self.dut_node_id)


if __name__ == "__main__":
    default_matter_test_main()
`;

// Removes both of the image's baked-in fabrics (chip-tool CLI's "alpha" identity and the Python test
// framework's default_controller), leaving Matterbridge fully decommissioned and advertising commissionable
// again under the fixed factory pairing code (see docker/chip-test/pairing.json) — the only state
// `pairFabrics()` can re-pair from. Tolerant of a fabric already being absent (e.g. a previous run left
// things partially decommissioned), since `run()` here doesn't fail the script on a nonzero exit.
function unpairFabrics() {
  console.log('Unpairing the chip-tool (alpha) fabric...');
  run('docker', ['exec', containerName, chipToolBin, 'pairing', 'unpair', dutNodeId, '--commissioner-name', 'alpha']);

  console.log('Unpairing the Python test-framework fabric...');
  const scriptPath = join(tmpdir(), 'matterbridge-chip-unpair-fabric.py');
  writeFileSync(scriptPath, unpairPythonFabricScript);
  const remoteScript = 'src/python_testing/__unpair_default_fabric.py';
  runOrFail('docker', ['cp', scriptPath, `${containerName}:/root/connectedhomeip/${remoteScript}`]);
  run('docker', ['exec', containerName, 'python3', remoteScript]);
  run('docker', ['exec', containerName, 'rm', '-f', remoteScript]);
}

// Re-pairs both fabrics from a fully decommissioned (0-fabric) device: first chip-tool's "alpha" identity
// using the fixed factory pairing code (only valid once, from 0 fabrics), then — since a commissioning
// window closes as soon as one commissioning succeeds — has alpha open a fresh Enhanced Commissioning window
// and parses the one-time manual pairing code chip-tool prints for it, to commission the Python test
// framework's fabric through that window.
function pairFabrics() {
  console.log('Pairing the chip-tool (alpha) fabric with the fixed factory code...');
  runOrFail('docker', ['exec', containerName, chipToolBin, 'pairing', 'code', dutNodeId, fixedManualPairingCode, '--commissioner-name', 'alpha']);

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

// Reads chipTests.json once, populating resetClusterGlobs/allTests. Must run before anything that
// references those, so it's the first thing main() does.
function loadChipTestsFile() {
  let raw;
  try {
    raw = readFileSync(testsFile, 'utf8');
  } catch (error) {
    fail(`Unable to read ${testsFile}: ${error.message}`);
    return;
  }

  const parsed = JSON.parse(raw);

  resetClusterGlobs = parsed.resetClusterGlobs ?? [];
  if (!Array.isArray(resetClusterGlobs)) {
    fail(`Expected "resetClusterGlobs" to be an array in ${testsFile}`);
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

function buildArgs(test) {
  const scriptArgs = [];
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
function buildExecArgs(test) {
  const args = buildArgs(test);
  if (test.kind === 'yaml') {
    return ['python3', 'scripts/tests/chipyaml/chiptool.py', 'tests', test.test, ...args];
  }
  return ['python3', `src/python_testing/${test.test}`, ...args];
}

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

function runTests(nameFilter) {
  const tests = filterTests(allTests, nameFilter);
  const startedAt = `Chip tests run started at ${new Date().toISOString()}\n\n`;
  writeFileSync(logFile, startedAt);

  const results = [];
  for (const test of tests) {
    const label = `${test.name} (${test.test})`;

    if (test.skip) {
      console.log(`SKIP: ${label}`);
      appendFileSync(logFile, `=== ${label} ===\nSkipped ("skip": true set in ${testsFile})\n\n`);
      results.push({ label, passed: false, skipped: true, comment: test.comment });
      continue;
    }

    const execArgs = buildExecArgs(test);
    const commandLine = execArgs.join(' ');

    if (test.resetBefore) {
      appendFileSync(logFile, `--- reset stateful cluster storage before ${label} ---\n`);
      resetContainerState();
    }

    if (test.unpairBefore) {
      appendFileSync(logFile, `--- unpair both fabrics before ${label} ---\n`);
      unpairFabrics();
    }
    if (test.pairBefore) {
      appendFileSync(logFile, `--- pair both fabrics before ${label} ---\n`);
      pairFabrics();
    }
    if (test.revokeWindowBefore) {
      appendFileSync(logFile, `--- revoke any open commissioning window before ${label} ---\n`);
      revokeCommissioningWindow();
    }

    console.log(`Running: ${label}`);
    appendFileSync(logFile, `=== ${label} ===\n${commandLine}\n`);

    const result = spawnSync('docker', ['exec', '-i', containerName, ...execArgs], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      input: test.input ?? '',
    });

    appendFileSync(logFile, `${result.stdout ?? ''}${result.stderr ?? ''}\n`);

    const passed = result.status === 0;
    appendFileSync(logFile, `Result: ${passed ? 'PASS' : 'FAIL'} (exit ${result.status})\n\n`);
    console.log(passed ? `PASS: ${label}` : `FAIL: ${label} (exit ${result.status})`);

    results.push({ label, passed, comment: test.comment });

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
      pairFabrics();
    }
  }

  const executedResults = results.filter((result) => !result.skipped);
  const skippedCount = results.length - executedResults.length;
  const passedCount = executedResults.filter((result) => result.passed).length;
  const resultLines = results.flatMap((result) => {
    const icon = result.skipped ? '⏭️' : result.passed ? '✅' : '❌';
    const line = `${icon} ${result.label}`;
    return (result.skipped || !result.passed) && result.comment ? [line, `   ↳ ${result.comment}`] : [line];
  });
  const summary = `Summary: ${passedCount}/${executedResults.length} tests passed${skippedCount ? ` (${skippedCount} skipped)` : ''}.`;

  appendFileSync(logFile, `${resultLines.join('\n')}\n\n${summary}\n`);
  writeFileSync(summaryLogFile, `${startedAt}${resultLines.join('\n')}\n\n${summary}\n`);
  console.log(resultLines.join('\n'));
  console.log(summary);

  const unexpectedFailures = executedResults.filter((result) => !result.passed && !result.comment);
  if (unexpectedFailures.length > 0) {
    process.exitCode = 1;
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(scriptVersion);
    return;
  }

  loadChipTestsFile();

  if (args.includes('--start')) {
    start();
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

try {
  main();
} catch (error) {
  if (error instanceof ExitError) {
    if (error.message) console.error(error.message);
    process.exitCode = error.code;
  } else {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
