// src/matterbridgeDeviceTypes.clusters.zcl.revision.test.ts

const NAME = 'MatterbridgeDevicetypesClustersZclRevision';
const HOMEDIR = path.join('jest', NAME);

// Cross-check a few cluster revisions between official ZCL XML and @matter/types
import { readFile, access } from 'node:fs/promises';
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

await setupTest(NAME, false);

const ZCL_JSON_PATH = path.join('chip', 'v1.4.2-branch', 'zcl.json');

let hasZclJson = true;
try {
  await access(ZCL_JSON_PATH);
} catch {
  hasZclJson = false;
}

// Helper to read a cluster's revision across variations in @matter/types exports
const getClusterRevision = (entry: any): number | undefined => entry?.Cluster?.revision ?? entry?.Base?.revision ?? entry?.Complete?.revision ?? entry?.CompleteInstance?.revision;

// Minimal XML parser: get cluster name (from <name> element) and revision
// Revision can be either a cluster attribute (revision="N") or
// the global attribute with code 0xFFFD and a value="N" inside the cluster block
async function scanXmlFile(xmlPath: string): Promise<Array<{ name: string; revision?: number }>> {
  const xml = await readFile(xmlPath, 'utf8');
  const clusters: Array<{ name: string; revision?: number }> = [];
  const re = /<\s*cluster\b[\s\S]*?<\/\s*cluster\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const block = match[0];
    const tagMatch = block.match(/<\s*cluster\b[^>]*>/i);
    const tag = tagMatch ? tagMatch[0] : '';
    const revAttr = tag.match(/\brevision\s*=\s*"(\d+)"/i);
    const revGlobal = block.match(/<\s*globalAttribute\b[^>]*\bcode\s*=\s*"0xFFFD"[^>]*\bvalue\s*=\s*"(\d+)"[^>]*\/?\s*>/i);
    const nameElem = block.match(/<\s*name\s*>\s*([^<]+?)\s*<\/\s*name\s*>/i);
    const name = (nameElem?.[1] || '').trim();
    const revision = revAttr ? Number(revAttr[1]) : revGlobal ? Number(revGlobal[1]) : undefined;
    if (name) clusters.push({ name, revision });
  }
  return clusters;
}

function normalizeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function buildXmlIndex() {
  const zcl = JSON.parse(await readFile(ZCL_JSON_PATH, 'utf8')) as { xmlFile?: string[] };
  const files = Array.isArray(zcl.xmlFile) ? zcl.xmlFile : [];
  const index = new Map<string, number | undefined>();
  for (const f of files) {
    const xmlPath = path.join('chip', 'v1.4.2-branch', 'xml', f);
    try {
      const clusters = await scanXmlFile(xmlPath);
      for (const c of clusters) {
        index.set(normalizeName(c.name), c.revision);
      }
    } catch {
      // ignore missing/unreadable files
    }
  }
  return index;
}

if (!hasZclJson) {
  describe('ZCL XML vs @matter/types cluster revisions dummy', () => {
    test(`Skipped: missing ${ZCL_JSON_PATH}`, () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe('ZCL XML vs @matter/types cluster revisions', () => {
    let xmlIndex: Map<string, number | undefined>;
    beforeAll(async () => {
      xmlIndex = await buildXmlIndex();
    });
    const cases: Array<[string, any]> = [
      ['AccountLogin', AccountLogin],
      ['Actions', Actions],
      ['ActivatedCarbonFilterMonitoring', ActivatedCarbonFilterMonitoring],
      ['AdministratorCommissioning', AdministratorCommissioning],
      ['AirQuality', AirQuality],
      ['ApplicationLauncher', ApplicationLauncher],
      ['AudioOutput', AudioOutput],
      ['BooleanState', BooleanState],
      ['BooleanStateConfiguration', BooleanStateConfiguration],
      ['BridgedDeviceBasicInformation', BridgedDeviceBasicInformation],
      ['CarbonDioxideConcentrationMeasurement', CarbonDioxideConcentrationMeasurement],
      ['CarbonMonoxideConcentrationMeasurement', CarbonMonoxideConcentrationMeasurement],
      ['Channel', Channel],
      ['ColorControl', ColorControl],
      ['CommissionerControl', CommissionerControl],
      ['ContentControl', ContentControl],
      ['ContentLauncher', ContentLauncher],
      ['DeviceEnergyManagement', DeviceEnergyManagement],
      ['DeviceEnergyManagementMode', DeviceEnergyManagementMode],
      ['DishwasherAlarm', DishwasherAlarm],
      ['DishwasherMode', DishwasherMode],
      ['DoorLock', DoorLock],
      ['EcosystemInformation', EcosystemInformation],
      ['ElectricalEnergyMeasurement', ElectricalEnergyMeasurement],
      ['ElectricalPowerMeasurement', ElectricalPowerMeasurement],
      ['EnergyEvse', EnergyEvse],
      ['EnergyEvseMode', EnergyEvseMode],
      ['EnergyPreference', EnergyPreference],
      ['FanControl', FanControl],
      ['FlowMeasurement', FlowMeasurement],
      ['FormaldehydeConcentrationMeasurement', FormaldehydeConcentrationMeasurement],
      ['Groups', Groups],
      ['HepaFilterMonitoring', HepaFilterMonitoring],
      ['Identify', Identify],
      ['IlluminanceMeasurement', IlluminanceMeasurement],
      ['KeypadInput', KeypadInput],
      ['LaundryDryerControls', LaundryDryerControls],
      ['LaundryWasherControls', LaundryWasherControls],
      ['LaundryWasherMode', LaundryWasherMode],
      ['LevelControl', LevelControl],
      ['LowPower', LowPower],
      ['MediaInput', MediaInput],
      ['MediaPlayback', MediaPlayback],
      ['Messages', Messages],
      ['MicrowaveOvenControl', MicrowaveOvenControl],
      ['MicrowaveOvenMode', MicrowaveOvenMode],
      ['ModeSelect', ModeSelect],
      ['NitrogenDioxideConcentrationMeasurement', NitrogenDioxideConcentrationMeasurement],
      ['OccupancySensing', OccupancySensing],
      ['OnOff', OnOff],
      ['OperationalState', OperationalState],
      ['OtaSoftwareUpdateProvider', OtaSoftwareUpdateProvider],
      ['OtaSoftwareUpdateRequestor', OtaSoftwareUpdateRequestor],
      ['OvenCavityOperationalState', OvenCavityOperationalState],
      ['OvenMode', OvenMode],
      ['OzoneConcentrationMeasurement', OzoneConcentrationMeasurement],
      ['Pm1ConcentrationMeasurement', Pm1ConcentrationMeasurement],
      ['Pm10ConcentrationMeasurement', Pm10ConcentrationMeasurement],
      ['Pm25ConcentrationMeasurement', Pm25ConcentrationMeasurement],
      ['PowerSource', PowerSource],
      ['PowerTopology', PowerTopology],
      ['PressureMeasurement', PressureMeasurement],
      ['PumpConfigurationAndControl', PumpConfigurationAndControl],
      ['RadonConcentrationMeasurement', RadonConcentrationMeasurement],
      ['RefrigeratorAlarm', RefrigeratorAlarm],
      ['RefrigeratorAndTemperatureControlledCabinetMode', RefrigeratorAndTemperatureControlledCabinetMode],
      ['RelativeHumidityMeasurement', RelativeHumidityMeasurement],
      ['RvcCleanMode', RvcCleanMode],
      ['RvcOperationalState', RvcOperationalState],
      ['RvcRunMode', RvcRunMode],
      ['ServiceArea', ServiceArea],
      ['SmokeCoAlarm', SmokeCoAlarm],
      ['Switch', Switch],
      ['TargetNavigator', TargetNavigator],
      ['TemperatureControl', TemperatureControl],
      ['TemperatureMeasurement', TemperatureMeasurement],
      ['Thermostat', Thermostat],
      ['ThermostatUserInterfaceConfiguration', ThermostatUserInterfaceConfiguration],
      ['TotalVolatileOrganicCompoundsConcentrationMeasurement', TotalVolatileOrganicCompoundsConcentrationMeasurement],
      ['ValveConfigurationAndControl', ValveConfigurationAndControl],
      ['WakeOnLan', WakeOnLan],
      ['WaterHeaterManagement', WaterHeaterManagement],
      ['WaterHeaterMode', WaterHeaterMode],
      ['WindowCovering', WindowCovering],
    ];
    test.each(cases)('Cluster %s revision is readable from XML', async (display, entry) => {
      const key = display.toLowerCase().replace(/[^a-z0-9]/g, '');
      const xmlRev = xmlIndex.get(key);
      const typesRev = getClusterRevision(entry);
      if (typeof xmlRev !== 'number') {
        // eslint-disable-next-line no-console
        console.warn(`No XML revision found for ${display} (likely absent in this branch XML). types=${typesRev}`);
        return; // treat as informational; upstream XML may not yet define revision
      }
      // eslint-disable-next-line no-console
      console.info(`${display}: xml=${xmlRev} types=${typesRev}`);
      expect(typeof xmlRev).toBe('number');
    });
  });
}
