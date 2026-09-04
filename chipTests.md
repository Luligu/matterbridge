# Chip tests

## Create and start the container (Linux, macOS, and Windows)

Run the `luligu/matterbridge:chip-test` docker image (already bundles a full Matterbridge instance built
from the `dev` branch, started with `--novirtual` — nothing local is installed, built, or mounted):

- frontend on port 8585
- container test logs directory mapped on ./temp directory

```shell
node scripts/run-matterbridge-chip-tests.mjs --start
```

## Run all configured tests inside the container

```shell
node scripts/run-matterbridge-chip-tests.mjs
```

## Manually run the tests inside the container

Open a shell in the container

```shell
docker exec -it chip-test bash
```

In the shell:

```bash
# Generic device composition and conformance python
python3 src/python_testing/TC_DeviceBasicComposition.py
python3 src/python_testing/TC_DeviceConformance.py
python3 src/python_testing/TC_DefaultWarnings.py --bool-arg pixit_allow_default_vendor_id:true
```

```bash
# Generic YAML certification test (chip-tool interactive server spawned/torn down for the one test,
# reusing chip-tool's own baked-in fabric pairing at node id 0x12344321 — no --server_name/--server_path,
# no separate commissioning step)
python3 scripts/tests/chipyaml/chiptool.py tests Test_TC_I_2_1 --endpoint 7
```

## Stop the container

```shell
node scripts/run-matterbridge-chip-tests.mjs --stop
```

## Endpoint 0

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

## Endpoint 1

Aggregator clusters:

- Descriptor

## Endpoint 803

Window Covering Lift clusters:

- WindowCovering (Lift and PositionAwareLift features)

## Endpoint 8031

Window Covering Tilt clusters:

- WindowCovering (Tilt and PositionAwareTilt features)

## Endpoint 8032

Window Covering Lift & Tilt clusters:

- WindowCovering (Lift, Tilt, PositionAwareLift and PositionAwareTilt features)

## Endpoint 805

Closure clusters:

- ClosureControl (Positioning, MotionLatching and Speed features)

## Endpoint 8051

Closure Pedestrian clusters:

- ClosureControl (Positioning, MotionLatching, Speed and Pedestrian features)

## Endpoint 8052

Closure Ventilation clusters:

- ClosureControl (Positioning, MotionLatching, Speed and Ventilation features)

## Endpoint 8053

Closure Calibrate clusters:

- ClosureControl (Positioning, MotionLatching, Speed and Calibration features)

## Endpoint 8054

Closure Complete clusters:

- ClosureControl (Positioning, MotionLatching, Speed, Ventilation, Pedestrian and Calibration features)

## Endpoint 8061

Closure Panel Roller clusters:

- ClosureControl (Positioning, MotionLatching and Speed features)

## Endpoint 8062

Closure Panel Roller's Roller panel (child of endpoint 8061) clusters:

- ClosureDimension (Positioning and Translation features, no MotionLatching, no Speed)

## Endpoint 8063

Closure Panel Venetian clusters:

- ClosureControl (Positioning, MotionLatching and Speed features)

## Endpoint 8064

Closure Panel Venetian's Venetian panel (child of endpoint 8063) clusters:

- ClosureDimension (Positioning and Rotation features, no MotionLatching, no Speed)

## Endpoint 8065

Closure Panel Smart-Glass clusters:

- ClosureControl (Positioning, MotionLatching and Speed features)

## Endpoint 8066

Closure Panel Smart-Glass's Smart-Glass panel (child of endpoint 8065) clusters:

- ClosureDimension (Positioning and Modulation features, no MotionLatching, no Speed)

## Endpoint 901

Thermostat Auto clusters:

- Thermostat (Heating, Cooling, and AutoMode features; 2°C deadband; heat limits 0–47°C; cool limits 3–50°C)

## Endpoint 9011

Thermostat Heating clusters:

- Thermostat (Heating feature only)

## Endpoint 9012

Thermostat Cooling clusters:

- Thermostat (Cooling feature only)

## Endpoint 9013

Thermostat Presets clusters:

- Thermostat (Heating, Cooling, AutoMode, and Presets features; no Occupancy, no OutdoorTemperature)

## Endpoint 9014

Thermostat Schedules clusters:

- Thermostat (Heating, Cooling, AutoMode, and MatterScheduleConfiguration features; no Occupancy, no
  OutdoorTemperature, no Presets)

## Endpoint 9015

Thermostat Suggestions clusters:

- Thermostat (Heating, Cooling, AutoMode, Presets, and ThermostatSuggestions features; no Occupancy, no
  OutdoorTemperature)

Configured with two real built-in presets (Occupied/Unoccupied, distinct `presetHandle`s)

## Endpoint 403

Color Temperature Light clusters:

- ColorControl (ColorTemperature feature only)

## Endpoint 404

Extended Color Light XY CT clusters:

- ColorControl (Xy and ColorTemperature features)

## Endpoint 4041

Extended Color Light HS XY CT clusters:

## Endpoint 4042

Extended Color Light EHS XY CT clusters:

- ColorControl (HueSaturation, EnhancedHue, Xy and ColorTemperature features) — the most complete
  ColorControl feature set of any Matterbridge endpoint (`createEnhancedColorControlClusterServer()`). No
  endpoint enables the ColorLoop feature — see "Known Issues" below.

## Endpoint 505

Pump clusters:

- PumpConfigurationAndControl (ConstantSpeed feature only)

## Endpoint 506

Water Valve clusters:

- ValveConfigurationAndControl (Level feature only, no TimeSync)

## Endpoint 507

Irrigation System clusters:

- OperationalState (base cluster; Pause/Stop/Start/Resume).

## Endpoint 1201

Robotic Vacuum Cleaner clusters:

- RvcRunMode (Idle, Cleaning, Mapping, and SpotCleaning modes)
- RvcCleanMode (Vacuum, Mop, and DeepClean modes)
- RvcOperationalState (Stopped, Running, Paused, Error, SeekingCharger, Charging, and Docked states)
- ServiceArea (Maps and SelectAreas; ProgressReporting and SkipArea are not implemented)

## Endpoint 1301

Laundry Washer with level temperature control clusters:

- OnOff (DeadFrontBehavior)
- LaundryWasherMode
- LaundryWasherControls (Spin and Rinse)
- TemperatureControl (TemperatureLevel)

## Endpoint 13012

Second Laundry Washer with numeric temperature control clusters:

- OnOff (DeadFrontBehavior)
- LaundryWasherMode
- LaundryWasherControls (Spin and Rinse)
- TemperatureControl (TemperatureNumber and TemperatureStep)
- DeadFrontOnOff attributes and primary functionality pass 2/2.
- LaundryWasherMode attributes and ChangeToMode pass 2/2.
- LaundryWasherControls Spin attributes pass.
- LaundryWasherControls Rinse attributes, supported-list, valid-write, and readback checks pass.
- NumberTemperatureControl passes 2/2 and LevelTemperatureControl passes 1/1.

The local `Test_TC_WASHERCTRL_2_2.yaml` patch removes only the upstream final step that writes undefined
`NumberOfRinsesEnum` value `4`; CHIP rejects that value locally during encoding before any request reaches the DUT,
so the step cannot test the expected `INVALID_IN_STATE` response. The patched Rinse test does not cover `INVALID_IN_STATE`;
that requires a separate valid test scenario using a defined enum value that is unavailable in the current mode's `SupportedRinses` list.

## Endpoint 1302

Refrigerator clusters:

- Refrigerator And Temperature Controlled Cabinet Mode
- Refrigerator Alarm

- `Test_TC_TCCM_2_1` contains only disabled manual verification steps and executes no conformance checks.
- `Test_TC_REFALM_2_3` requires local alarm suppression, which endpoint 1302 does not implement, and every suppression step is gated on `PICS_USER_PROMPT` (0 here), so it would run no conformance check even if enabled.

## Endpoint 1305

Dishwasher clusters:

- Dishwasher Mode
- Dishwasher Alarm

## Endpoint 1306

Laundry Dryer cluster:

- Laundry Dryer Controls

The local `Test_TC_DRYERCTRL_2_1.yaml` patch omits the upstream write of undefined `DrynessLevelEnum` value `4`,
the same class of issue as the WASHERCTRL patch above: chip-tool rejects that value during local command encoding
before any request reaches the DUT, so the step cannot verify the expected `CONSTRAINT_ERROR`. Separately, the
test's `INVALID_IN_STATE` scenario is gated by `DRYERCTRL.S.M.ManuallyControlled`, which endpoint 1306 does not
support, so that step does not apply either.

## Endpoint 1308

Cooktop clusters:

- OnOff (OffOnly)
- Fixed Label

The local `Test_TC_OO_2_2.yaml` patch adds the triggering command's PICS guard to each subsequent state read. The
upstream test otherwise skips an unsupported `On` or `Toggle` command on an OffOnly endpoint but still asserts the
state change that command would have caused. The local `Test_TC_OO_2_6.yaml` patch removes those same unsupported
commands' contradictory PICS guards from the negative checks, allowing the test to verify the Matter 1.6-required
`UNSUPPORTED_COMMAND` responses.

## Endpoint 13091

Top Oven Cabinet clusters:

- Oven Mode
- Oven Cavity Operational State

- `CountdownTime` is not implemented on endpoint 13091. The corresponding upstream Matter 1.6 script also hardcodes
  endpoint 1 instead of using its configured endpoint.

## Endpoint 1311

Microwave Oven clusters:

- Microwave Oven Mode
- Microwave Oven Control (`PowerAsNumber` and `PowerNumberLimits`)

## Endpoint 1409

Electrical Utility Meter clusters:

- Meter Identification

## Endpoint 14091

Electrical Meter (child of Electrical Utility Meter, endpoint 1409) clusters:

- Commodity Metering

## Endpoint 14092

Electrical Energy Tariff Upcoming (child of Electrical Utility Meter, endpoint 1409) clusters:

- Commodity Price
- Commodity Tariff

## Patched CHIP tests

Local copies under `docker/chip-test/patches/`, applied over the same-named upstream file inside the container
by `--start` (see `chipTests.json`'s `"patches"` array and chip-tests instructions §12). Each is a stopgap for a
stale/buggy upstream test file, not a Matterbridge behavior change — remove the entry (and the file) once the
corresponding upstream fix merges and a new `chip-test` image is published with it baked in.

| Patched file                   | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TC_DeviceBasicComposition.py` | `test_TC_DESC_2_1`'s hand-coded `Descriptor.TagList` namespace whitelist stops at `0x43` and predates the eight Matter 1.6 namespaces (five Closure, three Commodity Tariff) our devices can emit, so a fully spec-compliant `Closure` tag (`namespaceID=0x44`) is rejected. See "Known Issues" below and [PR #73481](https://github.com/project-chip/connectedhomeip/pull/73481) (open/unmerged).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `TC_FAN_3_1.py`                | Same coalescing race as `TC_FAN_3_2.py` below, but with no upstream fix to copy: the unpatched test fires its whole `value_range` of writes back-to-back with no synchronization, so matter.js's report engine can coalesce reports out from under `verify_number_of_fan_mode_reports()`'s report-count-parity check, and a report arriving mid-iteration of `log_results()`'s live subscription queue can raise `RuntimeError: deque mutated during iteration`. Patch adds a `wait_for_triggered_reports()`/`wait_for_latest_report_value()` pair (same synchronization approach as PR #73629 below, generalized to `TC_FAN_3_1.py`'s two update-attribute scenarios) and snapshots the subscription queue before iterating it. See "Known Issues" below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `TC_FAN_3_2.py`                | The exact-report-count assertion (`FanMode` emits exactly 3 subscription reports) is timing-fragile: matter.js's report engine legitimately coalesces rapid intermediate value changes into one report, which the Matter spec allows. Upstream already fixed this on master ([PR #73629](https://github.com/project-chip/connectedhomeip/pull/73629), merged 2026-08-25) by synchronizing on each report instead of loosening the assertion; our patch is that fixed master file copied in as-is, not a local rewrite — not yet backported to `v1.6-branch`/`v1.6.1-branch` or baked into the published `chip-test` image.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Test_TC_TSTAT_2_1.yaml`       | Uses the DUT's implemented `AbsMinHeatSetpointLimit`/`AbsMaxHeatSetpointLimit` for the corresponding `MinHeatSetpointLimit`/`MaxHeatSetpointLimit` checks instead of always applying the upstream 7°C/30°C fallback values. The hardcoded fallbacks remain for DUTs that do not implement the optional absolute-limit attributes. This permits endpoint 901's spec-valid 0°C minimum and endpoint 9011's spec-valid 50°C maximum while retaining the relative Matter 1.6 setpoint-limit checks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
|                                |
| `Test_TC_OO_2_2.yaml`          | Adds the triggering command's PICS guard to each subsequent state read, so an unsupported `On`/`Toggle` command on an OffOnly endpoint (Cooktop, endpoint 1308) no longer asserts the state change that skipped command would have caused.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Test_TC_OO_2_3.yaml`          | The final exact-zero `OffWaitTime` assertion is timing-fragile (a couple of seconds of container/round-trip latency can leave a small residual value on this specific step). The patch relaxes that one check from an exact `value: 0` to a `constraints: minValue 0, maxValue 2 * PIXIT.OO.MaxCommunicationTurnaround` range.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `Test_TC_OO_2_6.yaml`          | Removes the same unsupported `On`/`Toggle` commands' contradictory PICS guards from the negative checks, so the test can verify the Matter 1.6-required `UNSUPPORTED_COMMAND` responses on an OffOnly endpoint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `Test_TC_DRLK_2_1.yaml`        | Corrects the no-PIN `LockDoor` and `UnlockDoor` PICS guards. Upstream requires both PIN and Credential OTA Access to send a PIN, but its fallback path runs only when both features are absent; the patch runs that path whenever the combined requirement is false, including endpoint 8011 where PIN is supported without COTA.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Test_TC_DRLK_2_4.yaml`        | Replaces the upstream sample-app path's hardcoded 60-second `AutoRelockTime` and 70000 ms wait with typed `PIXIT.DRLK.AutoRelockTime` and `PIXIT.DRLK.AutoRelockWaitTimeMs` config values. Their defaults preserve upstream behavior; `chipTests.json` overrides them to 1 second and 6000 ms for endpoints 801 and 8011, retaining the expiry check while avoiding a 70-second suite delay.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `TC_DRLK_2_5.py`               | Uses the configured test endpoint instead of hardcoded endpoint `1`, allowing the week day schedule test to target endpoint 8012.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Test_TC_DRLK_2_6.yaml`        | Adds the missing `DRLK.S.F08 && DRLK.S.C1d.Rsp` guard to the final `ClearUser` cleanup. It also removes the invalid `OperatingModeEnum` value `5` step, which chip-tool rejects locally during enum encoding before the command reaches the DUT, so it cannot verify the expected `INVALID_COMMAND` response.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `Test_TC_DRLK_2_8.yaml`        | Removes the step that asks chip-tool to encode undefined `UserStatusEnum` value `5`. Encoding fails locally before a command reaches the DUT, so the step cannot test the expected `INVALID_COMMAND` response. Master independently added a similar `SetUser` step with an out-of-range `UserType` value (`10`) elsewhere in the file — tried and reverted (2026-08-31): it hits the same local-encoding-rejection class of issue (`CONSTRAINT_ERROR` before the request reaches the DUT, so the DUT-side `INVALID_COMMAND` never gets exercised), failing the `DoorLockUserPINSchedules` run. Do not re-add it without a chip-tool/YAML-runner change that stops rejecting out-of-range enum literals locally.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `TC_DRLK_2_9.py`               | Uses the configured test endpoint instead of hardcoded endpoint `1`. It also validates `InteractionModelError.clusterStatus` for Door Lock `DUPLICATE`/`OCCUPIED` responses and applies the test's existing duplicate-or-occupied sentinel consistently in both response and exception paths.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `Test_TC_WASHERCTRL_2_2.yaml`  | Removes the upstream final step that writes undefined `NumberOfRinsesEnum` value `4`; CHIP rejects that value locally during enum encoding before any request reaches the DUT, so the step cannot test the expected `INVALID_IN_STATE` response.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `Test_TC_DRYERCTRL_2_1.yaml`   | Same class of issue as WASHERCTRL: omits the upstream write of undefined `DrynessLevelEnum` value `4`, which CHIP rejects locally during encoding before reaching the DUT, so the step cannot verify the expected `CONSTRAINT_ERROR`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `TC_MWOCTRL_2_2.py`            | Corrects the upstream `MaxPower < 100` assertion to `MaxPower <= 100`, as required by Matter 1.6 §8.13.5.5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `TC_EEVSE_2_2.py`              | Targets the configured EVSE endpoint (1401) for the `UserMaximumChargeCurrent` write instead of the upstream test's hardcoded endpoint `1`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `TC_TSTAT_2_2.py`              | Base file copied verbatim from `connectedhomeip` **master** at commit [`4624ece9`](https://github.com/project-chip/connectedhomeip/commit/4624ece91bbb3ed9c576ae8321e6b809f1a189d8) (2026-08-10), from PR [#42326](https://github.com/project-chip/connectedhomeip/pull/42326) "Thermostat - Relocate setpoint logic to separate files" (merged 2026-07-17), which rewrote it to drive a `ThermostatSimulator`/`ThermostatState` reference model (`TC_TSTAT_Utils.py`) instead of hand-computed, never-refreshed local variables. This replaces the older, pre-#42326 version baked into the `chip-test` image, whose hardcoded Step 6b expectation was simply wrong (see "Known Issues" below) and whose later steps relied on stale captured values that the correct DUT behavior happened to paper over. On top of that base, two small local corrections fix genuine bugs still present in #42326's rewrite as of this writing (see "Known Issues"): Step 9b writes `absMinCoolSetpointLimit - 10` instead of the wrong `minCoolSetpointLimit - 10` (matching its own documented intent), and Step 9c's `hasAutoModeFeature` branch computes a real deadband-aware target instead of duplicating its `else` branch. Not yet backported to a release branch or baked into the published `chip-test` image. |
| `TC_TSTAT_Utils.py`            | New file, not present in the `chip-test` image at all — `TC_TSTAT_2_2.py`'s reference-model dependency, introduced by the same PR [#42326](https://github.com/project-chip/connectedhomeip/pull/42326). Copied verbatim from `connectedhomeip` **master** at commit [`324f0aa3`](https://github.com/project-chip/connectedhomeip/commit/324f0aa34abb18b2ec0fafd53f7d3224500e92d7) (2026-07-17, the PR's merge commit). Defines `ThermostatState` (a full attribute snapshot) and `ThermostatSimulator` (mirrors the C++ `Setpoints::Fix()`/`ChangeLimits` reconciliation `TC_TSTAT_2_2.py` exercises), so `write_setpoint()`/`send_raise_lower_and_verify()` compute the expected outcome dynamically per-call instead of asserting fixed constants. Verified compatible with this image's baked `matter.testing` package (`EventSubscriptionHandler`, `TestStep`, `default_matter_test_main` all resolve).                                                                                                                                                                                                                                                                                                                                                                                                   |

# Known Issues

## matter.js discovery

- **Refrigerator Alarm / Dishwasher Alarm: `@matter/node`'s generic Alarm Base cluster schema resolves `Mask`/
  `State`/`Supported`/`Notify` against an empty base-cluster `AlarmBitmap`, not the device-specific one — a
  matter.js modeling gap, worked around locally in both single-class devices' cluster server code.**
  `RefrigeratorAlarmServer`/`DishwasherAlarmServer` (`@matter/node`) each inherit their alarm-bearing attributes
  and the `Notify` event from the shared Alarm Base cluster, but Alarm Base itself only declares an empty
  `AlarmBitmap` type placeholder — the device-specific bits (Matter 1.6 Application Cluster Specification
  §8.8.6.1 for Refrigerator, §8.4.4.1 for Dishwasher; Alarm Base §1.15.6.3, §1.15.6.4, §1.15.8.1 for the shared
  element definitions) are never bound to the inherited elements' wire schema, so reading/writing them against
  the real per-device bitmap fails. `MatterbridgeRefrigeratorAlarmServer` (`packages/core/src/devices/refrigerator.ts`)
  and `MatterbridgeDishwasherAlarmServer` (`packages/core/src/devices/dishwasher.ts`) each redeclare `Mask`/
  `State`/`Supported`/`Notify` via `<Alarm>Server.schema.extend(...)`, rebinding those elements' type to the
  correct device-specific `AlarmBitmap` so the wire schema resolves correctly. This is a schema-level fix in
  the single-class device's own server class, not a test-only patch — no corresponding
  `docker/chip-test/patches/` entry exists for it, since it's part of the device implementation itself, not a
  workaround for a stale upstream CHIP test file.
