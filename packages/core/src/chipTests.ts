/**
 * @file packages/core/src/chipTests.ts
 * @description This file contains the CHIP test helpers of Matterbridge.
 * @author Luca Liguori
 * @created 2026-08-16
 * @version 1.1.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* oxlint-disable max-lines */

/* v8 ignore start - CHIP test glue only runs inside the chip-test Docker container, gated behind MATTERBRIDGE_CHIP_TEST */

import { spawnSync } from 'node:child_process';
import { closeSync, constants, existsSync, openSync, readSync, unlinkSync } from 'node:fs';

import { Seconds, Time, type Timer } from '@matter/general';
import { BasicInformationServer } from '@matter/node/behaviors/basic-information';
import { BridgedDeviceBasicInformationServer } from '@matter/node/behaviors/bridged-device-basic-information';
import { GeneralDiagnosticsServer } from '@matter/node/behaviors/general-diagnostics';
import { Status, StatusResponseError } from '@matter/types';
import { BooleanStateConfiguration } from '@matter/types/clusters/boolean-state-configuration';
import { ClosureControl } from '@matter/types/clusters/closure-control';
import { CommodityMetering } from '@matter/types/clusters/commodity-metering';
import { CommodityPrice } from '@matter/types/clusters/commodity-price';
import { CommodityTariff } from '@matter/types/clusters/commodity-tariff';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { ElectricalEnergyMeasurement } from '@matter/types/clusters/electrical-energy-measurement';
import { ElectricalPowerMeasurement } from '@matter/types/clusters/electrical-power-measurement';
import { EnergyEvse } from '@matter/types/clusters/energy-evse';
import { EnergyEvseMode } from '@matter/types/clusters/energy-evse-mode';
import type { GeneralDiagnostics } from '@matter/types/clusters/general-diagnostics';
import { MeterIdentification } from '@matter/types/clusters/meter-identification';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { RefrigeratorAlarm } from '@matter/types/clusters/refrigerator-alarm';
import { RvcOperationalState } from '@matter/types/clusters/rvc-operational-state';
import { RvcRunMode } from '@matter/types/clusters/rvc-run-mode';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { TariffPriceType, TariffUnit } from '@matter/types/globals';
import type { AnsiLogger } from 'node-ansi-logger';

import { MatterbridgeOccupancySensingServer } from './behaviors/occupancySensingServer.js';
import { cliEmitter } from './cliEmitter.js';
import { MatterbridgeRefrigeratorAlarmServer } from './devices/refrigerator.js';
import { MatterbridgeRvcOperationalStateServer, MatterbridgeRvcRunModeServer } from './devices/roboticVacuumCleaner.js';
import type { Matterbridge } from './matterbridge.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

type ChipTestAppPipeCommand = {
  Name?: string;
  EndpointId?: number;
  NewState?: boolean;
  Occupancy?: number;
  SensorFault?: number;
  SoilMoistureValue?: number;
  Device?: string;
  Type?: string;
  Operation?: string;
  Param?: number;
  Error?: string;
  DoorOpen?: number;
};

const chipTestAppPipePath = '/tmp/matterbridge-chip-test-app-pipe';
const chipTestValidEventTrigger = 0xfffffffffff10000n;
const smokeCoAlarmWarningSmokeAlarmTrigger = 0x005c000000000090n;
const smokeCoAlarmCriticalSmokeAlarmTrigger = 0x005c00000000009cn;
const smokeCoAlarmSmokeAlarmClearTrigger = 0x005c0000000000a0n;
const smokeCoAlarmWarningCoAlarmTrigger = 0xffffffff00000091n;
const smokeCoAlarmCriticalCoAlarmTrigger = 0xffffffff0000009dn;
const smokeCoAlarmCoAlarmClearTrigger = 0xffffffff000000a1n;
const smokeCoAlarmYamlWarningCoAlarmTrigger = 0x005c000000000091n;
const smokeCoAlarmYamlCriticalCoAlarmTrigger = 0x005c00000000009dn;
const smokeCoAlarmYamlCoAlarmClearTrigger = 0x005c0000000000a1n;
const smokeCoAlarmWarningBatteryAlertTrigger = 0xffffffff00000095n;
const smokeCoAlarmCriticalBatteryAlertTrigger = 0xffffffff0000009en;
const smokeCoAlarmBatteryAlertClearTrigger = 0xffffffff000000a5n;
const smokeCoAlarmYamlWarningBatteryAlertTrigger = 0x005c000000000095n;
const smokeCoAlarmYamlBatteryAlertClearTrigger = 0x005c0000000000a5n;
const smokeCoAlarmHardwareFaultAlertTrigger = 0xffffffff00000093n;
const smokeCoAlarmHardwareFaultAlertClearTrigger = 0xffffffff000000a3n;
const smokeCoAlarmEndOfServiceAlertTrigger = 0xffffffff0000009an;
const smokeCoAlarmEndOfServiceAlertClearTrigger = 0xffffffff000000aan;
const smokeCoAlarmDeviceMutedTrigger = 0x005c00000000009bn;
const smokeCoAlarmDeviceMutedClearTrigger = 0x005c0000000000abn;
// TC_EPM_2_2/TC_EEM_2_2/TC_EEM_2_3's send_test_event_trigger_start_fake_1kw_load_2s()/
// send_test_event_trigger_start_fake_3kw_generator_5s()/send_test_event_trigger_stop_fake_readings()
// (src/python_testing/TC_EnergyReporting_Utils.py). TC_EEM_2_4/TC_EEM_2_5's PeriodicEnergy (imported/exported)
// accumulation is not implemented — endpoint 206 doesn't enable that optional feature.
const electricalPowerMeasurementStartFakeLoadTrigger = 0x0091000000000001n;
const electricalEnergyMeasurementStartFakeGeneratorTrigger = 0x0091000000000002n;
const electricalPowerMeasurementStopFakeReadingsTrigger = 0x0091000000000000n;
// TC_DEM_2_2/TC_DEM_2_9/TC_DEM_2_10's send_test_event_trigger_power_adjustment()/_power_adjustment_clear()/
// _user_opt_out_local()/_user_opt_out_grid()/_user_opt_out_clear_all()/_forecast()/_forecast_clear()
// (src/python_testing/TC_DEMTestBase.py). Endpoint 207 only enables the PowerAdjustment and PowerForecastReporting
// features, so the StartTimeAdjustment/Pausable/ForecastAdjustment/ConstraintBasedAdjustment triggers (which none
// of TC_DEM_2_2/2_9/2_10 exercise on this feature set) are not implemented.
const deviceEnergyManagementPowerAdjustmentTrigger = 0x0098000000000000n;
const deviceEnergyManagementPowerAdjustmentClearTrigger = 0x0098000000000001n;
const deviceEnergyManagementUserOptOutLocalTrigger = 0x0098000000000002n;
const deviceEnergyManagementUserOptOutGridTrigger = 0x0098000000000003n;
const deviceEnergyManagementUserOptOutClearAllTrigger = 0x0098000000000004n;
const deviceEnergyManagementForecastTrigger = 0x009800000000000fn;
const deviceEnergyManagementForecastClearTrigger = 0x0098000000000010n;
const energyEvseBasicTrigger = 0x0099000000000000n;
const energyEvseBasicClearTrigger = 0x0099000000000001n;
const energyEvsePluggedInTrigger = 0x0099000000000002n;
const energyEvsePluggedInClearTrigger = 0x0099000000000003n;
const energyEvseChargeDemandTrigger = 0x0099000000000004n;
const energyEvseChargeDemandClearTrigger = 0x0099000000000005n;
const energyEvseTimeOfUseModeTrigger = 0x0099000000000006n;
const energyEvseGroundFaultTrigger = 0x0099000000000010n;
const energyEvseOverTemperatureFaultTrigger = 0x0099000000000011n;
const energyEvseFaultClearTrigger = 0x0099000000000012n;
const energyEvseDiagnosticsCompleteTrigger = 0x0099000000000020n;
const energyEvseTimeOfUseModeClearTrigger = 0x0099000000000021n;
// TC_MTRID_3_1's test_event_fake_data/test_event_clear constants (src/python_testing/TC_MTRIDTestBase.py).
const meterIdentificationAttributesValueSetTrigger = 0x0b06000000000000n;
const meterIdentificationTestEventClearTrigger = 0x0b06000000000001n;
// TC_COMMTR_3_1's test_event_fake_data/test_event_clear constants (src/python_testing/TC_COMMTR_TestBase.py).
const commodityMeteringAttributesValueSetTrigger = 0x0b07000000000000n;
const commodityMeteringTestEventClearTrigger = 0x0b07000000000001n;
// TC_SEPR_2_2's kEventTriggerPriceUpdate constant (src/python_testing/TC_SEPRTestBase.py). SEPR has no Test
// Event Clear counterpart — only a Price Update trigger and a (Forecasting-feature-gated, unused here) Forecast
// Update trigger.
const commodityPricePriceUpdateTrigger = 0x0095000000000000n;

// TC_SETRF_TestBase.py's EventTriggerFakeData/EventTriggerClear/EventTriggerChangeDay/EventTriggerChangeTime —
// unlike the other CommodityXxx clusters' repo-local trigger constants (chosen since those tests read them
// indirectly via PIXIT config defaults), TC_SETRF's own test source hardcodes these directly as class attributes,
// so these four values are copied verbatim rather than assigned a repo convention.
const commodityTariffAttributesValueSetTrigger = 0x0700000000000000n;
const commodityTariffTestEventClearTrigger = 0x0700000000000001n;
const commodityTariffChangeDayTrigger = 0x0700000000000002n;
const commodityTariffChangeTimeTrigger = 0x0700000000000003n;
// The EVSE test triggers simulate cable connection/disconnection. Track their elapsed session time so the
// SessionDuration attribute reflects the simulated connection while keeping the EVNotDetected test payload unchanged.
const energyEvseSessionStartedAt = new Map<number, number>();
const energyEvseSupplyStateBeforeFault = new Map<number, EnergyEvse.SupplyState>();
// TC_BOOLCFG_4_2/4_3/4_4/5_1/5_2's sensorTrigger/sensorUntrigger constants (src/python_testing/TC_BOOLCFG_4_2.py etc.).
const booleanStateConfigurationSensorTrigger = 0x0080000000000000n;
const booleanStateConfigurationSensorUntriggerTrigger = 0x0080000000000001n;
// TC_CLCTRL_5_1/TC_CLCTRL_6_1's triggerError/triggerProtected/triggerDisengaged/triggerSetupRequired/triggerClear
// constants (src/python_testing/TC_CLCTRL_5_1.py's/TC_CLCTRL_6_1.py's own module-level assignments — both
// files hardcode the same values rather than importing a shared constant).
const closureControlErrorTrigger = 0x0104000000000000n;
const closureControlProtectedTrigger = 0x0104000000000001n;
const closureControlDisengagedTrigger = 0x0104000000000002n;
const closureControlSetupRequiredTrigger = 0x0104000000000003n;
const closureControlClearTrigger = 0x0104000000000004n;
// MatterBaseTest.send_test_event_triggers() can OR the target endpoint into bits 32-47 of EventTrigger.
// GeneralDiagnostics.TestEventTrigger has no endpoint field per spec, and Matterbridge targets tests from
// chipTestActiveEndpointId instead, so normalize those framework-only endpoint bits out before dispatching.
const testEventTriggerEndpointMask = 0x0000ffff00000000n;

export const chipTestEnableKey = Uint8Array.from({ length: 16 }, (_, index) => index);
const smokeCoAlarmChipTestEnableKey = Uint8Array.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
// Set by createChipTestAppPipe() (the CHIP test bootstrap entry point, called whenever MATTERBRIDGE_CHIP_TEST
// is set) so the TestEventTrigger handlers below can look devices up on it, regardless of whether
// MATTERBRIDGE_DEMO_DEVICES also created a device tree via createChipTestDevices() (chipTestDevices.ts).
let chipTestMatterbridge: Matterbridge | undefined;
let closeChipTestAppPipe: (() => void) | undefined;
let electricalPowerMeasurementFakeLoadTimer: Timer | undefined;
// The endpoint chipTests.json's "endpoint" field names for whichever test is currently running, set via the
// app-pipe "SetTestEndpoint" command (run-matterbridge-chip-tests.mjs writes it before every test, cleared —
// EndpointId omitted — before a test with no "endpoint" set). GeneralDiagnostics.TestEventTrigger carries no
// endpoint field on the wire, so this out-of-band pin is what lets handleSmokeCoAlarmTestEventTrigger()/
// handleBooleanStateConfigurationTestEventTrigger()/handleElectricalEnergyTestEventTrigger() target the one
// endpoint under test directly, without guessing or broadcasting to every endpoint that implements the
// affected cluster. It also feeds handleChipTestAppPipeCommand()'s own EndpointId fallback, so it's not
// limited to TestEventTrigger — any app-pipe command that omits EndpointId falls back to whichever endpoint
// is pinned.
let chipTestActiveEndpointId: number | undefined;

export class MatterbridgeGeneralDiagnosticsServer extends GeneralDiagnosticsServer {
  override initialize(): void {
    this.state.testEventTriggersEnabled = true;
    this.state.deviceTestEnableKey = chipTestEnableKey;
    super.initialize();
  }

  override async testEventTrigger({ eventTrigger, enableKey }: GeneralDiagnostics.TestEventTriggerRequest): Promise<void> {
    const keyData = Uint8Array.from(enableKey);
    if (keyData.every((byte) => byte === 0)) {
      throw new StatusResponseError('Invalid test enable key, all zeros', Status.ConstraintError);
    }
    if (!isChipTestEnableKey(keyData)) {
      throw new StatusResponseError('Invalid test enable key', Status.ConstraintError);
    }
    if (BigInt(eventTrigger) === chipTestValidEventTrigger) return;
    if (await handleChipTestEventTrigger(BigInt(eventTrigger))) return;
    super.triggerTestEvent(eventTrigger);
  }

  override payloadTestRequest(request: GeneralDiagnostics.PayloadTestRequest): ReturnType<GeneralDiagnosticsServer['payloadTestRequest']> {
    // TC_DGGEN_2_3 sends PIXIT.DGGEN.ENABLEKEY (the smokeCoAlarmChipTestEnableKey), not chipTestEnableKey. The base
    // implementation only accepts state.deviceTestEnableKey as-is, so switch it to whichever recognized key was
    // presented before delegating, matching testEventTrigger's isChipTestEnableKey() acceptance of either key.
    const keyData = Uint8Array.from(request.enableKey);
    if (isChipTestEnableKey(keyData)) this.state.deviceTestEnableKey = keyData;
    return super.payloadTestRequest(request);
  }
}

function isChipTestEnableKey(keyData: Uint8Array): boolean {
  return equalsBytes(keyData, chipTestEnableKey) || equalsBytes(keyData, smokeCoAlarmChipTestEnableKey);
}

function equalsBytes(first: Uint8Array, second: Uint8Array): boolean {
  return first.length === second.length && first.every((byte, index) => byte === second[index]);
}

export function createChipTestAppPipe(matterbridge: Matterbridge): void {
  chipTestMatterbridge = matterbridge;
  closeChipTestAppPipe?.();

  try {
    if (existsSync(chipTestAppPipePath)) unlinkSync(chipTestAppPipePath);
    const mkfifo = spawnSync('mkfifo', [chipTestAppPipePath], { encoding: 'utf8' });
    if (mkfifo.status !== 0) {
      matterbridge.log.error(`Failed to create CHIP test app pipe ${chipTestAppPipePath}: ${mkfifo.stderr.trim()}`);
      return;
    }
  } catch (error) {
    matterbridge.log.error(`Failed to create CHIP test app pipe ${chipTestAppPipePath}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  matterbridge.log.notice(`CHIP test app pipe listening on ${chipTestAppPipePath}`);
  let buffer = '';
  let commandQueue = Promise.resolve<null>(null);
  let isClosing = false;
  let pipeFd: number | undefined;
  let shutdownListener: (() => void) | undefined;

  const closePipe = (): void => {
    isClosing = true;
    if (shutdownListener) {
      cliEmitter.off('shutdown', shutdownListener);
      shutdownListener = undefined;
    }
    if (pipeFd !== undefined) {
      try {
        closeSync(pipeFd);
      } catch (error) {
        matterbridge.log.debug(`Failed to close CHIP test app pipe ${chipTestAppPipePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
      pipeFd = undefined;
    }
    try {
      if (existsSync(chipTestAppPipePath)) unlinkSync(chipTestAppPipePath);
    } catch (error) {
      matterbridge.log.debug(`Failed to remove CHIP test app pipe ${chipTestAppPipePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    closeChipTestAppPipe = undefined;
  };

  const enqueueCommand = (line: string): void => {
    const commandLine = line.trim();
    if (!commandLine) return;
    commandQueue = commandQueue
      .then(async (): Promise<null> => {
        const command: unknown = JSON.parse(commandLine);
        if (!isChipTestAppPipeCommand(command)) {
          matterbridge.log.warn(`Ignoring invalid CHIP test app pipe command: ${commandLine}`);
          return null;
        }
        await handleChipTestAppPipeCommand(matterbridge, command);
        return null;
      })
      .catch((error: unknown): null => {
        matterbridge.log.error(`Failed to handle CHIP test app pipe command ${commandLine}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      });
  };

  const handleChunk = (chunk: string): void => {
    buffer += chunk;
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      enqueueCommand(buffer.slice(0, newlineIndex));
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf('\n');
    }
  };

  try {
    // oxlint-disable-next-line no-bitwise
    pipeFd = openSync(chipTestAppPipePath, constants.O_RDWR | constants.O_NONBLOCK);
  } catch (error) {
    matterbridge.log.error(`Failed to open CHIP test app pipe ${chipTestAppPipePath}: ${error instanceof Error ? error.message : String(error)}`);
    closePipe();
    return;
  }

  const readBuffer = Buffer.alloc(4096);
  const pollInterval = setInterval(() => {
    if (isClosing || pipeFd === undefined) return;
    try {
      let bytesRead = readSync(pipeFd, readBuffer, 0, readBuffer.length, null);
      while (bytesRead > 0) {
        handleChunk(readBuffer.toString('utf8', 0, bytesRead));
        bytesRead = readSync(pipeFd, readBuffer, 0, readBuffer.length, null);
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && ['EAGAIN', 'EWOULDBLOCK'].includes(String(error.code))) return;
      matterbridge.log.error(`CHIP test app pipe ${chipTestAppPipePath} read error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, 50);
  pollInterval.unref();

  const closePipeWithInterval = (): void => {
    clearInterval(pollInterval);
    closePipe();
  };
  closeChipTestAppPipe = closePipeWithInterval;
  shutdownListener = closePipeWithInterval;
  cliEmitter.once('shutdown', shutdownListener);
}

async function handleChipTestEventTrigger(eventTrigger: bigint): Promise<boolean> {
  const normalizedEventTrigger = normalizeTestEventTrigger(eventTrigger);
  if (
    normalizedEventTrigger === normalizeTestEventTrigger(booleanStateConfigurationSensorTrigger) ||
    normalizedEventTrigger === normalizeTestEventTrigger(booleanStateConfigurationSensorUntriggerTrigger)
  ) {
    return await handleBooleanStateConfigurationTestEventTrigger(normalizedEventTrigger);
  }
  if (
    normalizedEventTrigger === normalizeTestEventTrigger(closureControlErrorTrigger) ||
    normalizedEventTrigger === normalizeTestEventTrigger(closureControlProtectedTrigger) ||
    normalizedEventTrigger === normalizeTestEventTrigger(closureControlDisengagedTrigger) ||
    normalizedEventTrigger === normalizeTestEventTrigger(closureControlSetupRequiredTrigger) ||
    normalizedEventTrigger === normalizeTestEventTrigger(closureControlClearTrigger)
  ) {
    return await handleClosureControlTestEventTrigger(normalizedEventTrigger);
  }
  if (
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmWarningSmokeAlarmTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmCriticalSmokeAlarmTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmSmokeAlarmClearTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmWarningCoAlarmTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmCriticalCoAlarmTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmCoAlarmClearTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmYamlWarningCoAlarmTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmYamlCriticalCoAlarmTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmYamlCoAlarmClearTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmWarningBatteryAlertTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmCriticalBatteryAlertTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmBatteryAlertClearTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmYamlWarningBatteryAlertTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmYamlBatteryAlertClearTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmHardwareFaultAlertTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmHardwareFaultAlertClearTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmEndOfServiceAlertTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmEndOfServiceAlertClearTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmDeviceMutedTrigger) &&
    normalizedEventTrigger !== normalizeTestEventTrigger(smokeCoAlarmDeviceMutedClearTrigger)
  ) {
    return (
      (await handleElectricalEnergyTestEventTrigger(normalizedEventTrigger)) ||
      (await handleDeviceEnergyManagementTestEventTrigger(normalizedEventTrigger)) ||
      (await handleEnergyEvseTestEventTrigger(normalizedEventTrigger)) ||
      (await handleMeterIdentificationTestEventTrigger(normalizedEventTrigger)) ||
      (await handleCommodityMeteringTestEventTrigger(normalizedEventTrigger)) ||
      (await handleCommodityPriceTestEventTrigger(normalizedEventTrigger)) ||
      (await handleCommodityTariffTestEventTrigger(normalizedEventTrigger))
    );
  }
  return await handleSmokeCoAlarmTestEventTrigger(normalizedEventTrigger);
}

function normalizeTestEventTrigger(eventTrigger: bigint): bigint {
  // oxlint-disable-next-line no-bitwise
  return eventTrigger & ~testEventTriggerEndpointMask;
}

async function handleEnergyEvseTestEventTrigger(eventTrigger: bigint): Promise<boolean> {
  const supportedTriggers = [
    normalizeTestEventTrigger(energyEvseBasicTrigger),
    normalizeTestEventTrigger(energyEvseBasicClearTrigger),
    normalizeTestEventTrigger(energyEvsePluggedInTrigger),
    normalizeTestEventTrigger(energyEvsePluggedInClearTrigger),
    normalizeTestEventTrigger(energyEvseChargeDemandTrigger),
    normalizeTestEventTrigger(energyEvseChargeDemandClearTrigger),
    normalizeTestEventTrigger(energyEvseTimeOfUseModeTrigger),
    normalizeTestEventTrigger(energyEvseGroundFaultTrigger),
    normalizeTestEventTrigger(energyEvseOverTemperatureFaultTrigger),
    normalizeTestEventTrigger(energyEvseFaultClearTrigger),
    normalizeTestEventTrigger(energyEvseDiagnosticsCompleteTrigger),
    normalizeTestEventTrigger(energyEvseTimeOfUseModeClearTrigger),
  ];
  if (!supportedTriggers.includes(eventTrigger) || !chipTestMatterbridge || chipTestActiveEndpointId === undefined) return false;
  const endpoint = getChipTestEndpoint(chipTestMatterbridge, chipTestActiveEndpointId);
  if (!endpoint?.hasClusterServer(EnergyEvse.id)) return false;
  const log = chipTestMatterbridge.log;
  const sessionIdAttribute = endpoint.getAttribute(EnergyEvse.id, 'sessionId');
  const sessionId = typeof sessionIdAttribute === 'number' ? sessionIdAttribute : 0;
  const state = getEnergyEvseState(endpoint.getAttribute(EnergyEvse.id, 'state'));

  switch (eventTrigger) {
    case normalizeTestEventTrigger(energyEvseBasicTrigger):
      energyEvseSessionStartedAt.delete(chipTestActiveEndpointId);
      await endpoint.setCluster(
        EnergyEvse,
        {
          state: EnergyEvse.State.NotPluggedIn,
          supplyState: EnergyEvse.SupplyState.Disabled,
          faultState: EnergyEvse.FaultState.NoError,
          minimumChargeCurrent: 6_000,
          maximumChargeCurrent: 32_000,
          userMaximumChargeCurrent: 32_000,
        },
        log,
      );
      return true;
    case normalizeTestEventTrigger(energyEvseBasicClearTrigger):
      return true;
    case normalizeTestEventTrigger(energyEvsePluggedInTrigger): {
      const nextSessionId = sessionId + 1;
      energyEvseSessionStartedAt.set(chipTestActiveEndpointId, Time.nowMs);
      await endpoint.setCluster(EnergyEvse, { state: EnergyEvse.State.PluggedInNoDemand, sessionId: nextSessionId, sessionDuration: 0, sessionEnergyCharged: 0 }, log);
      await endpoint.triggerEvent(EnergyEvse, 'evConnected', { sessionId: nextSessionId }, log);
      return true;
    }
    case normalizeTestEventTrigger(energyEvsePluggedInClearTrigger): {
      const sessionStartedAt = energyEvseSessionStartedAt.get(chipTestActiveEndpointId);
      const sessionDuration = sessionStartedAt === undefined ? 0 : Math.floor((Time.nowMs - sessionStartedAt) / 1_000);
      await endpoint.triggerEvent(EnergyEvse, 'evNotDetected', { sessionId, state: EnergyEvse.State.PluggedInNoDemand, sessionDuration, sessionEnergyCharged: 1 }, log);
      await endpoint.setCluster(EnergyEvse, { state: EnergyEvse.State.NotPluggedIn, sessionDuration, sessionEnergyCharged: 1 }, log);
      energyEvseSessionStartedAt.delete(chipTestActiveEndpointId);
      return true;
    }
    case normalizeTestEventTrigger(energyEvseChargeDemandTrigger): {
      const charging = endpoint.getAttribute(EnergyEvse.id, 'supplyState') === EnergyEvse.SupplyState.ChargingEnabled;
      const nextState = charging ? EnergyEvse.State.PluggedInCharging : EnergyEvse.State.PluggedInDemand;
      await endpoint.setCluster(EnergyEvse, { state: nextState }, log);
      if (charging) {
        const maximumChargeCurrentAttribute = endpoint.getAttribute(EnergyEvse.id, 'maximumChargeCurrent');
        const maximumCurrent = typeof maximumChargeCurrentAttribute === 'number' || typeof maximumChargeCurrentAttribute === 'bigint' ? maximumChargeCurrentAttribute : 0;
        await endpoint.triggerEvent(EnergyEvse, 'energyTransferStarted', { sessionId, state: nextState, maximumCurrent }, log);
      }
      return true;
    }
    case normalizeTestEventTrigger(energyEvseChargeDemandClearTrigger):
      if (state === EnergyEvse.State.PluggedInCharging) {
        await endpoint.triggerEvent(EnergyEvse, 'energyTransferStopped', { sessionId, state, reason: EnergyEvse.EnergyTransferStoppedReason.EvStopped, energyTransferred: 0 }, log);
      }
      await endpoint.setCluster(EnergyEvse, { state: EnergyEvse.State.PluggedInNoDemand }, log);
      return true;
    case normalizeTestEventTrigger(energyEvseTimeOfUseModeTrigger):
      if (endpoint.hasClusterServer(EnergyEvseMode.id)) await endpoint.setCluster(EnergyEvseMode, { currentMode: 2 }, log);
      return true;
    case normalizeTestEventTrigger(energyEvseTimeOfUseModeClearTrigger):
      if (endpoint.hasClusterServer(EnergyEvseMode.id)) await endpoint.setCluster(EnergyEvseMode, { currentMode: 1 }, log);
      return true;
    case normalizeTestEventTrigger(energyEvseGroundFaultTrigger):
      await applyEnergyEvseFault(endpoint, EnergyEvse.FaultState.GroundFault, log);
      return true;
    case normalizeTestEventTrigger(energyEvseOverTemperatureFaultTrigger):
      await applyEnergyEvseFault(endpoint, EnergyEvse.FaultState.OverTemperature, log);
      return true;
    case normalizeTestEventTrigger(energyEvseFaultClearTrigger):
      await applyEnergyEvseFault(endpoint, EnergyEvse.FaultState.NoError, log);
      return true;
    case normalizeTestEventTrigger(energyEvseDiagnosticsCompleteTrigger):
      await endpoint.setCluster(EnergyEvse, { state: EnergyEvse.State.NotPluggedIn, supplyState: EnergyEvse.SupplyState.Disabled }, log);
      return true;
    default:
      return false;
  }
}

async function applyEnergyEvseFault(endpoint: MatterbridgeEndpoint, faultState: EnergyEvse.FaultState, log: AnsiLogger): Promise<void> {
  const previousFaultStateAttribute = endpoint.getAttribute(EnergyEvse.id, 'faultState');
  const previousFaultState = typeof previousFaultStateAttribute === 'number' ? previousFaultStateAttribute : EnergyEvse.FaultState.NoError;
  const state = getEnergyEvseState(endpoint.getAttribute(EnergyEvse.id, 'state'));
  const supplyState = getEnergyEvseSupplyState(endpoint.getAttribute(EnergyEvse.id, 'supplyState'));
  const restoredSupplyState = getEnergyEvseRestoredSupplyState(faultState, supplyState);
  const sessionIdAttribute = endpoint.getAttribute(EnergyEvse.id, 'sessionId');
  const sessionId = typeof sessionIdAttribute === 'number' ? sessionIdAttribute : null;
  await endpoint.setCluster(
    EnergyEvse,
    {
      faultState,
      state: getEnergyEvseFaultTriggerState(faultState, restoredSupplyState),
      supplyState: faultState === EnergyEvse.FaultState.NoError ? restoredSupplyState : EnergyEvse.SupplyState.DisabledError,
    },
    log,
  );
  await endpoint.triggerEvent(EnergyEvse, 'fault', { sessionId, state, faultStatePreviousState: previousFaultState, faultStateCurrentState: faultState }, log);
}

function getEnergyEvseRestoredSupplyState(faultState: EnergyEvse.FaultState, supplyState: EnergyEvse.SupplyState): EnergyEvse.SupplyState {
  if (chipTestActiveEndpointId === undefined) return supplyState;
  if (faultState === EnergyEvse.FaultState.NoError) {
    const restoredSupplyState = energyEvseSupplyStateBeforeFault.get(chipTestActiveEndpointId) ?? supplyState;
    energyEvseSupplyStateBeforeFault.delete(chipTestActiveEndpointId);
    return restoredSupplyState;
  }
  if (!energyEvseSupplyStateBeforeFault.has(chipTestActiveEndpointId)) energyEvseSupplyStateBeforeFault.set(chipTestActiveEndpointId, supplyState);
  return supplyState;
}

function getEnergyEvseFaultTriggerState(faultState: EnergyEvse.FaultState, supplyState: EnergyEvse.SupplyState): EnergyEvse.State {
  if (faultState !== EnergyEvse.FaultState.NoError) return EnergyEvse.State.Fault;
  return supplyState === EnergyEvse.SupplyState.ChargingEnabled ? EnergyEvse.State.PluggedInCharging : EnergyEvse.State.PluggedInDemand;
}

function getEnergyEvseSupplyState(value: unknown): EnergyEvse.SupplyState {
  switch (value) {
    case EnergyEvse.SupplyState.ChargingEnabled:
      return EnergyEvse.SupplyState.ChargingEnabled;
    case EnergyEvse.SupplyState.DisabledError:
      return EnergyEvse.SupplyState.DisabledError;
    case EnergyEvse.SupplyState.DisabledDiagnostics:
      return EnergyEvse.SupplyState.DisabledDiagnostics;
    default:
      return EnergyEvse.SupplyState.Disabled;
  }
}

/**
 * Validates an Energy EVSE State attribute read from the generic endpoint API.
 *
 * @param {unknown} value - Attribute value to validate.
 * @returns {EnergyEvse.State} Valid state, or `NotPluggedIn` when the value is absent or invalid.
 */
function getEnergyEvseState(value: unknown): EnergyEvse.State {
  switch (value) {
    case EnergyEvse.State.PluggedInNoDemand:
      return EnergyEvse.State.PluggedInNoDemand;
    case EnergyEvse.State.PluggedInDemand:
      return EnergyEvse.State.PluggedInDemand;
    case EnergyEvse.State.PluggedInCharging:
      return EnergyEvse.State.PluggedInCharging;
    case EnergyEvse.State.PluggedInDischarging:
      return EnergyEvse.State.PluggedInDischarging;
    case EnergyEvse.State.SessionEnding:
      return EnergyEvse.State.SessionEnding;
    case EnergyEvse.State.Fault:
      return EnergyEvse.State.Fault;
    default:
      return EnergyEvse.State.NotPluggedIn;
  }
}

// GeneralDiagnostics.TestEventTrigger carries no endpoint field on the wire, but every TC_SMOKECO_* chipTests.json
// entry sets "endpoint" to the one of the three SmokeCOAlarm variants it actually targets — the combined
// smoke+CO alarm (709), the smoke-only variant (7091), or the CO-only variant (7092); see
// chipTestActiveEndpointId — so this never needs to guess or broadcast.
async function handleSmokeCoAlarmTestEventTrigger(eventTrigger: bigint): Promise<boolean> {
  if (!chipTestMatterbridge || chipTestActiveEndpointId === undefined) return false;
  const endpoint = getChipTestEndpoint(chipTestMatterbridge, chipTestActiveEndpointId);
  if (!endpoint) return false;

  await applySmokeCoAlarmTestEventTrigger(endpoint, eventTrigger, chipTestMatterbridge.log);
  return true;
}

async function applySmokeCoAlarmTestEventTrigger(endpoint: MatterbridgeEndpoint, eventTrigger: bigint, log: AnsiLogger): Promise<void> {
  const hasSmokeAlarm = endpoint.hasAttributeServer(SmokeCoAlarm.id, 'smokeState');
  const hasCoAlarm = endpoint.hasAttributeServer(SmokeCoAlarm.id, 'coState');

  switch (eventTrigger) {
    case normalizeTestEventTrigger(smokeCoAlarmWarningSmokeAlarmTrigger):
      if (!hasSmokeAlarm) return;
      await endpoint.setCluster(SmokeCoAlarm, { smokeState: SmokeCoAlarm.AlarmState.Warning, expressedState: SmokeCoAlarm.ExpressedState.SmokeAlarm }, log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'smokeAlarm', { alarmSeverityLevel: SmokeCoAlarm.AlarmState.Warning }, log);
      return;
    case normalizeTestEventTrigger(smokeCoAlarmCriticalSmokeAlarmTrigger):
      if (!hasSmokeAlarm) return;
      await endpoint.setCluster(SmokeCoAlarm, { smokeState: SmokeCoAlarm.AlarmState.Critical, expressedState: SmokeCoAlarm.ExpressedState.SmokeAlarm }, log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'smokeAlarm', { alarmSeverityLevel: SmokeCoAlarm.AlarmState.Critical }, log);
      return;
    case normalizeTestEventTrigger(smokeCoAlarmSmokeAlarmClearTrigger):
      if (!hasSmokeAlarm) return;
      await endpoint.setCluster(
        SmokeCoAlarm,
        { smokeState: SmokeCoAlarm.AlarmState.Normal, expressedState: getSmokeCoAlarmExpressedState(endpoint, { smokeState: SmokeCoAlarm.AlarmState.Normal }) },
        log,
      );
      await endpoint.triggerEvent(SmokeCoAlarm, 'allClear', undefined, log);
      return;
    case normalizeTestEventTrigger(smokeCoAlarmWarningCoAlarmTrigger):
    case normalizeTestEventTrigger(smokeCoAlarmYamlWarningCoAlarmTrigger):
      if (!hasCoAlarm) return;
      await endpoint.setCluster(SmokeCoAlarm, { coState: SmokeCoAlarm.AlarmState.Warning, expressedState: SmokeCoAlarm.ExpressedState.CoAlarm }, log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'coAlarm', { alarmSeverityLevel: SmokeCoAlarm.AlarmState.Warning }, log);
      return;
    case normalizeTestEventTrigger(smokeCoAlarmCriticalCoAlarmTrigger):
    case normalizeTestEventTrigger(smokeCoAlarmYamlCriticalCoAlarmTrigger):
      if (!hasCoAlarm) return;
      await endpoint.setCluster(SmokeCoAlarm, { coState: SmokeCoAlarm.AlarmState.Critical, expressedState: SmokeCoAlarm.ExpressedState.CoAlarm }, log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'coAlarm', { alarmSeverityLevel: SmokeCoAlarm.AlarmState.Critical }, log);
      return;
    case normalizeTestEventTrigger(smokeCoAlarmCoAlarmClearTrigger):
    case normalizeTestEventTrigger(smokeCoAlarmYamlCoAlarmClearTrigger):
      if (!hasCoAlarm) return;
      await endpoint.setCluster(
        SmokeCoAlarm,
        { coState: SmokeCoAlarm.AlarmState.Normal, expressedState: getSmokeCoAlarmExpressedState(endpoint, { coState: SmokeCoAlarm.AlarmState.Normal }) },
        log,
      );
      await endpoint.triggerEvent(SmokeCoAlarm, 'allClear', undefined, log);
      return;
    case normalizeTestEventTrigger(smokeCoAlarmWarningBatteryAlertTrigger):
    case normalizeTestEventTrigger(smokeCoAlarmYamlWarningBatteryAlertTrigger):
      await endpoint.setCluster(
        SmokeCoAlarm,
        { batteryAlert: SmokeCoAlarm.AlarmState.Warning, expressedState: getSmokeCoAlarmExpressedState(endpoint, { batteryAlert: SmokeCoAlarm.AlarmState.Warning }) },
        log,
      );
      await endpoint.triggerEvent(SmokeCoAlarm, 'lowBattery', { alarmSeverityLevel: SmokeCoAlarm.AlarmState.Warning }, log);
      return;
    case normalizeTestEventTrigger(smokeCoAlarmCriticalBatteryAlertTrigger):
      await endpoint.setCluster(
        SmokeCoAlarm,
        { batteryAlert: SmokeCoAlarm.AlarmState.Critical, expressedState: getSmokeCoAlarmExpressedState(endpoint, { batteryAlert: SmokeCoAlarm.AlarmState.Critical }) },
        log,
      );
      await endpoint.triggerEvent(SmokeCoAlarm, 'lowBattery', { alarmSeverityLevel: SmokeCoAlarm.AlarmState.Critical }, log);
      return;
    case normalizeTestEventTrigger(smokeCoAlarmBatteryAlertClearTrigger):
    case normalizeTestEventTrigger(smokeCoAlarmYamlBatteryAlertClearTrigger):
      await endpoint.setCluster(
        SmokeCoAlarm,
        { batteryAlert: SmokeCoAlarm.AlarmState.Normal, expressedState: getSmokeCoAlarmExpressedState(endpoint, { batteryAlert: SmokeCoAlarm.AlarmState.Normal }) },
        log,
      );
      await endpoint.triggerEvent(SmokeCoAlarm, 'allClear', undefined, log);
      return;
    case normalizeTestEventTrigger(smokeCoAlarmHardwareFaultAlertTrigger):
      await endpoint.setCluster(SmokeCoAlarm, { hardwareFaultAlert: true, expressedState: SmokeCoAlarm.ExpressedState.HardwareFault }, log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'hardwareFault', undefined, log);
      return;
    case normalizeTestEventTrigger(smokeCoAlarmHardwareFaultAlertClearTrigger):
      await endpoint.setCluster(SmokeCoAlarm, { hardwareFaultAlert: false, expressedState: SmokeCoAlarm.ExpressedState.Normal }, log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'allClear', undefined, log);
      return;
    case normalizeTestEventTrigger(smokeCoAlarmEndOfServiceAlertTrigger):
      await endpoint.setCluster(SmokeCoAlarm, { endOfServiceAlert: SmokeCoAlarm.EndOfService.Expired, expressedState: SmokeCoAlarm.ExpressedState.EndOfService }, log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'endOfService', undefined, log);
      return;
    case normalizeTestEventTrigger(smokeCoAlarmEndOfServiceAlertClearTrigger):
      await endpoint.setCluster(SmokeCoAlarm, { endOfServiceAlert: SmokeCoAlarm.EndOfService.Normal, expressedState: SmokeCoAlarm.ExpressedState.Normal }, log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'allClear', undefined, log);
      return;
    case normalizeTestEventTrigger(smokeCoAlarmDeviceMutedTrigger):
      if (
        (hasSmokeAlarm && endpoint.getAttribute(SmokeCoAlarm.id, 'smokeState') === SmokeCoAlarm.AlarmState.Warning) ||
        (hasCoAlarm && endpoint.getAttribute(SmokeCoAlarm.id, 'coState') === SmokeCoAlarm.AlarmState.Warning)
      ) {
        await endpoint.setCluster(SmokeCoAlarm, { deviceMuted: SmokeCoAlarm.MuteState.Muted }, log);
        await endpoint.triggerEvent(SmokeCoAlarm, 'alarmMuted', undefined, log);
      }
      return;
    case normalizeTestEventTrigger(smokeCoAlarmDeviceMutedClearTrigger):
      await endpoint.setCluster(SmokeCoAlarm, { deviceMuted: SmokeCoAlarm.MuteState.NotMuted }, log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'muteEnded', undefined, log);
      return;
    default:
      return;
  }
}

function getSmokeCoAlarmExpressedState(
  endpoint: MatterbridgeEndpoint,
  state: { smokeState?: SmokeCoAlarm.AlarmState; coState?: SmokeCoAlarm.AlarmState; batteryAlert?: SmokeCoAlarm.AlarmState } = {},
): SmokeCoAlarm.ExpressedState {
  // smokeState/coState don't exist on the CO-only/smoke-only endpoint variants (7092/7091); treat a missing
  // attribute as Normal rather than reading it (which would log an error and return undefined).
  const smokeState =
    state.smokeState ?? (endpoint.hasAttributeServer(SmokeCoAlarm.id, 'smokeState') ? endpoint.getAttribute(SmokeCoAlarm.id, 'smokeState') : SmokeCoAlarm.AlarmState.Normal);
  const coState = state.coState ?? (endpoint.hasAttributeServer(SmokeCoAlarm.id, 'coState') ? endpoint.getAttribute(SmokeCoAlarm.id, 'coState') : SmokeCoAlarm.AlarmState.Normal);
  const batteryAlert = state.batteryAlert ?? endpoint.getAttribute(SmokeCoAlarm.id, 'batteryAlert');

  if (smokeState !== SmokeCoAlarm.AlarmState.Normal) return SmokeCoAlarm.ExpressedState.SmokeAlarm;
  if (batteryAlert !== SmokeCoAlarm.AlarmState.Normal) return SmokeCoAlarm.ExpressedState.BatteryAlert;
  if (coState !== SmokeCoAlarm.AlarmState.Normal) return SmokeCoAlarm.ExpressedState.CoAlarm;
  return SmokeCoAlarm.ExpressedState.Normal;
}

// SensorTrigger/SensorUntrigger carry no endpoint field on the wire, but every TC_BOOLCFG_* chipTests.json
// entry sets "endpoint" to the one of the four BooleanStateConfiguration endpoints it actually targets
// (ContactSensor 701, WaterFreezeDetector 711, WaterLeakDetector 712, RainSensor 713) — see
// chipTestActiveEndpointId — so, unlike SmokeCOAlarm's triggers, this never needs to guess or broadcast.
async function handleBooleanStateConfigurationTestEventTrigger(eventTrigger: bigint): Promise<boolean> {
  if (!chipTestMatterbridge || chipTestActiveEndpointId === undefined) return false;
  const endpoint = getChipTestEndpoint(chipTestMatterbridge, chipTestActiveEndpointId);
  if (!endpoint) return false;

  await applyBooleanStateConfigurationTestEventTrigger(endpoint, eventTrigger, chipTestMatterbridge.log);
  return true;
}

async function applyBooleanStateConfigurationTestEventTrigger(endpoint: MatterbridgeEndpoint, eventTrigger: bigint, log: AnsiLogger): Promise<void> {
  switch (eventTrigger) {
    case normalizeTestEventTrigger(booleanStateConfigurationSensorTrigger): {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const alarmsEnabled = endpoint.getAttribute(BooleanStateConfiguration.id, 'alarmsEnabled') as BooleanStateConfiguration.AlarmMode | undefined;
      await endpoint.setCluster(BooleanStateConfiguration, { alarmsActive: { visual: Boolean(alarmsEnabled?.visual), audible: Boolean(alarmsEnabled?.audible) } }, log);
      return;
    }
    case normalizeTestEventTrigger(booleanStateConfigurationSensorUntriggerTrigger):
      await endpoint.setCluster(BooleanStateConfiguration, { alarmsActive: { visual: false, audible: false }, alarmsSuppressed: { visual: false, audible: false } }, log);
      return;
    default:
      return;
  }
}

// The Error/Protected/Disengaged/SetupRequired/Clear triggers carry no endpoint field on the wire, but every
// TC_CLCTRL_5_1/TC_CLCTRL_6_1 chipTests.json entry sets "endpoint" to the one ClosureControl endpoint it
// actually targets — see chipTestActiveEndpointId — so this never needs to guess or broadcast.
async function handleClosureControlTestEventTrigger(eventTrigger: bigint): Promise<boolean> {
  if (!chipTestMatterbridge || chipTestActiveEndpointId === undefined) return false;
  const endpoint = getChipTestEndpoint(chipTestMatterbridge, chipTestActiveEndpointId);
  if (!endpoint || !endpoint.hasClusterServer(ClosureControl.id)) return false;

  await applyClosureControlTestEventTrigger(endpoint, eventTrigger, chipTestMatterbridge.log);
  return true;
}

async function applyClosureControlTestEventTrigger(endpoint: MatterbridgeEndpoint, eventTrigger: bigint, log: AnsiLogger): Promise<void> {
  switch (eventTrigger) {
    case normalizeTestEventTrigger(closureControlErrorTrigger): {
      const errorState = [ClosureControl.ClosureError.PhysicallyBlocked];
      await endpoint.setCluster(ClosureControl, { mainState: ClosureControl.MainState.Error, currentErrorList: errorState }, log);
      await endpoint.triggerEvent(ClosureControl, 'operationalError', { errorState }, log);
      return;
    }
    case normalizeTestEventTrigger(closureControlProtectedTrigger):
      await endpoint.setCluster(ClosureControl, { mainState: ClosureControl.MainState.Protected }, log);
      return;
    case normalizeTestEventTrigger(closureControlDisengagedTrigger):
      await endpoint.setCluster(ClosureControl, { mainState: ClosureControl.MainState.Disengaged }, log);
      await endpoint.triggerEvent(ClosureControl, 'engageStateChanged', { engageValue: false }, log);
      return;
    case normalizeTestEventTrigger(closureControlSetupRequiredTrigger):
      await endpoint.setCluster(ClosureControl, { mainState: ClosureControl.MainState.SetupRequired }, log);
      return;
    case normalizeTestEventTrigger(closureControlClearTrigger): {
      // TC_CLCTRL_6_1 step 6e expects an EngageStateChanged(engageValue=true) event when clearing back out of
      // the Disengaged test state (steps 4d/11 clear Error/SetupRequired/Protected instead, which have no
      // corresponding "re-engaged" event to emit), so only re-fire it when that was the state being cleared.
      const wasDisengaged = endpoint.getAttribute(ClosureControl.id, 'mainState') === ClosureControl.MainState.Disengaged;
      await endpoint.setCluster(ClosureControl, { mainState: ClosureControl.MainState.Stopped, currentErrorList: [] }, log);
      if (wasDisengaged) await endpoint.triggerEvent(ClosureControl, 'engageStateChanged', { engageValue: true }, log);
      return;
    }
    default:
      return;
  }
}

// The fake-load/fake-generator trigger carries no endpoint field on the wire, but every TC_EPM_*/TC_EEM_*/
// TC_DEM_* chipTests.json entry that uses it sets "endpoint": 206 (ElectricalSensor) — see
// chipTestActiveEndpointId — so this never needs to guess or broadcast across createChipTestDevices()'s other
// ElectricalPowerMeasurement/ElectricalEnergyMeasurement endpoints (the imported/exported variants).

// Idle values createDefaultElectricalPowerMeasurementClusterServer() constructs each endpoint with (see
// createChipTestDevices()), restored once the fake load stops. Cumulative energy is deliberately left alone
// on stop — a real meter's running total doesn't reset just because the load/generator turns off.
const electricalPowerMeasurementIdleReading = { voltage: 220_000, activeCurrent: 1_000, activePower: 220_000_000, frequency: 50_000 };

// Simulated energy accumulation per periodic tick (mWh added per second), derived from P(mW) * dt(1h/3600) at
// the fixed rate the trigger name promises — not required to be exact, since TC_EEM_2_2/2_3 only assert the
// cumulative reading strictly increases between two reads, not any particular magnitude.
const electricalEnergyMeasurementImportedEnergyPerTick = 278; // ~1kW fake load
const electricalEnergyMeasurementExportedEnergyPerTick = 833; // ~3kW fake generator

async function handleElectricalEnergyTestEventTrigger(eventTrigger: bigint): Promise<boolean> {
  if (
    eventTrigger !== electricalPowerMeasurementStartFakeLoadTrigger &&
    eventTrigger !== electricalEnergyMeasurementStartFakeGeneratorTrigger &&
    eventTrigger !== electricalPowerMeasurementStopFakeReadingsTrigger
  ) {
    return false;
  }
  if (!chipTestMatterbridge || chipTestActiveEndpointId === undefined) return false;
  const matterbridge = chipTestMatterbridge;
  const endpoint = getChipTestEndpoint(matterbridge, chipTestActiveEndpointId);
  if (!endpoint) return false;
  const log = matterbridge.log;

  electricalPowerMeasurementFakeLoadTimer?.stop();
  electricalPowerMeasurementFakeLoadTimer = undefined;

  if (eventTrigger === electricalPowerMeasurementStopFakeReadingsTrigger) {
    if (endpoint.hasClusterServer(ElectricalPowerMeasurement.id)) await endpoint.setCluster(ElectricalPowerMeasurement, electricalPowerMeasurementIdleReading, log);
    return true;
  }

  const isFakeLoad = eventTrigger === electricalPowerMeasurementStartFakeLoadTrigger;

  // TC_EPM_2_2 reads ActivePower/ActiveCurrent/Voltage twice, 3 seconds apart, and asserts both readings fall
  // within a fixed range around 1kW/4.348A/230V *and* differ from each other, so each tick must land on a
  // fresh value inside that range rather than a fixed constant. TC_EEM_2_2/2_3 read CumulativeEnergyImported/
  // Exported twice and assert the second read is strictly greater, so each tick accumulates onto the current
  // live value rather than resetting it.
  const applyFakeLoadTick = async (): Promise<void> => {
    if (isFakeLoad && endpoint.hasClusterServer(ElectricalPowerMeasurement.id)) {
      await endpoint.setCluster(
        ElectricalPowerMeasurement,
        {
          activePower: 980_000 + Math.floor(Math.random() * 40_001), // 980'000-1'020'000 mW
          activeCurrent: 3_848 + Math.floor(Math.random() * 1_001), // 3'848-4'848 mA
          voltage: 229_000 + Math.floor(Math.random() * 2_001), // 229'000-231'000 mV
        },
        log,
      );
    }
    if (isFakeLoad && endpoint.hasAttributeServer(ElectricalEnergyMeasurement.id, 'cumulativeEnergyImported')) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const current = endpoint.getAttribute(ElectricalEnergyMeasurement.id, 'cumulativeEnergyImported') as { energy: number } | null;
      await endpoint.setCluster(
        ElectricalEnergyMeasurement,
        { cumulativeEnergyImported: { energy: (current?.energy ?? 0) + electricalEnergyMeasurementImportedEnergyPerTick } },
        log,
      );
    }
    if (!isFakeLoad && endpoint.hasAttributeServer(ElectricalEnergyMeasurement.id, 'cumulativeEnergyExported')) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const current = endpoint.getAttribute(ElectricalEnergyMeasurement.id, 'cumulativeEnergyExported') as { energy: number } | null;
      await endpoint.setCluster(
        ElectricalEnergyMeasurement,
        { cumulativeEnergyExported: { energy: (current?.energy ?? 0) + electricalEnergyMeasurementExportedEnergyPerTick } },
        log,
      );
    }
  };

  await applyFakeLoadTick();
  electricalPowerMeasurementFakeLoadTimer = Time.getPeriodicTimer('Electrical fake load', Seconds(1), () => {
    applyFakeLoadTick().catch((error: unknown) => log.error(`Electrical fake load tick failed: ${error instanceof Error ? error.message : String(error)}`));
  }).start();
  cliEmitter.once('shutdown', () => electricalPowerMeasurementFakeLoadTimer?.stop());
  return true;
}

// TC_MTRID_3_1's Attributes Value Set / Test Event Clear triggers (src/python_testing/TC_MTRIDTestBase.py).
// createDemoDevices() registers only one MeterIdentification chip-test endpoint (1409, the
// ElectricalUtilityMeter), and every TC_MTRID_2_1/3_1 chipTests.json entry pins "endpoint": 1409, so
// chipTestActiveEndpointId is used directly. MeterType/PointOfDelivery/MeterSerialNumber/ProtocolVersion all
// default to null (createDemoDevices() passes no MeterIdentification options), so the Attributes Value Set
// trigger swaps in distinct non-null fake values — required for TC_MTRID_3_1's subscription assertions, which
// check that each reported value differs from the value read before the trigger fired — and the Test Event
// Clear trigger restores the original null values.
const meterIdentificationFakeValues = {
  meterType: MeterIdentification.MeterType.Utility,
  pointOfDelivery: 'POD-CHIP-TEST',
  meterSerialNumber: 'SN-CHIP-TEST',
  protocolVersion: 'CHIP-TEST-1.0',
};
const meterIdentificationClearedValues = { meterType: null, pointOfDelivery: null, meterSerialNumber: null, protocolVersion: null };

async function handleMeterIdentificationTestEventTrigger(eventTrigger: bigint): Promise<boolean> {
  if (eventTrigger !== meterIdentificationAttributesValueSetTrigger && eventTrigger !== meterIdentificationTestEventClearTrigger) return false;
  if (!chipTestMatterbridge || chipTestActiveEndpointId === undefined) return false;
  const endpoint = getChipTestEndpoint(chipTestMatterbridge, chipTestActiveEndpointId);
  if (!endpoint?.hasClusterServer(MeterIdentification.id)) return false;
  const log = chipTestMatterbridge.log;
  await endpoint.setCluster(
    MeterIdentification,
    eventTrigger === meterIdentificationAttributesValueSetTrigger ? meterIdentificationFakeValues : meterIdentificationClearedValues,
    log,
  );
  return true;
}

// TC_COMMTR_3_1's Attributes Value Set / Test Event Clear triggers (src/python_testing/TC_COMMTR_TestBase.py).
// createDemoDevices() registers CommodityMetering on the Electrical Meter child endpoints created by
// addElectricalMeter() (14091, 14101, 14103), and TC_COMMTR_2_1/3_1's chipTests.json entry pins
// "endpoint": 14091, so chipTestActiveEndpointId is used directly. MeteredQuantity/MeteredQuantityTimestamp/
// TariffUnit/MaximumMeteredQuantities all default to null (addElectricalMeter() is called with no
// CommodityMetering options), so the Attributes Value Set trigger swaps in distinct non-null fake values —
// required for TC_COMMTR_3_1's subscription assertions, which check that each reported value differs from
// the value read before the trigger fired, and for MeteredQuantity's own constraint that
// MaximumMeteredQuantities must not be null whenever MeteredQuantity is not null — and the Test Event Clear
// trigger restores the original null values.
const commodityMeteringFakeValues = {
  maximumMeteredQuantities: 8,
  meteredQuantity: [{ tariffComponentIDs: [1], quantity: 1_234 }],
  meteredQuantityTimestamp: Math.floor(Date.now() / 1000),
  tariffUnit: TariffUnit.KWh,
};
const commodityMeteringClearedValues = { maximumMeteredQuantities: null, meteredQuantity: null, meteredQuantityTimestamp: null, tariffUnit: null };

async function handleCommodityMeteringTestEventTrigger(eventTrigger: bigint): Promise<boolean> {
  if (eventTrigger !== commodityMeteringAttributesValueSetTrigger && eventTrigger !== commodityMeteringTestEventClearTrigger) return false;
  if (!chipTestMatterbridge || chipTestActiveEndpointId === undefined) return false;
  const endpoint = getChipTestEndpoint(chipTestMatterbridge, chipTestActiveEndpointId);
  if (!endpoint?.hasClusterServer(CommodityMetering.id)) return false;
  const log = chipTestMatterbridge.log;
  await endpoint.setCluster(CommodityMetering, eventTrigger === commodityMeteringAttributesValueSetTrigger ? commodityMeteringFakeValues : commodityMeteringClearedValues, log);
  return true;
}

// TC_SEPR_2_2's Price Update TestEventTrigger (src/python_testing/TC_SEPRTestBase.py). createDemoDevices()
// registers CommodityPrice on every Electrical Energy Tariff endpoint created by addElectricalEnergyTariff()/
// addElectricalMeter()'s energyTariff option, and the TC_SEPR_2_1/2_2 chipTests.json entries pin
// "endpoint": 14092 (the dedicated Electrical Energy Tariff Upcoming endpoint), so chipTestActiveEndpointId is
// used directly. CurrentPrice defaults to null (configureElectricalEnergyTariffClusters() is called with no
// currentPrice option), so the trigger publishes a fake CommodityPriceStruct and emits the matching PriceChange
// event, satisfying TC_SEPR_2_2's "either Price or PriceLevel must be included" struct check and its "event's
// CurrentPrice matches the attribute" assertion. Both Price and PriceLevel are populated (not just one) because
// TC_SEPRTestBase.check_CommodityPriceStruct() checks each field against the Python SDK's `NullValue` sentinel
// rather than `None` — the sentinel a genuinely absent (non-nullable) optional struct field actually decodes
// to — so omitting either field would misfire that check's `assert_valid_int64`/`assert_valid_int16` on a
// `None` value and fail; populating both sidesteps that upstream test quirk entirely. `components` is set to
// `undefined` explicitly (not simply omitted) because matter.js's model declares a `default: []` for
// CommodityPriceStruct's Components field (@matter/model's commodity-price.element.ts) and
// ClassForValueModel.initialize() applies that default before overlaying caller-provided keys — an omitted key
// leaves the `[]` default in place, but an explicit `undefined` key overlays and clears it, matching § 9.9.6.3's
// "Description and Components fields shall be omitted in [the CurrentPrice] attribute's value". There is no
// Test Event Clear trigger for this cluster.
async function handleCommodityPriceTestEventTrigger(eventTrigger: bigint): Promise<boolean> {
  if (eventTrigger !== commodityPricePriceUpdateTrigger) return false;
  if (!chipTestMatterbridge || chipTestActiveEndpointId === undefined) return false;
  const endpoint = getChipTestEndpoint(chipTestMatterbridge, chipTestActiveEndpointId);
  if (!endpoint?.hasClusterServer(CommodityPrice.id)) return false;
  const log = chipTestMatterbridge.log;
  // matter.js's epoch-s type is Unix epoch seconds at the API level (it validates a floor of 946_684_800, i.e.
  // the Matter epoch of 2000-01-01T00:00:00Z, expressed in Unix time) — wire-level Matter-epoch conversion is
  // handled internally, not by the caller.
  const currentPrice = { periodStart: Math.floor(Time.nowMs / 1000), periodEnd: null, price: 2_500, priceLevel: 3, components: undefined };
  await endpoint.setCluster(CommodityPrice, { currentPrice }, log);
  await endpoint.triggerEvent(CommodityPrice, 'priceChange', { currentPrice }, log);
  return true;
}

// TC_SETRF_2_2/2_3/3_1's Attributes Value Set / Test Event Clear / Change Day / Change Time TestEventTriggers
// (src/python_testing/TC_SETRF_TestBase.py). createDemoDevices() registers CommodityTariff (Pricing feature
// only — see MatterbridgeCommodityTariffServer) on the same Electrical Energy Tariff endpoints as CommodityPrice,
// and the TC_SETRF_* chipTests.json entries pin "endpoint": 14092, so chipTestActiveEndpointId is used directly.
// All 17 mandatory attributes default to null (configureElectricalEnergyTariffClusters() forces every
// CommodityTariff attribute to null whenever tariffInfo is null — see its own comment), so the Attributes Value
// Set trigger publishes a small, internally-consistent fake tariff (two DayEntryStructs per day, one
// DayPatternStruct/CalendarPeriodStruct covering every day of the week, two TariffComponents/TariffPeriods
// mapping 1:1 to the two day entries) and the Test Event Clear trigger restores the null baseline.
//
// TC_SETRF_2_3 additionally drives the Change Time and Change Day triggers and asserts a specific relationship
// between the CurrentDay(Entry)/NextDay(Entry) values before and after each one (TC_SETRF_2_3.py steps 12-21):
// Change Time must advance CurrentDayEntryDate to the previously-read NextDayEntryDate while leaving
// CurrentDay/NextDay unchanged, and advance NextDayEntryDate again without touching NextDay. Change Day must
// then advance CurrentDay to the previously-read NextDay while leaving CurrentDayEntry's day-of-week pointer
// unchanged, advance NextDay again, and — counter-intuitively — the new CurrentDayEntryDate must NOT equal the
// NextDayEntryDate that was read just before Change Day fired (`assert_not_equal` at TC_SETRF_2_3.py step 18),
// even though the new CurrentDay does equal the old NextDay. A day-entry pointer that resets to the day's first
// entry on every day change lands exactly on that old NextDayEntryDate and fails this assertion, so Change Day
// instead carries the current entry-of-day index forward unchanged (only the day itself advances) — this is
// self-consistent fake data chosen to satisfy the test's assertions, not a claim about how a real device's
// day/entry transitions should compose.
//
// DayEntryStruct's RandomizationType field declares a model-level `default: 0` (@matter/model's
// commodity-tariff.element.ts) despite its `[RNDM]` conformance forbidding it from being set at all when the
// Randomization feature isn't enabled (as here) — ClassForValueModel.initialize() applies that default before
// overlaying caller-provided keys, so an omitted key on a supplied DayEntry still leaks the `0` default onto the
// wire and fails cluster-state validation with ConstraintError. Explicitly overlaying `undefined` clears it,
// the same fix as CommodityPrice's Components field (see MatterbridgeCommodityPriceServer's own comment).
const commodityTariffDayEntries = [
  { dayEntryId: 1, startTime: 0, randomizationType: undefined },
  { dayEntryId: 2, startTime: 720, randomizationType: undefined },
];
const commodityTariffDayPatternId = 1;
const commodityTariffAllDaysOfWeek = { sunday: true, monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true };
// TariffComponentStruct's PeakPeriod/PowerThreshold fields each declare a model-level `default: { type: "none" }`
// (same @matter/model file), gated on the (disabled) PeakPeriod/PowerThreshold features — explicitly overlaying
// `undefined` clears them for the same reason DayEntry's RandomizationType needs it above.
const commodityTariffTariffComponents = [
  {
    tariffComponentId: 100,
    price: { priceType: TariffPriceType.Standard, price: 1_000 },
    threshold: null,
    label: 'Morning Rate',
    peakPeriod: undefined,
    powerThreshold: undefined,
  },
  {
    tariffComponentId: 101,
    price: { priceType: TariffPriceType.Standard, price: 2_000 },
    threshold: null,
    label: 'Afternoon Rate',
    peakPeriod: undefined,
    powerThreshold: undefined,
  },
];
const commodityTariffTariffPeriods = [
  { label: 'Morning', dayEntryIDs: [1], tariffComponentIDs: [100] },
  { label: 'Afternoon', dayEntryIDs: [2], tariffComponentIDs: [101] },
];
const commodityTariffClearedValues = {
  tariffInfo: null,
  tariffUnit: null,
  startDate: null,
  dayEntries: null,
  dayPatterns: null,
  calendarPeriods: null,
  individualDays: null,
  currentDay: null,
  nextDay: null,
  currentDayEntry: null,
  currentDayEntryDate: null,
  nextDayEntry: null,
  nextDayEntryDate: null,
  tariffComponents: null,
  tariffPeriods: null,
  currentTariffComponents: null,
  nextTariffComponents: null,
};
let commodityTariffDayOffset = 0;
let commodityTariffEntryIndex = 0;

function buildCommodityTariffFakeValues(
  dayOffset: number,
  entryIndex: number,
): {
  tariffInfo: CommodityTariff.TariffInformation;
  tariffUnit: TariffUnit;
  startDate: number;
  dayEntries: CommodityTariff.DayEntry[];
  dayPatterns: CommodityTariff.DayPattern[];
  calendarPeriods: CommodityTariff.CalendarPeriod[];
  individualDays: CommodityTariff.Day[];
  currentDay: CommodityTariff.Day;
  nextDay: CommodityTariff.Day;
  currentDayEntry: CommodityTariff.DayEntry;
  currentDayEntryDate: number;
  nextDayEntry: CommodityTariff.DayEntry;
  nextDayEntryDate: number;
  tariffComponents: CommodityTariff.TariffComponent[];
  tariffPeriods: CommodityTariff.TariffPeriod[];
  currentTariffComponents: CommodityTariff.TariffComponent[];
  nextTariffComponents: CommodityTariff.TariffComponent[];
} {
  const anchor = Math.floor(Date.now() / 86_400_000) * 86_400;
  // A calendar period that started a year ago (rather than "null", i.e. immediately) so that both the top-level
  // StartDate attribute and this CalendarPeriodStruct's own StartDate differ from their null default — required
  // for TC_SETRF_3_1's subscription assertion that every mandatory attribute's reported value differs from its
  // pre-trigger (null) value — while still comparing strictly less than any CurrentDayEntryDate/NextDayEntryDate
  // this fake data can produce, which get_day_pattern_IDs_for_active_calendar_period() (TC_SETRF_TestBase.py)
  // requires to resolve the active calendar period.
  const tariffStartDate = anchor - 365 * 86_400;
  const dayOf = (offset: number): CommodityTariff.Day => ({ date: anchor + offset * 86_400, dayType: CommodityTariff.DayType.Standard, dayEntryIDs: [1, 2] });
  const entryDate = (offset: number, idx: number): number => anchor + offset * 86_400 + commodityTariffDayEntries[idx].startTime * 60;
  const nextEntry = entryIndex === commodityTariffDayEntries.length - 1 ? { offset: dayOffset + 1, idx: 0 } : { offset: dayOffset, idx: entryIndex + 1 };
  const tariffComponentsFor = (dayEntryId: number): CommodityTariff.TariffComponent[] =>
    commodityTariffTariffPeriods
      .filter((period) => period.dayEntryIDs.includes(dayEntryId))
      .flatMap((period) => period.tariffComponentIDs)
      .map((id) => commodityTariffTariffComponents.find((component) => component.tariffComponentId === id))
      .filter((component): component is (typeof commodityTariffTariffComponents)[number] => component !== undefined);

  return {
    tariffInfo: {
      tariffLabel: 'CHIP Test Tariff',
      providerName: 'CHIP Test Provider',
      currency: { currency: 840, decimalPoints: 2 },
      blockMode: CommodityTariff.BlockMode.NoBlock,
    },
    tariffUnit: TariffUnit.KWh,
    startDate: tariffStartDate,
    dayEntries: commodityTariffDayEntries,
    dayPatterns: [{ dayPatternId: commodityTariffDayPatternId, daysOfWeek: commodityTariffAllDaysOfWeek, dayEntryIDs: [1, 2] }],
    calendarPeriods: [{ startDate: tariffStartDate, dayPatternIDs: [commodityTariffDayPatternId] }],
    // A single day 30 days in the past — clear of any CurrentDay/NextDay date this fake data can produce — so
    // IndividualDays also differs from its null default (see the tariffStartDate comment above for why that
    // matters), while still trivially satisfying "the DayStruct in this list shall not overlap".
    individualDays: [{ date: anchor - 30 * 86_400, dayType: CommodityTariff.DayType.Holiday, dayEntryIDs: [1, 2] }],
    currentDay: dayOf(dayOffset),
    nextDay: dayOf(dayOffset + 1),
    currentDayEntry: commodityTariffDayEntries[entryIndex],
    currentDayEntryDate: entryDate(dayOffset, entryIndex),
    nextDayEntry: commodityTariffDayEntries[nextEntry.idx],
    nextDayEntryDate: entryDate(nextEntry.offset, nextEntry.idx),
    tariffComponents: commodityTariffTariffComponents,
    tariffPeriods: commodityTariffTariffPeriods,
    currentTariffComponents: tariffComponentsFor(commodityTariffDayEntries[entryIndex].dayEntryId),
    nextTariffComponents: tariffComponentsFor(commodityTariffDayEntries[nextEntry.idx].dayEntryId),
  };
}

async function handleCommodityTariffTestEventTrigger(eventTrigger: bigint): Promise<boolean> {
  if (
    eventTrigger !== commodityTariffAttributesValueSetTrigger &&
    eventTrigger !== commodityTariffTestEventClearTrigger &&
    eventTrigger !== commodityTariffChangeDayTrigger &&
    eventTrigger !== commodityTariffChangeTimeTrigger
  ) {
    return false;
  }
  if (!chipTestMatterbridge || chipTestActiveEndpointId === undefined) return false;
  const endpoint = getChipTestEndpoint(chipTestMatterbridge, chipTestActiveEndpointId);
  if (!endpoint?.hasClusterServer(CommodityTariff.id)) return false;
  const log = chipTestMatterbridge.log;

  if (eventTrigger === commodityTariffTestEventClearTrigger) {
    commodityTariffDayOffset = 0;
    commodityTariffEntryIndex = 0;
    await endpoint.setCluster(CommodityTariff, commodityTariffClearedValues, log);
    return true;
  }
  if (eventTrigger === commodityTariffAttributesValueSetTrigger) {
    commodityTariffDayOffset = 0;
    commodityTariffEntryIndex = 0;
  } else if (eventTrigger === commodityTariffChangeTimeTrigger) {
    commodityTariffEntryIndex = (commodityTariffEntryIndex + 1) % commodityTariffDayEntries.length;
  } else if (eventTrigger === commodityTariffChangeDayTrigger) {
    commodityTariffDayOffset += 1;
  }
  await endpoint.setCluster(CommodityTariff, buildCommodityTariffFakeValues(commodityTariffDayOffset, commodityTariffEntryIndex), log);
  return true;
}

// createChipTestDevices() registers only one DeviceEnergyManagement chip-test endpoint (207, with the
// PowerAdjustment and PowerForecastReporting features — see createDefaultDeviceEnergyManagementClusterServer()),
// and every TC_DEM_*/TC_DEMM_* chipTests.json entry pins "endpoint": 207, so chipTestActiveEndpointId is used
// directly rather than broadcasting or guessing. Command validation, ESAState transitions, and
// PowerAdjustStart/PowerAdjustEnd events are implemented spec-compliantly by
// MatterbridgeDeviceEnergyManagementServer itself (behaviors/deviceEnergyManagementServer.ts), including
// reacting to OptOutState changes that must cancel an active session (Matter 1.6 Application Cluster Spec
// § 9.2.8.8) — these handlers only need to set the attributes each trigger populates or clears.
async function handleDeviceEnergyManagementTestEventTrigger(eventTrigger: bigint): Promise<boolean> {
  if (
    eventTrigger !== deviceEnergyManagementPowerAdjustmentTrigger &&
    eventTrigger !== deviceEnergyManagementPowerAdjustmentClearTrigger &&
    eventTrigger !== deviceEnergyManagementUserOptOutLocalTrigger &&
    eventTrigger !== deviceEnergyManagementUserOptOutGridTrigger &&
    eventTrigger !== deviceEnergyManagementUserOptOutClearAllTrigger &&
    eventTrigger !== deviceEnergyManagementForecastTrigger &&
    eventTrigger !== deviceEnergyManagementForecastClearTrigger
  ) {
    return false;
  }
  if (!chipTestMatterbridge || chipTestActiveEndpointId === undefined) return false;
  const endpoint = getChipTestEndpoint(chipTestMatterbridge, chipTestActiveEndpointId);
  if (!endpoint || !endpoint.hasClusterServer(DeviceEnergyManagement.id)) return false;
  const log = chipTestMatterbridge.log;

  switch (eventTrigger) {
    case deviceEnergyManagementPowerAdjustmentTrigger:
      // TC_DEM_2_2 step 5b: PowerAdjustmentCapability shall include Cause=NoAdjustment with at least one
      // PowerAdjustStruct entry.
      await endpoint.setCluster(
        DeviceEnergyManagement,
        {
          esaState: DeviceEnergyManagement.EsaState.Online,
          powerAdjustmentCapability: {
            powerAdjustCapability: [{ minPower: 500_000, maxPower: 2_000_000, minDuration: 10, maxDuration: 60 }],
            cause: DeviceEnergyManagement.PowerAdjustReason.NoAdjustment,
          },
        },
        log,
      );
      return true;
    case deviceEnergyManagementPowerAdjustmentClearTrigger:
      await endpoint.setCluster(DeviceEnergyManagement, { esaState: DeviceEnergyManagement.EsaState.Online, powerAdjustmentCapability: null }, log);
      return true;
    case deviceEnergyManagementUserOptOutLocalTrigger:
      await applyDeviceEnergyManagementOptOutTrigger(endpoint, DeviceEnergyManagement.OptOutState.LocalOptOut, log);
      return true;
    case deviceEnergyManagementUserOptOutGridTrigger:
      await applyDeviceEnergyManagementOptOutTrigger(endpoint, DeviceEnergyManagement.OptOutState.GridOptOut, log);
      return true;
    case deviceEnergyManagementUserOptOutClearAllTrigger:
      await endpoint.setCluster(DeviceEnergyManagement, { optOutState: DeviceEnergyManagement.OptOutState.NoOptOut }, log);
      return true;
    case deviceEnergyManagementForecastTrigger:
      await endpoint.setCluster(DeviceEnergyManagement, { forecast: buildChipTestDeviceEnergyManagementForecast() }, log);
      return true;
    case deviceEnergyManagementForecastClearTrigger:
      await endpoint.setCluster(DeviceEnergyManagement, { forecast: null }, log);
      return true;
    default:
      return false;
  }
}

async function applyDeviceEnergyManagementOptOutTrigger(endpoint: MatterbridgeEndpoint, bit: DeviceEnergyManagement.OptOutState, log: AnsiLogger): Promise<void> {
  const optOutStateAttribute = endpoint.getAttribute(DeviceEnergyManagement.id, 'optOutState');
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const currentOptOutState = (optOutStateAttribute as DeviceEnergyManagement.OptOutState | null) ?? DeviceEnergyManagement.OptOutState.NoOptOut;
  // oxlint-disable-next-line no-bitwise
  await endpoint.setCluster(DeviceEnergyManagement, { optOutState: currentOptOutState | bit }, log);
}

function buildChipTestDeviceEnergyManagementForecast(): {
  forecastId: number;
  activeSlotNumber: number;
  startTime: number;
  endTime: number;
  isPausable: boolean;
  slots: {
    minDuration: number;
    maxDuration: number;
    defaultDuration: number;
    elapsedSlotTime: number;
    remainingSlotTime: number;
    nominalPower: number;
    minPower: number;
    maxPower: number;
    nominalEnergy: number;
  }[];
  forecastUpdateReason: DeviceEnergyManagement.ForecastUpdateReason;
} {
  // matter.js's epoch-s type is Unix epoch seconds at the API level (it validates a floor of 946_684_800, i.e. the
  // Matter epoch of 2000-01-01T00:00:00Z, expressed in Unix time) — wire-level Matter-epoch conversion is handled
  // internally, not by the caller.
  const nowUnixEpochSeconds = Math.floor(Time.nowMs / 1000);
  return {
    forecastId: 1,
    activeSlotNumber: 0,
    startTime: nowUnixEpochSeconds,
    endTime: nowUnixEpochSeconds + 3600,
    isPausable: false,
    slots: [
      {
        minDuration: 60,
        maxDuration: 3600,
        defaultDuration: 3600,
        elapsedSlotTime: 0,
        remainingSlotTime: 3600,
        nominalPower: 1_000_000,
        minPower: 500_000,
        maxPower: 2_000_000,
        nominalEnergy: 1_000_000,
      },
    ],
    forecastUpdateReason: DeviceEnergyManagement.ForecastUpdateReason.InternalOptimization,
  };
}

async function handleChipTestAppPipeCommand(matterbridge: Matterbridge, command: ChipTestAppPipeCommand): Promise<void> {
  // Not a device command: run-matterbridge-chip-tests.mjs writes this before every test to pin
  // chipTestActiveEndpointId to chipTests.json's "endpoint" for that test (EndpointId omitted clears the pin),
  // so GeneralDiagnostics.TestEventTrigger handlers (which have no endpoint field to work with) and the
  // EndpointId fallback below can target the right endpoint instead of guessing or broadcasting.
  if (command.Name === 'SetTestEndpoint') {
    chipTestActiveEndpointId = command.EndpointId;
    matterbridge.log.info(`CHIP test harness pinned the active test endpoint to ${command.EndpointId ?? 'none'}`);
    return;
  }

  // SimulateConfigurationVersionChange bumps root's BasicInformation.ConfigurationVersion unconditionally, via
  // matterbridge.serverNode directly — root is a ServerNode, not a MatterbridgeEndpoint (siblings under the
  // same Endpoint base, not a subtype), so it can never flow through getChipTestEndpoint()/the endpointId
  // resolution below. It also bumps whichever bridged endpoint is pinned, if any resolves — TC_BRBINFO_3_2
  // pins 701 and gets that bump; TC_BINFO_3_2 pins 0 (root, for reading BasicInformation) and just skips it,
  // since there's no BridgedDeviceBasicInformation cluster on root to bump in the first place.
  if (command.Name === 'SimulateConfigurationVersionChange') {
    if (matterbridge.serverNode) {
      const configurationVersion = (matterbridge.serverNode.stateOf(BasicInformationServer).configurationVersion ?? 1) + 1;
      await matterbridge.serverNode.setStateOf(BasicInformationServer, { configurationVersion });
      matterbridge.log.info(`CHIP test app pipe set BasicInformation.ConfigurationVersion to ${configurationVersion} on endpoint 0`);
    }
    const bridgedEndpoint = chipTestActiveEndpointId === undefined ? undefined : getChipTestEndpoint(matterbridge, chipTestActiveEndpointId);
    if (bridgedEndpoint) {
      bridgedEndpoint.configurationVersion = (bridgedEndpoint.stateOf(BridgedDeviceBasicInformationServer).configurationVersion ?? 1) + 1;
      await bridgedEndpoint.setStateOf(BridgedDeviceBasicInformationServer, { configurationVersion: bridgedEndpoint.configurationVersion });
      matterbridge.log.info(
        `CHIP test app pipe set BridgedDeviceBasicInformation.ConfigurationVersion to ${bridgedEndpoint.configurationVersion} on endpoint ${chipTestActiveEndpointId}`,
      );
    }
    return;
  }

  // SetOccupancy's EndpointId isn't trustworthy (TC_OCC_3_2.py hardcodes the literal 1 rather than sending its
  // real endpoint), so it always defers to the pin instead.
  const endpointId = command.Name === 'SetOccupancy' ? chipTestActiveEndpointId : (command.EndpointId ?? chipTestActiveEndpointId);
  if (endpointId === undefined) {
    matterbridge.log.warn(`Ignoring CHIP test app pipe command without EndpointId: ${JSON.stringify(command)}`);
    return;
  }
  const endpoint = getChipTestEndpoint(matterbridge, endpointId);
  if (!endpoint) {
    matterbridge.log.warn(`Ignoring CHIP test app pipe command for unknown endpoint ${endpointId}: ${JSON.stringify(command)}`);
    return;
  }

  switch (command.Name) {
    case 'Reset': {
      if (!endpoint.behaviors.has(MatterbridgeRvcRunModeServer) || !endpoint.behaviors.has(MatterbridgeRvcOperationalStateServer)) {
        matterbridge.log.warn(`Ignoring RVC Reset CHIP test app pipe command on non-RVC endpoint ${endpointId}`);
        return;
      }
      const runModeState = endpoint.stateOf(MatterbridgeRvcRunModeServer);
      const idleMode = runModeState.supportedModes.find((mode) => mode.modeTags.some((tag) => tag.value === RvcRunMode.ModeTag.Idle));
      if (!idleMode) {
        matterbridge.log.warn(`Ignoring RVC Reset CHIP test app pipe command because endpoint ${endpointId} has no Idle run mode`);
        return;
      }
      await endpoint.setStateOf(MatterbridgeRvcRunModeServer, { currentMode: idleMode.mode });
      await endpoint.setStateOf(MatterbridgeRvcOperationalStateServer, {
        operationalState: RvcOperationalState.OperationalState.Stopped,
        operationalError: { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
      });
      matterbridge.log.info(`CHIP test app pipe reset RVC endpoint ${endpointId}`);
      return;
    }
    case 'ErrorEvent': {
      const errorStates: Record<string, RvcOperationalState.ErrorState> = {
        UnableToStartOrResume: RvcOperationalState.ErrorState.UnableToStartOrResume,
        UnableToCompleteOperation: RvcOperationalState.ErrorState.UnableToCompleteOperation,
        CommandInvalidInState: RvcOperationalState.ErrorState.CommandInvalidInState,
        FailedToFindChargingDock: RvcOperationalState.ErrorState.FailedToFindChargingDock,
        Stuck: RvcOperationalState.ErrorState.Stuck,
        DustBinMissing: RvcOperationalState.ErrorState.DustBinMissing,
        DustBinFull: RvcOperationalState.ErrorState.DustBinFull,
        WaterTankEmpty: RvcOperationalState.ErrorState.WaterTankEmpty,
        WaterTankMissing: RvcOperationalState.ErrorState.WaterTankMissing,
        WaterTankLidOpen: RvcOperationalState.ErrorState.WaterTankLidOpen,
        MopCleaningPadMissing: RvcOperationalState.ErrorState.MopCleaningPadMissing,
        BatteryLow: RvcOperationalState.ErrorState.LowBattery,
        CannotReachTargetArea: RvcOperationalState.ErrorState.CannotReachTargetArea,
        DirtyWaterTankFull: RvcOperationalState.ErrorState.DirtyWaterTankFull,
        DirtyWaterTankMissing: RvcOperationalState.ErrorState.DirtyWaterTankMissing,
        WheelsJammed: RvcOperationalState.ErrorState.WheelsJammed,
        BrushJammed: RvcOperationalState.ErrorState.BrushJammed,
        NavigationSensorObscured: RvcOperationalState.ErrorState.NavigationSensorObscured,
      };
      const errorStateId = command.Error === undefined ? undefined : errorStates[command.Error];
      if (errorStateId === undefined) {
        matterbridge.log.warn(`Ignoring unsupported RVC ErrorEvent CHIP test app pipe command: ${JSON.stringify(command)}`);
        return;
      }
      await endpoint.setStateOf(MatterbridgeRvcOperationalStateServer, {
        operationalState: RvcOperationalState.OperationalState.Error,
        operationalError: { errorStateId, errorStateDetails: 'Simulated CHIP test fault' },
      });
      matterbridge.log.info(`CHIP test app pipe set RVC OperationalError to ${command.Error} on endpoint ${endpointId}`);
      return;
    }
    case 'ChargerFound':
    case 'Charging':
      await endpoint.setStateOf(MatterbridgeRvcOperationalStateServer, { operationalState: RvcOperationalState.OperationalState.Charging });
      matterbridge.log.info(`CHIP test app pipe set RVC OperationalState to Charging on endpoint ${endpointId}`);
      return;
    case 'Charged':
    case 'Docked': {
      const runModeState = endpoint.stateOf(MatterbridgeRvcRunModeServer);
      const idleMode = runModeState.supportedModes.find((mode) => mode.modeTags.some((tag) => tag.value === RvcRunMode.ModeTag.Idle));
      if (idleMode) await endpoint.setStateOf(MatterbridgeRvcRunModeServer, { currentMode: idleMode.mode });
      await endpoint.setStateOf(MatterbridgeRvcOperationalStateServer, { operationalState: RvcOperationalState.OperationalState.Docked });
      matterbridge.log.info(`CHIP test app pipe set RVC OperationalState to Docked on endpoint ${endpointId}`);
      return;
    }
    case 'SetBooleanState':
      await endpoint.setStateOf(endpoint.behaviors.supported.booleanState, { stateValue: Boolean(command.NewState) });
      matterbridge.log.info(`CHIP test app pipe set BooleanState.StateValue to ${Boolean(command.NewState)} on endpoint ${endpointId}`);
      return;
    case 'SetBooleanStateSensorFault':
      await endpoint.setStateOf(endpoint.behaviors.supported.booleanStateConfiguration, { sensorFault: { generalFault: Boolean(command.SensorFault) } });
      matterbridge.log.info(`CHIP test app pipe set BooleanStateConfiguration.SensorFault to ${command.SensorFault ?? 0} on endpoint ${endpointId}`);
      return;
    case 'SetOccupancy':
      await endpoint.setStateOf(MatterbridgeOccupancySensingServer, { occupancy: { occupied: Boolean(command.Occupancy) } });
      matterbridge.log.info(`CHIP test app pipe set OccupancySensing.Occupancy to ${command.Occupancy ?? 0} on endpoint ${endpointId}`);
      return;
    case 'SetSimulatedSoilMoisture':
      await endpoint.setStateOf(endpoint.behaviors.supported.soilMeasurement, { soilMoistureMeasuredValue: command.SoilMoistureValue ?? null });
      matterbridge.log.info(`CHIP test app pipe set SoilMeasurement.SoilMoistureMeasuredValue to ${command.SoilMoistureValue ?? null} on endpoint ${endpointId}`);
      return;
    case 'SetRefrigeratorDoorStatus': {
      const doorOpen = Boolean(command.DoorOpen);
      const wasDoorOpen = Boolean(endpoint.stateOf(MatterbridgeRefrigeratorAlarmServer).state.doorOpen);
      await endpoint.setCluster(RefrigeratorAlarm, { state: { doorOpen } }, matterbridge.log);
      await endpoint.triggerEvent(
        'RefrigeratorAlarm',
        'notify',
        {
          active: { doorOpen: doorOpen && !wasDoorOpen },
          inactive: { doorOpen: !doorOpen && wasDoorOpen },
          state: { doorOpen },
          mask: endpoint.stateOf(MatterbridgeRefrigeratorAlarmServer).mask,
        },
        matterbridge.log,
      );
      matterbridge.log.info(`CHIP test app pipe set RefrigeratorAlarm.State.DoorOpen to ${doorOpen} on endpoint ${endpointId}`);
      return;
    }
    case 'ModeChange':
      if (command.Device === 'DishWasher' && command.Type === 'ToggleFailTransition') {
        matterbridge.log.info(`CHIP test app pipe prepared DishwasherMode for a successful transition on endpoint ${endpointId}`);
        return;
      }
      matterbridge.log.warn(`Ignoring unsupported ModeChange CHIP test app pipe command: ${JSON.stringify(command)}`);
      return;
    case 'OperationalStateChange':
      // TC_OpstateCommon.py's send_manual_or_pipe_command() drives the DUT into states/errors a real command
      // can't reach on its own (e.g. forcing Error), independently of the actual Pause/Stop/Start/Resume
      // command handlers under test elsewhere in the same test. OnFault with NoError only clears the error
      // (the test always follows it with an explicit Stop/Start pipe command of its own to pick the resulting
      // state); any other error id also moves the device to Error, per the base cluster's Effect on Receipt.
      switch (command.Operation) {
        case 'Stop':
          await endpoint.setStateOf(endpoint.behaviors.supported.operationalState, { operationalState: OperationalState.OperationalStateEnum.Stopped });
          break;
        case 'Start':
          await endpoint.setStateOf(endpoint.behaviors.supported.operationalState, { operationalState: OperationalState.OperationalStateEnum.Running });
          break;
        case 'Pause':
          await endpoint.setStateOf(endpoint.behaviors.supported.operationalState, { operationalState: OperationalState.OperationalStateEnum.Paused });
          break;
        case 'OnFault': {
          const errorStateId: OperationalState.ErrorState = command.Param ?? OperationalState.ErrorState.NoError;
          const isNoError = errorStateId === OperationalState.ErrorState.NoError;
          await endpoint.setStateOf(endpoint.behaviors.supported.operationalState, {
            operationalError: { errorStateId, errorStateDetails: isNoError ? 'Fully operational' : 'Simulated CHIP test fault' },
            ...(isNoError ? {} : { operationalState: OperationalState.OperationalStateEnum.Error }),
          });
          break;
        }
        default:
          matterbridge.log.warn(`Ignoring unsupported CHIP test app pipe OperationalStateChange operation: ${JSON.stringify(command)}`);
          return;
      }
      matterbridge.log.info(
        `CHIP test app pipe OperationalStateChange(${command.Operation}${command.Param === undefined ? '' : `, ${command.Param}`}) applied on endpoint ${endpointId}`,
      );
      return;
    default:
      matterbridge.log.warn(`Ignoring unsupported CHIP test app pipe command: ${JSON.stringify(command)}`);
  }
}

function getChipTestEndpoint(matterbridge: Matterbridge, endpointId: number): MatterbridgeEndpoint | undefined {
  const aggregatorEndpoint = matterbridge.aggregatorNode;
  if (!aggregatorEndpoint) return undefined;
  const endpoints = [aggregatorEndpoint, ...aggregatorEndpoint.parts];
  for (const endpoint of endpoints) {
    if (Number(endpoint.number) === endpointId && endpoint instanceof MatterbridgeEndpoint) return endpoint;
    for (const childEndpoint of endpoint.parts) {
      if (Number(childEndpoint.number) === endpointId && childEndpoint instanceof MatterbridgeEndpoint) return childEndpoint;
    }
  }
  return undefined;
}

function isChipTestAppPipeCommand(value: unknown): value is ChipTestAppPipeCommand {
  return (
    typeof value === 'object' &&
    value !== null &&
    (!('Name' in value) || typeof value.Name === 'string') &&
    (!('EndpointId' in value) || typeof value.EndpointId === 'number') &&
    (!('NewState' in value) || typeof value.NewState === 'boolean') &&
    (!('Occupancy' in value) || typeof value.Occupancy === 'number') &&
    (!('SensorFault' in value) || typeof value.SensorFault === 'number') &&
    (!('SoilMoistureValue' in value) || typeof value.SoilMoistureValue === 'number') &&
    (!('Device' in value) || typeof value.Device === 'string') &&
    (!('Operation' in value) || typeof value.Operation === 'string') &&
    (!('Param' in value) || typeof value.Param === 'number')
  );
}
// v8 ignore end
