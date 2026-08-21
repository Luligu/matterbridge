/**
 * @file packages/core/src/devices/electricalUtilityMeter.ts
 * @description This file contains the ElectricalUtilityMeter class.
 * @author Luca Liguori
 * @created 2026-08-15
 * @version 1.0.0
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

// @matter
import { CommodityTariffChronologyTag, CommodityTariffCommodityTag, PowerSourceTag } from '@matter/node';
import { CommodityMeteringServer } from '@matter/node/behaviors/commodity-metering';
import { CommodityPriceServer } from '@matter/node/behaviors/commodity-price';
import { CommodityTariffServer } from '@matter/node/behaviors/commodity-tariff';
import { ElectricalGridConditionsServer } from '@matter/node/behaviors/electrical-grid-conditions';
import { MeterIdentificationServer } from '@matter/node/behaviors/meter-identification';
import { StatusResponse } from '@matter/types';
import type { CommodityMetering } from '@matter/types/clusters/commodity-metering';
import type { CommodityPrice } from '@matter/types/clusters/commodity-price';
import { CommodityTariff } from '@matter/types/clusters/commodity-tariff';
import type { ElectricalGridConditions } from '@matter/types/clusters/electrical-grid-conditions';
import type { MeterIdentification } from '@matter/types/clusters/meter-identification';
import { type Currency, type Semtag, TariffUnit } from '@matter/types/globals';

// Matterbridge
import { electricalEnergyTariff, electricalMeter, electricalSensor, electricalUtilityMeter, meterReferencePoint, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { getSemtag, optionsFor } from '../matterbridgeEndpointHelpers.js';

/**
 * CommodityPrice server (Application Cluster Specification § 9.9) that implements the mandatory `GetDetailedPrice`
 * command (§ 9.9.7.1) by returning the endpoint's own already-published `currentPrice` attribute (§ 9.9.6.3) as-is.
 *
 * matter.js does not yet provide a default implementation of this command (it throws "unimplemented" by default).
 */
export class MatterbridgeCommodityPriceServer extends CommodityPriceServer {
  /**
   * Returns the endpoint's own already-published `currentPrice` attribute as the detailed price.
   *
   * Application Cluster Specification § 9.9.7.1 (GetDetailedPrice).
   *
   * @returns {CommodityPrice.GetDetailedPriceResponse} The current price, unchanged.
   */
  override getDetailedPriceRequest(): CommodityPrice.GetDetailedPriceResponse {
    return { currentPrice: this.state.currentPrice };
  }
}

/**
 * CommodityTariff server (Application Cluster Specification § 9.12) with the `Pricing` feature (required for the
 * `TariffInfo.Currency` (§ 9.12.6.1) and `TariffComponent.Price` fields) that implements the mandatory
 * `GetTariffComponent` (§ 9.12.7.1) and `GetDayEntry` (§ 9.12.7.3) commands as plain lookups against the endpoint's
 * own already-published `tariffComponents`/`tariffPeriods`/`dayEntries` attributes.
 *
 * matter.js does not yet provide a default implementation of these commands (they throw "unimplemented" by default).
 */
export class MatterbridgeCommodityTariffServer extends CommodityTariffServer.with(CommodityTariff.Feature.Pricing) {
  /**
   * Looks up the requested tariff component (and the label/day entries of the tariff period that references it)
   * among the values already published on `tariffComponents`/`tariffPeriods`.
   *
   * Application Cluster Specification § 9.12.7.1 (GetTariffComponent).
   *
   * @param {CommodityTariff.GetTariffComponentRequest} request - Get-tariff-component request payload.
   * @returns {CommodityTariff.GetTariffComponentResponse} The matching tariff component, with the label and day entry ids of the period it belongs to, if any.
   */
  override getTariffComponent(request: CommodityTariff.GetTariffComponentRequest): CommodityTariff.GetTariffComponentResponse {
    const tariffComponent = (this.state.tariffComponents ?? []).find((component) => component.tariffComponentId === request.tariffComponentId);
    if (!tariffComponent) {
      throw new StatusResponse.NotFoundError(`No TariffComponent with id ${request.tariffComponentId}`);
    }
    const period = (this.state.tariffPeriods ?? []).find((p) => p.tariffComponentIDs.includes(request.tariffComponentId));
    return { label: period?.label ?? null, dayEntryIDs: period?.dayEntryIDs ?? [], tariffComponent };
  }

  /**
   * Looks up the requested day entry among the values already published on `dayEntries`.
   *
   * Application Cluster Specification § 9.12.7.3 (GetDayEntry).
   *
   * @param {CommodityTariff.GetDayEntryRequest} request - Get-day-entry request payload.
   * @returns {CommodityTariff.GetDayEntryResponse} The matching day entry.
   */
  override getDayEntry(request: CommodityTariff.GetDayEntryRequest): CommodityTariff.GetDayEntryResponse {
    const dayEntry = (this.state.dayEntries ?? []).find((entry) => entry.dayEntryId === request.dayEntryId);
    if (!dayEntry) {
      throw new StatusResponse.NotFoundError(`No DayEntry with id ${request.dayEntryId}`);
    }
    return { dayEntry };
  }
}

/**
 * Options for {@link ElectricalUtilityMeter}. See Application Cluster Specification § 9.10 (Meter Identification).
 */
export interface ElectricalUtilityMeterOptions {
  /** The meter type, decided by the manufacturer. Defaults to `null` (not available). § 9.10.6.1. */
  meterType?: MeterIdentification.MeterType | null;
  /** The unique identification of the connection point for the premises. Defaults to `null` (not available). § 9.10.6.2. */
  pointOfDelivery?: string | null;
  /** The serial number of the meter. Defaults to `null` (not available). § 9.10.6.3. */
  meterSerialNumber?: string | null;
  /** The underlying protocol version to express local market features. Defaults to `null` (not available). § 9.10.6.4. */
  protocolVersion?: string | null;
  /** Semantic tags for endpoint disambiguation. Defaults to the Grid power source tag. */
  tagList?: Semtag[];
}

/**
 * Options for {@link ElectricalUtilityMeter.addElectricalMeter}. See Application Cluster Specification § 9.11
 * (Commodity Metering).
 */
export interface ElectricalMeterOptions {
  /** Voltage value in millivolts. Defaults to `null` (not available). */
  voltage?: number | bigint | null;
  /** Current value in milliamperes. Defaults to `null` (not available). */
  current?: number | bigint | null;
  /** Active power value in milliwatts. Defaults to `null` (not available). */
  power?: number | bigint | null;
  /** Cumulative energy imported, in mWh. Defaults to `null` (not available). */
  energyImported?: number | bigint | null;
  /** Cumulative energy exported, in mWh. Defaults to `null` (not available). */
  energyExported?: number | bigint | null;
  /** The most recent summed value(s) of a commodity delivered to and consumed in the premises. Defaults to `null` (not available). § 9.11.5.1. */
  meteredQuantity?: CommodityMetering.MeteredQuantity[] | null;
  /** The UTC timestamp (epoch-s) for when `meteredQuantity` was last updated. Defaults to `null` (not available). § 9.11.5.2. */
  meteredQuantityTimestamp?: number | null;
  /** The unit for the Quantity field on all entries in `meteredQuantity`. Defaults to `null` (not available). § 9.11.5.3. */
  tariffUnit?: TariffUnit | null;
  /** The maximum number of entries in `meteredQuantity`. Defaults to `null` (not available). § 9.11.5.4. */
  maximumMeteredQuantities?: number | null;
  /** Semantic tags for endpoint disambiguation, e.g. to disambiguate multiple electrical meters. */
  tagList?: Semtag[];
}

/**
 * Options for {@link ElectricalUtilityMeter.addElectricalEnergyTariff}. See Application Cluster Specification § 9.9
 * (Commodity Price), § 9.12 (Commodity Tariff), and § 9.13 (Electrical Grid Conditions).
 */
export interface ElectricalEnergyTariffOptions {
  /**
   * The tariff label, e.g. "Standard". Defaults to `null` (not available). Ignored (`tariffInfo` stays `null`) if
   * neither this, providerName, nor currency are provided. § 9.12.6.1 (TariffInfo).
   */
  tariffLabel?: string | null;
  /** The tariff provider's name. Defaults to `null` (not available). § 9.12.6.1 (TariffInfo). */
  providerName?: string | null;
  /**
   * The unit of measure for all pricing data reported by this endpoint's CommodityPrice cluster. Defaults to
   * `TariffUnit.KWh`. § 9.9.6.1. Also used for the CommodityTariff cluster's `tariffUnit` (§ 9.12.6.2), which per
   * spec is only published when `tariffInfo` is not `null` — otherwise it is forced to `null` too.
   */
  tariffUnit?: TariffUnit;
  /** The currency for all tariff and pricing data reported by this endpoint. Defaults to `null` (unknown). § 9.9.6.2 / § 9.12.6.1. */
  currency?: Currency | null;
  /** The current price. Defaults to `null` (unknown). § 9.9.6.3. */
  currentPrice?: CommodityPrice.CommodityPriceStruct | null;
  /** Whether there is known to be local generation (e.g. Solar PV or Battery Storage) at the premises. Defaults to `null` (unknown). § 9.13.6.1. */
  localGenerationAvailable?: boolean | null;
  /** The current electricity supply conditions. Defaults to `null` (unknown). § 9.13.6.2. */
  currentConditions?: ElectricalGridConditions.ElectricalGridConditionsStruct | null;
  /**
   * Semantic tags for endpoint disambiguation. Defaults to the CurrentActiveTariff chronology tag and the
   * ElectricalEnergy commodity tag.
   */
  tagList?: Semtag[];
}

/**
 * Matterbridge endpoint representing an electrical utility meter device.
 *
 * Device Library Specification § 14.9 (Electrical Utility Meter Device Type, superset of Meter Reference Point
 * § 14.6), § 14.9.5 (Cluster Requirements: MeterIdentification), § 14.9.6 (Electrical Utility Meter Topology —
 * Basic Utility Meter example: EP1 Electrical Utility Meter + Meter Reference Point / EP2 Electrical Meter +
 * Electrical Energy Tariff + Electrical Sensor / EP3 Electrical Energy Tariff).
 *
 * @remarks
 * § 14.6.6, inherited from Meter Reference Point via the superset relationship, requires this device to be composed
 * of at least one child endpoint with the Electrical Meter device type and at least one with Electrical Energy
 * Tariff. This is left to the caller, not enforced here (matching how `Oven`/`Refrigerator`/`Cooktop` leave their own
 * "min 1" composition rules to `addCabinet`/`addSurface`) — use `addElectricalMeter` to add at least one electrical
 * meter endpoint and `addElectricalEnergyTariff` to add at least one tariff endpoint for a spec-conformant device.
 *
 * § 14.9.4 also marks the `TimeSynchronization` cluster as mandatory on the node's Root Node endpoint (not this
 * endpoint) whenever an Electrical Utility Meter device type is present. This is intentionally not implemented here:
 * it is out of reach of a device endpoint (it belongs on the Matterbridge server node's own root endpoint), the chip
 * `TC_MTRID`/`TC_COMMTR`/`TC_SETRF`/`TC_EGC`/`TC_EPM`/`TC_EEM` certification tests do not exercise it, and even
 * chip's own `examples/energy-gateway-app` reference app does not wire it up.
 */
export class ElectricalUtilityMeter extends MatterbridgeEndpoint {
  /**
   * Creates an ElectricalUtilityMeter endpoint and configures the MeterIdentification cluster.
   *
   * @param {string} name - Human-readable device name.
   * @param {string} serial - Device serial number.
   * @param {ElectricalUtilityMeterOptions} [options] - Optional initial cluster attribute values.
   */
  constructor(name: string, serial: string, options: ElectricalUtilityMeterOptions = {}) {
    const { meterType = null, pointOfDelivery = null, meterSerialNumber = null, protocolVersion = null, tagList = [getSemtag(PowerSourceTag.Grid)] } = options;
    super([electricalUtilityMeter, meterReferencePoint, powerSource], {
      id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      tagList,
    });

    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Electrical Utility Meter');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createDefaultMeterIdentificationClusterServer(meterType, pointOfDelivery, meterSerialNumber, protocolVersion);
    this.addRequiredClusterServers();
  }

  /**
   * Creates a default Meter Identification Cluster Server.
   *
   * Application Cluster Specification § 9.10 (Meter Identification), required by the Electrical Utility Meter
   * device type (Device Library Specification § 14.9.5).
   *
   * @param {MeterIdentification.MeterType | null} [meterType] - The meter type, decided by the manufacturer. Defaults to `null` (not available). § 9.10.6.1.
   * @param {string | null} [pointOfDelivery] - The unique identification of the connection point for the premises. Defaults to `null` (not available). § 9.10.6.2.
   * @param {string | null} [meterSerialNumber] - The serial number of the meter. Defaults to `null` (not available). § 9.10.6.3.
   * @param {string | null} [protocolVersion] - The underlying protocol version to express local market features. Defaults to `null` (not available). § 9.10.6.4.
   * @returns {this} The current ElectricalUtilityMeter instance for chaining.
   */
  createDefaultMeterIdentificationClusterServer(
    meterType: MeterIdentification.MeterType | null = null,
    pointOfDelivery: string | null = null,
    meterSerialNumber: string | null = null,
    protocolVersion: string | null = null,
  ): this {
    this.behaviors.require(MeterIdentificationServer, optionsFor(MeterIdentificationServer, { meterType, pointOfDelivery, meterSerialNumber, protocolVersion }));
    return this;
  }

  /**
   * Adds an Electrical Meter child endpoint (combined with the Electrical Sensor device type, as required by the
   * Electrical Meter device type composition rules) and configures the ElectricalPowerMeasurement,
   * ElectricalEnergyMeasurement and CommodityMetering clusters.
   *
   * Device Library Specification § 14.8 (Electrical Meter Device Type), § 14.8.4 (Cluster Requirements:
   * ElectricalPowerMeasurement, ElectricalEnergyMeasurement mandatory, CommodityMetering optional/provisional) and
   * § 2.6 (Electrical Sensor Device Type). CommodityMetering itself is Application Cluster Specification § 9.11 —
   * see chip `TC_COMMTR_2_1`/`TC_COMMTR_3_1` for the certification checks this default satisfies (all attributes
   * nullable, `tariffUnit` in range 0-1, `meteredQuantity` length bounded by `maximumMeteredQuantities`).
   *
   * @param {string} name - Human-readable name of the electrical meter endpoint.
   * @param {ElectricalMeterOptions} [options] - Optional initial cluster attribute values.
   * @returns {MatterbridgeEndpoint} The created electrical meter endpoint.
   */
  addElectricalMeter(name: string, options: ElectricalMeterOptions = {}): MatterbridgeEndpoint {
    const {
      voltage = null,
      current = null,
      power = null,
      energyImported = null,
      energyExported = null,
      meteredQuantity = null,
      meteredQuantityTimestamp = null,
      tariffUnit = null,
      maximumMeteredQuantities = null,
      tagList,
    } = options;
    const meter = this.addChildDeviceType(name, [electricalMeter, electricalSensor], tagList ? { tagList } : {})
      .createDefaultPowerTopologyClusterServer()
      .createDefaultElectricalPowerMeasurementClusterServer(voltage, current, power)
      .createDefaultElectricalEnergyMeasurementClusterServer(energyImported, energyExported);
    meter.behaviors.require(CommodityMeteringServer, optionsFor(CommodityMeteringServer, { meteredQuantity, meteredQuantityTimestamp, tariffUnit, maximumMeteredQuantities }));
    meter.addRequiredClusterServers();
    return meter;
  }

  /**
   * Adds an Electrical Energy Tariff child endpoint and configures the CommodityPrice, CommodityTariff and
   * ElectricalGridConditions clusters.
   *
   * Device Library Specification § 14.7 (Electrical Energy Tariff Device Type), § 14.7.4 (Cluster Requirements:
   * CommodityPrice, ElectricalGridConditions and CommodityTariff, all optional) and its Semantic Tag Requirements
   * (Commodity Tariff Chronology `Current` and Commodity Tariff Commodity `ElectricalEnergy`, both applied via the
   * default `tagList`).
   *
   * Per Application Cluster Specification § 9.12.6.1/§ 9.12.6.2, chip's `TC_SETRF_TestBase` asserts that every
   * CommodityTariff attribute — including `tariffUnit` — must read back `null` while `tariffInfo` is `null`; this is
   * enforced below regardless of the `tariffUnit` option (which otherwise only feeds the CommodityPrice cluster,
   * § 9.9.6.1, where `tariffUnit` is non-nullable).
   *
   * @param {string} name - Human-readable name of the electrical energy tariff endpoint.
   * @param {ElectricalEnergyTariffOptions} [options] - Optional initial cluster attribute values.
   * @returns {MatterbridgeEndpoint} The created electrical energy tariff endpoint.
   */
  addElectricalEnergyTariff(name: string, options: ElectricalEnergyTariffOptions = {}): MatterbridgeEndpoint {
    const {
      tariffLabel = null,
      providerName = null,
      tariffUnit = TariffUnit.KWh,
      currency = null,
      currentPrice = null,
      localGenerationAvailable = null,
      currentConditions = null,
      tagList = [getSemtag(CommodityTariffChronologyTag.Current), getSemtag(CommodityTariffCommodityTag.ElectricalEnergy)],
    } = options;
    const tariff = this.addChildDeviceType(name, electricalEnergyTariff, { tagList });

    tariff.behaviors.require(MatterbridgeCommodityPriceServer, optionsFor(MatterbridgeCommodityPriceServer, { tariffUnit, currency, currentPrice }));

    // Application Cluster Specification § 9.12.6.1: TariffInfo is null unless a label, provider name, or currency is given.
    const tariffInfo =
      tariffLabel !== null || providerName !== null || currency !== null ? { tariffLabel, providerName, currency, blockMode: CommodityTariff.BlockMode.NoBlock } : null;
    tariff.behaviors.require(
      MatterbridgeCommodityTariffServer,
      optionsFor(MatterbridgeCommodityTariffServer, {
        tariffInfo,
        // § 9.12.6.2: TariffUnit SHALL be null when TariffInfo is null (chip TC_SETRF_TestBase.check_tariff_unit_attribute).
        tariffUnit: tariffInfo === null ? null : tariffUnit,
        startDate: null,
        dayEntries: null,
        dayPatterns: null,
        calendarPeriods: null,
        individualDays: null,
        tariffComponents: null,
        tariffPeriods: null,
        currentDay: null,
        nextDay: null,
        currentDayEntry: null,
        currentDayEntryDate: null,
        nextDayEntry: null,
        nextDayEntryDate: null,
        currentTariffComponents: null,
        nextTariffComponents: null,
      }),
    );

    tariff.behaviors.require(ElectricalGridConditionsServer, optionsFor(ElectricalGridConditionsServer, { localGenerationAvailable, currentConditions }));

    tariff.addRequiredClusterServers();
    return tariff;
  }
}
