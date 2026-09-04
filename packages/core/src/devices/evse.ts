/**
 * @file packages/core/src/devices/evse.ts
 * @description This file contains the Evse class.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2025-05-27
 * @version 1.3.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
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

/* oxlint-disable unicorn/no-negated-condition */
/* oxlint-disable typescript/prefer-nullish-coalescing */
/* oxlint-disable typescript/no-unsafe-type-assertion */
/* oxlint-disable typescript/no-namespace */
/* oxlint-disable no-bitwise */

// @matter
import { Seconds, Time, type Timer } from '@matter/general';
import { Supervision } from '@matter/node';
import { EnergyEvseServer } from '@matter/node/behaviors/energy-evse';
import { EnergyEvseModeServer } from '@matter/node/behaviors/energy-evse-mode';
import { MATTER_EPOCH_OFFSET_S, StatusResponse, type EndpointNumber } from '@matter/types';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { EnergyEvse } from '@matter/types/clusters/energy-evse';
import { EnergyEvseMode } from '@matter/types/clusters/energy-evse-mode';
import { ModeBase } from '@matter/types/clusters/mode-base';
import type { Semtag } from '@matter/types/globals';
import { fireAndForget } from '@matterbridge/utils/wait';
import { debugStringify, type AnsiLogger } from 'node-ansi-logger';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { deviceEnergyManagement, electricalSensor, evse, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';

/** Options for configuring an {@link Evse} endpoint. */
export interface EvseOptions {
  /** Endpoint operating mode. */
  mode?: 'server' | 'matter';
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
  /** Semantic tags for endpoint disambiguation. */
  tagList?: Semtag[];
  currentMode?: number;
  supportedModes?: EnergyEvseMode.ModeOption[];
  state?: EnergyEvse.State;
  supplyState?: EnergyEvse.SupplyState;
  faultState?: EnergyEvse.FaultState;
  voltage?: number | bigint | null;
  current?: number | bigint | null;
  power?: number | bigint | null;
  energy?: number | bigint | null;
  absMinPower?: number;
  absMaxPower?: number;
  /** Enables the DeviceEnergyManagement `EsaCanGenerate` flag. Set `true` together with a negative {@link absMinPower} for a V2X-capable (export-capable) EVSE. Defaults to `false`. */
  esaCanGenerate?: boolean;
  /** Enables the EnergyEvse `SoCReporting` (SOC) feature and sets the initial `StateOfCharge` (0-100%). A `null` value means the feature is supported but no vehicle is currently reporting its state of charge. Omit to leave the feature disabled. */
  stateOfCharge?: number | null;
  /** Initial `BatteryCapacity` in mWh, only meaningful when {@link stateOfCharge} is also provided. Defaults to `null`. */
  batteryCapacity?: number | bigint | null;
  /** Enables the EnergyEvse `PlugAndCharge` (PNC) feature and sets the initial `VehicleID`. A `null` value means the feature is supported but no vehicle is currently identified. Omit to leave the feature disabled. */
  vehicleId?: string | null;
  /** Enables the EnergyEvse `Rfid` (RFID) feature, which adds the `Rfid` event. Defaults to `false`. */
  rfid?: boolean;
  /** Enables the EnergyEvse `V2X` feature (bidirectional charging), which adds the `EnableDischarging` command. Defaults to `false`. */
  v2x?: boolean;
}

/**
 * Matterbridge endpoint representing an EVSE (electric vehicle supply equipment).
 */
export class Evse extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the EVSE class.
   *
   * @param {string} name - The name of the EVSE.
   * @param {string} serial - The serial number of the EVSE.
   * @param {number} [currentMode] - The current mode of the EnergyEvseMode cluster. Defaults to mode 1 (EnergyEvseMode.ModeTag.Manual).
   * @param {EnergyEvseMode.ModeOption[]} [supportedModes] - The supported modes for the EnergyEvseMode cluster. This is a fixed attribute that defaults to a predefined set of EnergyEvseMode cluster modes.
   * @param {EnergyEvse.State} [state] - The current state of the EVSE. Defaults to NotPluggedIn.
   * @param {EnergyEvse.SupplyState} [supplyState] - The supply state of the EVSE. Defaults to Disabled.
   * @param {EnergyEvse.FaultState} [faultState] - The fault state of the EVSE. Defaults to NoError.
   * @param {number} [voltage] - The voltage value in millivolts. Defaults to null if not provided.
   * @param {number} [current] - The current value in milliamperes. Defaults to null if not provided.
   * @param {number} [power] - The power value in milliwatts. Defaults to null if not provided.
   * @param {number} [energy] - The total consumption value in mW/h. Defaults to null if not provided.
   * @param {number} [absMinPower] - Indicate the minimum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
   * @param {number} [absMaxPower] - Indicate the maximum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
   * @param {boolean} [esaCanGenerate] - Indicate whether the ESA can also generate/export power. Defaults to `false`.
   * @param {number | null} [stateOfCharge] - Enables the `SoCReporting` (SOC) feature and sets the initial `StateOfCharge` (0-100%). A `null` value means the feature is supported but no vehicle is currently reporting its state of charge. Omit to leave the feature disabled.
   * @param {number | bigint | null} [batteryCapacity] - Initial `BatteryCapacity` in mWh, only meaningful when `stateOfCharge` is also provided. Defaults to `null`.
   * @param {string | null} [vehicleId] - Enables the `PlugAndCharge` (PNC) feature and sets the initial `VehicleID`. A `null` value means the feature is supported but no vehicle is currently identified. Omit to leave the feature disabled.
   * @param {boolean} [rfid] - Enables the `Rfid` (RFID) feature. Defaults to `false`.
   * @param {boolean} [v2x] - Enables the `V2X` feature (bidirectional charging). Defaults to `false`.
   */
  constructor(name: string, serial: string, options?: EvseOptions);

  /** @deprecated Pass an {@link EvseOptions} object as the third argument instead. */
  constructor(
    name: string,
    serial: string,
    currentMode?: number,
    supportedModes?: EnergyEvseMode.ModeOption[],
    state?: EnergyEvse.State,
    supplyState?: EnergyEvse.SupplyState,
    faultState?: EnergyEvse.FaultState,
    voltage?: number | bigint | null,
    current?: number | bigint | null,
    power?: number | bigint | null,
    energy?: number | bigint | null,
    absMinPower?: number,
    absMaxPower?: number,
  );

  constructor(
    name: string,
    serial: string,
    optionsOrCurrentMode?: EvseOptions | number,
    supportedModes?: EnergyEvseMode.ModeOption[],
    state?: EnergyEvse.State,
    supplyState?: EnergyEvse.SupplyState,
    faultState?: EnergyEvse.FaultState,
    voltage: number | bigint | null = null,
    current: number | bigint | null = null,
    power: number | bigint | null = null,
    energy: number | bigint | null = null,
    absMinPower?: number,
    absMaxPower?: number,
  ) {
    const options: EvseOptions =
      typeof optionsOrCurrentMode === 'object'
        ? optionsOrCurrentMode
        : { currentMode: optionsOrCurrentMode, supportedModes, state, supplyState, faultState, voltage, current, power, energy, absMinPower, absMaxPower };
    super([evse], { id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`, number: options.number, tagList: options.tagList, mode: options.mode });
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Evse')
      .createDefaultEnergyEvseClusterServer(
        options.state,
        options.supplyState,
        options.faultState,
        options.stateOfCharge,
        options.batteryCapacity,
        options.vehicleId,
        options.rfid,
        options.v2x,
      )
      .createDefaultEnergyEvseModeClusterServer(options.currentMode, options.supportedModes, options.v2x)
      .createDefaultTemperatureMeasurementClusterServer(24_00) // Internal temperature 24°C in centi-degrees
      .addRequiredClusterServers();
    fireAndForget(this.addFixedLabel('composed', 'EVSE'), this.log, 'Error adding composed label to EVSE');
    this.addChildDeviceType('PowerSource', powerSource).createDefaultPowerSourceWiredClusterServer().addRequiredClusterServers();
    this.addChildDeviceType('ElectricalSensor', electricalSensor)
      .createDefaultPowerTopologyClusterServer()
      .createDefaultElectricalPowerMeasurementClusterServer(options.voltage ?? null, options.current ?? null, options.power ?? null)
      .createDefaultElectricalEnergyMeasurementClusterServer(options.energy ?? null, 0)
      .addRequiredClusterServers();
    this.addChildDeviceType('DeviceEnergyManagement', deviceEnergyManagement)
      .createDefaultDeviceEnergyManagementClusterServer(
        DeviceEnergyManagement.EsaType.Evse,
        options.esaCanGenerate ?? false,
        DeviceEnergyManagement.EsaState.Online,
        options.absMinPower,
        options.absMaxPower,
      )
      .createDefaultDeviceEnergyManagementModeClusterServer()
      .addRequiredClusterServers();
  }

  /**
   * Creates a default EnergyEvseServer Cluster Server.
   *
   * @param {EnergyEvse.State} [state] - The initial state of the EnergyEvse cluster. Defaults to EnergyEvse.State.NotPluggedIn.
   * @param {EnergyEvse.SupplyState} [supplyState] - The initial supply state of the EnergyEvse cluster. Defaults to EnergyEvse.SupplyState.ChargingEnabled.
   * @param {EnergyEvse.FaultState} [faultState] - The initial fault state of the EnergyEvse cluster. Defaults to EnergyEvse.FaultState.NoError.
   * @param {number | null} [stateOfCharge] - Enables the `SoCReporting` (SOC) feature and sets the initial `StateOfCharge` (0-100%). A `null` value means the feature is supported but no vehicle is currently reporting its state of charge. Omit to leave the feature disabled.
   * @param {number | bigint | null} [batteryCapacity] - Initial `BatteryCapacity` in mWh, only meaningful when `stateOfCharge` is also provided. Defaults to `null`.
   * @param {string | null} [vehicleId] - Enables the `PlugAndCharge` (PNC) feature and sets the initial `VehicleID`. A `null` value means the feature is supported but no vehicle is currently identified. Omit to leave the feature disabled.
   * @param {boolean} [rfid] - Enables the `Rfid` (RFID) feature, which adds the `Rfid` event. Defaults to `false`.
   * @param {boolean} [v2x] - Enables the `V2X` feature (bidirectional charging), which adds the `EnableDischarging` command. Defaults to `false`.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultEnergyEvseClusterServer(
    state?: EnergyEvse.State,
    supplyState?: EnergyEvse.SupplyState,
    faultState?: EnergyEvse.FaultState,
    stateOfCharge?: number | null,
    batteryCapacity?: number | bigint | null,
    vehicleId?: string | null,
    rfid?: boolean,
    v2x?: boolean,
  ): this {
    const evseServer = MatterbridgeEnergyEvseServer.with(
      EnergyEvse.Feature.ChargingPreferences,
      ...(stateOfCharge !== undefined ? [EnergyEvse.Feature.SoCReporting] : []),
      ...(vehicleId !== undefined ? [EnergyEvse.Feature.PlugAndCharge] : []),
      ...(rfid ? [EnergyEvse.Feature.Rfid] : []),
      ...(v2x ? [EnergyEvse.Feature.V2X] : []),
    );
    this.behaviors.require(
      // The `rfid` event only exists on the cluster schema when the Rfid feature is part of the selected set.
      rfid ? evseServer.enable({ events: { rfid: true } }) : evseServer,
      {
        state: state !== undefined ? state : EnergyEvse.State.NotPluggedIn,
        supplyState: supplyState !== undefined ? supplyState : EnergyEvse.SupplyState.ChargingEnabled,
        faultState: faultState !== undefined ? faultState : EnergyEvse.FaultState.NoError,
        chargingEnabledUntil: null, // Persistent attribute. A null value indicates the EVSE is always enabled for charging.
        circuitCapacity: 32_000, // Persistent attribute in mA. 32A in mA.
        minimumChargeCurrent: 6_000, // Persistent attribute in mA. 6A in mA.
        maximumChargeCurrent: 32_000, // Persistent attribute in mA. 32A in mA.
        userMaximumChargeCurrent: 32_000, // Persistent attribute in mA. 32A in mA.
        sessionId: null, // Persistent attribute
        sessionDuration: null, // Persistent attribute
        sessionEnergyCharged: null, // Persistent attribute
        // SoCReporting feature attributes
        ...(stateOfCharge !== undefined ? { stateOfCharge, batteryCapacity: batteryCapacity ?? null } : {}),
        // PlugAndCharge feature attribute
        ...(vehicleId !== undefined ? { vehicleId } : {}),
        // V2X feature attributes
        ...(v2x ? { dischargingEnabledUntil: null, maximumDischargeCurrent: 0, sessionEnergyDischarged: null } : {}),
      },
    );
    return this;
  }

  /**
   * Creates a default EnergyEvseMode Cluster Server.
   *
   * @param {number} [currentMode] - The current mode of the EnergyEvseMode cluster. Defaults to mode 1 (EnergyEvseMode.ModeTag.Manual).
   * @param {EnergyEvseMode.ModeOption[]} [supportedModes] - The supported modes for the EnergyEvseMode cluster. Defaults all EnergyEvseMode cluster modes.
   * @param {boolean} [v2x] - When `supportedModes` is not provided, includes the V2X mode (mode 4) in the default modes. Ignored when `supportedModes` is provided. Defaults to `false`.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultEnergyEvseModeClusterServer(currentMode?: number, supportedModes?: EnergyEvseMode.ModeOption[], v2x?: boolean): this {
    this.behaviors.require(MatterbridgeEnergyEvseModeServer, {
      supportedModes: supportedModes ?? [
        { label: 'On demand', mode: 1, modeTags: [{ value: EnergyEvseMode.ModeTag.Manual }] },
        { label: 'Scheduled', mode: 2, modeTags: [{ value: EnergyEvseMode.ModeTag.TimeOfUse }] },
        { label: 'Solar charging', mode: 3, modeTags: [{ value: EnergyEvseMode.ModeTag.SolarCharging }] },
        // This mode is not valid in charging only EVSEs, so it's only included when the V2X feature is enabled.
        ...(v2x ? [{ label: 'Home to vehicle and Vehicle to home', mode: 4, modeTags: [{ value: EnergyEvseMode.ModeTag.V2X }] }] : []),
      ], // FixedAttribute
      currentMode: currentMode ?? 1, // Persistent attribute
    });
    return this;
  }

  /**
   * Triggers the EnergyEvse `Rfid` event (Matter 1.6.0 § 9.3.10.6) for a badge scan detected by the physical RFID
   * reader, e.g. from a plugin driving real hardware. Requires the `Rfid` feature to have been enabled via the
   * `rfid` option of the constructor or {@link createDefaultEnergyEvseClusterServer}.
   *
   * @param {Uint8Array} uid - The ISO/IEC 14443A UID read from the RFID card. Must be 4, 7, or 10 bytes long.
   * @param {AnsiLogger} [log] - Optional logger for logging information.
   * @returns {Promise<boolean>} Resolves to `true` if the event was triggered, `false` if the UID length is invalid.
   */
  async triggerRfidEvent(uid: Uint8Array, log?: AnsiLogger): Promise<boolean> {
    if (![4, 7, 10].includes(uid.length)) {
      (log ?? this.log).warn(`triggerRfidEvent: invalid RFID uid length ${uid.length} (expected 4, 7 or 10 bytes)`);
      return false;
    }
    return this.triggerEvent(EnergyEvseServer.with(EnergyEvse.Feature.Rfid), 'rfid', { uid }, log);
  }
}

/**
 * Energy EVSE server that forwards charging commands and applies the validation and state-update mandates from
 * Matter 1.6 Application Cluster Specification §§ 9.3.8 and 9.3.9.
 *
 * Only `ChargingPreferences` is declared here, matching the default {@link Evse} instance, so
 * `behaviors.has(MatterbridgeEnergyEvseServer)` keeps matching every instance regardless of which additional
 * optional features (SoCReporting/PlugAndCharge/Rfid/V2X) a given call site narrows in via `.with(...)`; see
 * {@link Evse.createDefaultEnergyEvseClusterServer}. `state` is declared with the full attribute set below purely
 * for compile-time convenience in the feature-conditional code paths (`enableDischarging`, `disable`, etc.); the
 * attributes are only actually present on an instance when its selected features include them.
 */
export class MatterbridgeEnergyEvseServer extends EnergyEvseServer.with(EnergyEvse.Feature.ChargingPreferences) {
  declare protected internal: MatterbridgeEnergyEvseServer.Internal;
  declare state: ClusterAttributeValues<(typeof EnergyEvse)['attributes']>;

  override async initialize(): Promise<void> {
    await super.initialize();
    this.internal.requestedMaximumChargeCurrent = Number(this.state.maximumChargeCurrent);
    this.internal.requestedMaximumDischargeCurrent = 0;
    this.internal.chargingTargetSchedules = [];
    // Matter 1.6.0 §§ 9.3.8.8 and 9.3.8.10: a consumer preference write changes the actual maximum current
    // offered by the EVSE, while the last EnableCharging command limit remains in force.
    const userMaximumChargeCurrentChanged = this.events.userMaximumChargeCurrent$Changed;
    /* v8 ignore else -- userMaximumChargeCurrent$Changed exists because this server enables ChargingPreferences. */
    if (userMaximumChargeCurrentChanged) {
      // oxlint-disable-next-line typescript/unbound-method
      this.reactTo(userMaximumChargeCurrentChanged, this.#handleUserMaximumChargeCurrentChanged);
    }
  }

  /**
   * Disables charging and updates EVSE state.
   */
  override async disable(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeEnergyEvseServer: disable charging (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('EnergyEvse.disable', {
      command: 'disable',
      request: {},
      cluster: EnergyEvseServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeEnergyEvseServer: disable called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 9.3.9.1.1: Set ChargingEnabledUntil to a past timestamp and stop any active energy transfer.
    this.state.chargingEnabledUntil = MATTER_EPOCH_OFFSET_S;
    this.#stopCharging(EnergyEvse.EnergyTransferStoppedReason.EvseStopped);
    // Matter 1.6.0 § 9.3.9.1.1: Disable also stops any active discharging when the V2X feature is supported.
    if (this.features.v2X) {
      this.state.dischargingEnabledUntil = MATTER_EPOCH_OFFSET_S;
      this.#stopDischarging(EnergyEvse.EnergyTransferStoppedReason.EvseStopped);
    }
    // super.disable();
    // disable is not implemented in matter.js
  }
  /**
   * Forwards an EnergyEvse `EnableCharging` request and updates the effective charging limits.
   *
   * Matter 1.6 Application Cluster Specification § 9.3.8.8 requires `MaximumChargeCurrent` to represent the
   * actual offered maximum and to be the minimum of the circuit/installation limit, cable limit, command field,
   * and `UserMaximumChargeCurrent`. This implementation has no separate cable or installer limit, so it applies
   * the minimum of `CircuitCapacity`, the request, and `UserMaximumChargeCurrent`.
   *
   * @param {EnergyEvse.EnableChargingRequest} request - Charging enable request payload.
   * @returns {Promise<void>} Resolves after forwarding the command and applying the required state updates.
   */
  override async enableCharging(request: EnergyEvse.EnableChargingRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeEnergyEvseServer: enableCharging (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('EnergyEvse.enableCharging', {
      command: 'enableCharging',
      request,
      cluster: EnergyEvseServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeEnergyEvseServer: enableCharging called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 9.3.9.2.4: Reject EnableCharging with FAILURE while diagnostics are active.
    if (this.state.supplyState === EnergyEvse.SupplyState.DisabledDiagnostics) {
      throw new StatusResponse.FailureError(
        `MatterbridgeEnergyEvseServer: cannot enable charging while diagnostics are active (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }
    this.internal.chargingExpiryTimer?.stop();
    this.internal.chargingExpiryTimer = undefined;
    // Matter 1.6.0 § 9.3.9.2.4: Set SupplyState to ChargingEnabled on success, or to Enabled if discharging
    // (V2X feature) is concurrently active.
    this.state.supplyState = this.#isDischargingActive() ? EnergyEvse.SupplyState.Enabled : EnergyEvse.SupplyState.ChargingEnabled;
    // Matter 1.6.0 § 9.3.9.2.4: Update ChargingEnabledUntil to the timestamp of the ChargingEnabledUntil field.
    this.state.chargingEnabledUntil = request.chargingEnabledUntil;
    this.state.minimumChargeCurrent = request.minimumChargeCurrent;
    this.internal.requestedMaximumChargeCurrent = Number(request.maximumChargeCurrent);
    // Matter 1.6.0 § 9.3.8.8: MaximumChargeCurrent SHALL be the minimum of every applicable charging limit.
    this.#updateMaximumChargeCurrent();
    this.#updateNextChargeTarget();
    if (this.state.state === EnergyEvse.State.PluggedInDemand) {
      this.state.state = EnergyEvse.State.PluggedInCharging;
      this.events.energyTransferStarted.emit(
        { sessionId: this.state.sessionId ?? 0, state: EnergyEvse.State.PluggedInCharging, maximumCurrent: this.state.maximumChargeCurrent },
        this.context,
      );
    }
    if (request.chargingEnabledUntil !== null) {
      const remainingSeconds = Math.max(0, Math.ceil(request.chargingEnabledUntil - Time.nowMs / 1000));
      this.internal.chargingExpiryTimer = Time.getTimer(
        'EnergyEvse charging expiry',
        Seconds(remainingSeconds),
        // oxlint-disable-next-line typescript/unbound-method
        this.callback(this.#expireCharging, { lock: true }),
      ).start();
    }
    // super.enableCharging();
    // enableCharging is not implemented in matter.js
  }

  /**
   * Forwards an EnergyEvse `EnableDischarging` request and updates the effective discharging limits.
   *
   * Matter 1.6 Application Cluster Specification § 9.3.9.3 mirrors § 9.3.8.8's `EnableCharging` behavior for the
   * discharge direction: `MaximumDischargeCurrent` represents the actual offered maximum and this implementation
   * derives it as the minimum of `CircuitCapacity` and the request.
   *
   * @param {EnergyEvse.EnableDischargingRequest} request - Discharging enable request payload.
   * @returns {Promise<void>} Resolves after forwarding the command and applying the required state updates.
   */
  // Not `override`: the class only declares `ChargingPreferences` (see the class JSDoc above), so `enableDischarging`
  // isn't part of its statically-known base interface even though it's only ever dispatched on V2X-enabled instances.
  async enableDischarging(request: EnergyEvse.EnableDischargingRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeEnergyEvseServer: enableDischarging (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('EnergyEvse.enableDischarging', {
      command: 'enableDischarging',
      request,
      cluster: EnergyEvseServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeEnergyEvseServer: enableDischarging called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 9.3.9.2.4-equivalent: Reject EnableDischarging with FAILURE while diagnostics are active.
    if (this.state.supplyState === EnergyEvse.SupplyState.DisabledDiagnostics) {
      throw new StatusResponse.FailureError(
        `MatterbridgeEnergyEvseServer: cannot enable discharging while diagnostics are active (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }
    this.internal.dischargingExpiryTimer?.stop();
    this.internal.dischargingExpiryTimer = undefined;
    // Matter 1.6.0 § 9.3.9.3: Set SupplyState to DischargingEnabled on success, or to Enabled if charging is
    // concurrently active.
    this.state.supplyState = this.#isChargingActive() ? EnergyEvse.SupplyState.Enabled : EnergyEvse.SupplyState.DischargingEnabled;
    // Matter 1.6.0 § 9.3.9.3.1: Update DischargingEnabledUntil to the timestamp of the DischargingEnabledUntil field.
    this.state.dischargingEnabledUntil = request.dischargingEnabledUntil;
    this.internal.requestedMaximumDischargeCurrent = Number(request.maximumDischargeCurrent);
    // Matter 1.6.0 § 9.3.9.3.2: MaximumDischargeCurrent SHALL be the minimum of every applicable discharging limit.
    this.#updateMaximumDischargeCurrent();
    if (this.state.state === EnergyEvse.State.PluggedInDemand) {
      this.state.state = EnergyEvse.State.PluggedInDischarging;
      this.events.energyTransferStarted.emit(
        { sessionId: this.state.sessionId ?? 0, state: EnergyEvse.State.PluggedInDischarging, maximumCurrent: 0, maximumDischargeCurrent: this.state.maximumDischargeCurrent },
        this.context,
      );
    }
    if (request.dischargingEnabledUntil !== null) {
      const remainingSeconds = Math.max(0, Math.ceil(request.dischargingEnabledUntil - Time.nowMs / 1000));
      this.internal.dischargingExpiryTimer = Time.getTimer(
        'EnergyEvse discharging expiry',
        Seconds(remainingSeconds),
        // oxlint-disable-next-line typescript/unbound-method
        this.callback(this.#expireDischarging, { lock: true }),
      ).start();
    }
    // super.enableDischarging();
    // enableDischarging is not implemented in matter.js
  }

  /**
   * Starts EVSE self-diagnostics when charging is disabled.
   *
   * @returns {Promise<void>} Resolves after entering diagnostics mode.
   */
  override async startDiagnostics(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeEnergyEvseServer: startDiagnostics (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('EnergyEvse.startDiagnostics', {
      command: 'startDiagnostics',
      request: {},
      cluster: EnergyEvseServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeEnergyEvseServer: startDiagnostics called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 9.3.9.4.1: Reject StartDiagnostics with FAILURE unless SupplyState is Disabled.
    if (this.state.supplyState !== EnergyEvse.SupplyState.Disabled) {
      throw new StatusResponse.FailureError(
        `MatterbridgeEnergyEvseServer: diagnostics can only start while charging is disabled (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }
    // Matter 1.6.0 § 9.3.9.4.1: Set SupplyState to DisabledDiagnostics on success.
    this.state.supplyState = EnergyEvse.SupplyState.DisabledDiagnostics;
    this.#clearNextChargeTarget();
  }

  #expireCharging(): void {
    this.internal.chargingExpiryTimer = undefined;
    this.#stopCharging(EnergyEvse.EnergyTransferStoppedReason.EvseStopped);
  }

  #expireDischarging(): void {
    this.internal.dischargingExpiryTimer = undefined;
    this.#stopDischarging(EnergyEvse.EnergyTransferStoppedReason.EvseStopped);
  }

  /**
   * Whether charging is currently enabled.
   *
   * @returns {boolean} `true` if `SupplyState` is `ChargingEnabled` or `Enabled`.
   */
  #isChargingActive(): boolean {
    return this.state.supplyState === EnergyEvse.SupplyState.ChargingEnabled || this.state.supplyState === EnergyEvse.SupplyState.Enabled;
  }

  /**
   * Whether discharging is currently enabled.
   *
   * @returns {boolean} `true` if `SupplyState` is `DischargingEnabled` or `Enabled`.
   */
  #isDischargingActive(): boolean {
    return this.state.supplyState === EnergyEvse.SupplyState.DischargingEnabled || this.state.supplyState === EnergyEvse.SupplyState.Enabled;
  }

  /**
   * Recomputes the actual offered current when the consumer changes `UserMaximumChargeCurrent`.
   *
   * Matter 1.6 Application Cluster Specification § 9.3.8.10 defines this writable attribute as a consumer
   * preference that further reduces the charging rate. Section 9.3.8.8 therefore requires the resulting
   * `MaximumChargeCurrent` state to remain the minimum of that preference and all other applicable limits.
   */
  #handleUserMaximumChargeCurrentChanged(): void {
    this.internal.maximumChargeCurrentUpdateTimer?.stop();
    // Defer the derived read-only attribute update until the remote write transaction has completed. The timer
    // callback runs as a local action, which is permitted to update MaximumChargeCurrent.
    this.internal.maximumChargeCurrentUpdateTimer = Time.getTimer(
      'EnergyEvse maximum charge current update',
      Seconds(0),
      // oxlint-disable-next-line typescript/unbound-method
      this.callback(this.#updateMaximumChargeCurrent, { lock: true }),
    ).start();
  }

  /** Applies the Matter 1.6 § 9.3.8.8 effective-current state-update mandate. */
  #updateMaximumChargeCurrent(): void {
    this.state.maximumChargeCurrent = Math.min(Number(this.state.circuitCapacity), this.internal.requestedMaximumChargeCurrent, Number(this.state.userMaximumChargeCurrent));
  }

  /** Applies the Matter 1.6 § 9.3.9.3.2 effective-current state-update mandate for the discharge direction. */
  #updateMaximumDischargeCurrent(): void {
    this.state.maximumDischargeCurrent = Math.min(Number(this.state.circuitCapacity), this.internal.requestedMaximumDischargeCurrent);
  }

  #stopCharging(reason: EnergyEvse.EnergyTransferStoppedReason): void {
    this.internal.chargingExpiryTimer?.stop();
    this.internal.chargingExpiryTimer = undefined;
    if (this.state.state === EnergyEvse.State.PluggedInCharging) {
      this.events.energyTransferStopped.emit({ sessionId: this.state.sessionId ?? 0, state: this.state.state, reason, energyTransferred: 0 }, this.context);
      this.state.state = EnergyEvse.State.PluggedInDemand;
    }
    // Matter 1.6.0 § 9.3.9.1.1/9.3.9.2.4: only clear SupplyState down to Disabled if discharging (V2X) isn't still active.
    this.state.supplyState = this.#isDischargingActive() ? EnergyEvse.SupplyState.DischargingEnabled : EnergyEvse.SupplyState.Disabled;
    this.#clearNextChargeTarget();
  }

  #stopDischarging(reason: EnergyEvse.EnergyTransferStoppedReason): void {
    this.internal.dischargingExpiryTimer?.stop();
    this.internal.dischargingExpiryTimer = undefined;
    if (this.state.state === EnergyEvse.State.PluggedInDischarging) {
      this.events.energyTransferStopped.emit({ sessionId: this.state.sessionId ?? 0, state: this.state.state, reason, energyTransferred: 0, energyDischarged: 0 }, this.context);
      this.state.state = EnergyEvse.State.PluggedInDemand;
    }
    // Matter 1.6.0 § 9.3.9.3: only clear SupplyState down to Disabled if charging isn't still active.
    this.state.supplyState = this.#isChargingActive() ? EnergyEvse.SupplyState.ChargingEnabled : EnergyEvse.SupplyState.Disabled;
  }

  /**
   * Stores the user-specified weekly charging targets.
   *
   * Matter 1.6 Application Cluster Specification § 9.3.9.5.2 requires every day to occur in at most one
   * schedule and requires an update to replace only the days selected by its bitmap. An empty target list is
   * retained as an explicit cleared-day entry so `GetTargets` reports the resulting weekly schedule.
   *
   * @param {EnergyEvse.SetTargetsRequest} request - Charging target schedules request payload.
   * @returns {void} No return value.
   */
  override async setTargets(request: EnergyEvse.SetTargetsRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeEnergyEvseServer: setTargets request ${debugStringify(request.chargingTargetSchedules)} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('EnergyEvse.setTargets', {
      command: 'setTargets',
      request,
      cluster: EnergyEvseServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    let updatedDays = 0;
    for (const schedule of request.chargingTargetSchedules) {
      const scheduleDays = this.#encodeTargetDays(schedule.dayOfWeekForSequence);
      // Matter 1.6.0 § 9.3.9.5.2: Reject the command with CONSTRAINT_ERROR if a day is present in more than one ChargingTargetSchedule.
      if ((updatedDays & scheduleDays) !== 0) {
        throw new StatusResponse.ConstraintErrorError(
          `MatterbridgeEnergyEvseServer: each day may occur in only one ChargingTargetSchedule (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        );
      }
      // Matter 1.6.0 § 9.3.9.5.2: Reject the command with RESOURCE_EXHAUSTED if a schedule requires more charging targets than supported.
      if (schedule.chargingTargets.length > 10) {
        throw new StatusResponse.ResourceExhaustedError(
          `MatterbridgeEnergyEvseServer: a ChargingTargetSchedule supports at most 10 charging targets (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        );
      }
      updatedDays |= scheduleDays;
    }

    // Matter 1.6.0 § 9.3.9.5.2: replace the targets only for days present in this command and preserve all others.
    const unchangedSchedules = this.internal.chargingTargetSchedules.flatMap((schedule) => {
      const remainingDays = this.#encodeTargetDays(schedule.dayOfWeekForSequence) & ~updatedDays;
      // oxlint-disable-next-line typescript/no-misused-spread
      return remainingDays === 0 ? [] : [{ ...schedule, dayOfWeekForSequence: new EnergyEvse.TargetDayOfWeek(remainingDays) }];
    });
    this.internal.chargingTargetSchedules = [...unchangedSchedules, ...structuredClone(request.chargingTargetSchedules)];
    this.#updateNextChargeTarget();
  }

  /**
   * Returns the currently stored weekly charging targets.
   *
   * Matter 1.6 Application Cluster Specification §§ 9.3.9.6.1 and 9.3.9.7 require `GetTargets` to return a
   * `GetTargetsResponse` containing the current schedule.
   *
   * @returns {EnergyEvse.GetTargetsResponse} Stored charging target schedules.
   */
  override async getTargets(): Promise<EnergyEvse.GetTargetsResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeEnergyEvseServer: getTargets (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('EnergyEvse.getTargets', {
      command: 'getTargets',
      request: {},
      cluster: EnergyEvseServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    return { chargingTargetSchedules: structuredClone(this.internal.chargingTargetSchedules) };
  }

  /**
   * Clears all stored weekly charging targets and their derived attributes.
   *
   * Matter 1.6 Application Cluster Specification § 9.3.9.8.1 requires all targets to be cleared, the four
   * `NextCharge*` attributes to no longer describe a scheduled charge, and automatic charging to stop.
   *
   * @returns {void} No return value; this command always succeeds.
   */
  override async clearTargets(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeEnergyEvseServer: clearTargets (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('EnergyEvse.clearTargets', {
      command: 'clearTargets',
      request: {},
      cluster: EnergyEvseServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    // Matter 1.6.0 § 9.3.9.8.1: Clear all stored charging targets and their derived NextCharge* attributes.
    this.internal.chargingTargetSchedules = [];
    this.#clearNextChargeTarget();
  }

  /**
   * Converts a Matter target-day bitmap to its seven-bit numeric representation.
   *
   * @param {EnergyEvse.TargetDayOfWeek} days - Days selected by the charging-target schedule.
   * @returns {number} Numeric bitmap with Sunday at bit 0 and Saturday at bit 6.
   */
  #encodeTargetDays(days: EnergyEvse.TargetDayOfWeek): number {
    return (
      (days.sunday ? 0x01 : 0) |
      (days.monday ? 0x02 : 0) |
      (days.tuesday ? 0x04 : 0) |
      (days.wednesday ? 0x08 : 0) |
      (days.thursday ? 0x10 : 0) |
      (days.friday ? 0x20 : 0) |
      (days.saturday ? 0x40 : 0)
    );
  }

  /** Clears the schedule-derived attributes as required when no active scheduled charge exists. */
  #clearNextChargeTarget(): void {
    this.state.nextChargeStartTime = null;
    this.state.nextChargeTargetTime = null;
    this.state.nextChargeRequiredEnergy = null;
    this.state.nextChargeTargetSoC = null;
  }

  /** Updates the next scheduled charge attributes from the stored weekly schedule. */
  #updateNextChargeTarget(): void {
    this.#clearNextChargeTarget();
    // Charging may be active alongside discharging (V2X SupplyState.Enabled), so check both charging states.
    if (!this.#isChargingActive() || this.state.state === EnergyEvse.State.NotPluggedIn) return;

    const now = new Date(Time.nowMs);
    for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + dayOffset);
      const dayBit = 1 << targetDate.getDay();
      const schedule = this.internal.chargingTargetSchedules.find((candidate) => (this.#encodeTargetDays(candidate.dayOfWeekForSequence) & dayBit) !== 0);
      if (!schedule) continue;
      const targets = schedule.chargingTargets.toSorted((a, b) => a.targetTimeMinutesPastMidnight - b.targetTimeMinutesPastMidnight);
      for (const target of targets) {
        targetDate.setHours(0, target.targetTimeMinutesPastMidnight, 0, 0);
        if (targetDate.getTime() <= now.getTime()) continue;
        const targetTime = Math.floor(targetDate.getTime() / 1000);
        const requiredEnergy = target.addedEnergy === undefined ? null : target.addedEnergy;
        this.state.nextChargeTargetTime = targetTime;
        this.state.nextChargeRequiredEnergy = requiredEnergy;
        this.state.nextChargeTargetSoC = target.addedEnergy === undefined ? (target.targetSoC ?? null) : null;
        // Matter 1.6 §§ 9.3.7.6 and 9.3.9.5.2 recommend deriving the latest start from required energy,
        // available current, and local voltage. Use the EVSE's nominal 230 V supply for this default device.
        const maximumPowerMw = (230_000 * Number(this.state.maximumChargeCurrent)) / 1_000;
        // A zero offered current cannot provide a finite duration; retain a valid time before the target until
        // charging is enabled with a usable current and this calculation runs again.
        const chargingSeconds = requiredEnergy === null || maximumPowerMw <= 0 ? 1 : Math.max(1, Math.ceil((Number(requiredEnergy) * 3_600) / maximumPowerMw));
        this.state.nextChargeStartTime = targetTime - chargingSeconds;
        return;
      }
    }
  }
}

// Matter 1.6 § 9.3.9.5.2 mandates RESOURCE_EXHAUSTED when a command contains more targets than the EVSE
// supports. Disable only the nested list-size constraint so setTargets can return that status; matter.js continues
// to validate the outer schedule-list limit and every ChargingTargetStruct field.
Supervision(MatterbridgeEnergyEvseServer.prototype.constructor, 'setTargets', 'chargingTargetSchedules', 'entry', 'chargingTargets').constraint = false;

/* v8 ignore start */
export namespace MatterbridgeEnergyEvseServer {
  /** Internal timer state for the Energy EVSE server. */
  export class Internal {
    chargingExpiryTimer: Timer | undefined;
    dischargingExpiryTimer: Timer | undefined;
    chargingTargetSchedules: EnergyEvse.ChargingTargetSchedule[] = [];
    maximumChargeCurrentUpdateTimer: Timer | undefined;
    requestedMaximumChargeCurrent = 0;
    requestedMaximumDischargeCurrent = 0;
  }
}
/* v8 ignore stop */

/**
 * Energy EVSE mode server that validates and applies mode changes.
 */
export class MatterbridgeEnergyEvseModeServer extends EnergyEvseModeServer {
  /**
   * Handles the EnergyEvseMode `ChangeToMode` command.
   *
   * @param {ModeBase.ChangeToModeRequest} request - Mode change request payload.
   * @returns {ModeBase.ChangeToModeResponse} Command response with change status.
   */
  override async changeToMode(request: ModeBase.ChangeToModeRequest): Promise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeEnergyEvseModeServer: changing mode to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('EnergyEvseMode.changeToMode', {
      command: 'changeToMode',
      request,
      cluster: EnergyEvseModeServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    const supported = this.state.supportedModes.find((mode) => mode.mode === request.newMode);
    // Matter 1.6.0 § 1.10.7.1.1: Reject ChangeToMode with UnsupportedMode if NewMode matches no SupportedModes entry.
    if (!supported) {
      device.log.error(
        `MatterbridgeEnergyEvseModeServer: changeToMode called with unsupported newMode: ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    // Matter 1.6.0 § 1.10.7.1.1: Set CurrentMode to NewMode when the transition succeeds.
    this.state.currentMode = request.newMode;
    device.log.debug(
      `MatterbridgeEnergyEvseModeServer: changeToMode called with newMode ${request.newMode} => ${supported.label} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}
