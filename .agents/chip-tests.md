# CHIP Conformance Test Harness (v.1.0.0)

A Matterbridge plugin can be validated against the Matter CHIP certification test suite — both the Python
test scripts and the YAML certification tests used by the CSA's own CI — running inside the
`luligu/matterbridge:chip-test` Docker image. The harness is driven entirely by
`scripts/run-chip-tests.mjs` and configured by `chipTests.json`, both dropped into the plugin repo's root.
The script is not specific to any one plugin: it reads the plugin name, config, and test list from
`chipTests.json`, so the same `run-chip-tests.mjs` works unmodified across plugin repos — copy it as-is and
only author a `chipTests.json` for the new repo.

## 1. What the container is

- Image `luligu/matterbridge:chip-test` bundles a Matterbridge instance plus a full
  `connectedhomeip`/`chip-tool` checkout with the Python test suite under `src/python_testing/` (relative
  to the container's default working directory), the YAML certification test suite under
  `src/app/tests/suites/certification/`, the YAML test runner CLI at
  `scripts/tests/chipyaml/chiptool.py`, and `chip-tool` itself at `/root/connectedhomeip/out/host/chip-tool`.
- The container is always named `chip-test` (`containerName` in the script).
- `chip-tool`'s own persistent storage inside the image already holds a fabric paired with the matterbridge
  instance, under node id `0x12344321` — this is what makes the YAML tests runnable without a separate
  commissioning step (see §5). Verified directly: `chip-tool basicinformation read vendor-name 0x12344321 0`
  reads back `VendorName: Matterbridge` against that existing pairing, no commissioning needed. There is no
  long-running server process baked into the image; each YAML test invocation spawns its own short-lived
  `chip-tool interactive server`, runs, and tears it down again.
- The plugin's `node_modules` (under `/root/Matterbridge/<pluginName>/node_modules`) is shadowed by a named
  Docker volume (`chip-test-node-modules`), not the host bind mount — this gives the container its own
  independent, native-Linux-filesystem `node_modules`, since Matterbridge core re-links itself into a local
  plugin's `node_modules` on every restart when it isn't already there, and running that against a Windows
  bind mount over Docker Desktop's cross-OS file sharing is dramatically slower (a Windows-created
  `node_modules/matterbridge` symlink also doesn't reliably resolve from inside the Linux container anyway).
  The first-ever `--start` has to populate this volume from scratch, comparable to a full `npm install`, so
  the container can take **2-3 minutes to report ready**; every `--start` after that finds it already
  populated and skips straight past the re-link, coming up much faster. The named volume persists across
  `docker rm`/`--start` cycles (only removed by an explicit `docker volume rm chip-test-node-modules`), so
  this slow first run only happens once per host, not once per `--start`.
- It runs on the `matterbridge` docker network, mapping the frontend to host port `8585`, mounting `./temp`
  to `/tmp/matter_testing/logs` (test artifacts) and the plugin repo to `/root/Matterbridge/<pluginName>`,
  where `<pluginName>` comes from `chipTests.json`'s `config.name`. `start()` creates this network itself
  (`docker network inspect matterbridge || docker network create --ipv6 matterbridge`) if it doesn't already
  exist, so a fresh host (including a CI runner, see §9) needs no separate setup step for it. The `--ipv6`
  flag matters: the container relies on an IPv6 link-local address (e.g. `chip-tool`'s traffic to
  `fe80::.../UDP:5540`, see §1's `0x12344321` pairing check above), so a plain IPv4-only network breaks it —
  if the network already exists without `--ipv6` (e.g. created by hand or by another tool), `--start` reuses
  it as-is rather than recreating it, so that pre-existing network still needs fixing manually.
- The image bakes in a fixed set of environment variables (`Config.Env` in the Dockerfile, not something
  `chipTests.json`/`run-chip-tests.mjs` sets — check with `docker inspect luligu/matterbridge:chip-test`).
  As of this writing that includes `MATTERBRIDGE_CHIP_TEST=1` (a marker flag), `MATTERBRIDGE_START_CONFIGURE_TIMEOUT`/
  `MATTERBRIDGE_START_REACHABILITY_TIMEOUT` (shorter Matterbridge-core startup timeouts tuned for a fast,
  local, single-controller container), and one or more plugin-specific opt-in gates (e.g. a var that skips a
  camera plugin's default-stream self-allocation, or one that switches a WebRTC command handler into strict
  spec-validation mode instead of a lenient real-controller-friendly default) — these only do anything if
  the plugin being tested actually reads them via `process.env` and chooses to change behavior accordingly;
  the image itself doesn't enforce anything. Don't assume a specific plugin implements any of these gates —
  check that plugin's own source (`process.env.MATTERBRIDGE_*` reads) rather than assuming parity with
  another plugin, and re-run `docker inspect` for the current list rather than trusting a stale one here.
- A curated PICS (Protocol Implementation Conformance Statement) file is baked into the image at
  `/root/matterbridge.pics`, hand-verified against Matterbridge's own default cluster server
  implementations (see `matterbridge/docker/chip-test/matterbridge.pics` in the `matterbridge` repo — the
  source lives there, not in the plugin repo). Prefer this file over the generic
  `src/app/tests/suites/certification/ci-pics-values` (the CSA's own near-blanket CI profile) whenever a
  hand-verified section exists for the cluster under test — it is what makes tests like
  `TC_BINFO_*`/`TC_BRBINFO_*` behave correctly instead of asserting on attributes a real device doesn't
  support. If the cluster you're testing has no section yet in `matterbridge.pics`, either add one there
  (cross-referencing the Matter spec and the real cluster-server source) or fall back to the generic PICS
  file for that test.

## 2. Lifecycle commands

```shell
node scripts/run-chip-tests.mjs --start   # create the container, npm install/link/build, copy the plugin in, matterbridge --add, write config, restart
node scripts/run-chip-tests.mjs           # run every test in chipTests.json's "yamlTests" and "phytonTests" arrays against the running container
node scripts/run-chip-tests.mjs --test X  # run only tests whose "name" or "test" (filename) includes X, case-insensitive substring match
node scripts/run-chip-tests.mjs --stop    # docker stop the container, then npm install/link/build locally to restore the local dev environment
```

Expose these as `npm run` shortcuts in `package.json`, e.g. `chip:start`, `chip:test`, `chip:test:<cluster>`
(filtered by the `TC_*` prefix of the test file), `chip:stop`. Add a new `chip:test:<name>` shortcut
whenever a new cluster's tests are added to `chipTests.json`.

**Always run `--stop` after any container-based investigation.** On Windows especially, `--start`/`--stop`
swap `node_modules` native binaries (oxlint/oxfmt/tsc addons/etc.) between the container's platform (Linux,
from the container-side npm install) and the local platform — until `--stop` has run and rebuilt cleanly,
do not trust local lint/format/typecheck output.

## 3. `chipTests.json` shape

```jsonc
{
  "config": {
    /* the plugin's config.json content, written into the container as
       /root/.matterbridge/<config.name>.config.json before the final restart in --start.
       "config.name" is also used as the plugin (npm package) name for the container's
       volume mount and `matterbridge --add`. */
  },
  "resetClusterGlobs": [
    /* filename globs, matched against files under this plugin's node storage directory for the
       bridged endpoints, cleared by any test entry that sets "resetBefore": true or
       "resetAfter": true. Only needs entries for cluster state that's actually persisted to disk —
       the container restart that "resetBefore"/"resetAfter" also performs already clears any
       cluster state kept purely in memory, with no glob needed for that. Required (non-empty) if
       any test uses "resetBefore"/"resetAfter" — the script fails loudly rather than silently
       skipping the reset if this is empty. */
  ],
  "yamlTests": [
    // optional, defaults to []. "test" is a YAML certification test name (no extension, e.g.
    // "Test_TC_I_2_1") from src/app/tests/suites/certification/, run via:
    //   python3 scripts/tests/chipyaml/chiptool.py tests <test.test> <args...>
    // This spawns a short-lived "chip-tool interactive server" for the duration of the one test, reusing
    // chip-tool's own persisted fabric pairing baked into the image — see §5. Config values the YAML file
    // declares (e.g. "endpoint") become CLI flags, so "args": ["--endpoint 6"] overrides the file's own
    // default. Pass "--PICS /root/matterbridge.pics" in args when a hand-verified section exists for the
    // cluster under test (see §1) — the tool's own default is the generic ci-pics-values file.
    // "input"/"resetBefore"/"resetAfter"/"skip"/"comment" (documented on the phytonTests entry below) apply here identically —
    // run-chip-tests.mjs's runTests() reads them off every entry in yamlTests/phytonTests the same way,
    // regardless of kind.
    {
      "name": "Human-readable label, matched by --test",
      "test": "Test_TC_SOMETHING_1_2",
      "args": ["--endpoint 6"],
      "input": "y\ny\n", // optional, piped to stdin for tests that prompt for interactive confirmation
      "resetBefore": true, // optional: clear resetClusterGlobs + restart the container before this test
      "resetAfter": true, // optional: clear resetClusterGlobs + restart the container after this test (before the next one) — put this on the test that leaves dirty residue, not the one affected by it
      "skip": true, // optional: list the test (name, comment) but never invoke it — see below
      "comment": "optional free text, printed under a failing/skipped result in the summary log",
    },
  ],
  "phytonTests": [
    // optional, defaults to [].
    {
      "name": "Human-readable label, matched by --test",
      "test": "TC_SOMETHING_1_2.py", // filename under src/python_testing/ inside the container
      "args": ["--endpoint 6", "--PICS /root/matterbridge.pics"], // optional, split on whitespace per entry
      "input": "y\ny\n", // optional, piped to stdin for tests that prompt for interactive confirmation
      "resetBefore": true, // optional: clear resetClusterGlobs + restart the container before this test
      "resetAfter": true, // optional: clear resetClusterGlobs + restart the container after this test (before the next one) — put this on the test that leaves dirty residue, not the one affected by it
      "skip": true, // optional: list the test (name, comment) but never invoke it — see below
      "comment": "optional free text, printed under a failing/skipped result in the summary log",
    },
  ],
}
```

## 4. Mapping the plugin's own endpoint/cluster composition

Every plugin composes its own device tree, so there is no universal endpoint map — discover it fresh for
each plugin rather than assuming numbers carry over between repos, and re-verify after adding, removing, or
reordering registered devices. Endpoint 0 is always the root node (`BasicInformation`, not
`BridgedDeviceBasicInformation` — use `matterbridge.pics`'s `BINFO.*` section there, not `BRBINFO.*`).
Endpoint 1 is typically the aggregator. Everything above that depends on registration order in the plugin's
own platform/module code.

To discover which endpoint exposes which cluster, write a throwaway Python script using the same
`matter.testing` framework the real tests use (it already handles commissioning against the container's
fixed pairing credentials), copy it into `src/python_testing/` inside the container, run it, then delete it
— it is not part of the image and must not be left behind:

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

Once discovered, note the endpoint/cluster map for the plugin (e.g. in its own `chipTests.md`) so future
work doesn't have to rediscover it from scratch — but re-verify before trusting it if the plugin's device
registration has changed since.

## 5. YAML certification tests vs. Python test files

Not every `TC_<CLUSTER>_<n>_<m>` certification test ID has a corresponding `.py` file in
`src/python_testing/`. Some certification tests are YAML-only — e.g. for Identify, `TC_I_2_1`/`2_2`/`2_3`
are YAML-only (`Test_TC_I_2_1.yaml` etc. under `src/app/tests/suites/certification/`), while only
`TC_I_2_4.py` exists as a Python test. These are not unrunnable — run them as `yamlTests` entries (§3), not
as a documented gap. Before assuming a test is "missing" from `chipTests.json`, check both:

```shell
docker exec chip-test bash -c "cd /root/connectedhomeip && timeout 30 python3 scripts/tests/chipyaml/chiptool.py list" | grep -iE 'Test_TC_<CLUSTER>_'
docker exec chip-test bash -c "ls src/python_testing/ | grep -E '^TC_<CLUSTER>_'"
```

(prefix with `MSYS_NO_PATHCONV=1` on Windows, see §7) — do not assume a numbering gap is an oversight.

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
  `--endpoint 7`) override that test's own `config:` block in the YAML file.
- `chiptool.py list` prints every runnable YAML test name (individual tests and named collections) — use it
  to discover what exists for a cluster instead of guessing filenames.
- The default `--PICS` is the generic `src/app/tests/suites/certification/ci-pics-values` (see §1); pass
  `--PICS /root/matterbridge.pics` explicitly only if that file has a hand-verified section for the cluster
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
  `--endpoint 7`) map to `chipTests.json`'s `"args"` array for that entry (§3).
- Pass `--PICS /root/matterbridge.pics` the same way as for YAML tests (see above) when a hand-verified
  section exists for the cluster under test.

## 6. Test exclusion reasons — do not assume PICS can fix everything

Some certification tests are permanently inapplicable regardless of PICS content, because they are gated by
something other than a PICS flag:

- `@run_if_endpoint_matches(has_attribute(...))` — probes the **live** attribute list on the real DUT, not
  PICS. If the attribute genuinely isn't implemented by the plugin/Matterbridge (e.g. `ProductAppearance`),
  the test always skips.
- `write_to_app_pipe(...)` / `--app-pipe` — a debug named-pipe protocol only the CSA's own reference
  `all-clusters-app`/`bridge-app` implements to simulate out-of-band config changes. No real device
  (including a Matterbridge plugin) can support this.
- Tests requiring `fabric-sync-app`/`fabric-admin`/`fabric-bridge`/`TH_ICD_SERVER` — an entirely different
  multi-app test topology, not something `--endpoint` against a single bridge can satisfy.

Check a test's actual gating (`grep -n 'run_if_endpoint_matches\|has_attribute\|app_pipe\|app-pipe' src/python_testing/TC_X.py`
inside the container) before concluding a PICS change would unlock it.

For a test that's permanently inapplicable for one of the reasons above, set `"skip": true` on its
`chipTests.json` entry (§3) instead of leaving it to fail on every run. This keeps the entry (name, args,
`comment` explaining why) in the file for documentation/discoverability, but `runTests()` never invokes it —
reported as `⏭️` in the summary, excluded from the pass/fail ratio. Don't use `"skip": true` for a real,
fixable gap (e.g. Known Issues #4/#5/#6 in `chipTests.md`) — only for tests gated on something this harness
can never provide.

## 7. Windows/Git Bash quoting

Manual `docker exec`/`docker cp` invocations via a POSIX-shell tool on Windows must be prefixed with
`MSYS_NO_PATHCONV=1`, otherwise Git Bash mangles POSIX-style container paths (e.g. `/root/matterbridge.pics`
gets translated to a Windows path before reaching `docker`).

## 8. Verifying any change to this harness

After editing `chipTests.json`, `chipTests.md`, `run-chip-tests.mjs`, or `matterbridge.pics` (in the
`matterbridge` repo), always re-verify end-to-end rather than trusting the edit alone:

1. `node scripts/run-chip-tests.mjs --start`
2. `node scripts/run-chip-tests.mjs --test <NAME>` for the affected test(s)
3. `node scripts/run-chip-tests.mjs --stop`
4. Run the plugin's formatter/linter check on the touched files.

Keep `chipTests.md`'s manual-run shell block and prose in sync with `chipTests.json` whenever tests are
added, removed, or re-gated on a different PICS file/endpoint.

## 9. CI workflow

`.github/workflows/chip-tests.yml` runs the full suite in CI, but only on demand
(`workflow_dispatch`, no `push`/`pull_request` trigger) — a full run is dozens of tests and can take tens of
minutes, and the harness has occasionally shown session/container state leaking between tests (see
`chipTests.md` Known Issue #4), so it isn't wired into the normal per-PR gate. On a GitHub-hosted
`ubuntu-latest` runner: Docker Engine is already preinstalled (no setup step needed), and
`luligu/matterbridge:chip-test` is a modest pull (~260MB compressed per architecture, checked via the Docker
Hub API), so runner disk space isn't a concern. Every run starts on a fresh runner with no prior
`chip-test-node-modules` volume (see §1), so `--start` always pays the ~2-3 minute first-run cost — there's
no way to warm that cache between separate workflow runs. The job mirrors `build.yml`'s matterbridge
clone/build/`npm link` setup, then goes straight into `--start` → the full test run → `--stop` — no separate
docker-network step needed, since `--start` itself creates the `matterbridge` network (with `--ipv6`) on a
fresh runner that doesn't have it yet (see §1). `--stop` runs with `if: always()` so the container always
gets torn down, even on test failure. No log artifact is uploaded — `chipTests.log`/`chipTestsSummary.log` add nothing the step's own
console output doesn't already show, since `runTests()` prints every result live. The job fails naturally
because `run-chip-tests.mjs` sets a nonzero exit code whenever any executed (non-skipped) test fails.
