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

## Bind a client cluster (Chime client on the Doorbell)

A few device types mandate a _client_ cluster: the Doorbell (device type `0x0148`) must host a Chime client,
which in the demo device tree lives on endpoint 1609, while the Chime _server_ lives on its own endpoint 1607.
A client cluster has nothing to read — to point it at a server you write the `Binding` cluster (`0x001E`)
`Binding` attribute (`0x0000`) on the endpoint that hosts the client.

Check the two halves first (endpoint 1609 must list Binding as a server and Chime as a client, endpoint 1607
must list Chime as a server):

```bash
chip-tool descriptor read server-list 0x12344321 1609   # ... 30 (Binding) ...
chip-tool descriptor read client-list 0x12344321 1609   # 1366 (Chime)
chip-tool descriptor read server-list 0x12344321 1607   # ... 1366 (Chime) ...
```

### Both fabrics need their own binding

The `Binding` attribute is fabric-scoped (`fabricScoped="true"` on both the attribute and `TargetStruct`, see
`chip/1.6.0/xml/clusters/Binding-Cluster.xml`), so each fabric sees and writes only its own entries. The
container is commissioned on two fabrics — fabric index 1 is chip-tool's baked-in `alpha` identity, fabric
index 2 is the Python test framework's `default_controller` (`operationalcredentials read commissioned-fabrics`
reports `2`). A binding written from chip-tool is invisible to the Python tests and vice versa, so write it on
both. They do not overwrite each other: a fabric-scoped write replaces only the writing fabric's entries.

Fabric 1, from chip-tool:

```bash
chip-tool binding write binding \
  '[{"fabricIndex":1,"node":305414945,"endpoint":1607,"cluster":1366}]' \
  0x12344321 1609
```

`0x12344321` and `1609` are the _destination_ node and endpoint — the endpoint whose binding table is being
written, i.e. the one hosting the client. The target endpoint 1607 appears only inside the JSON. Struct fields
want decimal, so the node id is repeated as `305414945` (`0x12344321`) and the cluster as `1366` (`0x0556`,
Chime). `fabricIndex` is assigned by the server from the writing session and ignored on write.

Fabric 2 cannot be driven from chip-tool at all. It is not a CLI limitation — chip-tool happily holds several
fabrics, one per `--commissioner-name` identity — but fabric 2 was commissioned by the Python framework from
its _own_ root CA, whose private key exists only in `/root/connectedhomeip/admin_storage.json`. Joining an
existing fabric requires a NOC chaining to that fabric's root plus the matching operational private key, and
chip-tool has no way to import another controller's credentials: each identity mints its own CA and NOCs in
`/tmp/chip_tool_config.<identity>.ini`. The DUT confirms the split — the two fabrics report different
`RootPublicKey` values. A `--commissioner-name beta` invocation would create a _third_ fabric needing its own
commissioning, and until then cannot even resolve the node (operational DNS-SD instance names are keyed by the
compressed fabric id, derived from the root public key, so the lookup just times out).

The interactive equivalent of chip-tool for fabric 2 is `matter-repl`, pointed at the Python framework's own
storage (note it takes no `--simple-prompt`; unknown flags abort the startup script and leave you with a bare
IPython prompt and no `devCtrl`):

```bash
docker exec -it chip-test /root/connectedhomeip/out/python_env/bin/matter-repl \
  -s /root/connectedhomeip/admin_storage.json
```

```python
await devCtrl.ReadAttribute(0x12344321, [(1609, Clusters.Binding.Attributes.Binding)])
```

Only one process may use `admin_storage.json` at a time, so close the REPL before running Python tests.

For a scripted or repeatable binding — and for anything unattended, since the runner cannot type into an
interactive prompt — use [docker/chip-test/bind.py](docker/chip-test/bind.py), a cluster-agnostic helper that
writes the Binding attribute on any endpoint. Copy it in, run it, delete it (the same pattern as §4 of the
chip-tests instructions):

```bash
docker cp docker/chip-test/bind.py chip-test:/root/connectedhomeip/src/python_testing/__bind.py
docker exec chip-test python3 src/python_testing/__bind.py \
  --int-arg source_endpoint:1609 --string-arg 'targets:[{"endpoint": 1607, "cluster": 1366}]'
docker exec chip-test rm -f /root/connectedhomeip/src/python_testing/__bind.py
```

`source_endpoint` is the endpoint hosting the client cluster. `targets` is a JSON list of binding targets:
each entry is either unicast (`endpoint`, plus an optional `node` defaulting to the DUT node id) or group
(`group`), with an optional `cluster` narrowing the binding to one client cluster. Add `--bool-arg
append:true` to merge with this fabric's existing entries instead of replacing them, and pass `targets:[]` to
clear them. The script prints the binding list before and after, and fails if the write is rejected.

### Verify

A plain read is fabric-filtered and shows only the caller's own entry, so pass `--fabric-filtered false` to see
both:

```bash
chip-tool binding read binding 0x12344321 1609 --fabric-filtered false
```

```text
Binding: 2 entries
  [1]: { Node: 305414945, Endpoint: 1607, Cluster: 1366, FabricIndex: 1 }
  [2]: { Node: 305414945, Endpoint: 1607, Cluster: 1366, FabricIndex: 2 }
```

### Notes

- A write replaces the writing fabric's entries wholesale — it does not append, and it does not touch entries
  belonging to other fabrics. So the Python write above leaves the chip-tool entry intact (the verification read
  still shows both), but a second chip-tool write would drop the first chip-tool target. To add a target to a
  fabric that already has one, read that fabric's current list and write all its entries back together. Writing
  `[]` clears only the calling fabric's bindings.
- A `TargetStruct` is either unicast (`node` + `endpoint`, optionally narrowed by `cluster`) or group
  (`group` instead of `node`/`endpoint`); the two forms are mutually exclusive. Omitting `cluster` binds every
  client cluster on the source endpoint.
- The binding is only an address book entry and grants no access. An invoke from the client is still subject to
  the target's ACL — irrelevant here, since source and target are the same node and the existing admin entries
  already cover endpoint 1607, but a real cross-node binding also needs an ACL entry on the target admitting
  the source node at `operate` privilege.
- `Binding` is `nonVolatile`, so entries survive a container restart. They are cleared by `--reset` (stateful
  cluster storage wipe) and by re-pairing the fabrics.

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

## Endpoint 1401

EVSE clusters:

- Energy EVSE (`ChargingPreferences`)
- Energy EVSE Mode

The optional SoC Reporting, Plug and Charge, RFID, and V2X tests remain listed but skipped for this endpoint
because those features are not enabled by its base profile.

## Endpoint 14011

EVSE Complete clusters:

- Energy EVSE (`V2X`, `ChargingPreferences`, `SoCReporting`, `PlugAndCharge`, and `RFID`)
- Energy EVSE Mode (including the V2X mode)

This endpoint runs the complete `TC_EEVSE_2_1` through `TC_EEVSE_2_10` matrix with
`energy-evse-complete.pics`, plus the Energy EVSE Mode tests. Its CHIP test-event-trigger support includes the
SoC low/high/clear, VehicleID, and RFID stimuli in addition to the shared base EVSE triggers.

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

## Endpoint 1601

Camera clusters:

- Camera AV Stream Management (Video, Audio, Snapshot and ImageControl)

`chipTests.json` includes all 21 numbered `TC_AVSM_2_1` through `TC_AVSM_2_21` tests,
plus `TC_AVSM_StreamReuseRangeParams` and `TC_AVSM_VideoStreamsPersistence`.
The shared `TC_AVSMTestBase.py` is a helper, not a standalone test. No AVSM YAML tests
are present in the CHIP container.

Run with `npm run chip:test -- --test TC_AVSM_`. The focused
`camera-av-stream-management.pics` declares the server and the feature aliases consumed
by the persistence tests; other capabilities are discovered from the live endpoint.
SDK CI mode disables interactive snapshot image verification in `TC_AVSM_2_10` (and
that upstream mode also tolerates snapshot capture command errors).

`TC_AVSM_2_7` uses `--int-arg minFrameRate:20` to keep its resource-exhaustion
check within the camera's 60 fps maximum. The default produces a 65 fps request,
which correctly returns `DynamicConstraintError` before checking available resources.

WebRTC session creation increments the reference counts of its video and audio streams;
ending the session decrements them. Referenced streams reject deallocation with
`InvalidInState` (Matter 1.6 §§11.5.6.1.10, 11.5.6.3.12 and 11.5.6.7.3).

`TC_AVSM_2_16` and `TC_AVSM_2_17` receive the app-pipe path, but their optional
`SetHardPrivacyModeOn` stimulus is not implemented by the Matterbridge backchannel.

`TC_AVSM_2_18` through `TC_AVSM_2_21` perform actual mid-test DUT reboots via
`request_device_reboot()`, served by the restart-flag monitor (see "Mid-test DUT reboots"
below). They pass `--restart-flag-file` and set `resetBefore`, since a stream left
allocated by an earlier test now genuinely survives a restart and would break their
"AllocatedVideoStreams should be empty" precondition.

`TC_AVSM_VideoStreamsPersistence` is skipped. Its steps 12 and 14 simulate a reboot by
sending `FaultInjection.FailAtFault` (manufacturer-specific cluster `0xFFF1FC06` on
endpoint 0) with `kChipFault` ids 34 (`kFault_ClearInMemoryAllocatedVideoStreams`) and
37 (`kFault_LoadPersistentCameraAVSMAttributes`), to clear the in-memory stream list and
then re-run the persistent-attribute load path. That cluster is a chip example-app debug
hook into the C++ `camera-app` internals, not something a bridge implements, so step 12
fails with `UnsupportedCluster (0xc3)` — steps 1 through 11 pass, allocating the video
stream normally. It is gated on a missing cluster rather than a PICS flag, so no PICS
change unlocks it. It is also a `PICS_SDK_CI_ONLY` SDK-internal test rather than a
certification test, which is why it carries no `TC_AVSM_<n>_<m>` number. Implementing a
minimal `MATTERBRIDGE_CHIP_TEST`-gated FaultInjection server for those two fault ids
would make it runnable, and would be the only AVSM test that actually asserts allocated
video streams survive a restart.

## Mid-test DUT reboots (restart-flag monitor)

Several Python tests reboot the DUT mid-run to assert that state survives a restart:
`TC_ACL_2_10`, `TC_AVSM_2_18` through `TC_AVSM_2_21`, `TC_BINFO_2_2` and `TC_CC_6_5`.
They all go through the one shared `MatterBaseTest.request_device_reboot()` in
`matter/testing/matter_testing.py`, which has two branches.

Without `--restart-flag-file` it takes the manual branch: it prompts an operator to reboot
the DUT and blocks on `input()`. Under this noninteractive harness stdin is closed, so
`wait_for_user_input()` swallows the `EOFError`, returns `None`, and the caller ignores
it — the test continues as if a reboot had happened and its persistence assertions pass
vacuously against a bridge that never restarted. A pass from that branch proves nothing.

With `--restart-flag-file <path>` it takes the flag branch: it writes `restart` into the
file, expires its CASE sessions, and blocks in `wait_for_restart_flag_file_removal()`,
whose contract is that the flag disappears only _after_ the DUT is fully rebooted and
ready, with a hard 30 s timeout.

Restarting the container to serve that is not an option: `docker/entrypoint.chip-test.sh`
ends in `exec "$@"`, so Matterbridge is PID 1 and a `docker restart` would kill the Python
test running inside the same container via `docker exec`. Instead `createChipTestRestartFlag()`
in `packages/core/src/chipTests.ts` polls the flag and reuses Matterbridge's own frontend
restart path — `restartProcess()`, i.e. `/api/restart` — which cleans up the instance and
reloads a fresh one in-process (`cliEmitter` `restart` -> `Matterbridge.loadInstance(true)`
in `cli.ts`) without ever exiting Node. The container and the test both stay up while the
DUT genuinely restarts and reloads its state from the node storage.

It is called from `startBridge()` alongside `createChipTestAppPipe()`, so it is gated
behind `MATTERBRIDGE_CHIP_TEST` the same way, and its timer and state are module level so
they outlive the instance that requested the restart. The flag is cleared only once the
root server node re-emits `online` — clearing it earlier would both let the test resume
against a still-booting bridge and let the monitor's own poll see the stale flag and fire
a second, spurious restart. Only `restart` is handled; the `factory reset` variants that
`request_device_factory_reset()` writes are left in place so the test fails loudly rather
than being told a reset it asked for had completed.

To add a reboot-backed test, pass `--restart-flag-file /tmp/matterbridge-chip-test-restart-flag`
in that entry's `args`. A completed reboot logs `CHIP test restart requested via ...`,
`Cleanup completed. Restarting...` and `CHIP test restart completed, cleared restart flag ...`,
and takes roughly 4-5 s against the 30 s budget. To confirm a run really rebooted rather
than falling into the EOF branch, check that `chipTests.log` contains no `EOF on STDIN`
and one `App reboot completed successfully` per reboot. Note the container's `local` log
driver rotates at 100 MB x 3, so `docker logs` may only show the most recent cycles —
`chipTests.log` is the reliable record.

### StartUp* attributes are ignored on bridged endpoints

`TC_CC_6_5` is skipped despite the reboot working. matter.js guards the startup logic of
all three `StartUp*` clusters with `!this.endpoint.ownerOfType(AggregatorEndpoint)` —
`OnOffServer` (`StartUpOnOff`), `LevelControlServer` (`StartUpCurrentLevel`) and
`ColorControlServer` (`StartUpColorTemperatureMireds`) — so none of them apply on an
endpoint under an aggregator, which every Matterbridge bridged device is. It comes from
matter.js PR #3048 ("Ignore Startup definitions for Bridged devices"), whose stated
rationale is that the values "are for the bridged devices".

That guard has no basis in the specification. The only exception the Matter 1.6 cluster
spec defines for these attributes is OTA ("This behavior does not apply to reboots
associated with OTA"), which is the _other_ half of the same condition
(`bootReason !== SoftwareUpdateCompleted`). There is no aggregator or bridge carve-out in
§1.5.7 (OnOff), §1.6.7 (LevelControl) or §3.2.7.23 (ColorControl), and Core §9.12.2.4 says
a Bridge's clusters are to be interacted with "in the same manner as with a native Matter
Node of that device type". Core §7.12.1 also defines a restart to include "a program
restart", and explicitly blesses the pattern of "a persistent configuration attribute A
that contains a value to use to restore persistent state attribute B after a restart".

Verified directly against endpoint 401: with `StartUpOnOff` set to 1 (On) and `OnOff`
false, a real reboot through the restart-flag monitor left `OnOff` false.

The practical problem is that the attributes are implemented and advertised but silently
ignored — `CC.S.A4010`, `OO.S.A4003` and `LVL.S.A4000` are all declared `1` in the PICS
files, so a controller can write them, read them back, and never see them take effect.

Matterbridge therefore re-applies the startup value itself, in the `initialize()` override
of `MatterbridgeOnOffServer`, `MatterbridgeLevelControlServer` and
`MatterbridgeColorControlServer`, after `super.initialize()` has skipped it. The OTA
exclusion the spec _does_ define is honoured through `isSoftwareUpdateBoot()` in
`matterbridgeServer.ts`. ColorControl's logic is mirrored rather than reused, because
matter.js keeps the aggregator guard _inside_ `initializeColorTemperature()`, so that
method cannot simply be re-entered.

The override is not gated: it applies in normal runs too. That is safe because every helper
defaults its startup attribute to `null`, and `null` is the spec's "keep the previous
value" — so the override is a no-op unless a controller has explicitly written a non-null
value, which is exactly the request the attribute exists to express. All five
`create*ColorControlClusterServer()` helpers now take `startUpColorTemperatureMireds` as a
trailing optional parameter, matching `createDefaultOnOffClusterServer()`'s `startUpOnOff`
and `createDefaultLevelControlClusterServer()`'s `startUpCurrentLevel`. Remove the three
overrides and `isSoftwareUpdateBoot()` once matter.js applies StartUp* on aggregator-owned
endpoints itself.

With the override in place `TC_CC_6_5` passes. Verified on endpoint 401 for OnOff too:
with `StartUpOnOff` set to 1 (On) and `OnOff` false, a reboot through the restart-flag
monitor now leaves `OnOff` true — the exact inverse of the behavior without it.

`Test_TC_OO_2_4` (the `StartUpOnOff` equivalent) is additionally unreachable by this
monitor: it is YAML-only, and YAML tests have no `--restart-flag-file`. Their reboot steps
are either `SystemCommands.Reboot` under `PICS_SDK_CI_ONLY` — which restarts an app
chip-tool itself spawned, not a separately running bridge — or a `LogCommands.UserPrompt`
answered on stdin, where canned input would fake the reboot rather than perform one.
`LevelControl` has no certification test for `StartUpCurrentLevel` at all, so that
attribute is unexercised either way.

## Endpoint 1607

Chime clusters:

- Chime

## Endpoint 1609

Doorbell clusters:

- Switch (single-press momentary switch: MomentarySwitch feature only)

## Patched CHIP tests

Local copies under `docker/chip-test/patches/`, applied over the same-named upstream file inside the container
by `--start` (see `chipTests.json`'s `"patches"` array and chip-tests instructions §12). Each is a stopgap for a
stale/buggy upstream test file, not a Matterbridge behavior change — remove the entry (and the file) once the
corresponding upstream fix merges and a new `chip-test` image is published with it baked in.

### `TC_DeviceBasicComposition.py`

`test_TC_DESC_2_1`'s hand-coded `Descriptor.TagList` namespace whitelist stops at `0x43` and predates the
eight Matter 1.6 namespaces (five Closure, three Commodity Tariff) our devices can emit, so a fully
spec-compliant `Closure` tag (`namespaceID=0x44`) is rejected. See "Known Issues" below. Upstream fixed this
on master ([PR #73481](https://github.com/project-chip/connectedhomeip/pull/73481), merged) by checking
`self.xml_namespaces` instead of a literal list; the patch now carries that same data-driven check, but
master's file cannot be copied verbatim because it relies on `BasicCompositionTests.xml_namespaces`, which
`v1.6-branch` does not populate — the patch builds the namespace map itself and defers to the attribute as
soon as a future image provides it.

### `TC_FAN_3_1.py`

Same coalescing race as `TC_FAN_3_2.py` below, but with no upstream fix to copy: the unpatched test fires its
whole `value_range` of writes back-to-back with no synchronization, so matter.js's report engine can coalesce
reports out from under `verify_number_of_fan_mode_reports()`'s report-count-parity check, and a report
arriving mid-iteration of `log_results()`'s live subscription queue can raise `RuntimeError: deque mutated
during iteration`. Patch adds a `wait_for_triggered_reports()`/`wait_for_latest_report_value()` pair (same
synchronization approach as PR #73629 below, generalized to `TC_FAN_3_1.py`'s two update-attribute scenarios)
and snapshots the subscription queue before iterating it. See "Known Issues" below.

### `TC_FAN_3_2.py`

The exact-report-count assertion (`FanMode` emits exactly 3 subscription reports) is timing-fragile:
matter.js's report engine legitimately coalesces rapid intermediate value changes into one report, which the
Matter spec allows. Upstream already fixed this on master
([PR #73629](https://github.com/project-chip/connectedhomeip/pull/73629), merged 2026-08-25) by synchronizing
on each report instead of loosening the assertion; our patch is that fixed master file copied in as-is, not a
local rewrite — not yet backported to `v1.6-branch`/`v1.6.1-branch` or baked into the published `chip-test`
image.

### `Test_TC_TSTAT_2_1.yaml`

Uses the DUT's implemented `AbsMinHeatSetpointLimit`/`AbsMaxHeatSetpointLimit` for the corresponding
`MinHeatSetpointLimit`/`MaxHeatSetpointLimit` checks instead of always applying the upstream 7°C/30°C fallback
values. The hardcoded fallbacks remain for DUTs that do not implement the optional absolute-limit attributes.
This permits endpoint 901's spec-valid 0°C minimum and endpoint 9011's spec-valid 50°C maximum while retaining
the relative Matter 1.6 setpoint-limit checks.

### `Test_TC_OO_2_2.yaml`

Adds the triggering command's PICS guard to each subsequent state read, so an unsupported `On`/`Toggle`
command on an OffOnly endpoint (Cooktop, endpoint 1308) no longer asserts the state change that skipped
command would have caused.

### `Test_TC_OO_2_3.yaml`

The final exact-zero `OffWaitTime` assertion is timing-fragile (a couple of seconds of container/round-trip
latency can leave a small residual value on this specific step). The patch relaxes that one check from an
exact `value: 0` to a `constraints: minValue 0, maxValue 2 * PIXIT.OO.MaxCommunicationTurnaround` range.

### `Test_TC_OO_2_6.yaml`

Removes the same unsupported `On`/`Toggle` commands' contradictory PICS guards from the negative checks, so
the test can verify the Matter 1.6-required `UNSUPPORTED_COMMAND` responses on an OffOnly endpoint.

### `Test_TC_DRLK_2_1.yaml`

Corrects the no-PIN `LockDoor` and `UnlockDoor` PICS guards. Upstream requires both PIN and Credential OTA
Access to send a PIN, but its fallback path runs only when both features are absent; the patch runs that path
whenever the combined requirement is false, including endpoint 8011 where PIN is supported without COTA.

### `Test_TC_DRLK_2_4.yaml`

Replaces the upstream sample-app path's hardcoded 60-second `AutoRelockTime` and 70000 ms wait with typed
`PIXIT.DRLK.AutoRelockTime` and `PIXIT.DRLK.AutoRelockWaitTimeMs` config values. Their defaults preserve
upstream behavior; `chipTests.json` overrides them to 1 second and 6000 ms for endpoints 801 and 8011,
retaining the expiry check while avoiding a 70-second suite delay.

### `TC_DRLK_2_5.py`

Uses the configured test endpoint instead of hardcoded endpoint `1`, allowing the week day schedule test to
target endpoint 8012.

### `Test_TC_DRLK_2_6.yaml`

Adds the missing `DRLK.S.F08 && DRLK.S.C1d.Rsp` guard to the final `ClearUser` cleanup. It also removes the
invalid `OperatingModeEnum` value `5` step, which chip-tool rejects locally during enum encoding before the
command reaches the DUT, so it cannot verify the expected `INVALID_COMMAND` response.

### `Test_TC_DRLK_2_8.yaml`

Removes the step that asks chip-tool to encode undefined `UserStatusEnum` value `5`. Encoding fails locally
before a command reaches the DUT, so the step cannot test the expected `INVALID_COMMAND` response. Master
independently added a similar `SetUser` step with an out-of-range `UserType` value (`10`) elsewhere in the
file — tried and reverted (2026-08-31): it hits the same local-encoding-rejection class of issue
(`CONSTRAINT_ERROR` before the request reaches the DUT, so the DUT-side `INVALID_COMMAND` never gets
exercised), failing the `DoorLockUserPINSchedules` run. Do not re-add it without a chip-tool/YAML-runner
change that stops rejecting out-of-range enum literals locally.

### `TC_DRLK_2_9.py`

Uses the configured test endpoint instead of hardcoded endpoint `1`. It also validates
`InteractionModelError.clusterStatus` for Door Lock `DUPLICATE`/`OCCUPIED` responses and applies the test's
existing duplicate-or-occupied sentinel consistently in both response and exception paths.

### `Test_TC_WASHERCTRL_2_2.yaml`

Removes the upstream final step that writes undefined `NumberOfRinsesEnum` value `4`; CHIP rejects that value
locally during enum encoding before any request reaches the DUT, so the step cannot test the expected
`INVALID_IN_STATE` response.

### `Test_TC_DRYERCTRL_2_1.yaml`

Same class of issue as WASHERCTRL: omits the upstream write of undefined `DrynessLevelEnum` value `4`, which
CHIP rejects locally during encoding before reaching the DUT, so the step cannot verify the expected
`CONSTRAINT_ERROR`.

### `TC_MWOCTRL_2_2.py`

Corrects the upstream `MaxPower < 100` assertion to `MaxPower <= 100`, as required by Matter 1.6 §8.13.5.5.

### `Test_TC_EEVSE_2_1.yaml`

The Energy EVSE attribute test baked into the current `chip-test` image uses `epoch-s` and `energy-mWh` as
constraint type names. Those spellings describe the units, but they are not keys registered by the CHIP YAML
runner. Its constraint parser accepts `epoch_s` and `energy_mwh`, so the unpatched test rejects a valid
attribute value locally while processing the response, before it can evaluate that value against the test's
range constraints.

The local copy changes only those constraint type identifiers:

- `epoch-s` to `epoch_s` for `ChargingEnabledUntil`, `DischargingEnabledUntil`, `NextChargeStartTime`, and
  `NextChargeTargetTime`;
- `energy-mWh` to `energy_mwh` for `NextChargeRequiredEnergy`, `BatteryCapacity`, `SessionEnergyCharged`, and
  `SessionEnergyDischarged`.

No command, PICS guard, expected value, range, endpoint, or Matterbridge behavior is changed. The patch lets
the existing checks run with the runner's canonical type names; it does not skip or relax any conformance
assertion. `chipTests.json` applies the file during `--start`, and the patch can be removed once the published
CHIP test image contains corrected spellings upstream.

### `TC_EEVSE_2_2.py`

Targets the configured EVSE endpoint (1401 or 14011) for the `UserMaximumChargeCurrent` write instead of the
upstream test's hardcoded endpoint `1`.

### `TC_TSTAT_2_2.py`

Base file copied verbatim from `connectedhomeip` **master** at commit
[`4624ece9`](https://github.com/project-chip/connectedhomeip/commit/4624ece91bbb3ed9c576ae8321e6b809f1a189d8)
(2026-08-10), from PR [#42326](https://github.com/project-chip/connectedhomeip/pull/42326) "Thermostat -
Relocate setpoint logic to separate files" (merged 2026-07-17), which rewrote it to drive a
`ThermostatSimulator`/`ThermostatState` reference model (`TC_TSTAT_Utils.py`) instead of hand-computed,
never-refreshed local variables. This replaces the older, pre-#42326 version baked into the `chip-test` image,
whose hardcoded Step 6b expectation was simply wrong (see "Known Issues" below) and whose later steps relied
on stale captured values that the correct DUT behavior happened to paper over. On top of that base, two small
local corrections fix genuine bugs still present in #42326's rewrite as of this writing (see "Known Issues"):
Step 9b writes `absMinCoolSetpointLimit - 10` instead of the wrong `minCoolSetpointLimit - 10` (matching its
own documented intent), and Step 9c's `hasAutoModeFeature` branch computes a real deadband-aware target
instead of duplicating its `else` branch. Not yet backported to a release branch or baked into the published
`chip-test` image.

### `TC_TSTAT_Utils.py`

New file, not present in the `chip-test` image at all — `TC_TSTAT_2_2.py`'s reference-model dependency,
introduced by the same PR [#42326](https://github.com/project-chip/connectedhomeip/pull/42326). Copied
verbatim from `connectedhomeip` **master** at commit
[`324f0aa3`](https://github.com/project-chip/connectedhomeip/commit/324f0aa34abb18b2ec0fafd53f7d3224500e92d7)
(2026-07-17, the PR's merge commit). Defines `ThermostatState` (a full attribute snapshot) and
`ThermostatSimulator` (mirrors the C++ `Setpoints::Fix()`/`ChangeLimits` reconciliation `TC_TSTAT_2_2.py`
exercises), so `write_setpoint()`/`send_raise_lower_and_verify()` compute the expected outcome dynamically
per-call instead of asserting fixed constants. Verified compatible with this image's baked `matter.testing`
package (`EventSubscriptionHandler`, `TestStep`, `default_matter_test_main` all resolve).

### `TC_AVSUM_2_7.py`

Steps 7, 9 and 14 expect `DPTZSetViewport` to reject an out-of-range viewport with `CONSTRAINT_ERROR` (0x87).
Matter 1.6.0 § 11.3.7.6.3 "Effect on Receipt" defines exactly two failure modes for this command: `NOT_FOUND`
when the `VideoStreamID` has no entry in `DPTZStreams`, and **`DYNAMIC_CONSTRAINT_ERROR` (0x8b)** when "the
requested viewport is outside of the defined allowed range". All three of those steps are the second case: a
viewport below `MinViewportResolution` (step 7), one larger than the sensor (step 9), and one whose aspect
ratio does not match the stream's, which § 11.3.7.6.2 makes a `SHALL` on the `Viewport` field and which
§ 11.3.7.6.3 therefore also folds into the allowed range, since it lists no third status (step 14). The patch
changes only those three `expected_status` values from `Status.ConstraintError` to
`Status.DynamicConstraintError`; nothing else in the file is touched, and no command, PICS guard, viewport
value or endpoint is changed.

`MatterbridgeCameraAvSettingsUserLevelManagementServer.dptzSetViewport()` follows the specification and
returns `DYNAMIC_CONSTRAINT_ERROR`, so the unpatched test fails all three steps against a spec-correct DUT.
The distinction is not cosmetic: `CONSTRAINT_ERROR` is the status for a field violating a _static_ constraint
declared in the cluster XML, which matter.js enforces from the data model before the command ever reaches the
server, whereas these three checks depend on `MinViewportResolution`, `VideoSensorParams` and the stream's
current viewport — runtime state — which is precisely what `DYNAMIC_CONSTRAINT_ERROR` exists to report. The
sibling command keeps the static form: `TC_AVSUM_2_8.py` step 4 expects `CONSTRAINT_ERROR` for a `ZoomDelta`
of 101, which is correct and unpatched, because the cluster XML constrains that field to `-100 to 100` and
matter.js rejects it from the model.

Not yet reported upstream.

### `TC_WEBRTCP_2_16.py`

The test contradicts itself about which endpoint it is exercising. It resolves the endpoint under test up
front (`endpoint = self.get_endpoint()`, i.e. `--endpoint 1601`), but step 2 fills the DUT's session capacity
with a loop of `ProvideOffer` commands sent to a hardcoded `endpoint=1`, while step 3 — the step that asserts
`RESOURCE_EXHAUSTED` — sends its extra `ProvideOffer` to the resolved `endpoint`. The two steps therefore
target different endpoints. The patch changes step 2's `endpoint=1` to `endpoint`; nothing else is touched. In
particular `originatingEndpointID=1` in the command payload is deliberately left alone: that field is the
TH's own `WebRtcTransportRequestor` endpoint, not the DUT's, and is correctly 1.

Not yet reported upstream.

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
