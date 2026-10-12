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
} from '@matterbridge/test-utils/vitest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { stringify } from 'node-ansi-logger';

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
  const tariffPeriods = [{ label: 'Standard', dayEntryIds: [1], tariffComponentIds: [1] }];

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
      meteredQuantity: [{ tariffComponentIds: [1], quantity: 12.5 }],
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
      meteredQuantity: [{ tariffComponentIds: [1], quantity: 12.5 }],
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

  test('addElectricalEnergyTariff with a full tariff schedule via options', () => {
    // Seeded through addElectricalEnergyTariff's own schedule options (dayEntries/dayPatterns/calendarPeriods/
    // individualDays/currentDay/nextDay/currentDayEntry/currentDayEntryDate/nextDayEntry/nextDayEntryDate/
    // tariffComponents/tariffPeriods/currentTariffComponents/nextTariffComponents/startDate), applied in the single
    // behaviors.require() call configureElectricalEnergyTariffClusters() already makes at construction time — a
    // later setAttribute() update to these array-of-struct attributes is rejected by matter.js's conformance
    // validation (it fills in defaults for the omitted optional fields of every entry and re-validates them against
    // the enabled features, a path construction-time state doesn't hit), and a second require() call on an
    // already-required behavior would not apply new options either. Also exercises
    // MatterbridgeCommodityTariffServer.getTariffComponent/getDayEntry for command coverage.
    const day: CommodityTariff.Day = { date: 1_700_000_000, dayType: CommodityTariff.DayType.Standard, dayEntryIds: [1] };
    commandTariff = device.addElectricalEnergyTariff('Electrical Energy Tariff Commands', {
      tariffLabel: 'Standard',
      providerName: 'Provider',
      currency: { currency: 978, decimalPoints: 4 },
      currentPrice: explicitCurrentPrice,
      startDate: 1_700_000_000,
      dayEntries,
      dayPatterns: [
        { dayPatternId: 1, daysOfWeek: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true }, dayEntryIds: [1] },
      ],
      calendarPeriods: [{ startDate: null, dayPatternIds: [1] }],
      individualDays: [day],
      currentDay: day,
      nextDay: day,
      currentDayEntry: dayEntries[0],
      currentDayEntryDate: 1_700_000_000,
      nextDayEntry: dayEntries[0],
      nextDayEntryDate: 1_700_086_400,
      tariffComponents,
      tariffPeriods,
      currentTariffComponents: tariffComponents,
      nextTariffComponents: tariffComponents,
    });
    expect(commandTariff.getClusterServerOptions(CommodityTariff.id)).toMatchObject({
      startDate: 1_700_000_000,
      dayEntries,
      calendarPeriods: [{ startDate: null, dayPatternIds: [1] }],
      individualDays: [day],
      currentDay: day,
      nextDay: day,
      currentDayEntry: dayEntries[0],
      currentDayEntryDate: 1_700_000_000,
      nextDayEntry: dayEntries[0],
      nextDayEntryDate: 1_700_086_400,
      tariffComponents,
      tariffPeriods,
      currentTariffComponents: tariffComponents,
      nextTariffComponents: tariffComponents,
    });

    // A second endpoint with tariffComponents set but tariffPeriods left null, to exercise the `tariffPeriods ?? []`
    // fallback and the resulting "component found, but no owning period" branch in getTariffComponent.
    noPeriodTariff = device.addElectricalEnergyTariff('Electrical Energy Tariff No Periods', {
      tariffLabel: 'Standard',
      providerName: 'Provider',
      currency: { currency: 978, decimalPoints: 4 },
      tariffComponents,
    });
  });

  test('addElectricalEnergyTariff CommodityTariff schedule fields stay null while tariffInfo is null', () => {
    const partialScheduleTariff = device.addElectricalEnergyTariff('Electrical Energy Tariff Partial Schedule', {
      startDate: 1_700_000_000,
      dayEntries,
      tariffComponents,
      tariffPeriods,
    });
    expect(partialScheduleTariff.getClusterServerOptions(CommodityTariff.id)).toMatchObject({
      tariffInfo: null,
      startDate: null,
      dayEntries: null,
      tariffComponents: null,
      tariffPeriods: null,
    });
  });

  test('add an electrical utility meter device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('device forEachAttribute', () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 1297, revision: 1 }, { deviceType: 1298, revision: 1 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[ 3, 4, 5, 6, 7, 8, 9, 14091, 14092 ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 47, 64, 2822 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 15, tag: 1, label: undefined } ]',
        'fixedLabel(0x40).acceptedCommandList(0xfff9)=[  ]',
        'fixedLabel(0x40).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'fixedLabel(0x40).clusterRevision(0xfffd)=1',
        'fixedLabel(0x40).featureMap(0xfffc)={  }',
        'fixedLabel(0x40).generatedCommandList(0xfff8)=[  ]',
        "fixedLabel(0x40).labelList(0x0)=[ { label: 'composed', value: 'UtilityMeter' } ]",
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'meterIdentification(0xb06).acceptedCommandList(0xfff9)=[  ]',
        'meterIdentification(0xb06).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'meterIdentification(0xb06).clusterRevision(0xfffd)=1',
        'meterIdentification(0xb06).featureMap(0xfffc)={ powerThreshold: false }',
        'meterIdentification(0xb06).generatedCommandList(0xfff8)=[  ]',
        'meterIdentification(0xb06).meterSerialNumber(0x2)=null',
        'meterIdentification(0xb06).meterType(0x0)=null',
        'meterIdentification(0xb06).pointOfDelivery(0x1)=null',
        'meterIdentification(0xb06).protocolVersion(0x3)=null',
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 5, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='AC Power'",
        'powerSource(0x2f).endpointList(0x1f)=[ 2, 3, 14091, 4, 5, 6, 14092, 7, 8, 9 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
      ].toSorted(),
    );
  });

  test('ElectricalMeter child forEachAttribute', () => {
    const child = device.getChildEndpointById('ElectricalMeter');
    expect(child).toBeDefined();
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    child?.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'commodityMetering(0xb07).acceptedCommandList(0xfff9)=[  ]',
        'commodityMetering(0xb07).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityMetering(0xb07).clusterRevision(0xfffd)=1',
        'commodityMetering(0xb07).featureMap(0xfffc)={  }',
        'commodityMetering(0xb07).generatedCommandList(0xfff8)=[  ]',
        'commodityMetering(0xb07).maximumMeteredQuantities(0x3)=null',
        'commodityMetering(0xb07).meteredQuantity(0x0)=null',
        'commodityMetering(0xb07).meteredQuantityTimestamp(0x1)=null',
        'commodityMetering(0xb07).tariffUnit(0x2)=null',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 1300, revision: 1 }, { deviceType: 1296, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 144, 145, 156, 2823 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 10, tag: 1, label: undefined }, { mfgCode: null, namespaceId: 15, tag: 1, label: undefined }, { mfgCode: null, namespaceId: 19, tag: 0, label: undefined }, { mfgCode: null, namespaceId: 11, tag: 0, label: undefined } ]',
        'electricalEnergyMeasurement(0x91).acceptedCommandList(0xfff9)=[  ]',
        'electricalEnergyMeasurement(0x91).accuracy(0x0)={ measurementType: 14, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }',
        'electricalEnergyMeasurement(0x91).attributeList(0xfffb)=[ 0, 1, 2, 5, 65528, 65529, 65531, 65532, 65533 ]',
        'electricalEnergyMeasurement(0x91).clusterRevision(0xfffd)=2',
        'electricalEnergyMeasurement(0x91).cumulativeEnergyExported(0x2)=null',
        'electricalEnergyMeasurement(0x91).cumulativeEnergyImported(0x1)=null',
        'electricalEnergyMeasurement(0x91).cumulativeEnergyReset(0x5)=null',
        'electricalEnergyMeasurement(0x91).featureMap(0xfffc)={ importedEnergy: true, exportedEnergy: true, cumulativeEnergy: true, periodicEnergy: false, apparentEnergy: false, reactiveEnergy: false }',
        'electricalEnergyMeasurement(0x91).generatedCommandList(0xfff8)=[  ]',
        'electricalPowerMeasurement(0x90).acceptedCommandList(0xfff9)=[  ]',
        'electricalPowerMeasurement(0x90).accuracy(0x2)=[ { measurementType: 1, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }, { measurementType: 2, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }, { measurementType: 5, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }, { measurementType: 11, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] } ]',
        'electricalPowerMeasurement(0x90).activeCurrent(0x5)=null',
        'electricalPowerMeasurement(0x90).activePower(0x8)=null',
        'electricalPowerMeasurement(0x90).attributeList(0xfffb)=[ 0, 1, 2, 4, 5, 8, 14, 65528, 65529, 65531, 65532, 65533 ]',
        'electricalPowerMeasurement(0x90).clusterRevision(0xfffd)=3',
        'electricalPowerMeasurement(0x90).featureMap(0xfffc)={ directCurrent: false, alternatingCurrent: true, polyphasePower: false, harmonics: false, powerQuality: false }',
        'electricalPowerMeasurement(0x90).frequency(0xe)=null',
        'electricalPowerMeasurement(0x90).generatedCommandList(0xfff8)=[  ]',
        'electricalPowerMeasurement(0x90).numberOfMeasurementTypes(0x1)=4',
        'electricalPowerMeasurement(0x90).powerMode(0x0)=2',
        'electricalPowerMeasurement(0x90).voltage(0x4)=null',
        'powerTopology(0x9c).acceptedCommandList(0xfff9)=[  ]',
        'powerTopology(0x9c).attributeList(0xfffb)=[ 65528, 65529, 65531, 65532, 65533 ]',
        'powerTopology(0x9c).clusterRevision(0xfffd)=1',
        'powerTopology(0x9c).featureMap(0xfffc)={ nodeTopology: false, treeTopology: true, setTopology: false, dynamicPowerFlow: false }',
        'powerTopology(0x9c).generatedCommandList(0xfff8)=[  ]',
      ].toSorted(),
    );
  });

  test('ElectricalMeterExplicit child forEachAttribute', () => {
    const child = device.getChildEndpointById('ElectricalMeterExplicit');
    expect(child).toBeDefined();
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    child?.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'commodityMetering(0xb07).acceptedCommandList(0xfff9)=[  ]',
        'commodityMetering(0xb07).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityMetering(0xb07).clusterRevision(0xfffd)=1',
        'commodityMetering(0xb07).featureMap(0xfffc)={  }',
        'commodityMetering(0xb07).generatedCommandList(0xfff8)=[  ]',
        'commodityMetering(0xb07).maximumMeteredQuantities(0x3)=1',
        'commodityMetering(0xb07).meteredQuantity(0x0)=[ { tariffComponentIds: [ 1 ], quantity: 12.5 } ]',
        'commodityMetering(0xb07).meteredQuantityTimestamp(0x1)=1700000000',
        'commodityMetering(0xb07).tariffUnit(0x2)=0',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 1300, revision: 1 }, { deviceType: 1296, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 144, 145, 156, 2823 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 7, tag: 1, label: undefined } ]',
        'electricalEnergyMeasurement(0x91).acceptedCommandList(0xfff9)=[  ]',
        'electricalEnergyMeasurement(0x91).accuracy(0x0)={ measurementType: 14, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }',
        'electricalEnergyMeasurement(0x91).attributeList(0xfffb)=[ 0, 1, 2, 5, 65528, 65529, 65531, 65532, 65533 ]',
        'electricalEnergyMeasurement(0x91).clusterRevision(0xfffd)=2',
        'electricalEnergyMeasurement(0x91).cumulativeEnergyExported(0x2)={ energy: 0, startTimestamp: undefined, endTimestamp: undefined, startSystime: undefined, endSystime: undefined, apparentEnergy: undefined, reactiveEnergy: undefined }',
        'electricalEnergyMeasurement(0x91).cumulativeEnergyImported(0x1)={ energy: 1000000, startTimestamp: undefined, endTimestamp: undefined, startSystime: undefined, endSystime: undefined, apparentEnergy: undefined, reactiveEnergy: undefined }',
        'electricalEnergyMeasurement(0x91).cumulativeEnergyReset(0x5)=null',
        'electricalEnergyMeasurement(0x91).featureMap(0xfffc)={ importedEnergy: true, exportedEnergy: true, cumulativeEnergy: true, periodicEnergy: false, apparentEnergy: false, reactiveEnergy: false }',
        'electricalEnergyMeasurement(0x91).generatedCommandList(0xfff8)=[  ]',
        'electricalPowerMeasurement(0x90).acceptedCommandList(0xfff9)=[  ]',
        'electricalPowerMeasurement(0x90).accuracy(0x2)=[ { measurementType: 1, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }, { measurementType: 2, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }, { measurementType: 5, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }, { measurementType: 11, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] } ]',
        'electricalPowerMeasurement(0x90).activeCurrent(0x5)=2000',
        'electricalPowerMeasurement(0x90).activePower(0x8)=460000',
        'electricalPowerMeasurement(0x90).attributeList(0xfffb)=[ 0, 1, 2, 4, 5, 8, 14, 65528, 65529, 65531, 65532, 65533 ]',
        'electricalPowerMeasurement(0x90).clusterRevision(0xfffd)=3',
        'electricalPowerMeasurement(0x90).featureMap(0xfffc)={ directCurrent: false, alternatingCurrent: true, polyphasePower: false, harmonics: false, powerQuality: false }',
        'electricalPowerMeasurement(0x90).frequency(0xe)=null',
        'electricalPowerMeasurement(0x90).generatedCommandList(0xfff8)=[  ]',
        'electricalPowerMeasurement(0x90).numberOfMeasurementTypes(0x1)=4',
        'electricalPowerMeasurement(0x90).powerMode(0x0)=2',
        'electricalPowerMeasurement(0x90).voltage(0x4)=230000',
        'powerTopology(0x9c).acceptedCommandList(0xfff9)=[  ]',
        'powerTopology(0x9c).attributeList(0xfffb)=[ 65528, 65529, 65531, 65532, 65533 ]',
        'powerTopology(0x9c).clusterRevision(0xfffd)=1',
        'powerTopology(0x9c).featureMap(0xfffc)={ nodeTopology: false, treeTopology: true, setTopology: false, dynamicPowerFlow: false }',
        'powerTopology(0x9c).generatedCommandList(0xfff8)=[  ]',
      ].toSorted(),
    );
  });

  test('ElectricalMeterWithTariff child forEachAttribute', () => {
    const child = device.getChildEndpointById('ElectricalMeterWithTariff');
    expect(child).toBeDefined();
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    child?.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'commodityMetering(0xb07).acceptedCommandList(0xfff9)=[  ]',
        'commodityMetering(0xb07).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityMetering(0xb07).clusterRevision(0xfffd)=1',
        'commodityMetering(0xb07).featureMap(0xfffc)={  }',
        'commodityMetering(0xb07).generatedCommandList(0xfff8)=[  ]',
        'commodityMetering(0xb07).maximumMeteredQuantities(0x3)=null',
        'commodityMetering(0xb07).meteredQuantity(0x0)=null',
        'commodityMetering(0xb07).meteredQuantityTimestamp(0x1)=null',
        'commodityMetering(0xb07).tariffUnit(0x2)=null',
        'commodityPrice(0x95).acceptedCommandList(0xfff9)=[ 0 ]',
        'commodityPrice(0x95).attributeList(0xfffb)=[ 0, 1, 2, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityPrice(0x95).clusterRevision(0xfffd)=4',
        'commodityPrice(0x95).currency(0x1)={ currency: 978, decimalPoints: 4 }',
        'commodityPrice(0x95).currentPrice(0x2)={ periodStart: 1700000000, periodEnd: null, price: 2000, priceLevel: undefined, description: undefined, components: undefined }',
        'commodityPrice(0x95).featureMap(0xfffc)={ forecasting: false }',
        'commodityPrice(0x95).generatedCommandList(0xfff8)=[ 1 ]',
        'commodityPrice(0x95).tariffUnit(0x0)=0',
        'commodityTariff(0x700).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'commodityTariff(0x700).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityTariff(0x700).calendarPeriods(0x5)=null',
        'commodityTariff(0x700).clusterRevision(0xfffd)=1',
        'commodityTariff(0x700).currentDay(0x7)=null',
        'commodityTariff(0x700).currentDayEntry(0x9)=null',
        'commodityTariff(0x700).currentDayEntryDate(0xa)=null',
        'commodityTariff(0x700).currentTariffComponents(0xf)=null',
        'commodityTariff(0x700).dayEntries(0x3)=null',
        'commodityTariff(0x700).dayPatterns(0x4)=null',
        'commodityTariff(0x700).featureMap(0xfffc)={ pricing: true, friendlyCredit: false, auxiliaryLoad: false, peakPeriod: false, powerThreshold: false, randomization: false }',
        'commodityTariff(0x700).generatedCommandList(0xfff8)=[ 0, 1 ]',
        'commodityTariff(0x700).individualDays(0x6)=null',
        'commodityTariff(0x700).nextDay(0x8)=null',
        'commodityTariff(0x700).nextDayEntry(0xb)=null',
        'commodityTariff(0x700).nextDayEntryDate(0xc)=null',
        'commodityTariff(0x700).nextTariffComponents(0x10)=null',
        'commodityTariff(0x700).startDate(0x2)=null',
        'commodityTariff(0x700).tariffComponents(0xd)=null',
        "commodityTariff(0x700).tariffInfo(0x0)={ tariffLabel: 'Standard', providerName: 'Provider', currency: { currency: 978, decimalPoints: 4 }, blockMode: 0 }",
        'commodityTariff(0x700).tariffPeriods(0xe)=null',
        'commodityTariff(0x700).tariffUnit(0x1)=0',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 1300, revision: 1 }, { deviceType: 1299, revision: 1 }, { deviceType: 1296, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 144, 145, 149, 156, 160, 1792, 2823 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 10, tag: 1, label: undefined }, { mfgCode: null, namespaceId: 15, tag: 1, label: undefined }, { mfgCode: null, namespaceId: 19, tag: 0, label: undefined }, { mfgCode: null, namespaceId: 11, tag: 0, label: undefined } ]',
        'electricalEnergyMeasurement(0x91).acceptedCommandList(0xfff9)=[  ]',
        'electricalEnergyMeasurement(0x91).accuracy(0x0)={ measurementType: 14, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }',
        'electricalEnergyMeasurement(0x91).attributeList(0xfffb)=[ 0, 1, 2, 5, 65528, 65529, 65531, 65532, 65533 ]',
        'electricalEnergyMeasurement(0x91).clusterRevision(0xfffd)=2',
        'electricalEnergyMeasurement(0x91).cumulativeEnergyExported(0x2)=null',
        'electricalEnergyMeasurement(0x91).cumulativeEnergyImported(0x1)=null',
        'electricalEnergyMeasurement(0x91).cumulativeEnergyReset(0x5)=null',
        'electricalEnergyMeasurement(0x91).featureMap(0xfffc)={ importedEnergy: true, exportedEnergy: true, cumulativeEnergy: true, periodicEnergy: false, apparentEnergy: false, reactiveEnergy: false }',
        'electricalEnergyMeasurement(0x91).generatedCommandList(0xfff8)=[  ]',
        'electricalGridConditions(0xa0).acceptedCommandList(0xfff9)=[  ]',
        'electricalGridConditions(0xa0).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'electricalGridConditions(0xa0).clusterRevision(0xfffd)=1',
        'electricalGridConditions(0xa0).currentConditions(0x1)={ periodStart: 1700000000, periodEnd: null, gridCarbonIntensity: 100, gridCarbonLevel: 1, localCarbonIntensity: 50, localCarbonLevel: 1 }',
        'electricalGridConditions(0xa0).featureMap(0xfffc)={ forecasting: false }',
        'electricalGridConditions(0xa0).generatedCommandList(0xfff8)=[  ]',
        'electricalGridConditions(0xa0).localGenerationAvailable(0x0)=true',
        'electricalPowerMeasurement(0x90).acceptedCommandList(0xfff9)=[  ]',
        'electricalPowerMeasurement(0x90).accuracy(0x2)=[ { measurementType: 1, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }, { measurementType: 2, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }, { measurementType: 5, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }, { measurementType: 11, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] } ]',
        'electricalPowerMeasurement(0x90).activeCurrent(0x5)=null',
        'electricalPowerMeasurement(0x90).activePower(0x8)=null',
        'electricalPowerMeasurement(0x90).attributeList(0xfffb)=[ 0, 1, 2, 4, 5, 8, 14, 65528, 65529, 65531, 65532, 65533 ]',
        'electricalPowerMeasurement(0x90).clusterRevision(0xfffd)=3',
        'electricalPowerMeasurement(0x90).featureMap(0xfffc)={ directCurrent: false, alternatingCurrent: true, polyphasePower: false, harmonics: false, powerQuality: false }',
        'electricalPowerMeasurement(0x90).frequency(0xe)=null',
        'electricalPowerMeasurement(0x90).generatedCommandList(0xfff8)=[  ]',
        'electricalPowerMeasurement(0x90).numberOfMeasurementTypes(0x1)=4',
        'electricalPowerMeasurement(0x90).powerMode(0x0)=2',
        'electricalPowerMeasurement(0x90).voltage(0x4)=null',
        'powerTopology(0x9c).acceptedCommandList(0xfff9)=[  ]',
        'powerTopology(0x9c).attributeList(0xfffb)=[ 65528, 65529, 65531, 65532, 65533 ]',
        'powerTopology(0x9c).clusterRevision(0xfffd)=1',
        'powerTopology(0x9c).featureMap(0xfffc)={ nodeTopology: false, treeTopology: true, setTopology: false, dynamicPowerFlow: false }',
        'powerTopology(0x9c).generatedCommandList(0xfff8)=[  ]',
      ].toSorted(),
    );
  });

  test('ElectricalEnergyTariff child forEachAttribute', () => {
    const child = device.getChildEndpointById('ElectricalEnergyTariff');
    expect(child).toBeDefined();
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    child?.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'commodityPrice(0x95).acceptedCommandList(0xfff9)=[ 0 ]',
        'commodityPrice(0x95).attributeList(0xfffb)=[ 0, 1, 2, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityPrice(0x95).clusterRevision(0xfffd)=4',
        'commodityPrice(0x95).currency(0x1)=null',
        'commodityPrice(0x95).currentPrice(0x2)=null',
        'commodityPrice(0x95).featureMap(0xfffc)={ forecasting: false }',
        'commodityPrice(0x95).generatedCommandList(0xfff8)=[ 1 ]',
        'commodityPrice(0x95).tariffUnit(0x0)=0',
        'commodityTariff(0x700).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'commodityTariff(0x700).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityTariff(0x700).calendarPeriods(0x5)=null',
        'commodityTariff(0x700).clusterRevision(0xfffd)=1',
        'commodityTariff(0x700).currentDay(0x7)=null',
        'commodityTariff(0x700).currentDayEntry(0x9)=null',
        'commodityTariff(0x700).currentDayEntryDate(0xa)=null',
        'commodityTariff(0x700).currentTariffComponents(0xf)=null',
        'commodityTariff(0x700).dayEntries(0x3)=null',
        'commodityTariff(0x700).dayPatterns(0x4)=null',
        'commodityTariff(0x700).featureMap(0xfffc)={ pricing: true, friendlyCredit: false, auxiliaryLoad: false, peakPeriod: false, powerThreshold: false, randomization: false }',
        'commodityTariff(0x700).generatedCommandList(0xfff8)=[ 0, 1 ]',
        'commodityTariff(0x700).individualDays(0x6)=null',
        'commodityTariff(0x700).nextDay(0x8)=null',
        'commodityTariff(0x700).nextDayEntry(0xb)=null',
        'commodityTariff(0x700).nextDayEntryDate(0xc)=null',
        'commodityTariff(0x700).nextTariffComponents(0x10)=null',
        'commodityTariff(0x700).startDate(0x2)=null',
        'commodityTariff(0x700).tariffComponents(0xd)=null',
        'commodityTariff(0x700).tariffInfo(0x0)=null',
        'commodityTariff(0x700).tariffPeriods(0xe)=null',
        'commodityTariff(0x700).tariffUnit(0x1)=null',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 1299, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 149, 160, 1792 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 11, tag: 0, label: undefined }, { mfgCode: null, namespaceId: 13, tag: 0, label: undefined } ]',
        'electricalGridConditions(0xa0).acceptedCommandList(0xfff9)=[  ]',
        'electricalGridConditions(0xa0).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'electricalGridConditions(0xa0).clusterRevision(0xfffd)=1',
        'electricalGridConditions(0xa0).currentConditions(0x1)=null',
        'electricalGridConditions(0xa0).featureMap(0xfffc)={ forecasting: false }',
        'electricalGridConditions(0xa0).generatedCommandList(0xfff8)=[  ]',
        'electricalGridConditions(0xa0).localGenerationAvailable(0x0)=null',
      ].toSorted(),
    );
  });

  test('ElectricalEnergyTariffPartial child forEachAttribute', () => {
    const child = device.getChildEndpointById('ElectricalEnergyTariffPartial');
    expect(child).toBeDefined();
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    child?.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'commodityPrice(0x95).acceptedCommandList(0xfff9)=[ 0 ]',
        'commodityPrice(0x95).attributeList(0xfffb)=[ 0, 1, 2, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityPrice(0x95).clusterRevision(0xfffd)=4',
        'commodityPrice(0x95).currency(0x1)=null',
        'commodityPrice(0x95).currentPrice(0x2)=null',
        'commodityPrice(0x95).featureMap(0xfffc)={ forecasting: false }',
        'commodityPrice(0x95).generatedCommandList(0xfff8)=[ 1 ]',
        'commodityPrice(0x95).tariffUnit(0x0)=1',
        'commodityTariff(0x700).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'commodityTariff(0x700).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityTariff(0x700).calendarPeriods(0x5)=null',
        'commodityTariff(0x700).clusterRevision(0xfffd)=1',
        'commodityTariff(0x700).currentDay(0x7)=null',
        'commodityTariff(0x700).currentDayEntry(0x9)=null',
        'commodityTariff(0x700).currentDayEntryDate(0xa)=null',
        'commodityTariff(0x700).currentTariffComponents(0xf)=null',
        'commodityTariff(0x700).dayEntries(0x3)=null',
        'commodityTariff(0x700).dayPatterns(0x4)=null',
        'commodityTariff(0x700).featureMap(0xfffc)={ pricing: true, friendlyCredit: false, auxiliaryLoad: false, peakPeriod: false, powerThreshold: false, randomization: false }',
        'commodityTariff(0x700).generatedCommandList(0xfff8)=[ 0, 1 ]',
        'commodityTariff(0x700).individualDays(0x6)=null',
        'commodityTariff(0x700).nextDay(0x8)=null',
        'commodityTariff(0x700).nextDayEntry(0xb)=null',
        'commodityTariff(0x700).nextDayEntryDate(0xc)=null',
        'commodityTariff(0x700).nextTariffComponents(0x10)=null',
        'commodityTariff(0x700).startDate(0x2)=null',
        'commodityTariff(0x700).tariffComponents(0xd)=null',
        'commodityTariff(0x700).tariffInfo(0x0)=null',
        'commodityTariff(0x700).tariffPeriods(0xe)=null',
        'commodityTariff(0x700).tariffUnit(0x1)=null',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 1299, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 149, 160, 1792 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 11, tag: 0, label: undefined }, { mfgCode: null, namespaceId: 13, tag: 0, label: undefined } ]',
        'electricalGridConditions(0xa0).acceptedCommandList(0xfff9)=[  ]',
        'electricalGridConditions(0xa0).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'electricalGridConditions(0xa0).clusterRevision(0xfffd)=1',
        'electricalGridConditions(0xa0).currentConditions(0x1)=null',
        'electricalGridConditions(0xa0).featureMap(0xfffc)={ forecasting: false }',
        'electricalGridConditions(0xa0).generatedCommandList(0xfff8)=[  ]',
        'electricalGridConditions(0xa0).localGenerationAvailable(0x0)=null',
      ].toSorted(),
    );
  });

  test('ElectricalEnergyTariffExplicit child forEachAttribute', () => {
    const child = device.getChildEndpointById('ElectricalEnergyTariffExplicit');
    expect(child).toBeDefined();
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    child?.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'commodityPrice(0x95).acceptedCommandList(0xfff9)=[ 0 ]',
        'commodityPrice(0x95).attributeList(0xfffb)=[ 0, 1, 2, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityPrice(0x95).clusterRevision(0xfffd)=4',
        'commodityPrice(0x95).currency(0x1)={ currency: 978, decimalPoints: 4 }',
        'commodityPrice(0x95).currentPrice(0x2)={ periodStart: 1700000000, periodEnd: null, price: 2000, priceLevel: undefined, description: undefined, components: undefined }',
        'commodityPrice(0x95).featureMap(0xfffc)={ forecasting: false }',
        'commodityPrice(0x95).generatedCommandList(0xfff8)=[ 1 ]',
        'commodityPrice(0x95).tariffUnit(0x0)=0',
        'commodityTariff(0x700).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'commodityTariff(0x700).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityTariff(0x700).calendarPeriods(0x5)=null',
        'commodityTariff(0x700).clusterRevision(0xfffd)=1',
        'commodityTariff(0x700).currentDay(0x7)=null',
        'commodityTariff(0x700).currentDayEntry(0x9)=null',
        'commodityTariff(0x700).currentDayEntryDate(0xa)=null',
        'commodityTariff(0x700).currentTariffComponents(0xf)=null',
        'commodityTariff(0x700).dayEntries(0x3)=null',
        'commodityTariff(0x700).dayPatterns(0x4)=null',
        'commodityTariff(0x700).featureMap(0xfffc)={ pricing: true, friendlyCredit: false, auxiliaryLoad: false, peakPeriod: false, powerThreshold: false, randomization: false }',
        'commodityTariff(0x700).generatedCommandList(0xfff8)=[ 0, 1 ]',
        'commodityTariff(0x700).individualDays(0x6)=null',
        'commodityTariff(0x700).nextDay(0x8)=null',
        'commodityTariff(0x700).nextDayEntry(0xb)=null',
        'commodityTariff(0x700).nextDayEntryDate(0xc)=null',
        'commodityTariff(0x700).nextTariffComponents(0x10)=null',
        'commodityTariff(0x700).startDate(0x2)=null',
        'commodityTariff(0x700).tariffComponents(0xd)=null',
        "commodityTariff(0x700).tariffInfo(0x0)={ tariffLabel: 'Standard', providerName: 'Provider', currency: { currency: 978, decimalPoints: 4 }, blockMode: 0 }",
        'commodityTariff(0x700).tariffPeriods(0xe)=null',
        'commodityTariff(0x700).tariffUnit(0x1)=0',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 1299, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 149, 160, 1792 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 11, tag: 0, label: undefined }, { mfgCode: null, namespaceId: 13, tag: 0, label: undefined } ]',
        'electricalGridConditions(0xa0).acceptedCommandList(0xfff9)=[  ]',
        'electricalGridConditions(0xa0).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'electricalGridConditions(0xa0).clusterRevision(0xfffd)=1',
        'electricalGridConditions(0xa0).currentConditions(0x1)={ periodStart: 1700000000, periodEnd: null, gridCarbonIntensity: 100, gridCarbonLevel: 1, localCarbonIntensity: 50, localCarbonLevel: 1 }',
        'electricalGridConditions(0xa0).featureMap(0xfffc)={ forecasting: false }',
        'electricalGridConditions(0xa0).generatedCommandList(0xfff8)=[  ]',
        'electricalGridConditions(0xa0).localGenerationAvailable(0x0)=true',
      ].toSorted(),
    );
  });

  test('ElectricalEnergyTariffCommands child forEachAttribute', () => {
    const child = device.getChildEndpointById('ElectricalEnergyTariffCommands');
    expect(child).toBeDefined();
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    child?.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'commodityPrice(0x95).acceptedCommandList(0xfff9)=[ 0 ]',
        'commodityPrice(0x95).attributeList(0xfffb)=[ 0, 1, 2, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityPrice(0x95).clusterRevision(0xfffd)=4',
        'commodityPrice(0x95).currency(0x1)={ currency: 978, decimalPoints: 4 }',
        'commodityPrice(0x95).currentPrice(0x2)={ periodStart: 1700000000, periodEnd: null, price: 2000, priceLevel: undefined, description: undefined, components: undefined }',
        'commodityPrice(0x95).featureMap(0xfffc)={ forecasting: false }',
        'commodityPrice(0x95).generatedCommandList(0xfff8)=[ 1 ]',
        'commodityPrice(0x95).tariffUnit(0x0)=0',
        'commodityTariff(0x700).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'commodityTariff(0x700).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityTariff(0x700).calendarPeriods(0x5)=[ { startDate: null, dayPatternIds: [ 1 ] } ]',
        'commodityTariff(0x700).clusterRevision(0xfffd)=1',
        'commodityTariff(0x700).currentDay(0x7)={ date: 1700000000, dayType: 0, dayEntryIds: [ 1 ] }',
        'commodityTariff(0x700).currentDayEntry(0x9)={ dayEntryId: 1, startTime: 0, duration: undefined, randomizationOffset: undefined, randomizationType: undefined }',
        'commodityTariff(0x700).currentDayEntryDate(0xa)=1700000000',
        "commodityTariff(0x700).currentTariffComponents(0xf)=[ { tariffComponentId: 1, price: { priceType: 0, price: 2000, priceLevel: undefined }, friendlyCredit: undefined, auxiliaryLoad: undefined, peakPeriod: undefined, powerThreshold: undefined, threshold: null, label: 'Standard', predicted: undefined } ]",
        'commodityTariff(0x700).dayEntries(0x3)=[ { dayEntryId: 1, startTime: 0, duration: undefined, randomizationOffset: undefined, randomizationType: undefined } ]',
        'commodityTariff(0x700).dayPatterns(0x4)=[ { dayPatternId: 1, daysOfWeek: { sunday: true, monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true }, dayEntryIds: [ 1 ] } ]',
        'commodityTariff(0x700).featureMap(0xfffc)={ pricing: true, friendlyCredit: false, auxiliaryLoad: false, peakPeriod: false, powerThreshold: false, randomization: false }',
        'commodityTariff(0x700).generatedCommandList(0xfff8)=[ 0, 1 ]',
        'commodityTariff(0x700).individualDays(0x6)=[ { date: 1700000000, dayType: 0, dayEntryIds: [ 1 ] } ]',
        'commodityTariff(0x700).nextDay(0x8)={ date: 1700000000, dayType: 0, dayEntryIds: [ 1 ] }',
        'commodityTariff(0x700).nextDayEntry(0xb)={ dayEntryId: 1, startTime: 0, duration: undefined, randomizationOffset: undefined, randomizationType: undefined }',
        'commodityTariff(0x700).nextDayEntryDate(0xc)=1700086400',
        "commodityTariff(0x700).nextTariffComponents(0x10)=[ { tariffComponentId: 1, price: { priceType: 0, price: 2000, priceLevel: undefined }, friendlyCredit: undefined, auxiliaryLoad: undefined, peakPeriod: undefined, powerThreshold: undefined, threshold: null, label: 'Standard', predicted: undefined } ]",
        'commodityTariff(0x700).startDate(0x2)=1700000000',
        "commodityTariff(0x700).tariffComponents(0xd)=[ { tariffComponentId: 1, price: { priceType: 0, price: 2000, priceLevel: undefined }, friendlyCredit: undefined, auxiliaryLoad: undefined, peakPeriod: undefined, powerThreshold: undefined, threshold: null, label: 'Standard', predicted: undefined } ]",
        "commodityTariff(0x700).tariffInfo(0x0)={ tariffLabel: 'Standard', providerName: 'Provider', currency: { currency: 978, decimalPoints: 4 }, blockMode: 0 }",
        "commodityTariff(0x700).tariffPeriods(0xe)=[ { label: 'Standard', dayEntryIds: [ 1 ], tariffComponentIds: [ 1 ] } ]",
        'commodityTariff(0x700).tariffUnit(0x1)=0',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 1299, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 149, 160, 1792 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 11, tag: 0, label: undefined }, { mfgCode: null, namespaceId: 13, tag: 0, label: undefined } ]',
        'electricalGridConditions(0xa0).acceptedCommandList(0xfff9)=[  ]',
        'electricalGridConditions(0xa0).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'electricalGridConditions(0xa0).clusterRevision(0xfffd)=1',
        'electricalGridConditions(0xa0).currentConditions(0x1)=null',
        'electricalGridConditions(0xa0).featureMap(0xfffc)={ forecasting: false }',
        'electricalGridConditions(0xa0).generatedCommandList(0xfff8)=[  ]',
        'electricalGridConditions(0xa0).localGenerationAvailable(0x0)=null',
      ].toSorted(),
    );
  });

  test('ElectricalEnergyTariffNoPeriods child forEachAttribute', () => {
    const child = device.getChildEndpointById('ElectricalEnergyTariffNoPeriods');
    expect(child).toBeDefined();
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    child?.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'commodityPrice(0x95).acceptedCommandList(0xfff9)=[ 0 ]',
        'commodityPrice(0x95).attributeList(0xfffb)=[ 0, 1, 2, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityPrice(0x95).clusterRevision(0xfffd)=4',
        'commodityPrice(0x95).currency(0x1)={ currency: 978, decimalPoints: 4 }',
        'commodityPrice(0x95).currentPrice(0x2)=null',
        'commodityPrice(0x95).featureMap(0xfffc)={ forecasting: false }',
        'commodityPrice(0x95).generatedCommandList(0xfff8)=[ 1 ]',
        'commodityPrice(0x95).tariffUnit(0x0)=0',
        'commodityTariff(0x700).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'commodityTariff(0x700).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityTariff(0x700).calendarPeriods(0x5)=null',
        'commodityTariff(0x700).clusterRevision(0xfffd)=1',
        'commodityTariff(0x700).currentDay(0x7)=null',
        'commodityTariff(0x700).currentDayEntry(0x9)=null',
        'commodityTariff(0x700).currentDayEntryDate(0xa)=null',
        'commodityTariff(0x700).currentTariffComponents(0xf)=null',
        'commodityTariff(0x700).dayEntries(0x3)=null',
        'commodityTariff(0x700).dayPatterns(0x4)=null',
        'commodityTariff(0x700).featureMap(0xfffc)={ pricing: true, friendlyCredit: false, auxiliaryLoad: false, peakPeriod: false, powerThreshold: false, randomization: false }',
        'commodityTariff(0x700).generatedCommandList(0xfff8)=[ 0, 1 ]',
        'commodityTariff(0x700).individualDays(0x6)=null',
        'commodityTariff(0x700).nextDay(0x8)=null',
        'commodityTariff(0x700).nextDayEntry(0xb)=null',
        'commodityTariff(0x700).nextDayEntryDate(0xc)=null',
        'commodityTariff(0x700).nextTariffComponents(0x10)=null',
        'commodityTariff(0x700).startDate(0x2)=null',
        "commodityTariff(0x700).tariffComponents(0xd)=[ { tariffComponentId: 1, price: { priceType: 0, price: 2000, priceLevel: undefined }, friendlyCredit: undefined, auxiliaryLoad: undefined, peakPeriod: undefined, powerThreshold: undefined, threshold: null, label: 'Standard', predicted: undefined } ]",
        "commodityTariff(0x700).tariffInfo(0x0)={ tariffLabel: 'Standard', providerName: 'Provider', currency: { currency: 978, decimalPoints: 4 }, blockMode: 0 }",
        'commodityTariff(0x700).tariffPeriods(0xe)=null',
        'commodityTariff(0x700).tariffUnit(0x1)=0',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 1299, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 149, 160, 1792 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 11, tag: 0, label: undefined }, { mfgCode: null, namespaceId: 13, tag: 0, label: undefined } ]',
        'electricalGridConditions(0xa0).acceptedCommandList(0xfff9)=[  ]',
        'electricalGridConditions(0xa0).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'electricalGridConditions(0xa0).clusterRevision(0xfffd)=1',
        'electricalGridConditions(0xa0).currentConditions(0x1)=null',
        'electricalGridConditions(0xa0).featureMap(0xfffc)={ forecasting: false }',
        'electricalGridConditions(0xa0).generatedCommandList(0xfff8)=[  ]',
        'electricalGridConditions(0xa0).localGenerationAvailable(0x0)=null',
      ].toSorted(),
    );
  });

  test('ElectricalEnergyTariffPartialSchedule child forEachAttribute', () => {
    const child = device.getChildEndpointById('ElectricalEnergyTariffPartialSchedule');
    expect(child).toBeDefined();
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    child?.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'commodityPrice(0x95).acceptedCommandList(0xfff9)=[ 0 ]',
        'commodityPrice(0x95).attributeList(0xfffb)=[ 0, 1, 2, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityPrice(0x95).clusterRevision(0xfffd)=4',
        'commodityPrice(0x95).currency(0x1)=null',
        'commodityPrice(0x95).currentPrice(0x2)=null',
        'commodityPrice(0x95).featureMap(0xfffc)={ forecasting: false }',
        'commodityPrice(0x95).generatedCommandList(0xfff8)=[ 1 ]',
        'commodityPrice(0x95).tariffUnit(0x0)=0',
        'commodityTariff(0x700).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'commodityTariff(0x700).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 65528, 65529, 65531, 65532, 65533 ]',
        'commodityTariff(0x700).calendarPeriods(0x5)=null',
        'commodityTariff(0x700).clusterRevision(0xfffd)=1',
        'commodityTariff(0x700).currentDay(0x7)=null',
        'commodityTariff(0x700).currentDayEntry(0x9)=null',
        'commodityTariff(0x700).currentDayEntryDate(0xa)=null',
        'commodityTariff(0x700).currentTariffComponents(0xf)=null',
        'commodityTariff(0x700).dayEntries(0x3)=null',
        'commodityTariff(0x700).dayPatterns(0x4)=null',
        'commodityTariff(0x700).featureMap(0xfffc)={ pricing: true, friendlyCredit: false, auxiliaryLoad: false, peakPeriod: false, powerThreshold: false, randomization: false }',
        'commodityTariff(0x700).generatedCommandList(0xfff8)=[ 0, 1 ]',
        'commodityTariff(0x700).individualDays(0x6)=null',
        'commodityTariff(0x700).nextDay(0x8)=null',
        'commodityTariff(0x700).nextDayEntry(0xb)=null',
        'commodityTariff(0x700).nextDayEntryDate(0xc)=null',
        'commodityTariff(0x700).nextTariffComponents(0x10)=null',
        'commodityTariff(0x700).startDate(0x2)=null',
        'commodityTariff(0x700).tariffComponents(0xd)=null',
        'commodityTariff(0x700).tariffInfo(0x0)=null',
        'commodityTariff(0x700).tariffPeriods(0xe)=null',
        'commodityTariff(0x700).tariffUnit(0x1)=null',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 1299, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 149, 160, 1792 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 11, tag: 0, label: undefined }, { mfgCode: null, namespaceId: 13, tag: 0, label: undefined } ]',
        'electricalGridConditions(0xa0).acceptedCommandList(0xfff9)=[  ]',
        'electricalGridConditions(0xa0).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'electricalGridConditions(0xa0).clusterRevision(0xfffd)=1',
        'electricalGridConditions(0xa0).currentConditions(0x1)=null',
        'electricalGridConditions(0xa0).featureMap(0xfffc)={ forecasting: false }',
        'electricalGridConditions(0xa0).generatedCommandList(0xfff8)=[  ]',
        'electricalGridConditions(0xa0).localGenerationAvailable(0x0)=null',
      ].toSorted(),
    );
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
    expect(found).toEqual({ label: 'Standard', dayEntryIds: [1], tariffComponent: tariffComponents[0] });

    await expect(commandTariff.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getTariffComponent({ tariffComponentId: 99 }))).rejects.toThrow(
      /no TariffComponent with id 99/,
    );

    const dayEntry = await commandTariff.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getDayEntry({ dayEntryId: 1 }));
    expect(dayEntry).toEqual({ dayEntry: dayEntries[0] });

    await expect(commandTariff.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getDayEntry({ dayEntryId: 99 }))).rejects.toThrow(/no DayEntry with id 99/);
  });

  test('MatterbridgeCommodityTariffServer getTariffComponent falls back when no owning tariffPeriod exists', async () => {
    const found = await noPeriodTariff.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getTariffComponent({ tariffComponentId: 1 }));
    expect(found).toEqual({ label: null, dayEntryIds: [], tariffComponent: tariffComponents[0] });
  });

  test('MatterbridgeCommodityTariffServer getTariffComponent/getDayEntry reject against an unscheduled tariff', async () => {
    // `tariff` (addElectricalEnergyTariff with default options) never had dayEntries/tariffComponents/tariffPeriods
    // set, so its CommodityTariff state has them as null — exercises the `?? []` fallback on a null state.
    await expect(tariff.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getTariffComponent({ tariffComponentId: 1 }))).rejects.toThrow(
      /no TariffComponent with id 1/,
    );
    await expect(tariff.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getDayEntry({ dayEntryId: 1 }))).rejects.toThrow(/no DayEntry with id 1/);
  });

  test('should emit completed commodity commands after awaited plugin forwarding', async () => {
    const observedMeter = new ElectricalUtilityMeter('Utility Observable', 'EUM-OBS');
    const observed = observedMeter.addElectricalEnergyTariff('ObservedTariff', {
      tariffLabel: 'Standard',
      currentPrice: explicitCurrentPrice,
      tariffComponents,
      tariffPeriods,
      dayEntries,
    });
    await addDevice(server, observedMeter);
    const order: string[] = [];
    const requests: unknown[] = [];
    observed.addCommandHandler('CommodityPrice.getDetailedPriceRequest', async (data) => {
      expect(data.endpoint).toBe(observed);
      expect(data.context).toBeDefined();
      await Promise.resolve();
      order.push('forwarded:price');
    });
    observed.subscribeCommand(CommodityPrice, 'getDetailedPriceRequest', (data) => {
      expect(data.context).toBeDefined();
      requests.push(data.request);
      order.push('emitted:price');
    });
    for (const command of ['getTariffComponent', 'getDayEntry'] as const) {
      observed.addCommandHandler(`CommodityTariff.${command}`, async (data) => {
        expect(data.endpoint).toBe(observed);
        expect(data.context).toBeDefined();
        await Promise.resolve();
        order.push(`forwarded:${command}`);
      });
      observed.subscribeCommand(CommodityTariff, command, (data) => {
        expect(data.context).toBeDefined();
        requests.push(data.request);
        order.push(`emitted:${command}`);
      });
    }
    const priceRequest = { details: {} };
    expect(await observed.act(async (agent) => agent.get(MatterbridgeCommodityPriceServer).getDetailedPriceRequest(priceRequest))).toMatchObject({
      currentPrice: explicitCurrentPrice,
    });
    expect(await observed.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getTariffComponent({ tariffComponentId: 1 }))).toEqual({
      label: 'Standard',
      dayEntryIds: [1],
      tariffComponent: tariffComponents[0],
    });
    expect(await observed.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getDayEntry({ dayEntryId: 1 }))).toEqual({ dayEntry: dayEntries[0] });
    expect(requests).toEqual([priceRequest, { tariffComponentId: 1 }, { dayEntryId: 1 }]);
    expect(order).toEqual(['forwarded:price', 'emitted:price', 'forwarded:getTariffComponent', 'emitted:getTariffComponent', 'forwarded:getDayEntry', 'emitted:getDayEntry']);
    order.length = 0;
    await expect(observed.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getTariffComponent({ tariffComponentId: 99 }))).rejects.toThrow(
      /no TariffComponent with id 99/,
    );
    await expect(observed.act(async (agent) => agent.get(MatterbridgeCommodityTariffServer).getDayEntry({ dayEntryId: 99 }))).rejects.toThrow(/no DayEntry with id 99/);
    expect(order).toEqual(['forwarded:getTariffComponent', 'forwarded:getDayEntry']);
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
