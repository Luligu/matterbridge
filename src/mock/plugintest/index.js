// eslint-disable-next-line n/no-missing-import
import { MatterbridgeAccessoryPlatform, MatterbridgeEndpoint, pressureSensor } from 'matterbridge';

// eslint-disable-next-line jsdoc/require-jsdoc
export function initializePlugin(matterbridge, log, config) {
  return new MockPlatform(matterbridge, log, config);
}

class MockPlatform extends MatterbridgeAccessoryPlatform {
  async onStart(reason) {
    await this.ready;
    this.log.info(`Starting platform ${this.config.name}: ${reason ?? ''}`);
    const device = new MatterbridgeEndpoint(pressureSensor, { uniqueStorageKey: 'PressureSensorPlugin6' })
      .createDefaultBasicInformationClusterServer('PressureSensor plugin 6', '0x123456789', 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge PressureSensor')
      .addRequiredClusterServers();
    await this.registerDevice(device);
    this.setSelectDevice('0x123456789', 'PressureSensor plugin 6');
    this.setSelectEntity('Pressure', 'Pressure', 'matter');
  }
  async onConfigure() {
    this.log.info(`Configuring platform ${this.config.name}`);
  }
  async onShutdown(reason) {
    this.log.info(`Shutting down platform ${this.config.name}: ${reason ?? ''}`);
  }
}
