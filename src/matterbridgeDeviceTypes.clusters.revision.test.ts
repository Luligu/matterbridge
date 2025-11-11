// src/matterbridgeDeviceTypes.clusters.revision.test.ts

const NAME = 'MatterbridgeDevicetypesClustersRevision';
const HOMEDIR = path.join('jest', NAME);
/**
 * Verifies that the revision of every Matter cluster referenced by matterbridgeDeviceTypes.ts
 * matches the expected (current) revision. If any cluster revision changes in `@matter/types`,
 * this test will fail and should be updated accordingly.
 */

// Import all clusters referenced in matterbridgeDeviceTypes.ts
import path from 'node:path/win32';

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
import { CarbonDioxideConcentrationMeasurement } from '@matter/types/clusters/carbon-dioxide-concentration-measurement';
import { CarbonMonoxideConcentrationMeasurement } from '@matter/types/clusters/carbon-monoxide-concentration-measurement';
import { Channel } from '@matter/types/clusters/channel';
import { ColorControl } from '@matter/types/clusters/color-control';
import { CommissionerControl } from '@matter/types/clusters/commissioner-control';
import { ContentControl } from '@matter/types/clusters/content-control';
import { ContentLauncher } from '@matter/types/clusters/content-launcher';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
import { DishwasherAlarm } from '@matter/types/clusters/dishwasher-alarm';
import { DishwasherMode } from '@matter/types/clusters/dishwasher-mode';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { EcosystemInformation } from '@matter/types/clusters/ecosystem-information';
import { ElectricalEnergyMeasurement } from '@matter/types/clusters/electrical-energy-measurement';
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
import { RadonConcentrationMeasurement } from '@matter/types/clusters/radon-concentration-measurement';
import { RefrigeratorAlarm } from '@matter/types/clusters/refrigerator-alarm';
import { RefrigeratorAndTemperatureControlledCabinetMode } from '@matter/types/clusters/refrigerator-and-temperature-controlled-cabinet-mode';
import { RelativeHumidityMeasurement } from '@matter/types/clusters/relative-humidity-measurement';
import { RvcCleanMode } from '@matter/types/clusters/rvc-clean-mode';
import { RvcOperationalState } from '@matter/types/clusters/rvc-operational-state';
import { RvcRunMode } from '@matter/types/clusters/rvc-run-mode';
import { ServiceArea } from '@matter/types/clusters/service-area';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { Switch } from '@matter/types/clusters/switch';
import { TargetNavigator } from '@matter/types/clusters/target-navigator';
import { TemperatureControl } from '@matter/types/clusters/temperature-control';
import { TemperatureMeasurement } from '@matter/types/clusters/temperature-measurement';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { ThermostatUserInterfaceConfiguration } from '@matter/types/clusters/thermostat-user-interface-configuration';
import { TotalVolatileOrganicCompoundsConcentrationMeasurement } from '@matter/types/clusters/total-volatile-organic-compounds-concentration-measurement';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
import { WakeOnLan } from '@matter/types/clusters/wake-on-lan';
import { WaterHeaterManagement } from '@matter/types/clusters/water-heater-management';
import { WaterHeaterMode } from '@matter/types/clusters/water-heater-mode';
import { WindowCovering } from '@matter/types/clusters/window-covering';

import { setupTest } from './jestutils/jestHelpers.js';

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
    ['BooleanState', BooleanState, 1],
    ['BooleanStateConfiguration', BooleanStateConfiguration, 1],
    ['BridgedDeviceBasicInformation', BridgedDeviceBasicInformation, 4],
    ['CarbonDioxideConcentrationMeasurement', CarbonDioxideConcentrationMeasurement, 3],
    ['CarbonMonoxideConcentrationMeasurement', CarbonMonoxideConcentrationMeasurement, 3],
    ['Channel', Channel, 2],
    ['ColorControl', ColorControl, 7],
    ['CommissionerControl', CommissionerControl, 1],
    ['ContentControl', ContentControl, 1],
    ['ContentLauncher', ContentLauncher, 2],
    ['DeviceEnergyManagement', DeviceEnergyManagement, 4],
    ['DeviceEnergyManagementMode', DeviceEnergyManagementMode, 2],
    ['DishwasherAlarm', DishwasherAlarm, 1],
    ['DishwasherMode', DishwasherMode, 3],
    ['DoorLock', DoorLock, 8],
    ['EcosystemInformation', EcosystemInformation, 1],
    ['ElectricalEnergyMeasurement', ElectricalEnergyMeasurement, 1],
    ['ElectricalPowerMeasurement', ElectricalPowerMeasurement, 1],
    ['EnergyEvse', EnergyEvse, 3],
    ['EnergyEvseMode', EnergyEvseMode, 2],
    ['EnergyPreference', EnergyPreference, 1],
    ['FanControl', FanControl, 4],
    ['FlowMeasurement', FlowMeasurement, 3],
    ['FormaldehydeConcentrationMeasurement', FormaldehydeConcentrationMeasurement, 3],
    ['Groups', Groups, 4],
    ['HepaFilterMonitoring', HepaFilterMonitoring, 1],
    ['Identify', Identify, 5],
    ['IlluminanceMeasurement', IlluminanceMeasurement, 3],
    ['KeypadInput', KeypadInput, 1],
    ['LaundryDryerControls', LaundryDryerControls, 1],
    ['LaundryWasherControls', LaundryWasherControls, 2],
    ['LaundryWasherMode', LaundryWasherMode, 3],
    ['LevelControl', LevelControl, 6],
    ['LowPower', LowPower, 1],
    ['MediaInput', MediaInput, 1],
    ['MediaPlayback', MediaPlayback, 2],
    ['Messages', Messages, 3],
    ['MicrowaveOvenControl', MicrowaveOvenControl, 1],
    ['MicrowaveOvenMode', MicrowaveOvenMode, 2],
    ['ModeSelect', ModeSelect, 2],
    ['NitrogenDioxideConcentrationMeasurement', NitrogenDioxideConcentrationMeasurement, 3],
    ['OccupancySensing', OccupancySensing, 5],
    ['OnOff', OnOff, 6],
    ['OperationalState', OperationalState, 3],
    ['OtaSoftwareUpdateProvider', OtaSoftwareUpdateProvider, 1],
    ['OtaSoftwareUpdateRequestor', OtaSoftwareUpdateRequestor, 1],
    ['OvenCavityOperationalState', OvenCavityOperationalState, 2],
    ['OvenMode', OvenMode, 2],
    ['OzoneConcentrationMeasurement', OzoneConcentrationMeasurement, 3],
    ['Pm1ConcentrationMeasurement', Pm1ConcentrationMeasurement, 3],
    ['Pm10ConcentrationMeasurement', Pm10ConcentrationMeasurement, 3],
    ['Pm25ConcentrationMeasurement', Pm25ConcentrationMeasurement, 3],
    ['PowerSource', PowerSource, 3],
    ['PowerTopology', PowerTopology, 1],
    ['PressureMeasurement', PressureMeasurement, 3],
    ['PumpConfigurationAndControl', PumpConfigurationAndControl, 4],
    ['RadonConcentrationMeasurement', RadonConcentrationMeasurement, 3],
    ['RefrigeratorAlarm', RefrigeratorAlarm, 1],
    ['RefrigeratorAndTemperatureControlledCabinetMode', RefrigeratorAndTemperatureControlledCabinetMode, 3],
    ['RelativeHumidityMeasurement', RelativeHumidityMeasurement, 3],
    ['RvcCleanMode', RvcCleanMode, 3],
    ['RvcOperationalState', RvcOperationalState, 2],
    ['RvcRunMode', RvcRunMode, 3],
    ['ServiceArea', ServiceArea, 1],
    ['SmokeCoAlarm', SmokeCoAlarm, 1],
    ['Switch', Switch, 2],
    ['TargetNavigator', TargetNavigator, 2],
    ['TemperatureControl', TemperatureControl, 1],
    ['TemperatureMeasurement', TemperatureMeasurement, 4],
    ['Thermostat', Thermostat, 8],
    ['ThermostatUserInterfaceConfiguration', ThermostatUserInterfaceConfiguration, 2],
    ['TotalVolatileOrganicCompoundsConcentrationMeasurement', TotalVolatileOrganicCompoundsConcentrationMeasurement, 3],
    ['ValveConfigurationAndControl', ValveConfigurationAndControl, 1],
    ['WakeOnLan', WakeOnLan, 1],
    ['WaterHeaterManagement', WaterHeaterManagement, 2],
    ['WaterHeaterMode', WaterHeaterMode, 1],
    ['WindowCovering', WindowCovering, 5],
  ];

  test.each(cases)('Cluster %s revision should match expected', (_name, entry, expected) => {
    const actual = getClusterRevision(entry);
    expect(actual).toBe(expected);
  });
});
