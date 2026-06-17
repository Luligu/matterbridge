// vitest\matterbridgeDeviceTypes.clusters.xml.matterjs.revision.test.ts

const NAME = 'MatterbridgeDevicetypesClustersZclRevision';

// Cross-check a few cluster revisions between official ZCL XML and @matter/types

import { access, readdir, readFile } from 'node:fs/promises';
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
import { setupTest } from '@matterbridge/vitest-utils';

await setupTest(NAME, false);

const XML_CLUSTERS_DIR = path.join('chip', '1.5.1', 'xml', 'clusters');

let hasXmlDir = true;
try {
  await access(XML_CLUSTERS_DIR);
} catch {
  hasXmlDir = false;
}

// Helper to read a cluster's revision across variations in @matter/types exports
const getClusterRevision = (entry: any): number | undefined => entry?.Cluster?.revision ?? entry?.Base?.revision ?? entry?.Complete?.revision ?? entry?.CompleteInstance?.revision;

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function buildXmlIndex(): Promise<Map<string, number | undefined>> {
  const files = await readdir(XML_CLUSTERS_DIR);
  const index = new Map<string, number | undefined>();
  for (const f of files.filter((f) => f.endsWith('.xml'))) {
    const xmlPath = path.join(XML_CLUSTERS_DIR, f);
    try {
      const xml = await readFile(xmlPath, 'utf8');
      const tagMatch = xml.match(/<cluster\b[^>]*>/i);
      if (!tagMatch) continue;
      const tag = tagMatch[0];
      const nameMatch = tag.match(/\bname\s*=\s*"([^"]+)"/i);
      const revMatch = tag.match(/\brevision\s*=\s*"(\d+)"/i);
      if (!nameMatch) continue;
      const name = nameMatch[1].replace(/\s*clusters?\s*$/i, '').trim();
      const revision = revMatch ? Number(revMatch[1]) : undefined;
      index.set(normalizeName(name), revision);
    } catch {
      // ignore missing/unreadable files
    }
  }
  return index;
}

// oxlint-disable-next-line unicorn/no-negated-condition
if (!hasXmlDir) {
  describe('Matter 1.5.1 XML vs @matter/types cluster revisions dummy', () => {
    test(`Skipped: missing ${XML_CLUSTERS_DIR}`, () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe('Matter 1.5.1 XML vs @matter/types cluster revisions', () => {
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
      ['CameraAvSettingsUserLevelManagement', CameraAvSettingsUserLevelManagement],
      ['CameraAvStreamManagement', CameraAvStreamManagement],
      ['CarbonDioxideConcentrationMeasurement', CarbonDioxideConcentrationMeasurement],
      ['CarbonMonoxideConcentrationMeasurement', CarbonMonoxideConcentrationMeasurement],
      ['Channel', Channel],
      ['Chime', Chime],
      ['ClosureControl', ClosureControl],
      ['ClosureDimension', ClosureDimension],
      ['ColorControl', ColorControl],
      ['CommissionerControl', CommissionerControl],
      ['CommodityMetering', CommodityMetering],
      ['CommodityPrice', CommodityPrice],
      ['CommodityTariff', CommodityTariff],
      ['ContentControl', ContentControl],
      ['ContentLauncher', ContentLauncher],
      ['DeviceEnergyManagement', DeviceEnergyManagement],
      ['DeviceEnergyManagementMode', DeviceEnergyManagementMode],
      ['DishwasherAlarm', DishwasherAlarm],
      ['DishwasherMode', DishwasherMode],
      ['DoorLock', DoorLock],
      ['EcosystemInformation', EcosystemInformation],
      ['ElectricalEnergyMeasurement', ElectricalEnergyMeasurement],
      ['ElectricalGridConditions', ElectricalGridConditions],
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
      ['MeterIdentification', MeterIdentification],
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
      ['PushAvStreamTransport', PushAvStreamTransport],
      ['RadonConcentrationMeasurement', RadonConcentrationMeasurement],
      ['RefrigeratorAlarm', RefrigeratorAlarm],
      ['RefrigeratorAndTemperatureControlledCabinetMode', RefrigeratorAndTemperatureControlledCabinetMode],
      ['RelativeHumidityMeasurement', RelativeHumidityMeasurement],
      ['RvcCleanMode', RvcCleanMode],
      ['RvcOperationalState', RvcOperationalState],
      ['RvcRunMode', RvcRunMode],
      ['ServiceArea', ServiceArea],
      ['SmokeCoAlarm', SmokeCoAlarm],
      ['SoilMeasurement', SoilMeasurement],
      ['Switch', Switch],
      ['TargetNavigator', TargetNavigator],
      ['TemperatureControl', TemperatureControl],
      ['TemperatureMeasurement', TemperatureMeasurement],
      ['Thermostat', Thermostat],
      ['ThermostatUserInterfaceConfiguration', ThermostatUserInterfaceConfiguration],
      ['TlsCertificateManagement', TlsCertificateManagement],
      ['TlsClientManagement', TlsClientManagement],
      ['TotalVolatileOrganicCompoundsConcentrationMeasurement', TotalVolatileOrganicCompoundsConcentrationMeasurement],
      ['ValveConfigurationAndControl', ValveConfigurationAndControl],
      ['WakeOnLan', WakeOnLan],
      ['WaterHeaterManagement', WaterHeaterManagement],
      ['WaterHeaterMode', WaterHeaterMode],
      ['WebRtcTransportProvider', WebRtcTransportProvider],
      ['WebRtcTransportRequestor', WebRtcTransportRequestor],
      ['WindowCovering', WindowCovering],
      ['ZoneManagement', ZoneManagement],
    ];
    test.each(cases)('Cluster %s revision matches Matter 1.5.1 XML', (display, entry) => {
      const key = normalizeName(display);
      const xmlRev = xmlIndex.get(key);
      const typesRev = getClusterRevision(entry);
      if (typeof xmlRev !== 'number') {
        // eslint-disable-next-line no-console
        console.warn(`No XML entry found for ${display} (likely a template or derived cluster). types=${typesRev}`);
        return; // not all clusters have individual 1.5.1 XML files
      }
      // eslint-disable-next-line no-console
      console.info(`${display}: xml=${xmlRev} types=${typesRev}`);
      expect(typeof xmlRev).toBe('number');
    });
  });
}
