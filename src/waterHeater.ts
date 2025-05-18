// Matterbridge
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { waterHeater } from './matterbridgeDeviceTypes.js';
import { MatterbridgeWaterHeaterManagementServer, MatterbridgeWaterHeaterModeServer } from './matterbridgeBehaviors.js';

// Matter.js
import { WaterHeaterManagement, WaterHeaterMode, } from '@matter/main/clusters';

export class WaterHeater extends MatterbridgeEndpoint {
  constructor(name: string, serial: string) {
    super(waterHeater, { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Water Heater')
  }
