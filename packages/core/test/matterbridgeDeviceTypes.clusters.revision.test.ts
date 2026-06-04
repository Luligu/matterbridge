// test/matterbridgeDeviceTypes.clusters.revision.test.ts

const NAME = 'MatterbridgeDevicetypesClustersRevision';
const HOMEDIR = path.join('.cache', 'jest', NAME);

/**
 * Verifies that the revision of every Matter cluster referenced by matterbridgeDeviceTypes.ts
 * matches the expected (current) revision. If any cluster revision changes in `@matter/types`,
 * this test will fail and should be updated accordingly.
 */

// Import all clusters referenced in matterbridgeDeviceTypes.ts
import path from 'node:path';

import { AccountLogin } from '@matter/types/clusters/account-login';
import { Actions } from '@matter/types/clusters/actions';
import { ActivatedCarbonFilterMonitoring } from '@matter/types/clusters/activated-carbon-filter-monitoring';
import { AdministratorCommissioning } from '@matter/types/clusters/administrator-commissioning';
import { AirQuality } from '@matter/types/clusters/air-quality';
import { ApplicationLauncher } from '@matter/types/clusters/application-launcher';
import { AudioOutput } from '@matter/types/clusters/audio-output';
import { BooleanState } from '@matter/types/clusters/boolean-state';
import { BooleanStateConfiguration } from '@matter/types/clusters/boolean-state-configuration';
import { BridgedDeviceBasicInformation } from '@matter/types/clusters/bridged-device-basic-information';
import { CameraAvSettingsUserLevelManagement } from '@matter/types/clusters/camera-av-settings-user-level-management';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { CarbonDioxideConcentrationMeasurement } from '@matter/types/clusters/carbon-dioxide-concentration-measurement';
import { CarbonMonoxideConcentrationMeasurement } from '@matter/types/clusters/carbon-monoxide-concentration-measurement';
import { Channel } from '@matter/types/clusters/channel';
import { Chime } from '@matter/types/clusters/chime';
import { ClosureControl } from '@matter/types/clusters/closure-control';
import { ClosureDimension } from '@matter/types/clusters/closure-dimension';
import { ColorControl } from '@matter/types/clusters/color-control';
import { CommissionerControl } from '@matter/types/clusters/commissioner-control';
import { CommodityMetering } from '@matter/types/clusters/commodity-metering';
import { CommodityPrice } from '@matter/types/clusters/commodity-price';
import { CommodityTariff } from '@matter/types/clusters/commodity-tariff';
import { ContentControl } from '@matter/types/clusters/content-control';
import { ContentLauncher } from '@matter/types/clusters/content-launcher';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
import { DishwasherAlarm } from '@matter/types/clusters/dishwasher-alarm';
import { DishwasherMode } from '@matter/types/clusters/dishwasher-mode';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { EcosystemInformation } from '@matter/types/clusters/ecosystem-information';
import { ElectricalEnergyMeasurement } from '@matter/types/clusters/electrical-energy-measurement';
import { ElectricalGridConditions } from '@matter/types/clusters/electrical-grid-conditions';
import { ElectricalPowerMeasurement } from '@matter/types/clusters/electrical-power-measurement';
import { EnergyEvse } from '@matter/types/clusters/energy-evse';
import { EnergyEvseMode } from '@matter/types/clusters/energy-evse-mode';
import { EnergyPreference } from '@matter/types/clusters/energy-preference';
import { FanControl } from '@matter/types/clusters/fan-control';
import { FlowMeasurement } from '@matter/types/clusters/flow-measurement';
import { FormaldehydeConcentrationMeasurement } from '@matter/types/clusters/formaldehyde-concentration-measurement';
import { Groups } from '@matter/types/clusters/groups';
import { HepaFilterMonitoring } from '@matter/types/clusters/hepa-filter-monitoring';
import { Identify } from '@matter/types/clusters/identify';
import { IlluminanceMeasurement } from '@matter/types/clusters/illuminance-measurement';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { LaundryDryerControls } from '@matter/types/clusters/laundry-dryer-controls';
import { LaundryWasherControls } from '@matter/types/clusters/laundry-washer-controls';
import { LaundryWasherMode } from '@matter/types/clusters/laundry-washer-mode';
import { LevelControl } from '@matter/types/clusters/level-control';
import { LowPower } from '@matter/types/clusters/low-power';
import { MediaInput } from '@matter/types/clusters/media-input';
import { MediaPlayback } from '@matter/types/clusters/media-playback';
import { Messages } from '@matter/types/clusters/messages';
import { MeterIdentification } from '@matter/types/clusters/meter-identification';
import { MicrowaveOvenControl } from '@matter/types/clusters/microwave-oven-control';
import { MicrowaveOvenMode } from '@matter/types/clusters/microwave-oven-mode';
import { ModeSelect } from '@matter/types/clusters/mode-select';
import { NitrogenDioxideConcentrationMeasurement } from '@matter/types/clusters/nitrogen-dioxide-concentration-measurement';
import { OccupancySensing } from '@matter/types/clusters/occupancy-sensing';
import { OnOff } from '@matter/types/clusters/on-off';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { OtaSoftwareUpdateProvider } from '@matter/types/clusters/ota-software-update-provider';
import { OtaSoftwareUpdateRequestor } from '@matter/types/clusters/ota-software-update-requestor';
import { OvenCavityOperationalState } from '@matter/types/clusters/oven-cavity-operational-state';
import { OvenMode } from '@matter/types/clusters/oven-mode';
import { OzoneConcentrationMeasurement } from '@matter/types/clusters/ozone-concentration-measurement';
import { Pm1ConcentrationMeasurement } from '@matter/types/clusters/pm1-concentration-measurement';
import { Pm10ConcentrationMeasurement } from '@matter/types/clusters/pm10-concentration-measurement';
import { Pm25ConcentrationMeasurement } from '@matter/types/clusters/pm25-concentration-measurement';
import { PowerSource } from '@matter/types/clusters/power-source';
import { PowerTopology } from '@matter/types/clusters/power-topology';
import { PressureMeasurement } from '@matter/types/clusters/pressure-measurement';
import { PumpConfigurationAndControl } from '@matter/types/clusters/pump-configuration-and-control';
import { PushAvStreamTransport } from '@matter/types/clusters/push-av-stream-transport';
import { RadonConcentrationMeasurement } from '@matter/types/clusters/radon-concentration-measurement';
import { RefrigeratorAlarm } from '@matter/types/clusters/refrigerator-alarm';
import { RefrigeratorAndTemperatureControlledCabinetMode } from '@matter/types/clusters/refrigerator-and-temperature-controlled-cabinet-mode';
import { RelativeHumidityMeasurement } from '@matter/types/clusters/relative-humidity-measurement';
import { RvcCleanMode } from '@matter/types/clusters/rvc-clean-mode';
import { RvcOperationalState } from '@matter/types/clusters/rvc-operational-state';
import { RvcRunMode } from '@matter/types/clusters/rvc-run-mode';
import { ServiceArea } from '@matter/types/clusters/service-area';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { SoilMeasurement } from '@matter/types/clusters/soil-measurement';
import { Switch } from '@matter/types/clusters/switch';
import { TargetNavigator } from '@matter/types/clusters/target-navigator';
import { TemperatureControl } from '@matter/types/clusters/temperature-control';
import { TemperatureMeasurement } from '@matter/types/clusters/temperature-measurement';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { ThermostatUserInterfaceConfiguration } from '@matter/types/clusters/thermostat-user-interface-configuration';
import { TlsCertificateManagement } from '@matter/types/clusters/tls-certificate-management';
import { TlsClientManagement } from '@matter/types/clusters/tls-client-management';
import { TotalVolatileOrganicCompoundsConcentrationMeasurement } from '@matter/types/clusters/total-volatile-organic-compounds-concentration-measurement';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
import { WakeOnLan } from '@matter/types/clusters/wake-on-lan';
import { WaterHeaterManagement } from '@matter/types/clusters/water-heater-management';
import { WaterHeaterMode } from '@matter/types/clusters/water-heater-mode';
import { WebRtcTransportProvider } from '@matter/types/clusters/web-rtc-transport-provider';
import { WebRtcTransportRequestor } from '@matter/types/clusters/web-rtc-transport-requestor';
import { WindowCovering } from '@matter/types/clusters/window-covering';
import { ZoneManagement } from '@matter/types/clusters/zone-management';

import { setupTest } from '../src/jestutils/jestSetupTest.js';

// Helper to read a cluster's revision across variations in @matter/types exports
const getClusterRevision = (entry: any): number | undefined => entry?.Cluster?.revision ?? entry?.Base?.revision ?? entry?.Complete?.revision ?? entry?.CompleteInstance?.revision;

await setupTest(NAME, false);

describe('Matter clusters revision (guard against upstream changes)', () => {
  // Hard-coded expected revisions (current as of @matter/main 0.15.6 > Matter specs v1.4.1)
  const cases: Array<[string, any, number]> = [
    ['AccountLogin', AccountLogin, 2],
    ['Actions', Actions, 1],
    ['ActivatedCarbonFilterMonitoring', ActivatedCarbonFilterMonitoring, 1],
    ['AdministratorCommissioning', AdministratorCommissioning, 1],
    ['AirQuality', AirQuality, 1],
    ['ApplicationLauncher', ApplicationLauncher, 2],
    ['AudioOutput', AudioOutput, 1],
    ['BooleanState', BooleanState, 2],
    ['BooleanStateConfiguration', BooleanStateConfiguration, 1],
    ['BridgedDeviceBasicInformation', BridgedDeviceBasicInformation, 5],
    ['CameraAvSettingsUserLevelManagement', CameraAvSettingsUserLevelManagement, 1],
    ['CameraAvStreamManagement', CameraAvStreamManagement, 1],
    ['CarbonDioxideConcentrationMeasurement', CarbonDioxideConcentrationMeasurement, 4],
    ['CarbonMonoxideConcentrationMeasurement', CarbonMonoxideConcentrationMeasurement, 4],
    ['Channel', Channel, 2],
    ['Chime', Chime, 2],
    ['ClosureControl', ClosureControl, 1],
    ['ClosureDimension', ClosureDimension, 1],
    ['ColorControl', ColorControl, 9],
    ['CommissionerControl', CommissionerControl, 1],
    ['CommodityMetering', CommodityMetering, 1],
    ['CommodityPrice', CommodityPrice, 4],
    ['CommodityTariff', CommodityTariff, 1],
    ['ContentControl', ContentControl, 1],
    ['ContentLauncher', ContentLauncher, 2],
    ['DeviceEnergyManagement', DeviceEnergyManagement, 4],
    ['DeviceEnergyManagementMode', DeviceEnergyManagementMode, 2],
    ['DishwasherAlarm', DishwasherAlarm, 1],
    ['DishwasherMode', DishwasherMode, 3],
    ['DoorLock', DoorLock, 10],
    ['EcosystemInformation', EcosystemInformation, 1],
    ['ElectricalEnergyMeasurement', ElectricalEnergyMeasurement, 2],
    ['ElectricalGridConditions', ElectricalGridConditions, 1],
    ['ElectricalPowerMeasurement', ElectricalPowerMeasurement, 3],
    ['EnergyEvse', EnergyEvse, 4],
    ['EnergyEvseMode', EnergyEvseMode, 2],
    ['EnergyPreference', EnergyPreference, 1],
    ['FanControl', FanControl, 6],
    ['FlowMeasurement', FlowMeasurement, 4],
    ['FormaldehydeConcentrationMeasurement', FormaldehydeConcentrationMeasurement, 4],
    ['Groups', Groups, 4],
    ['HepaFilterMonitoring', HepaFilterMonitoring, 1],
    ['Identify', Identify, 6],
    ['IlluminanceMeasurement', IlluminanceMeasurement, 4],
    ['KeypadInput', KeypadInput, 1],
    ['LaundryDryerControls', LaundryDryerControls, 1],
    ['LaundryWasherControls', LaundryWasherControls, 2],
    ['LaundryWasherMode', LaundryWasherMode, 3],
    ['LevelControl', LevelControl, 7],
    ['LowPower', LowPower, 1],
    ['MediaInput', MediaInput, 1],
    ['MediaPlayback', MediaPlayback, 2],
    ['Messages', Messages, 3],
    ['MeterIdentification', MeterIdentification, 1],
    ['MicrowaveOvenControl', MicrowaveOvenControl, 1],
    ['MicrowaveOvenMode', MicrowaveOvenMode, 2],
    ['ModeSelect', ModeSelect, 2],
    ['NitrogenDioxideConcentrationMeasurement', NitrogenDioxideConcentrationMeasurement, 4],
    ['OccupancySensing', OccupancySensing, 6], // 7 is empty/placeholder, so 6 is latest "real" revision
    ['OnOff', OnOff, 6],
    ['OperationalState', OperationalState, 3],
    ['OtaSoftwareUpdateProvider', OtaSoftwareUpdateProvider, 1],
    ['OtaSoftwareUpdateRequestor', OtaSoftwareUpdateRequestor, 1],
    ['OvenCavityOperationalState', OvenCavityOperationalState, 2],
    ['OvenMode', OvenMode, 2],
    ['OzoneConcentrationMeasurement', OzoneConcentrationMeasurement, 4],
    ['Pm1ConcentrationMeasurement', Pm1ConcentrationMeasurement, 4],
    ['Pm10ConcentrationMeasurement', Pm10ConcentrationMeasurement, 4],
    ['Pm25ConcentrationMeasurement', Pm25ConcentrationMeasurement, 4],
    ['PowerSource', PowerSource, 3],
    ['PowerTopology', PowerTopology, 1],
    ['PressureMeasurement', PressureMeasurement, 4],
    ['PumpConfigurationAndControl', PumpConfigurationAndControl, 5],
    ['PushAvStreamTransport', PushAvStreamTransport, 2],
    ['RadonConcentrationMeasurement', RadonConcentrationMeasurement, 4],
    ['RefrigeratorAlarm', RefrigeratorAlarm, 1],
    ['RefrigeratorAndTemperatureControlledCabinetMode', RefrigeratorAndTemperatureControlledCabinetMode, 3],
    ['RelativeHumidityMeasurement', RelativeHumidityMeasurement, 4],
    ['RvcCleanMode', RvcCleanMode, 5],
    ['RvcOperationalState', RvcOperationalState, 3],
    ['RvcRunMode', RvcRunMode, 4],
    ['ServiceArea', ServiceArea, 2],
    ['SmokeCoAlarm', SmokeCoAlarm, 1],
    ['SoilMeasurement', SoilMeasurement, 1],
    ['Switch', Switch, 2],
    ['TargetNavigator', TargetNavigator, 2],
    ['TemperatureControl', TemperatureControl, 1],
    ['TemperatureMeasurement', TemperatureMeasurement, 5],
    ['Thermostat', Thermostat, 10],
    ['ThermostatUserInterfaceConfiguration', ThermostatUserInterfaceConfiguration, 2],
    ['TlsCertificateManagement', TlsCertificateManagement, 1],
    ['TlsClientManagement', TlsClientManagement, 1],
    ['TotalVolatileOrganicCompoundsConcentrationMeasurement', TotalVolatileOrganicCompoundsConcentrationMeasurement, 4],
    ['ValveConfigurationAndControl', ValveConfigurationAndControl, 1],
    ['WakeOnLan', WakeOnLan, 1],
    ['WaterHeaterManagement', WaterHeaterManagement, 2],
    ['WaterHeaterMode', WaterHeaterMode, 1],
    ['WebRtcTransportProvider', WebRtcTransportProvider, 2],
    ['WebRtcTransportRequestor', WebRtcTransportRequestor, 2],
    ['WindowCovering', WindowCovering, 8],
    ['ZoneManagement', ZoneManagement, 1],
  ];

  test.each(cases)('Cluster %s revision should match expected', (_name, entry, expected) => {
    const actual = getClusterRevision(entry);
    expect(actual).toBe(expected);
  });
});
