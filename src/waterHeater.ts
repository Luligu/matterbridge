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
      .createDefaultWaterHeaterManagementClusterServer()
      .createDefaultWaterHeaterModeClusterServer()
  }


  /**
   * Creates a default WaterHeaterManagement Cluster Server.
   *
   * @param {WaterHeaterManagement.BoostState} [boostState] - The current boost state of the WaterHeaterManagement cluster. Defaults to Inactive.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultWaterHeaterManagementClusterServer(
    heaterTypes?: typeof WaterHeaterManagement.WaterHeaterHeatSource,
    heatDemand?: typeof WaterHeaterManagement.WaterHeaterHeatSource,
    boostState?: WaterHeaterManagement.BoostState,
  ): this {
    this.behaviors.require(MatterbridgeWaterHeaterManagementServer, {
      heaterTypes: { immersionElement1: true },
      heatDemand: { heatPump: false },
      boostState: WaterHeaterManagement.BoostState.Inactive,
    });
    return this;
  }
 

  /**
   * Creates a default WaterHeaterMode Cluster Server.
   *
   * @param {number} [currentMode] - The current mode of the WaterHeaterMode cluster. Defaults to 1 (Idle).
   * @param {WaterHeaterMode.ModeOption[]} [supportedModes] - The supported modes for the WaterHeaterMode cluster. Defaults to a predefined set of modes.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultWaterHeaterModeClusterServer(currentMode?: number, supportedModes?: WaterHeaterMode.ModeOption[]): this {
    this.behaviors.require(MatterbridgeWaterHeaterModeServer, {
      supportedModes: supportedModes ?? [
        { label: 'Auto', mode: 0, modeTags: [{ value: WaterHeaterMode.ModeTag.Auto }] },
        { label: 'Quick', mode: 1, modeTags: [{ value: WaterHeaterMode.ModeTag.Quick }] },
        { label: 'Quiet', mode: 2, modeTags: [{ value: WaterHeaterMode.ModeTag.Quiet }] },
        { label: 'LowNoise', mode: 3, modeTags: [{ value: WaterHeaterMode.ModeTag.LowNoise }] },
        { label: 'LowEnergy', mode: 4, modeTags: [{ value: WaterHeaterMode.ModeTag.LowEnergy }] },
        { label: 'Vacation', mode: 5, modeTags: [{ value: WaterHeaterMode.ModeTag.Vacation }] },
        { label: 'Min', mode: 6, modeTags: [{ value: WaterHeaterMode.ModeTag.Min }] },
        { label: 'Max', mode: 7, modeTags: [{ value: WaterHeaterMode.ModeTag.Max }] },
        { label: 'Night', mode: 8, modeTags: [{ value: WaterHeaterMode.ModeTag.Night }] },
        { label: 'Day', mode: 9, modeTags: [{ value: WaterHeaterMode.ModeTag.Day }] },
        { label: 'Off', mode: 0x4000, modeTags: [{ value: WaterHeaterMode.ModeTag.Off }] },
        { label: 'Manual', mode: 0x4001, modeTags: [{ value: WaterHeaterMode.ModeTag.Manual }] },
        { label: 'Timed', mode: 0x4002, modeTags: [{ value: WaterHeaterMode.ModeTag.Manual }] },
      ],
      currentMode: currentMode ?? 0,
    });
    return this;
  }
}

