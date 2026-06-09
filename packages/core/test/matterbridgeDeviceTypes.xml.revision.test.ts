// test/matterbridgeDeviceTypes.xml.revision.test.ts

/* eslint-disable simple-import-sort/imports */

const NAME = 'MatterbridgeDevicetypesXmlRevision';
const HOMEDIR = path.join('.cache', 'jest', NAME);

// Cross-check device type revisions between official Matter 1.5.1 XML and Matterbridge definitions
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  // Utility
  rootNode,
  powerSource,
  otaRequestor,
  otaProvider,
  bridgedNode,
  electricalSensor,
  deviceEnergyManagement,
  // Generic
  aggregator,
  bridge,
  // Lighting
  onOffLight,
  dimmableLight,
  colorTemperatureLight,
  extendedColorLight,
  // Smart plugs / outlets / mounted controls
  onOffPlugInUnit,
  dimmablePlugInUnit,
  mountedOnOffControl,
  mountedDimmableLoadControl,
  pump,
  waterValve,
  // Switches & controls
  onOffLightSwitch,
  dimmerSwitch,
  colorDimmerSwitch,
  controlBridge,
  pumpController,
  genericSwitch,
  // Sensors
  contactSensor,
  lightSensor,
  occupancySensor,
  temperatureSensor,
  pressureSensor,
  flowSensor,
  humiditySensor,
  onOffSensor,
  smokeCoAlarm,
  airQualitySensor,
  waterFreezeDetector,
  waterLeakDetector,
  rainSensor,
  // Closures
  doorLock,
  doorLockController,
  windowCovering,
  windowCoveringController,
  // HVAC
  thermostat,
  thermostatController,
  fan,
  airPurifier,
  // Media
  basicVideoPlayer,
  castingVideoPlayer,
  speaker,
  contentApp,
  castingVideoClient,
  videoRemoteControl,
  // Generic device types
  modeSelect,
  // Appliances & complex devices
  roboticVacuumCleaner,
  laundryWasher,
  refrigerator,
  roomAirConditioner,
  temperatureControlledCabinetCooler,
  temperatureControlledCabinetHeater,
  dishwasher,
  laundryDryer,
  cookSurface,
  cooktop,
  oven,
  extractorHood,
  microwaveOven,
  // Energy & environment
  evse,
  waterHeater,
  solarPower,
  batteryStorage,
  heatPump,
  // Matter 1.5.1 device types
  closure,
  closurePanel,
  closureController,
  irrigationSystem,
  soilSensor,
  meterReferencePoint,
  electricalEnergyTariff,
  electricalMeter,
  electricalUtilityMeter,
  camera,
  floodlightCamera,
  videoDoorbell,
  intercom,
  audioDoorbell,
  snapshotCamera,
  chime,
  cameraController,
  doorbell,
  DeviceClasses,
  DeviceScopes,
} from '../src/matterbridgeDeviceTypes.js';
import type { DeviceTypeDefinition } from '../src/matterbridgeDeviceTypes.js';

import { setupTest } from '../src/jestutils/jestSetupTest.js';

await setupTest(NAME, false);

const XML_DEVICE_TYPES_DIR = path.join('chip', '1.5.1', 'xml', 'device_types');

// Device type codes where the chip/1.5.1 XML has an incorrect revision.
// The override value is the correct revision per the Matter spec.
const XML_REVISION_OVERRIDES = new Map<number, number>([
  [0x0141, 2], // audioDoorbell: XML says 1, spec says 2
  [0x0148, 2], // doorbell: XML says 1, spec says 2
]);

// Device type codes where the chip/1.5.1 XML has an incorrect name.
// The override value is the Matterbridge canonical name.
const XML_DEVICE_NAME_OVERRIDES = new Map<number, string>([
  [0x010a, 'OnOffPlugInUnit'], // onOffPlugInUnit: XML says OnOff Plugin Unit
]);

// Aggregator (and bridge which aliases it) intentionally uses DeviceClasses.Dynamic in
// Matterbridge; the XML classifies it as 'simple'.
const DEVICE_CLASS_OVERRIDES = new Map<number, DeviceClasses>([[0x000e, DeviceClasses.Dynamic]]);

const XML_CLASS_TO_DEVICE_CLASS: Record<string, DeviceClasses> = {
  node: DeviceClasses.Node,
  utility: DeviceClasses.Utility,
  simple: DeviceClasses.Simple,
};

const XML_SCOPE_TO_DEVICE_SCOPE: Record<string, DeviceScopes> = {
  endpoint: DeviceScopes.Endpoint,
  node: DeviceScopes.Node,
};

let hasXmlDir = true;
try {
  await access(XML_DEVICE_TYPES_DIR);
} catch {
  hasXmlDir = false;
}

type XmlDeviceTypeInfo = { id: number; name: string; revision: number; class: string | undefined; scope: string | undefined };

async function buildXmlIndex() {
  const files = await readdir(XML_DEVICE_TYPES_DIR);
  const index = new Map<number, XmlDeviceTypeInfo>();
  for (const f of files.filter((f) => f.endsWith('.xml'))) {
    const xmlPath = path.join(XML_DEVICE_TYPES_DIR, f);
    try {
      const xml = await readFile(xmlPath, 'utf8');
      const tagMatch = xml.match(/<deviceType\b[^>]*>/i);
      if (!tagMatch) {
        // eslint-disable-next-line no-console
        console.warn(`No <deviceType> tag found in ${f}`);
        continue;
      }
      const tag = tagMatch[0];
      const nameMatch = tag.match(/\bname\s*=\s*"([^"]+)"/i);
      const revMatch = tag.match(/\brevision\s*=\s*"(\d+)"/i);
      const idMatch = tag.match(/\bid\s*=\s*"([^"]+)"/i);
      if (!nameMatch || !idMatch) {
        // eslint-disable-next-line no-console
        console.warn(`Missing name or id attribute in <deviceType> tag in ${f}`);
        continue;
      }
      const name = nameMatch[1].trim();
      const revision = revMatch ? Number(revMatch[1]) : undefined;
      const id = Number(idMatch[1]);
      const classTagMatch = xml.match(/<classification\b[^>]*>/i);
      const classTag = classTagMatch ? classTagMatch[0] : '';
      const xmlClass = classTag.match(/\bclass\s*=\s*"([^"]+)"/i)?.[1].trim();
      const xmlScope = classTag.match(/\bscope\s*=\s*"([^"]+)"/i)?.[1].trim();
      if (!Number.isNaN(id) && revision !== undefined) {
        index.set(id, { id, name, revision, class: xmlClass, scope: xmlScope });
      }
    } catch (err) {
      throw new Error(`Failed to read or parse ${f}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }
  return index;
}

if (!hasXmlDir) {
  describe('Matter 1.5.1 XML vs Matterbridge device type revisions dummy', () => {
    test(`Skipped: missing ${XML_DEVICE_TYPES_DIR}`, () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe('Matter 1.5.1 XML vs Matterbridge device type revisions', () => {
    let xmlIndex: Map<number, XmlDeviceTypeInfo>;
    beforeAll(async () => {
      xmlIndex = await buildXmlIndex();
    });

    const cases: Array<[string, DeviceTypeDefinition]> = [
      // Utility endpoint types
      ['rootNode', rootNode],
      ['powerSource', powerSource],
      ['otaRequestor', otaRequestor],
      ['otaProvider', otaProvider],
      ['bridgedNode', bridgedNode],
      ['electricalSensor', electricalSensor],
      ['deviceEnergyManagement', deviceEnergyManagement],
      ['aggregator', aggregator],
      ['bridge', bridge],

      // Lighting
      ['onOffLight', onOffLight],
      ['dimmableLight', dimmableLight],
      ['colorTemperatureLight', colorTemperatureLight],
      ['extendedColorLight', extendedColorLight],

      // Smart plugs / outlets / mounted controls
      ['onOffPlugInUnit', onOffPlugInUnit],
      ['dimmablePlugInUnit', dimmablePlugInUnit],
      ['mountedOnOffControl', mountedOnOffControl],
      ['mountedDimmableLoadControl', mountedDimmableLoadControl],
      ['pump', pump],
      ['waterValve', waterValve],

      // Switches & controls
      ['onOffLightSwitch', onOffLightSwitch],
      ['dimmerSwitch', dimmerSwitch],
      ['colorDimmerSwitch', colorDimmerSwitch],
      ['controlBridge', controlBridge],
      ['pumpController', pumpController],
      ['genericSwitch', genericSwitch],

      // Sensors
      ['contactSensor', contactSensor],
      ['lightSensor', lightSensor],
      ['occupancySensor', occupancySensor],
      ['temperatureSensor', temperatureSensor],
      ['pressureSensor', pressureSensor],
      ['flowSensor', flowSensor],
      ['humiditySensor', humiditySensor],
      ['onOffSensor', onOffSensor],
      ['smokeCoAlarm', smokeCoAlarm],
      ['airQualitySensor', airQualitySensor],
      ['waterFreezeDetector', waterFreezeDetector],
      ['waterLeakDetector', waterLeakDetector],
      ['rainSensor', rainSensor],

      // Closures
      ['doorLock', doorLock],
      ['doorLockController', doorLockController],
      ['windowCovering', windowCovering],
      ['windowCoveringController', windowCoveringController],

      // HVAC
      ['thermostat', thermostat],
      ['thermostatController', thermostatController],
      ['fan', fan],
      ['airPurifier', airPurifier],

      // Media
      ['basicVideoPlayer', basicVideoPlayer],
      ['castingVideoPlayer', castingVideoPlayer],
      ['speaker', speaker],
      ['contentApp', contentApp],
      ['castingVideoClient', castingVideoClient],
      ['videoRemoteControl', videoRemoteControl],

      // Generic device types
      ['modeSelect', modeSelect],

      // Appliances & complex devices
      ['roboticVacuumCleaner', roboticVacuumCleaner],
      ['laundryWasher', laundryWasher],
      ['refrigerator', refrigerator],
      ['roomAirConditioner', roomAirConditioner],
      ['temperatureControlledCabinetCooler', temperatureControlledCabinetCooler],
      ['temperatureControlledCabinetHeater', temperatureControlledCabinetHeater],
      ['dishwasher', dishwasher],
      ['laundryDryer', laundryDryer],
      ['cookSurface', cookSurface],
      ['cooktop', cooktop],
      ['oven', oven],
      ['extractorHood', extractorHood],
      ['microwaveOven', microwaveOven],

      // Energy & environment
      ['evse', evse],
      ['waterHeater', waterHeater],
      ['solarPower', solarPower],
      ['batteryStorage', batteryStorage],
      ['heatPump', heatPump],

      // Matter 1.5.1 device types
      ['closure', closure],
      ['closurePanel', closurePanel],
      ['closureController', closureController],
      ['irrigationSystem', irrigationSystem],
      ['soilSensor', soilSensor],
      ['meterReferencePoint', meterReferencePoint],
      ['electricalEnergyTariff', electricalEnergyTariff],
      ['electricalMeter', electricalMeter],
      ['electricalUtilityMeter', electricalUtilityMeter],
      ['camera', camera],
      ['floodlightCamera', floodlightCamera],
      ['videoDoorbell', videoDoorbell],
      ['intercom', intercom],
      ['audioDoorbell', audioDoorbell],
      ['snapshotCamera', snapshotCamera],
      ['chime', chime],
      ['cameraController', cameraController],
      ['doorbell', doorbell],
    ];

    test.each(cases)('Device type %s matches Matter 1.5.1 XML (id, revision, deviceName, deviceClass, deviceScope)', async (display, mb) => {
      const xmlInfo = xmlIndex.get(mb.code);
      if (!xmlInfo) {
        // eslint-disable-next-line no-console
        console.warn(`No XML entry found for ${display} (code=0x${mb.code.toString(16).padStart(4, '0')})`);
        return;
      }
      expect(mb.code).toBe(xmlInfo.id);
      expect(mb.revision).toBe(XML_REVISION_OVERRIDES.get(mb.code) ?? xmlInfo.revision);
      expect(mb.deviceName).toBe(XML_DEVICE_NAME_OVERRIDES.get(mb.code) ?? xmlInfo.name.replace(/[\s/-]/g, ''));
      expect(mb.deviceClass).toBe(DEVICE_CLASS_OVERRIDES.get(mb.code) ?? XML_CLASS_TO_DEVICE_CLASS[xmlInfo.class ?? '']);
      expect(mb.deviceScope).toBe(XML_SCOPE_TO_DEVICE_SCOPE[xmlInfo.scope ?? '']);
    });
  });
}
