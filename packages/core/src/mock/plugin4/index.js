/* eslint-disable n/no-missing-import */
import { MatterbridgeAccessoryPlatform } from '../../matterbridgeAccessoryPlatform.js';
import { MatterbridgeEndpoint } from '../../matterbridgeEndpoint.js';
import { temperatureSensor } from '../../matterbridgeDeviceTypes.js';

// eslint-disable-next-line jsdoc/require-jsdoc
export default function initializePlugin(matterbridge, log, config) {
  return new MockPlatform(matterbridge, log, config);
}

class MockPlatform extends MatterbridgeAccessoryPlatform {
  async onStart(reason) {
    await this.ready;
    this.log.info(`Starting platform ${this.config.name}: ${reason ?? ''}`);
    const device = new MatterbridgeEndpoint(temperatureSensor, { id: 'TemperatureSensorPlugin4' })
      .createDefaultBasicInformationClusterServer('TemperatureSensor plugin 4', '0x123456789', 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge TemperatureSensor')
      .addRequiredClusterServers();
    await this.registerDevice(device);
    this.setSelectDevice('0x123456789', 'TemperatureSensor plugin 4');
    this.setSelectEntity('Temperature', 'Temperature', 'matter');
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
