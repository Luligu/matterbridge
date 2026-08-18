## Chip tests

### Create and start the container (Linux, macOS, and Windows)

Run the `luligu/matterbridge:chip-test` docker image (already bundles a full Matterbridge instance built
from the `dev` branch, started with `--novirtual` — nothing local is installed, built, or mounted):

- frontend on port 8585
- container test logs directory mapped on ./temp directory

```shell
node scripts/run-matterbridge-chip-tests.mjs --start
```

### Run all configured tests inside the container

```shell
node scripts/run-matterbridge-chip-tests.mjs
```

### Manually run the tests inside the container

Open a shell in the container

```shell
docker exec -it chip-test bash
```

In the shell:

```bash
# Generic device composition and conformance
python3 src/python_testing/TC_DeviceBasicComposition.py
python3 src/python_testing/TC_DeviceConformance.py
python3 src/python_testing/TC_DefaultWarnings.py --bool-arg pixit_allow_default_vendor_id:true
```

### Stop the container

```shell
node scripts/run-matterbridge-chip-tests.mjs --stop
```

### Endpoint 0

Root node clusters:

- AccessControl
- AdministratorCommissioning
- BasicInformation
- Descriptor
- GeneralCommissioning
- GeneralDiagnostics
- GroupKeyManagement
- OperationalCredentials
- PowerSource

### Endpoint 1

Aggregator clusters:

- Descriptor

### Known Issues

- **FanControl: `TC_FAN_3_2.py`'s exact-report-count assertion is inherently timing-fragile, not a Matterbridge
  bug.** The test iteratively writes `SpeedSetting` from 1 to `SpeedMax` (no delay between writes) and asserts
  `FanMode` emits _exactly_ 3 subscription reports (one per Low/Medium/High transition). Root-caused by directly
  reproducing the failure with a throwaway script against a running container: writing **`PercentSetting`**
  (not `SpeedSetting`) at the same rapid pace — no Matterbridge code involved beyond the attribute write itself
  — produces the _identical_ symptom (2 reports, both showing the final value 3; the Low/Medium transitions are
  never delivered). This is matter.js's subscription/report engine legitimately coalescing intermediate value
  changes that occur faster than its reporting interval into a single report of the latest value — allowed by
  the Matter spec (a subscriber is only guaranteed eventual consistency, not delivery of every transient value)
  and outside Matterbridge's control. `TC_FAN_3_1.py` (which drives the same kind of `FanMode` cascade via
  `PercentSetting` writes) is not actually immune to this coalescing — it just does not assert an exact count;
  it only checks that `FanMode` and `PercentSetting` report the same number of times as each other, which holds
  regardless of how much coalescing occurs, since both attributes change together in the same transaction.
  `TC_FAN_3_2.py`'s stricter assertion has no such tolerance, so it fails whenever the DUT (Matterbridge) simply
  processes writes fast enough to trigger coalescing — arguably a fast, correct DUT exposing a fragile test
  assumption, not a defect to fix in `fanControlServer.ts`. This is why `TC_FAN_3_2.py` is expected to fail
  rather than `"skip": true` — it documents a real, reproducible discrepancy worth tracking, just not one that
  additional Matterbridge code changes can address. Note this same coalescing occasionally makes `TC_FAN_3_1.py`
  itself flaky too (observed once directly): its own report-count-parity assertion can still fail if the
  `FanMode` and `PercentSetting` subscriptions happen to coalesce by a different amount from each other on a
  given run, even though it is far more tolerant of coalescing in general than `TC_FAN_3_2.py`. Re-run the
  specific failing test alone if this happens — it passes reliably in isolation.
