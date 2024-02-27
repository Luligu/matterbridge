/* eslint-disable no-console */
import {
  BasicInformationCluster,
  BooleanStateCluster,
  BridgedDeviceBasicInformationCluster,
  ClusterServer,
  ClusterServerHandlers,
  ColorControl,
  Groups,
  Identify,
  IdentifyCluster,
  IlluminanceMeasurementCluster,
  LevelControl,
  OccupancySensing,
  OccupancySensingCluster,
  OnOff,
  OnOffCluster,
  PowerSource,
  PowerSourceCluster,
  PowerSourceConfigurationCluster,
  PressureMeasurementCluster,
  RelativeHumidityMeasurement,
  RelativeHumidityMeasurementCluster,
  Scenes,
  TemperatureMeasurement,
  TemperatureMeasurementCluster,
  ThreadNetworkDiagnostics,
  ThreadNetworkDiagnosticsCluster,
  WindowCovering,
  WindowCoveringCluster,
  createDefaultGroupsClusterServer,
  createDefaultScenesClusterServer,
} from '@project-chip/matter-node.js/cluster';
import { EndpointNumber, VendorId } from '@project-chip/matter-node.js/datatype';
import { Device, DeviceClasses, DeviceTypeDefinition, EndpointOptions } from '@project-chip/matter-node.js/device';
import { extendPublicHandlerMethods } from '@project-chip/matter-node.js/util';
import { AirQuality, AirQualityCluster } from './AirQualityCluster.js';

type MakeMandatory<T> = Exclude<T, undefined>;

type MatterbridgeDeviceCommands = {
  identify: MakeMandatory<ClusterServerHandlers<typeof Identify.Cluster>['identify']>;

  on: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['on']>;
  off: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['off']>;
  toggle: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['toggle']>;
  offWithEffect: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['offWithEffect']>;

  moveToLevel: MakeMandatory<ClusterServerHandlers<typeof LevelControl.Complete>['moveToLevel']>;
  moveToLevelWithOnOff: MakeMandatory<ClusterServerHandlers<typeof LevelControl.Complete>['moveToLevelWithOnOff']>;

  moveToHue: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToHue']>;
  moveHue: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveHue']>;
  stepHue: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['stepHue']>;
  moveToSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToSaturation']>;
  moveSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveSaturation']>;
  stepSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['stepSaturation']>;
  moveToHueAndSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToHueAndSaturation']>;
  moveToColorTemperature: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToColorTemperature']>;

  upOrOpen: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['upOrOpen']>;
  downOrClose: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['downOrClose']>;
  stopMotion: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['stopMotion']>;
  goToLiftPercentage: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['goToLiftPercentage']>;
};

// Custom device types
export const onOffSwitch = DeviceTypeDefinition({
  name: 'MA-onoffswitch',
  code: 0x0103,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, Scenes.Cluster.id, OnOff.Cluster.id],
  optionalServerClusters: [LevelControl.Cluster.id],
});

export const dimmableSwitch = DeviceTypeDefinition({
  name: 'MA-dimmableswitch',
  code: 0x0104,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, Scenes.Cluster.id, OnOff.Cluster.id, LevelControl.Cluster.id],
  optionalServerClusters: [],
});

export const colorTemperatureSwitch = DeviceTypeDefinition({
  name: 'MA-colortemperatureswitch',
  code: 0x0105,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, Scenes.Cluster.id, OnOff.Cluster.id, LevelControl.Cluster.id, ColorControl.Cluster.id],
  optionalServerClusters: [],
});

export const airQualitySensor = DeviceTypeDefinition({
  name: 'MA-airqualitysensor',
  code: 0x002c,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Identify.Cluster.id, AirQuality.Cluster.id],
  optionalServerClusters: [TemperatureMeasurement.Cluster.id, RelativeHumidityMeasurement.Cluster.id],
});

export class MatterbridgeDevice extends extendPublicHandlerMethods<typeof Device, MatterbridgeDeviceCommands>(Device) {
  constructor(
    definition: DeviceTypeDefinition,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // attributeInitialValues?: { [key: ClusterId]: AttributeInitialValues<any> },
    options: EndpointOptions = {},
  ) {
    super(definition, options);
  }

  createDefaultIdentifyClusterServer() {
    this.addClusterServer(
      ClusterServer(
        IdentifyCluster,
        {
          identifyTime: 0,
          identifyType: Identify.IdentifyType.None,
        },
        {
          identify: async (data) => {
            console.log('*Identify');
            await this.commandHandler.executeHandler('identify', data);
          },
        },
      ),
    );
  }

  createDefaultGroupsClusterServer() {
    this.addClusterServer(createDefaultGroupsClusterServer());
  }

  createDefaultScenesClusterServer() {
    this.addClusterServer(createDefaultScenesClusterServer());
  }

  createDefaultBridgedDeviceBasicInformationClusterServer(deviceName: string, uniqueId: string, vendorId?: number, vendorName?: string, productName?: string) {
    this.addClusterServer(
      ClusterServer(
        BridgedDeviceBasicInformationCluster,
        {
          vendorId: vendorId !== undefined ? VendorId(vendorId) : undefined, // 4874
          vendorName: vendorName,
          productName: productName,
          productLabel: deviceName,
          nodeLabel: deviceName,
          serialNumber: uniqueId,
          uniqueId: uniqueId,
          softwareVersion: 1,
          softwareVersionString: 'v.1.0',
          hardwareVersion: 1,
          hardwareVersionString: 'v.1.0',
          reachable: true,
        },
        {},
        {
          reachableChanged: true,
        },
      ),
    );
  }

  createDefaultBasicInformationClusterServer(deviceName: string, uniqueId: string, vendorId: number, vendorName: string, productId: number, productName: string) {
    this.addClusterServer(
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
          capabilityMinima: { caseSessionsPerFabric: 3, subscriptionsPerFabric: 3 },
        },
        {},
        {
          startUp: true,
          shutDown: true,
          leave: true,
          reachableChanged: true,
        },
      ),
    );
  }

  createDefaultThreadNetworkDiagnosticsClusterServer() {
    this.addClusterServer(
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
          resetCounts: async (data) => {
            console.log('resetCounts');
            await this.commandHandler.executeHandler('resetCounts', data);
          },
        },
        {},
      ),
    );
  }

  createDefaultOnOffClusterServer(onOff = false) {
    this.addClusterServer(
      ClusterServer(
        OnOffCluster,
        {
          onOff,
        },
        {
          on: async (data) => {
            console.log('*on');
            await this.commandHandler.executeHandler('on', data);
          },
          off: async (data) => {
            console.log('*off');
            await this.commandHandler.executeHandler('off', data);
          },
          toggle: async (data) => {
            console.log('*toggle');
            await this.commandHandler.executeHandler('toggle', data);
          },
        },
        {},
      ),
    );
  }

  createDefaultWindowCoveringClusterServer(positionPercent100ths?: number) {
    this.addClusterServer(
      ClusterServer(
        WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift),
        {
          type: WindowCovering.WindowCoveringType.Shutter,
          configStatus: {
            operational: true,
            onlineReserved: false,
            liftMovementReversed: true,
            liftPositionAware: true,
            tiltPositionAware: false,
            liftEncoderControlled: false,
            tiltEncoderControlled: false,
          },
          operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
          endProductType: WindowCovering.EndProductType.SlidingShutter,
          mode: { motorDirectionReversed: false, calibrationMode: false, maintenanceMode: false, ledFeedback: false },
          targetPositionLiftPercent100ths: positionPercent100ths ?? 0, // 0 Fully open 10000 fully closed
          currentPositionLiftPercent100ths: positionPercent100ths ?? 0, // 0 Fully open 10000 fully closed
        },
        {
          upOrOpen: async (data) => {
            console.log('*upOrOpen');
            await this.commandHandler.executeHandler('upOrOpen', data);
          },
          downOrClose: async (data) => {
            console.log('*downOrClose');
            await this.commandHandler.executeHandler('downOrClose', data);
          },
          stopMotion: async (data) => {
            console.log('*stopMotion');
            await this.commandHandler.executeHandler('stopMotion', data);
          },
          goToLiftPercentage: async (data) => {
            console.log(
              `*goToLiftPercentage: ${data.request.liftPercent100thsValue} current: ${data.attributes.currentPositionLiftPercent100ths?.getLocal()} ` +
                `target: ${data.attributes.targetPositionLiftPercent100ths?.getLocal()}`,
            );
            data.attributes.currentPositionLiftPercent100ths?.setLocal(data.request.liftPercent100thsValue);
            data.attributes.targetPositionLiftPercent100ths?.setLocal(data.request.liftPercent100thsValue);
            console.log(
              `*goToLiftPercentage: ${data.request.liftPercent100thsValue} current: ${data.attributes.currentPositionLiftPercent100ths?.getLocal()} ` +
                `target: ${data.attributes.targetPositionLiftPercent100ths?.getLocal()}`,
            );
            await this.commandHandler.executeHandler('goToLiftPercentage', data);
          },
        },
        {},
      ),
    );
  }

  createDefaultOccupancySensingClusterServer(occupied = false) {
    this.addClusterServer(
      ClusterServer(
        OccupancySensingCluster,
        {
          occupancy: { occupied },
          occupancySensorType: OccupancySensing.OccupancySensorType.Pir,
          occupancySensorTypeBitmap: { pir: true, ultrasonic: false, physicalContact: false },
          pirOccupiedToUnoccupiedDelay: 30,
        },
        {},
      ),
    );
  }

  createDefaultIlluminanceMeasurementClusterServer(measuredValue: number = 0) {
    this.addClusterServer(
      ClusterServer(
        IlluminanceMeasurementCluster,
        {
          measuredValue,
          minMeasuredValue: null,
          maxMeasuredValue: null,
          tolerance: 0,
        },
        {},
        {},
      ),
    );
  }

  createDefaultTemperatureMeasurementClusterServer(measuredValue: number = 0) {
    this.addClusterServer(
      ClusterServer(
        TemperatureMeasurementCluster,
        {
          measuredValue,
          minMeasuredValue: null,
          maxMeasuredValue: null,
          tolerance: 0,
        },
        {},
        {},
      ),
    );
  }

  createDefaultRelativeHumidityMeasurementClusterServer(measuredValue: number = 0) {
    this.addClusterServer(
      ClusterServer(
        RelativeHumidityMeasurementCluster,
        {
          measuredValue,
          minMeasuredValue: null,
          maxMeasuredValue: null,
          tolerance: 0,
        },
        {},
        {},
      ),
    );
  }

  createDefaultPressureMeasurementClusterServer(measuredValue: number = 0) {
    this.addClusterServer(
      ClusterServer(
        PressureMeasurementCluster,
        {
          measuredValue,
          minMeasuredValue: null,
          maxMeasuredValue: null,
          tolerance: 0,
        },
        {},
        {},
      ),
    );
  }

  createDefaultBooleanStateClusterServer(contact?: boolean) {
    this.addClusterServer(
      ClusterServer(
        BooleanStateCluster,
        {
          stateValue: contact ?? true, // true=contact false=no_contact
        },
        {},
        {
          stateChange: true,
        },
      ),
    );
  }

  createDefaultPowerSourceReplaceableBatteryClusterServer(
    batPercentRemaining: number = 100,
    batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok,
    batVoltage: number = 1500,
  ) {
    this.addClusterServer(
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
      ),
    );
  }

  createDefaultPowerSourceRechargableBatteryClusterServer(
    batPercentRemaining: number = 100,
    batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok,
    batVoltage: number = 1500,
  ) {
    this.addClusterServer(
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
      ),
    );
  }

  createDefaultPowerSourceWiredClusterServer(wiredCurrentType: PowerSource.WiredCurrentType = PowerSource.WiredCurrentType.Ac) {
    this.addClusterServer(
      ClusterServer(
        PowerSourceCluster.with(PowerSource.Feature.Wired),
        {
          wiredCurrentType,
          description: wiredCurrentType === PowerSource.WiredCurrentType.Ac ? 'AC Power' : 'DC Power',
          status: PowerSource.PowerSourceStatus.Active,
          order: 0,
        },
        {},
        {},
      ),
    );
  }

  createDefaultPowerSourceConfigurationClusterServer(endpointNumber: number) {
    this.addClusterServer(
      ClusterServer(
        PowerSourceConfigurationCluster,
        {
          sources: [EndpointNumber(endpointNumber)],
        },
        {},
        {},
      ),
    );
  }

  createDefaultAirQualityClusterServer() {
    this.addClusterServer(
      ClusterServer(
        AirQualityCluster.with(AirQuality.Feature.FairAirQuality, AirQuality.Feature.ModerateAirQuality, AirQuality.Feature.VeryPoorAirQuality),
        {
          airQuality: AirQuality.AirQualityType.Good,
        },
        {},
        {},
      ),
    );
  }
}
