/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NotImplementedError } from '@project-chip/matter.js/common';
import { WrapCommandHandler } from '@project-chip/matter-node.js/device';
import { NamedHandler } from '@project-chip/matter-node.js/util';
import { BasicInformationCluster, BooleanStateCluster, BridgedDeviceBasicInformationCluster, ColorControl, ColorControlCluster, Identify, IdentifyCluster, IlluminanceMeasurementCluster, LevelControlDefaultClusterHandler, OccupancySensing, OccupancySensingCluster, PowerSource, PowerSourceCluster, PowerSourceConfigurationCluster, PressureMeasurementCluster, RelativeHumidityMeasurementCluster, TemperatureMeasurementCluster, ThreadNetworkDiagnostics, ThreadNetworkDiagnosticsCluster, WindowCovering, WindowCoveringCluster } from '@project-chip/matter-node.js/cluster';
import { ClusterServer } from '@project-chip/matter-node.js/cluster';
import { AttributeInitialValues, ClusterServerHandlers } from '@project-chip/matter-node.js/cluster';
import { EndpointNumber, VendorId } from '@project-chip/matter.js/datatype';
import { AirQuality, AirQualityCluster } from './AirQualityCluster.js';

export const createDefaultIdentifyClusterServer = () =>
  ClusterServer(
    IdentifyCluster,
    {
      identifyTime: 0,
      identifyType: Identify.IdentifyType.None,
    },
    {
      identify: async data => {
        console.log('Identify');
      },
    }
  );

export const createDefaultBridgedDeviceBasicInformationClusterServer = (deviceName: string, uniqueId: string, vendorId: number, vendorName: string, productName: string) =>
  ClusterServer(
    BridgedDeviceBasicInformationCluster,
    {
      vendorId: VendorId(vendorId), // 4874
      vendorName: vendorName,
      productName: productName,
      productLabel: deviceName,
      nodeLabel: deviceName,
      serialNumber: uniqueId,
      uniqueId: uniqueId,
      softwareVersion: 6650,
      softwareVersionString: '3.2.1',
      hardwareVersion: 1,
      hardwareVersionString: '1.1',
      reachable: true,
    },
    {},
    {
      reachableChanged: true,
    },
  );

export const createDefaultBasicInformationClusterServer = (deviceName: string, uniqueId: string, vendorId: number, vendorName: string, productId: number, productName: string) =>
  ClusterServer(
    BasicInformationCluster,
    {
      dataModelRevision: 1,
      vendorId: VendorId(vendorId),
      vendorName: vendorName,
      productId: productId,
      productName: productName,
      productLabel: deviceName,
      nodeLabel: deviceName,
      location: 'XX',
      hardwareVersion: 1,
      hardwareVersionString: 'v.1.0',
      softwareVersion: 1,
      softwareVersionString: 'v.1.0',
      serialNumber: uniqueId,
      uniqueId: uniqueId,
      capabilityMinima: { 'caseSessionsPerFabric': 3, 'subscriptionsPerFabric': 3 },
    },
    {},
    {
      startUp: true,
      shutDown: true,
      leave: true,
      reachableChanged: true,
    }
  );

export const createDefaultThreadNetworkDiagnosticsClusterServer = () =>
  ClusterServer(
    ThreadNetworkDiagnosticsCluster.with(ThreadNetworkDiagnostics.Feature.PacketCounts, ThreadNetworkDiagnostics.Feature.ErrorCounts),
    {
      channel: 1,
      routingRole: ThreadNetworkDiagnostics.RoutingRole.Router,
      networkName: 'MyMatterThread',
      panId: 0,
      extendedPanId: 0,
      meshLocalPrefix: null,
      neighborTable: [],
      routeTable: [],
      partitionId: null,
      weighting: null,
      dataVersion: null,
      stableDataVersion: null,
      leaderRouterId: null,
      securityPolicy: null,
      channelPage0Mask: null,
      operationalDatasetComponents: null,
      overrunCount: 0,
      activeNetworkFaults: [],
    },
    {
      resetCounts: async data => {
        console.log('resetCounts');
      }
    },
    {},
  );

export const WindowCoveringDefaultClusterHandler: () => ClusterServerHandlers<typeof WindowCovering.Complete> = () => ({
  upOrOpen: async () => {
    throw new NotImplementedError('Not implemented');
  },
  downOrClose: async () => {
    throw new NotImplementedError('Not implemented');
  },
  stopMotion: async () => {
    throw new NotImplementedError('Not implemented');
  },
  goToLiftPercentage: async function({ request: { liftPercent100thsValue }, attributes: { currentPositionLiftPercent100ths, targetPositionLiftPercent100ths } }) {
    currentPositionLiftPercent100ths?.setLocal(liftPercent100thsValue);
    targetPositionLiftPercent100ths?.setLocal(liftPercent100thsValue);
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createDefaultWindowCoveringClusterServer = (commandHandler?: NamedHandler<any>, positionPercent100ths?: number) =>
  ClusterServer(
    WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift),
    {
      type: WindowCovering.WindowCoveringType.Shutter,
      configStatus: { operational: true, onlineReserved: false, liftMovementReversed: false, liftPositionAware: true, tiltPositionAware: false, liftEncoderControlled: false, tiltEncoderControlled: false },
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      endProductType: WindowCovering.EndProductType.SlidingShutter,
      mode: { motorDirectionReversed: false, calibrationMode: false, maintenanceMode: false, ledFeedback: false },
      targetPositionLiftPercent100ths: positionPercent100ths ?? 0, // 0 Fully open 10000 fully closed
      currentPositionLiftPercent100ths: positionPercent100ths ?? 0, // 0 Fully open 10000 fully closed
    },
    commandHandler ?
      WrapCommandHandler(WindowCoveringDefaultClusterHandler(), commandHandler) :
      {
        upOrOpen: async data => {
          //await this.commandHandler.executeHandler('testEventTrigger', data);
          console.log('upOrOpen');
        },
        downOrClose: async data => {
          console.log('downOrClose');
        },
        stopMotion: async data => {
          console.log('stopMotion');
        },
        goToLiftPercentage: async data => {
          console.log(`goToLiftPercentage: ${data.request.liftPercent100thsValue} current: ${data.attributes.currentPositionLiftPercent100ths?.getLocal()} target: ${data.attributes.targetPositionLiftPercent100ths?.getLocal()}`);
          data.attributes.currentPositionLiftPercent100ths?.setLocal(data.request.liftPercent100thsValue);
          data.attributes.targetPositionLiftPercent100ths?.setLocal(data.request.liftPercent100thsValue);
          console.log(`goToLiftPercentage: ${data.request.liftPercent100thsValue} current: ${data.attributes.currentPositionLiftPercent100ths?.getLocal()} target: ${data.attributes.targetPositionLiftPercent100ths?.getLocal()}`);
        }
      },
    {},
  );

export const createDefaultOccupancySensingClusterServer = () =>
  ClusterServer(
    OccupancySensingCluster,
    {
      occupancy: { occupied: false },
      occupancySensorType: OccupancySensing.OccupancySensorType.Pir,
      occupancySensorTypeBitmap: { pir: true, ultrasonic: false, physicalContact: false },
      pirOccupiedToUnoccupiedDelay: 30
    },
    {},
  );

export const createDefaultIlluminanceMeasurementClusterServer = () =>
  ClusterServer(
    IlluminanceMeasurementCluster,
    {
      measuredValue: 0,
      minMeasuredValue: null,
      maxMeasuredValue: null,
      tolerance: 0
    },
    {},
    {},
  );

export const createDefaultTemperatureMeasurementClusterServer = () =>
  ClusterServer(
    TemperatureMeasurementCluster,
    {
      measuredValue: 0,
      minMeasuredValue: null,
      maxMeasuredValue: null,
      tolerance: 0
    },
    {},
    {},
  );

export const createDefaultRelativeHumidityMeasurementClusterServer = () =>
  ClusterServer(
    RelativeHumidityMeasurementCluster,
    {
      measuredValue: 0,
      minMeasuredValue: null,
      maxMeasuredValue: null,
      tolerance: 0
    },
    {},
    {},
  );

export const createDefaultPressureMeasurementClusterServer = () =>
  ClusterServer(
    PressureMeasurementCluster,
    {
      measuredValue: 0,
      minMeasuredValue: null,
      maxMeasuredValue: null,
      tolerance: 0
    },
    {},
    {},
  );

export const createDefaultBooleanStateClusterServer = (contact?: boolean) =>
  ClusterServer(
    BooleanStateCluster,
    {
      stateValue: contact ?? true // true=contact false=no_contact
    },
    {},
    {
      stateChange: true,
    },
  );

export const createDefaultPowerSourceReplaceableBatteryClusterServer = (batPercentRemaining: number = 100, batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok, batVoltage: number = 1500) =>
  ClusterServer(
    PowerSourceCluster.with(PowerSource.Feature.Battery, PowerSource.Feature.Replaceable),
    {
      status: PowerSource.PowerSourceStatus.Active,
      order: 0,
      description: 'Primary battery',
      batVoltage,
      batPercentRemaining: Math.min(Math.max(batPercentRemaining * 2, 0), 200),
      batChargeLevel,
      batReplacementNeeded: false,
      batReplaceability: PowerSource.BatReplaceability.UserReplaceable,
      activeBatFaults: undefined,
      batReplacementDescription: 'AA battery',
      batQuantity: 1,
    },
    {},
    {},
  );

export const createDefaultPowerSourceRechargableBatteryClusterServer = (batPercentRemaining: number = 100, batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok, batVoltage: number = 1500) =>
  ClusterServer(
    PowerSourceCluster.with(PowerSource.Feature.Battery, PowerSource.Feature.Rechargeable),
    {
      status: PowerSource.PowerSourceStatus.Active,
      order: 0,
      description: 'Primary battery',
      batVoltage,
      batPercentRemaining: Math.min(Math.max(batPercentRemaining * 2, 0), 200),
      batTimeRemaining: 1,
      batChargeLevel,
      batReplacementNeeded: false,
      batReplaceability: PowerSource.BatReplaceability.Unspecified,
      activeBatFaults: undefined,
      batChargeState: PowerSource.BatChargeState.IsNotCharging,
      batFunctionalWhileCharging: true,
    },
    {},
    {},
  );

export const createDefaultPowerSourceWiredClusterServer = (wiredCurrentType: PowerSource.WiredCurrentType = PowerSource.WiredCurrentType.Ac) =>
  ClusterServer(
    PowerSourceCluster.with(PowerSource.Feature.Wired),
    {
      wiredCurrentType: PowerSource.WiredCurrentType.Ac,
      description: 'AC Power',
      status: PowerSource.PowerSourceStatus.Active,
      order: 0
    },
    {},
    {},
  );

export const createDefaultPowerSourceConfigurationClusterServer = (endpointNumber: number) =>
  ClusterServer(
    PowerSourceConfigurationCluster,
    {
      sources: [EndpointNumber(endpointNumber)],
    },
    {},
    {},
  );

export const createDefaultAirQualityClusterServer = () =>
  ClusterServer(
    AirQualityCluster.with(AirQuality.Feature.FairAirQuality, AirQuality.Feature.ModerateAirQuality, AirQuality.Feature.VeryPoorAirQuality),
    {
      airQuality: AirQuality.AirQualityType.Good,
    },
    {},
    {},
  );

