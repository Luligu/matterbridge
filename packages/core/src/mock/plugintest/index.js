/* eslint-disable n/no-missing-import */
import { MatterbridgeAccessoryPlatform } from '../../matterbridgeAccessoryPlatform.js';
import { MatterbridgeEndpoint } from '../../matterbridgeEndpoint.js';
import { pressureSensor } from '../../matterbridgeDeviceTypes.js';

// eslint-disable-next-line jsdoc/require-jsdoc
export function initializePlugin(matterbridge, log, config) {
  return new MockPlatform(matterbridge, log, config);
}

class MockPlatform extends MatterbridgeAccessoryPlatform {
  async onStart(reason) {
    await this.ready;
    this.log.info(`Starting platform ${this.config.name}: ${reason ?? ''}`);
    const device = new MatterbridgeEndpoint(pressureSensor, { id: 'PressureSensorPlugin6' })
      .createDefaultBasicInformationClusterServer('PressureSensor plugin 6', '0x123456789', 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge PressureSensor')
      .addRequiredClusterServers();
    await this.registerDevice(device);
    this.setSelectDevice('0x123456789', 'PressureSensor plugin 6');
    this.setSelectEntity('Pressure', 'Pressure', 'matter');
  }
  async onConfigure() {
    await super.onConfigure();
    this.log.info(`Configuring platform ${this.config.name}`);
  }
  async onShutdown(reason) {
    await super.onShutdown(reason);
    this.log.info(`Shutting down platform ${this.config.name}: ${reason ?? ''}`);
  }
}
