/**
 * @file packages/core/vitest/devices/electricalUtilityMeter.test.ts
 * @description This file contains the tests for the ElectricalUtilityMeter device.
 * @author Luca Liguori
 */

const NAME = 'ElectricalUtilityMeter';
const MATTER_PORT = 8025;
const MATTER_CREATE_ONLY = true;

import { CommonNumberTag } from '@matter/node';
import { CommodityMetering } from '@matter/types/clusters/commodity-metering';
import { CommodityPrice } from '@matter/types/clusters/commodity-price';
import { CommodityTariff } from '@matter/types/clusters/commodity-tariff';
import { Descriptor } from '@matter/types/clusters/descriptor';
import { ElectricalEnergyMeasurement } from '@matter/types/clusters/electrical-energy-measurement';
import { ElectricalGridConditions } from '@matter/types/clusters/electrical-grid-conditions';
import { ElectricalPowerMeasurement } from '@matter/types/clusters/electrical-power-measurement';
import { Identify } from '@matter/types/clusters/identify';
import { MeterIdentification } from '@matter/types/clusters/meter-identification';
import { PowerSource } from '@matter/types/clusters/power-source';
import { PowerTopology } from '@matter/types/clusters/power-topology';
import { EndpointNumber } from '@matter/types/datatype';
import { TariffPriceType, TariffUnit } from '@matter/types/globals';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  server,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';

import { ElectricalUtilityMeter, MatterbridgeCommodityPriceServer, MatterbridgeCommodityTariffServer } from '../../src/devices/electricalUtilityMeter.js';
import { electricalEnergyTariff, electricalMeter, electricalSensor, electricalUtilityMeter } from '../../src/matterbridgeDeviceTypes.js';
import type { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { getSemtag } from '../../src/matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: ElectricalUtilityMeter;
  let meter: MatterbridgeEndpoint;
  let tariff: MatterbridgeEndpoint;
  let explicitTariff: MatterbridgeEndpoint;
  let commandTariff: MatterbridgeEndpoint;
  let noPeriodTariff: MatterbridgeEndpoint;

  const explicitCurrentPrice = { periodStart: 1_700_000_000, periodEnd: null, price: 2000 };
  const dayEntries = [{ dayEntryId: 1, startTime: 0 }];
  const tariffComponents = [{ tariffComponentId: 1, price: { priceType: TariffPriceType.Standard, price: 2000 }, threshold: null, label: 'Standard' }];
  const tariffPeriods = [{ label: 'Standard', dayEntryIDs: [1], tariffComponentIDs: [1] }];

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('create the server node', async () => {
    await createServerNode(MATTER_PORT, electricalUtilityMeter.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create an electrical utility meter device with default options', () => {
    device = new ElectricalUtilityMeter('Electrical Utility Meter Test Device', 'EUM123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('ElectricalUtilityMeterTestDevice-EUM123456');

    expect(device.hasClusterServer(Identify.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(MeterIdentification.id)).toBeTruthy();

    expect(device.getClusterServerOptions(MeterIdentification.id)).toMatchObject({
      meterType: null,
      pointOfDelivery: null,
      meterSerialNumber: null,
      protocolVersion: null,
    });
  });

  test('create an electrical utility meter device with explicit options', () => {
    const explicitDevice = new ElectricalUtilityMeter('Electrical Utility Meter Explicit Device', 'EUM000000', {
      id: 'ElectricalUtilityMeterOptions',
      number: EndpointNumber(14_09),
      meterType: 0,
      pointOfDelivery: 'POD-0000001',
      meterSerialNumber: 'SN-0000001',
      protocolVersion: '1.0',
    });
    expect(explicitDevice.id).toBe('ElectricalUtilityMeterOptions');
    expect(explicitDevice.number).toBe(EndpointNumber(14_09));
    expect(explicitDevice.getClusterServerOptions(MeterIdentification.id)).toMatchObject({
      meterType: 0,
      pointOfDelivery: 'POD-0000001',
      meterSerialNumber: 'SN-0000001',
      protocolVersion: '1.0',
    });
  });

  test('addElectricalMeter with default options', () => {
    meter = device.addElectricalMeter('Electrical Meter');
    expect(meter).toBeDefined();

    expect(meter.hasClusterServer(PowerTopology.id)).toBeTruthy();
    expect(meter.hasClusterServer(ElectricalPowerMeasurement.id)).toBeTruthy();
    expect(meter.hasClusterServer(ElectricalEnergyMeasurement.id)).toBeTruthy();
    expect(meter.hasClusterServer(CommodityMetering.id)).toBeTruthy();
    expect(meter.hasClusterServer(CommodityPrice.id)).toBeFalsy();
    expect(meter.hasClusterServer(CommodityTariff.id)).toBeFalsy();
    expect(meter.deviceTypes.get(electricalMeter.code)).toBe(electricalMeter);
    expect(meter.deviceTypes.get(electricalSensor.code)).toBe(electricalSensor);
    expect(meter.deviceTypes.get(electricalEnergyTariff.code)).toBeUndefined();

    expect(meter.getClusterServerOptions(ElectricalPowerMeasurement.id)).toMatchObject({
      voltage: null,
      activeCurrent: null,
      activePower: null,
    });
    expect(meter.getClusterServerOptions(CommodityMetering.id)).toMatchObject({
      meteredQuantity: null,
      meteredQuantityTimestamp: null,
      tariffUnit: null,
      maximumMeteredQuantities: null,
    });
  });

  test('addElectricalMeter with explicit options', () => {
    const explicitMeter = device.addElectricalMeter('Electrical Meter Explicit', {
      id: 'ElectricalMeterExplicit',
      number: EndpointNumber(14_09_1),
      voltage: 230_000,
      current: 2_000,
      power: 460_000,
      energyImported: 1_000_000,
      energyExported: 0,
      meteredQuantity: [{ tariffComponentIDs: [1], quantity: 12.5 }],
      meteredQuantityTimestamp: 1_700_000_000,
      tariffUnit: TariffUnit.KWh,
      maximumMeteredQuantities: 1,
      tagList: [getSemtag(CommonNumberTag.One)],
    });
    expect(explicitMeter.id).toBe('ElectricalMeterExplicit');
    expect(explicitMeter.number).toBe(EndpointNumber(14_09_1));
    expect(explicitMeter.getClusterServerOptions(ElectricalPowerMeasurement.id)).toMatchObject({
      voltage: 230_000,
      activeCurrent: 2_000,
      activePower: 460_000,
    });
    expect(explicitMeter.getClusterServerOptions(ElectricalEnergyMeasurement.id)).toMatchObject({
      cumulativeEnergyImported: { energy: 1_000_000 },
      cumulativeEnergyExported: { energy: 0 },
    });
    expect(explicitMeter.getClusterServerOptions(CommodityMetering.id)).toMatchObject({
      meteredQuantity: [{ tariffComponentIDs: [1], quantity: 12.5 }],
      meteredQuantityTimestamp: 1_700_000_000,
      tariffUnit: TariffUnit.KWh,
      maximumMeteredQuantities: 1,
    });
    expect(explicitMeter.getClusterServerOptions(Descriptor.id)).toMatchObject({
      tagList: [{ mfgCode: null, namespaceId: CommonNumberTag.One.namespaceId, tag: CommonNumberTag.One.tag }],
    });
  });

  test('addElectricalMeter with energy tariff options', () => {
    const tariffMeter = device.addElectricalMeter('Electrical Meter With Tariff', {
      energyTariff: {
        tariffLabel: 'Standard',
        providerName: 'Provider',
        tariffUnit: TariffUnit.KWh,
        currency: { currency: 978, decimalPoints: 4 },
        currentPrice: explicitCurrentPrice,
        localGenerationAvailable: true,
        currentConditions: { periodStart: 1_700_000_000, periodEnd: null, gridCarbonIntensity: 100, gridCarbonLevel: 1, localCarbonIntensity: 50, localCarbonLevel: 1 },
      },
    });

    expect(tariffMeter.deviceTypes.get(electricalEnergyTariff.code)).toBe(electricalEnergyTariff);
    expect(tariffMeter.hasClusterServer(CommodityPrice.id)).toBeTruthy();
    expect(tariffMeter.hasClusterServer(CommodityTariff.id)).toBeTruthy();
    expect(tariffMeter.hasClusterServer(ElectricalGridConditions.id)).toBeTruthy();
    expect(tariffMeter.getClusterServerOptions(CommodityTariff.id)).toMatchObject({
      tariffInfo: { tariffLabel: 'Standard', providerName: 'Provider', currency: { currency: 978, decimalPoints: 4 }, blockMode: CommodityTariff.BlockMode.NoBlock },
      tariffUnit: TariffUnit.KWh,
    });
  });

  test('addElectricalEnergyTariff with default options', () => {
    tariff = device.addElectricalEnergyTariff('Electrical Energy Tariff');
    expect(tariff).toBeDefined();

    expect(tariff.hasClusterServer(CommodityPrice.id)).toBeTruthy();
    expect(tariff.hasClusterServer(CommodityTariff.id)).toBeTruthy();
    expect(tariff.hasClusterServer(ElectricalGridConditions.id)).toBeTruthy();

    expect(tariff.getClusterServerOptions(CommodityPrice.id)).toMatchObject({
      tariffUnit: TariffUnit.KWh,
      currency: null,
      currentPrice: null,
    });
    expect(tariff.getClusterServerOptions(CommodityTariff.id)).toMatchObject({
      tariffInfo: null,
      // Application Cluster Specification § 9.12.6.2: TariffUnit SHALL be null when TariffInfo is null.
      tariffUnit: null,
    });
    expect(tariff.getClusterServerOptions(ElectricalGridConditions.id)).toMatchObject({
      localGenerationAvailable: null,
      currentConditions: null,
    });
  });

  test('addElectricalEnergyTariff CommodityTariff tariffUnit stays null while tariffInfo is null', () => {
    const partialTariff = device.addElectricalEnergyTariff('Electrical Energy Tariff Partial', { tariffUnit: TariffUnit.KVAh });
    expect(partialTariff.getClusterServerOptions(CommodityPrice.id)).toMatchObject({
      tariffUnit: TariffUnit.KVAh,
    });
    expect(partialTariff.getClusterServerOptions(CommodityTariff.id)).toMatchObject({
      tariffInfo: null,
      tariffUnit: null,
    });
  });

  test('addElectricalEnergyTariff with explicit options', () => {
    explicitTariff = device.addElectricalEnergyTariff('Electrical Energy Tariff Explicit', {
      id: 'ElectricalEnergyTariffExplicit',
      number: EndpointNumber(14_09_2),
      tariffLabel: 'Standard',
      providerName: 'Provider',
      tariffUnit: TariffUnit.KWh,
      currency: { currency: 978, decimalPoints: 4 },
      currentPrice: explicitCurrentPrice,
      localGenerationAvailable: true,
      currentConditions: { periodStart: 1_700_000_000, periodEnd: null, gridCarbonIntensity: 100, gridCarbonLevel: 1, localCarbonIntensity: 50, localCarbonLevel: 1 },
    });
    expect(explicitTariff.id).toBe('ElectricalEnergyTariffExplicit');
    expect(explicitTariff.number).toBe(EndpointNumber(14_09_2));
    expect(explicitTariff.getClusterServerOptions(CommodityPrice.id)).toMatchObject({
      tariffUnit: TariffUnit.KWh,
      currency: { currency: 978, decimalPoints: 4 },
      currentPrice: explicitCurrentPrice,
    });
    expect(explicitTariff.getClusterServerOptions(CommodityTariff.id)).toMatchObject({
      tariffInfo: { tariffLabel: 'Standard', providerName: 'Provider', currency: { currency: 978, decimalPoints: 4 }, blockMode: CommodityTariff.BlockMode.NoBlock },
      tariffUnit: TariffUnit.KWh,
    });
    expect(explicitTariff.getClusterServerOptions(ElectricalGridConditions.id)).toMatchObject({
      localGenerationAvailable: true,
    });
  });

  test('addElectricalEnergyTariff seeded with a full tariff schedule for command coverage', () => {
    // Built directly (not via addElectricalEnergyTariff, which never exposes dayEntries/tariffComponents/tariffPeriods
    // — they're "left to setAttribute()/setCluster() for the full day/tariff schedule"). Seeded in a single
    // behaviors.require() call at construction time: matter.js's conformance validation for these array-of-struct
    // attributes rejects a later setAttribute() update (it fills in defaults for the omitted optional fields of every
    // entry and re-validates them against the enabled features, a path construction-time state doesn't hit), and a
    // second require() call on an already-required behavior does not apply new options either. Needed to exercise
    // MatterbridgeCommodityTariffServer.getTariffComponent/getDayEntry.
    commandTariff = device.addChildDeviceType('Electrical Energy Tariff Commands', electricalEnergyTariff);
    commandTariff.behaviors.require(MatterbridgeCommodityPriceServer, {
      tariffUnit: TariffUnit.KWh,
      currency: { currency: 978, decimalPoints: 4 },
      currentPrice: explicitCurrentPrice,
    });
    commandTariff.behaviors.require(MatterbridgeCommodityTariffServer, {
      tariffInfo: { tariffLabel: 'Standard', providerName: 'Provider', currency: { currency: 978, decimalPoints: 4 }, blockMode: CommodityTariff.BlockMode.NoBlock },
      tariffUnit: TariffUnit.KWh,
      startDate: null,
      dayEntries,
      dayPatterns: null,
      calendarPeriods: null,
      individualDays: null,
      tariffComponents,
      tariffPeriods,
      currentDay: null,
      nextDay: null,
      currentDayEntry: null,
      currentDayEntryDate: null,
      nextDayEntry: null,
      nextDayEntryDate: null,
      currentTariffComponents: null,
      nextTariffComponents: null,
    });
    commandTariff.addRequiredClusterServers();
    expect(commandTariff.getClusterServerOptions(CommodityTariff.id)).toMatchObject({ dayEntries, tariffComponents, tariffPeriods });

    // A second endpoint with tariffComponents set but tariffPeriods left null, to exercise the `tariffPeriods ?? []`
    // fallback and the resulting "component found, but no owning period" branch in getTariffComponent.
    noPeriodTariff = device.addChildDeviceType('Electrical Energy Tariff No Periods', electricalEnergyTariff);
    noPeriodTariff.behaviors.require(MatterbridgeCommodityTariffServer, {
      tariffInfo: { tariffLabel: 'Standard', providerName: 'Provider', currency: { currency: 978, decimalPoints: 4 }, blockMode: CommodityTariff.BlockMode.NoBlock },
      tariffUnit: TariffUnit.KWh,
      startDate: null,
      dayEntries: null,
      dayPatterns: null,
      calendarPeriods: null,
      individualDays: null,
      tariffComponents,
      tariffPeriods: null,
      currentDay: null,
      nextDay: null,
      currentDayEntry: null,
      currentDayEntryDate: null,
      nextDayEntry: null,
      nextDayEntryDate: null,
      currentTariffComponents: null,
      nextTariffComponents: null,
    });
    noPeriodTariff.addRequiredClusterServers();
  });

  test('add an electrical utility meter device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('check attributes after adding device to server', () => {
    expect(meter.getAttribute(CommodityMetering.id, 'meteredQuantity')).toBeNull();
    expect(tariff.getAttribute(CommodityPrice.id, 'currentPrice')).toBeNull();
  });

  test('MatterbridgeCommodityPriceServer getDetailedPriceRequest', async () => {
    const response = await commandTariff.act(async (agent) => agent.get(MatterbridgeCommodityPriceServer).getDetailedPriceRequest({ details: {} }));
    expect(response).toEqual({ currentPrice: explicitCurrentPrice });
  });

  test('MatterbridgeCommodityTariffServer getTariffComponent and getDayEntry', async () => {
    const found = await commandTariff.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getTariffComponent({ tariffComponentId: 1 }));
    expect(found).toEqual({ label: 'Standard', dayEntryIDs: [1], tariffComponent: tariffComponents[0] });

    await expect(commandTariff.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getTariffComponent({ tariffComponentId: 99 }))).rejects.toThrow(
      /no TariffComponent with id 99/,
    );

    const dayEntry = await commandTariff.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getDayEntry({ dayEntryId: 1 }));
    expect(dayEntry).toEqual({ dayEntry: dayEntries[0] });

    await expect(commandTariff.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getDayEntry({ dayEntryId: 99 }))).rejects.toThrow(/no DayEntry with id 99/);
  });

  test('MatterbridgeCommodityTariffServer getTariffComponent falls back when no owning tariffPeriod exists', async () => {
    const found = await noPeriodTariff.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getTariffComponent({ tariffComponentId: 1 }));
    expect(found).toEqual({ label: null, dayEntryIDs: [], tariffComponent: tariffComponents[0] });
  });

  test('MatterbridgeCommodityTariffServer getTariffComponent/getDayEntry reject against an unscheduled tariff', async () => {
    // `tariff` (addElectricalEnergyTariff with default options) never had dayEntries/tariffComponents/tariffPeriods
    // set, so its CommodityTariff state has them as null — exercises the `?? []` fallback on a null state.
    await expect(tariff.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getTariffComponent({ tariffComponentId: 1 }))).rejects.toThrow(
      /no TariffComponent with id 1/,
    );
    await expect(tariff.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getDayEntry({ dayEntryId: 1 }))).rejects.toThrow(/no DayEntry with id 1/);
  });

  test('start the server node', async () => {
    if (!MATTER_CREATE_ONLY) await startServerNode();
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('stop the server node', async () => {
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
  });
});
