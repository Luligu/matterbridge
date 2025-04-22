import { MatterbridgeAccessoryPlatform, MatterbridgeEndpoint, onOffSwitch } from 'matterbridge';
import { pressureSensor } from '../../matterbridgeDeviceTypes';

export default function initializePlugin(matterbridge, log, config) {
  return new MockPlatform(matterbridge, log, config);
}

export class MockPlatform extends MatterbridgeAccessoryPlatform {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(matterbridge, log, config) {
    super(matterbridge, log, config);
  }
  async onStart(reason) {
    this.log.info(`Starting platform ${this.config.name}: ${reason ?? ''}`);
    const device = new MatterbridgeEndpoint(pressureSensor, { uniqueStorageKey: 'PressureSensorPlugin6' })
      .createDefaultBasicInformationClusterServer('PressureSensor plugin 6', '0x123456789', 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge PressureSensor')
      .addRequiredClusterServers();
    await this.registerDevice(device);
  }
  async onConfigure() {
    this.log.info(`Configuring platform ${this.config.name}`);
  }
  async onShutdown(reason) {
    this.log.info(`Shutting down platform ${this.config.name}: ${reason ?? ''}`);
  }
}
