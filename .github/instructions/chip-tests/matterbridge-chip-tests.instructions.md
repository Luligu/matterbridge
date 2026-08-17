---
name: 'CHIP Conformance Test Harness v.1.0.0'
description: 'How the CHIP conformance test harness works for a Matterbridge plugin'
applyTo: 'chipTests.json, chipTests.md, chipTests.log, chipTestsSummary.log, scripts/run-chip-tests.mjs, scripts/run-matterbridge-chip-tests.mjs, packages/core/src/chipTests.ts, .github/workflows/chip-tests.yml'
---

# CHIP Conformance Test Harness

Matterbridge itself (not a plugin — there is no plugin under test here) can be validated against the Matter
CHIP certification test suite — both the Python test scripts and the YAML certification tests used by the
CSA's own CI — running inside the `luligu/matterbridge:chip-test` Docker image. The image bakes in a full
Matterbridge instance built from the `dev` branch at image-build time, so `--start` never installs, builds,
or copies anything local into the container — it only brings the container up and waits for Matterbridge's
root server node to come online. The harness is driven entirely by `scripts/run-matterbridge-chip-tests.mjs`
and configured by `chipTests.json`. This differs from the CHIP harness used in individual plugin repos (that
variant bind-mounts the plugin, rebuilds it, and runs `matterbridge --add` on `--start`) — see §4 for how to
get local code changes to this repo into a running container instead.

## 1. What the container is

- Image `luligu/matterbridge:chip-test` (built by `docker/Dockerfile.chip-test`) bundles the Matterbridge
  instance plus a full `connectedhomeip`/`chip-tool` checkout with the Python test suite under
  `src/python_testing/` (relative to the container's default working directory), the YAML certification test
  suite under `src/app/tests/suites/certification/`, the YAML test runner CLI at
  `scripts/tests/chipyaml/chiptool.py`, and `chip-tool` itself at `/root/connectedhomeip/out/host/chip-tool`.
- The container is always named `chip-test` (`containerName` in the script).
- `chip-tool`'s own persistent storage inside the image already holds a fabric paired with the matterbridge
  instance, under node id `0x12344321` — this is what makes the YAML tests runnable without a separate
  commissioning step (see §6). Verified directly: `chip-tool basicinformation read vendor-name 0x12344321 0`
  reads back `VendorName: Matterbridge` against that existing pairing, no commissioning needed. There is no
  long-running server process baked into the image; each YAML test invocation spawns its own short-lived
  `chip-tool interactive server`, runs, and tears it down again. A second, separate fixed fabric is also
  baked in for the Python test framework's `default_controller` (its own `admin_storage.json`, unrelated to
  chip-tool's storage) — see `docker/chip-test/pairing.json` for both fabrics' fixed pairing credentials, and
  §5's `unpairBefore`/`pairBefore` for re-pairing either one from scratch.
- It runs on the `matterbridge` docker network, mapping the frontend to host port `8585`, mounting `./temp`
  to `/tmp/matter_testing/logs` (test artifacts). `start()` creates the network itself
  (`docker network inspect matterbridge || docker network create --ipv6 matterbridge`) if it doesn't already
  exist. The `--ipv6` flag matters: the container relies on an IPv6 link-local address (e.g. `chip-tool`'s
  traffic to `fe80::.../UDP:5540`, see the pairing check above), so a plain IPv4-only network breaks it — if
  the network already exists without `--ipv6` (e.g. created by hand or by another tool), `--start` reuses it
  as-is rather than recreating it, so that pre-existing network still needs fixing manually.
- `--start` passes `-e MATTERBRIDGE_CHIP_TEST_DEVICES=1` on top of the image's own baked-in
  `MATTERBRIDGE_CHIP_TEST=1` — see §2 for what each one gates. Other env vars baked into the image
  (`Config.Env` in the Dockerfile) include `MATTERBRIDGE_START_CONFIGURE_TIMEOUT`/
  `MATTERBRIDGE_START_REACHABILITY_TIMEOUT` (shorter Matterbridge-core startup timeouts tuned for a fast,
  local, single-controller container) — re-run `docker inspect luligu/matterbridge:chip-test` for the current
  full list rather than trusting a stale one here.
- Curated, per-cluster PICS (Protocol Implementation Conformance Statement) files are baked into the image at
  `/root/*.pics`, sourced from `docker/chip-test/*.pics` in this same repo — e.g. `matterbridge.pics` (root
  node `BasicInformation`/`BridgedDeviceBasicInformation`/`PowerSource`, used by the `TC_BINFO_*`/`TC_BRBINFO_*`/
  generic `TC_PS_*` tests), plus one file per cluster under test (`smoke-co-alarm.pics`,
  `power-source.battery.pics`, `identify.pics`, `occupancy-sensing.pics`, `thermostat.*.pics`, and so on —
  see `docker/chip-test/` for the full list). Each hand-verified against Matterbridge's own default cluster
  server implementations. Prefer the matching per-cluster file over the generic
  `src/app/tests/suites/certification/ci-pics-values` (the CSA's own near-blanket CI profile) whenever one
  exists for the cluster under test — it is what makes the tests behave correctly instead of asserting on
  attributes Matterbridge's default cluster servers don't support. If a cluster has no `.pics` file yet, add
  one under `docker/chip-test/` (cross-referencing the Matter spec and the real cluster-server source) and
  copy it into the running container per §4, or fall back to the generic PICS file for that test in the
  meantime.

## 2. CHIP test devices and backchannels (`packages/core/src/chipTests.ts`, `packages/core/src/chipTestDevices.ts`)

Unlike a plugin repo (which has one real device tree to test), this repo has no plugin under test, so this
pair of files synthesizes a fixed device tree and both CHIP test backchannels, gated entirely behind env
vars so none of this ships or runs outside a CHIP-test container. `chipTestDevices.ts` holds only
`createChipTestDevices()` (the device tree) and has no dependency on `chipTests.ts`. Everything else — the
`TestEventTrigger`/app-pipe backchannels and the `chipTestMatterbridge` module state the TestEventTrigger
handlers read devices through — stays in `chipTests.ts`, captured by `createChipTestAppPipe()` (not
`createChipTestDevices()`) since app-pipe creation is the one call that always runs whenever
`MATTERBRIDGE_CHIP_TEST` is set, regardless of whether `MATTERBRIDGE_CHIP_TEST_DEVICES` also creates a
device tree:

- `MATTERBRIDGE_CHIP_TEST=1` (baked into the image, also settable manually: see the two env vars together in
  `matterbridge.ts`'s `startBridge()`) gates `MatterbridgeGeneralDiagnosticsServer` (added to the root
  endpoint in `matterbridge.ts`) and `createChipTestAppPipe()` (called from `startBridge()`, right after the
  `addVirtualDevices()` call) — i.e. the `GeneralDiagnostics.TestEventTrigger` handling and the app-pipe
  listener.
- `MATTERBRIDGE_CHIP_TEST_DEVICES=1` additionally gates `createChipTestDevices()` (`chipTestDevices.ts`,
  imported and called from `startBridge()` right alongside `createChipTestAppPipe()`) — the ~20 bridged
  sensor/alarm endpoints (one per device-type chapter: contact/light/occupancy/temperature/pressure/flow/
  humidity/on-off sensors, three SmokeCOAlarm variants, air quality, water freeze/leak, rain, soil)
  registered under a fake, disabled `matterbridge-chip` `DynamicPlatform` plugin entry. Without this flag
  the aggregator stays empty (Descriptor-only). `--start` always passes both.
- Both are Linux-only test glue: keep new handlers gated behind these env vars, don't make normal runtime
  behavior or shutdown depend on them, and don't assume a specific TestEventTrigger/app-pipe case is
  implemented without checking `chipTests.ts` — it currently only implements the SmokeCOAlarm TestEventTrigger
  cases and a handful of app-pipe commands (`SetBooleanState`, `SetBooleanStateSensorFault`,
  `SimulateConfigurationVersionChange`, `SetOccupancy`, `SetSimulatedSoilMoisture`); anything else falls
  through to `GeneralDiagnosticsServer`'s default `InvalidCommand` response or a logged-and-ignored warning.

### TestEventTrigger (`GeneralDiagnostics.TestEventTrigger`, endpoint 0)

The Matter command carries only an `EnableKey` (a 16-byte key accepted by the DUT) and an `EventTrigger`
(a test-defined integer) — no endpoint, cluster, attribute, or target value. Each CHIP test defines the
meaning of its `EventTrigger` values in its own test source/YAML, so each supported trigger must be mapped
explicitly in `handleChipTestEventTrigger()`/`handleSmokeCoAlarmTestEventTrigger()`. Keep these handlers
gated to `MATTERBRIDGE_CHIP_TEST` through `Matterbridge.createServerNode()`.

Several clusters have more than one candidate endpoint (e.g. the three SmokeCOAlarm variants, or the four
BooleanStateConfiguration endpoints) — since the trigger itself carries no endpoint,
`handleSmokeCoAlarmTestEventTrigger()`/`handleBooleanStateConfigurationTestEventTrigger()`/
`handleElectricalEnergyTestEventTrigger()` resolve the target directly from `chipTestActiveEndpointId` (every
`chipTests.json` entry for these triggers always pins the specific endpoint it targets, so there's no need to
guess or broadcast). `chipTestActiveEndpointId` is not decoded from the trigger value itself (an earlier
attempt at that broke real SmokeCOAlarm tests, since some of this file's own trigger constants — e.g.
`smokeCoAlarmWarningCoAlarmTrigger = 0xffffffff00000091n` — already have non-zero bits in the range that looked
like an endpoint encoding, but aren't one); it's set out-of-band by `run-matterbridge-chip-tests.mjs` from
`chipTests.json`'s `"endpoint"` field for the currently running test, via the app-pipe (see below).

To add a new trigger-backed CHIP test:

1. Read the CHIP test source and copy its exact `EventTrigger` constants.
2. Check the key the test really sends. Python tests often use `000102...0f`
   (`chipTestEnableKey`). YAML tests may define their own default key in the YAML config, such as
   SmokeCOAlarm's `001122...eeff` key (`smokeCoAlarmChipTestEnableKey`) — do not add a `chipTests.json`
   `--hex-arg` unless the YAML default is wrong for that specific test. Add only the required CHIP-test key
   to `isChipTestEnableKey()`.
3. Add a small handler that updates the target endpoint with `setCluster()` or `setAttribute()`, then emits
   any event the test reads with `triggerEvent()`.
4. Keep unsupported `EventTrigger` values delegated to `GeneralDiagnosticsServer` so they return
   `InvalidCommand`.
5. If a failed/interrupted run can persist dirty state, add a `resetClusterGlobs` entry (§5) and set
   `resetBefore` on that `chipTests.json` entry.

### App-pipe (`/tmp/matterbridge-chip-test-app-pipe`)

The app-pipe is a separate test backchannel from `TestEventTrigger`. Some Python CHIP tests call
`write_to_app_pipe()`/`--app-pipe` and write one JSON command per line into a named pipe. The command payload
can include fields such as `Name`, `EndpointId`, `NewState`, `Occupancy`, `SensorFault`, or
`SoilMoistureValue`. Matterbridge creates the pipe only when `MATTERBRIDGE_CHIP_TEST` is set, via
`createChipTestAppPipe()` called from the CHIP-test bootstrap. It's Linux-only test glue; do not use it for
production behavior and do not make normal runtime shutdown depend on it.

Note: §8 in the generic CHIP-test guidance for plugin repos says app-pipe tests are permanently unrunnable
because "no real device can support this debug hook" — that exclusion does **not** apply here. Matterbridge
implements the app-pipe itself for exactly this purpose, so app-pipe-gated tests are runnable against this
repo as long as the specific command the test sends is handled in `handleChipTestAppPipeCommand()`.

`run-matterbridge-chip-tests.mjs` also writes its own synthetic `{"Name":"SetTestEndpoint","EndpointId":<n>}`
command into this same pipe before every test (`setActiveTestEndpoint()`), sourced from that test's
`chipTests.json` `"endpoint"` field (omitting `EndpointId` clears it when a test has none). This isn't a real
CHIP test command — `handleChipTestAppPipeCommand()` intercepts it first and stores it in the module-level
`chipTestActiveEndpointId`, which both the `TestEventTrigger` handlers (above) and this function's own
`EndpointId` fallback read for commands that omit it, or (`SetOccupancy`) whose `EndpointId` isn't trustworthy
in the first place (`TC_OCC_3_2.py` hardcodes the literal `1` rather than sending its real endpoint).

`SimulateConfigurationVersionChange` needs its own dedicated branch ahead of the generic `endpointId`
resolution rather than fitting the same pattern: the command never sends an `EndpointId` at all, and it bumps
two different things — root's `BasicInformation.ConfigurationVersion` (unconditionally, via
`matterbridge.serverNode` directly — root is a `ServerNode`, not a `MatterbridgeEndpoint`; they're siblings
under the same `Endpoint` base class, not one a subtype of the other, so root can never flow through
`getChipTestEndpoint()`) and, only if `chipTestActiveEndpointId` resolves to an actual bridged endpoint, that
endpoint's `BridgedDeviceBasicInformation.ConfigurationVersion` too. `TC_BINFO_3_2` pins `0` (root, since it
only reads root `BasicInformation`) and gets just the root bump; `TC_BRBINFO_3_2` pins `701` and gets both.
This was reached after two failed simpler attempts, verified against the container each time: hardcoding `701`
unconditionally works but reintroduces a hardcoded endpoint number for no real reason once the pin is
available, and blindly preferring the pin over the hardcoded target breaks `TC_BINFO_3_2` (pin `0` doesn't
resolve via `getChipTestEndpoint()`, so the whole command — including the _unrelated_ root bump — was dropped
before ever reaching the switch statement).

To add a new app-pipe-backed CHIP test:

1. Read the CHIP Python test and copy the exact JSON command name and fields passed to
   `write_to_app_pipe()`.
2. Extend `ChipTestAppPipeCommand` only with the fields that test actually writes.
3. Add one small `case` in `handleChipTestAppPipeCommand()`, resolving the endpoint with
   `getChipTestEndpoint()`.
4. Update state through Matterbridge helpers such as `setCluster()`/`setStateOf()`/`setAttribute()` where
   possible.
5. Keep invalid or unknown commands logged and ignored so one malformed line cannot break the pipe loop.

## 3. `resetClusterGlobs` reference

`chipTests.json`'s `resetClusterGlobs` (§5) is matched against files directly under Matterbridge's own node
storage for the bridged endpoints inside the container
(`/root/.matterbridge/matterstorage/Matterbridge`, `matterstorageRoot` in the script) — only stateful cluster
attributes that get written during a test create a file there, so these globs only ever remove test-mutated
state, never device identity.

## 4. Lifecycle commands and syncing local code changes

```shell
node scripts/run-matterbridge-chip-tests.mjs --start   # docker rm -f any old container, pull the image, create the docker network if missing, run the container, wait for Matterbridge's root server node to come online
node scripts/run-matterbridge-chip-tests.mjs           # run every test in chipTests.json's "tests" array against the running container
node scripts/run-matterbridge-chip-tests.mjs --test X  # run only tests whose "name" or "test" (filename) includes X, case-insensitive substring match
node scripts/run-matterbridge-chip-tests.mjs --stop    # docker stop the container (left in place, not removed — the next --start does the docker rm -f)
```

Exposed as `npm run` shortcuts in `package.json`: `chip:start`, `chip:test`, `chip:stop` (there is currently
no per-cluster `chip:test:<name>` shortcut list in this repo's `package.json` — add one alongside a new
cluster's tests in `chipTests.json` if that becomes useful).

**Always run `--stop` after any container-based investigation.**

Because the image bundles its own build from the `dev` branch baked in at image-build time (not a bind
mount), a local TypeScript/frontend/PICS edit is invisible to the running container until it's rebuilt
locally and copied in:

```shell
# after rebuilding locally (npm run build or equivalent)
docker cp dist/. chip-test:/root/matterbridge/dist/
docker cp packages/core/dist/. chip-test:/root/matterbridge/packages/core/dist/
docker cp packages/types/dist/. chip-test:/root/matterbridge/packages/types/dist/
docker cp apps/frontend/build/. chip-test:/root/matterbridge/apps/frontend/build/
docker cp docker/chip-test/*.pics chip-test:/root/

# restart the existing container (no docker rm/pull, much cheaper than --start) to pick up the copied code
docker restart chip-test
```

Copy directory contents with `/.` so `docker cp` replaces the target directory's contents instead of nesting
another `dist`/`build` folder inside it. After restarting, re-run the focused check through the repo script,
e.g. `node scripts/run-matterbridge-chip-tests.mjs --test "SmokeCOAlarm"`.

## 5. `chipTests.json` shape

```jsonc
{
  "resetClusterGlobs": [
    /* filename globs (§3), cleared by any test entry that sets "resetBefore": true or "resetAfter": true.
       Required (non-empty) if any test uses either flag — the script fails loudly rather than silently
       skipping the reset if this is empty. */
  ],
  "tests": [
    // optional, defaults to []. A single unified list mixing YAML certification tests and Python tests —
    // the runner tells them apart from "test" alone: a filename ending in ".py" is a Python test
    // (src/python_testing/<test>.py inside the container), anything else is a YAML certification test name
    // (no extension, e.g. "Test_TC_I_2_1") from src/app/tests/suites/certification/, run via:
    //   python3 scripts/tests/chipyaml/chiptool.py tests <test.test> <args...>
    // This spawns a short-lived "chip-tool interactive server" for the duration of the one YAML test,
    // reusing chip-tool's own persisted fabric pairing baked into the image — see §6. Config values the YAML
    // file declares (e.g. "endpoint", or a PIXIT config default like "HIEST_PRI_ALARM_2") become CLI flags,
    // so "endpoint": 6 overrides the file's own default (rendered as "--endpoint 6", passed as the first
    // CLI arg, ahead of "args"); enum-typed config values need the fully-qualified enum name as a CLI value
    // (e.g. "--HIEST_PRI_ALARM_2 ExpressedStateEnum.BatteryAlert"), not the raw integer. Pass
    // "--PICS /root/<cluster>.pics" in args when a hand-verified section exists for the cluster under test
    // (see §1) — the tool's own default is the generic ci-pics-values file.
    // Keep every device/cluster's tests grouped together and ordered by ascending test number (e.g. _2_1
    // before _2_2 before _2_3), interleaving YAML and Python entries in that same numeric sequence, rather
    // than splitting them by kind — that's what makes the full conformance-test coverage for one endpoint
    // readable at a glance.
    {
      "name": "Human-readable label, matched by --test",
      "test": "Test_TC_SOMETHING_1_2", // or "TC_SOMETHING_1_2.py" for a Python test
      "endpoint": 6, // optional, rendered as "--endpoint 6" ahead of "args"
      "args": ["--PICS /root/matterbridge.pics"], // optional, each entry split on whitespace
      "input": "y\ny\n", // optional, piped to stdin for tests that prompt for interactive confirmation
      "resetBefore": true, // optional: clear resetClusterGlobs + restart the container before this test
      "resetAfter": true, // optional: clear resetClusterGlobs + restart the container after this test (before the next one) — put this on the test that leaves dirty residue, not the one affected by it
      "unpairBefore": true, // optional: fully decommission both baked-in fabrics before this test
      "pairBefore": true, // optional: re-commission both baked-in fabrics before this test (from a fully decommissioned state)
      "unpairAfter": true, // optional: fully decommission both baked-in fabrics after this test
      "pairAfter": true, // optional: re-commission both baked-in fabrics after this test
      "revokeWindowBefore": true, // optional: revoke any commissioning window left open by a previous test, without touching either fabric's pairing
      "skip": true, // optional: list the test (name, comment) but never invoke it — see §8
      "comment": "optional free text, printed under a failing/skipped result in the summary log",
    },
  ],
}
```

Order within a single test entry, when several pairing/reset flags are combined on one entry, is
`unpairBefore` → `pairBefore` → `revokeWindowBefore` → (test runs) → `resetAfter`/`unpairAfter`/`pairAfter`.
`resetBefore`/`resetAfter` (a lightweight storage-glob-plus-restart) is far cheaper than
`unpairBefore`/`pairBefore` (a genuinely fresh fabric/event-log state, needed only for tests asserting on
zero pre-existing events or an empty ACL) — prefer the former unless a test specifically needs the latter.

## 6. The CHIP test device endpoint map

Because this repo's device tree is fixed by `createChipTestDevices()` (§2) rather than assembled per-plugin,
the endpoint map is stable across runs and documented once in `chipTests.md`, rather than rediscovered per
target as a plugin repo would. Endpoint 0 is always the root node (`BasicInformation`, not
`BridgedDeviceBasicInformation` — use `matterbridge.pics`'s `BINFO.*` section there, not `BRBINFO.*`).
Endpoint 1 is the aggregator. Everything above that follows `createChipTestDevices()`'s registration order in
`chipTestDevices.ts` (currently: utility devices in the 2xx range, then sensor/alarm devices in the 7xx range,
e.g. `709`/`7091`/`7092` for the three SmokeCOAlarm variants).

Re-verify (and update `chipTests.md`) after adding, removing, or reordering `createChipTestDevices()`'s
registrations, using the same throwaway-Python-script approach as a plugin repo would (copy into
`src/python_testing/` inside the container, run it, then delete it — it is not part of the image and must
not be left behind):

```python
import matter.clusters as Clusters
from matter.testing.decorators import async_test_body
from matter.testing.matter_testing import MatterBaseTest
from matter.testing.runner import default_matter_test_main

class DumpEndpoints(MatterBaseTest):
    @async_test_body
    async def test_dump(self):
        wildcard = await self.default_controller.ReadAttribute(self.dut_node_id, [()])
        for ep, clusters in sorted(wildcard.items()):
            print(f"EP {ep}: {sorted(c.__name__ for c in clusters.keys())}")

if __name__ == "__main__":
    default_matter_test_main()
```

The raw `chip-tool` binary (`/root/connectedhomeip/out/host/chip-tool`, run directly rather than through
`chiptool.py`) is also present, and can reuse the same baked-in pairing at node id `0x12344321` (see §1) —
but the Python-script approach above is simpler since it reuses the test framework's own commissioning path
without having to pass `--paa-trust-store-path`/node id by hand on every invocation.

## 7. YAML certification tests vs. Python test files

Not every `TC_<CLUSTER>_<n>_<m>` certification test ID has a corresponding `.py` file in
`src/python_testing/`. Some certification tests are YAML-only — e.g. for Identify, `TC_I_2_1`/`2_2`/`2_3`
are YAML-only (`Test_TC_I_2_1.yaml` etc. under `src/app/tests/suites/certification/`), while only
`TC_I_2_4.py` exists as a Python test. These are not unrunnable — run them as `tests` entries with a YAML
(no `.py`) `test` id (§5), not as a documented gap. Before assuming a test is "missing" from `chipTests.json`,
check both:

```shell
docker exec chip-test bash -c "cd /root/connectedhomeip && timeout 30 python3 scripts/tests/chipyaml/chiptool.py list" | grep -iE 'Test_TC_<CLUSTER>_'
docker exec chip-test bash -c "ls src/python_testing/ | grep -E '^TC_<CLUSTER>_'"
```

(prefix with `MSYS_NO_PATHCONV=1` on Windows, see §9) — do not assume a numbering gap is an oversight.

### Running a YAML test manually

```shell
docker exec -i chip-test python3 scripts/tests/chipyaml/chiptool.py tests Test_TC_I_2_1 --endpoint 7
```

- Do **not** add `--server_name`/`--server_path`. Left at its default (`server_name='chip-tool'`), the
  runner resolves the `chip-tool` binary and spawns its own `chip-tool interactive server --port 9002` for
  the duration of the test, then tears it down — this works cleanly against a freshly-started container.
  A stray leftover `chip-tool interactive server` process from a killed/timed-out previous invocation (e.g.
  a shell-level `timeout` that killed the parent but orphaned its spawned child) can end up bound to port
  9002 and make the _next_ spawn attempt fail with `lws_create_vhost: init server failed` →
  `CHIP Error 0x000000AC: Internal error`. If that happens, find and kill the orphan
  (`docker exec chip-test bash -c "ps aux | grep 'chip-tool interactive'"`) rather than working around it
  with `--server_name ""` — reusing an ad hoc orphaned process is not a documented or supported mode.
- `tests <TestName>` (no `.yaml` extension) is the subcommand; extra flags after the test name (e.g.
  `--endpoint 7`) override that test's own `config:` block in the YAML file, including PIXIT-style config
  defaults (e.g. `--HIEST_PRI_ALARM_2 ExpressedStateEnum.BatteryAlert`) — see §5.
- `chiptool.py list` prints every runnable YAML test name (individual tests and named collections) — use it
  to discover what exists for a cluster instead of guessing filenames.
- The default `--PICS` is the generic `src/app/tests/suites/certification/ci-pics-values` (see §1); pass
  `--PICS /root/<cluster>.pics` explicitly only if that file has a hand-verified section for the cluster
  under test — check its content first (and diff step counts with/without it), since an inaccurate section
  will silently under- or over-skip steps rather than erroring.

### Running a Python test manually

```shell
docker exec -i chip-test python3 src/python_testing/TC_I_2_4.py --endpoint 7
```

- No `--commissioning-method`/node-id flags are needed: `matter.testing.runner` falls back to
  `TestingDefaults.DUT_NODE_ID` (`0x12344321`, the same node id chip-tool's own baked-in pairing uses — see
  §1) whenever `dut_node_ids`/`commissioning_method` aren't passed explicitly, so the test just reuses the
  already-commissioned device instead of trying to commission it again.
- `src/python_testing/<file>.py` (not through `chiptool.py`) is the entry point; extra flags after it (e.g.
  `--endpoint 7`) map to `chipTests.json`'s `"args"` array for that entry (§5).
- Pass `--PICS /root/<cluster>.pics` the same way as for YAML tests (see above) when a hand-verified section
  exists for the cluster under test.

## 8. Test exclusion reasons — do not assume PICS can fix everything

Some certification tests are permanently inapplicable regardless of PICS content, because they are gated by
something other than a PICS flag:

- `@run_if_endpoint_matches(has_attribute(...))` — probes the **live** attribute list on the real DUT, not
  PICS. If the attribute genuinely isn't implemented by Matterbridge (e.g. `ProductAppearance`), the test
  always skips.
- Tests requiring `fabric-sync-app`/`fabric-admin`/`fabric-bridge`/`TH_ICD_SERVER` — an entirely different
  multi-app test topology, not something `--endpoint` against a single bridge can satisfy.
- A test's hardcoded expected value can also assume optional attributes Matterbridge doesn't implement (e.g.
  `SmokeCoAlarm`'s `InterconnectSmokeAlarm`/`InterconnectCOAlarm`) — that's not a permanent exclusion, just a
  config mismatch: override the relevant PIXIT config default via `args` (§5) to match Matterbridge's actual
  (spec-legal, manufacturer-defined) behavior instead of skipping the test.

Note: `write_to_app_pipe(...)`/`--app-pipe` tests are runnable here, unlike in a plugin repo — see §2's
app-pipe section.

Check a test's actual gating (`grep -n 'run_if_endpoint_matches\|has_attribute\|app_pipe\|app-pipe' src/python_testing/TC_X.py`
inside the container) before concluding a PICS change or a config override would unlock it.

For a test that's permanently inapplicable for one of the reasons above, set `"skip": true` on its
`chipTests.json` entry (§5) instead of leaving it to fail on every run. This keeps the entry (name, args,
`comment` explaining why) in the file for documentation/discoverability, but `runTests()` never invokes it —
reported as `⏭️` in the summary, excluded from the pass/fail ratio. Don't use `"skip": true` for a real,
fixable gap — only for tests gated on something this harness can never provide.

## 9. Windows/Git Bash quoting

Manual `docker exec`/`docker cp` invocations via a POSIX-shell tool on Windows must be prefixed with
`MSYS_NO_PATHCONV=1`, otherwise Git Bash mangles POSIX-style container paths (e.g. `/root/matterbridge.pics`
gets translated to a Windows path before reaching `docker`).

## 10. Verifying any change to this harness

After editing `chipTests.json`, `chipTests.md`, `run-matterbridge-chip-tests.mjs`, `chipTests.ts`,
`chipTestDevices.ts`, or any `docker/chip-test/*.pics` file, always re-verify end-to-end rather than trusting
the edit alone:

1. `node scripts/run-matterbridge-chip-tests.mjs --start` (or, for a `chipTests.ts`/`chipTestDevices.ts`/
   `.pics` edit against an already-running container, the cheaper docker-cp-and-restart sync in §4) — a
   `chipTestDevices.ts` change also needs the container recreated with `--start` rather than a plain restart
   whenever it changes which env vars gate device creation, since `docker restart` doesn't refresh env vars
   baked in at `docker run` time.
2. `node scripts/run-matterbridge-chip-tests.mjs --test <NAME>` for the affected test(s).
3. `node scripts/run-matterbridge-chip-tests.mjs --stop`.
4. Run this repo's own formatter/linter/typecheck on the touched files.

Keep `chipTests.md`'s prose (endpoint map, manual-run notes) in sync with
`chipTests.json`/`chipTests.ts`/`chipTestDevices.ts` whenever tests or devices are added, removed, or
re-gated on a different PICS file/endpoint.

## 11. CI

There is no CI workflow that runs the CHIP test suite itself in this repo — it's a manual/local developer
workflow only (§4). The only CHIP-related workflow is
`.github/workflows/docker-buildx-chip-test.yml`, which builds and pushes the `luligu/matterbridge:chip-test`
image to Docker Hub (`docker/Dockerfile.chip-test`) on `workflow_dispatch` only — it does not run any tests,
it just produces the image the harness above pulls.
