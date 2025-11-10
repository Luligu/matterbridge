// eslint-disable-next-line n/no-missing-import
import { MatterbridgeAccessoryPlatform, MatterbridgeEndpoint, humiditySensor } from 'matterbridge';

// eslint-disable-next-line jsdoc/require-jsdoc
export default function initializePlugin(matterbridge, log, config) {
  return new MockPlatform(matterbridge, log, config);
}

class MockPlatform extends MatterbridgeAccessoryPlatform {
  async onStart(reason) {
    await this.ready;
    this.log.info(`Starting platform ${this.config.name}: ${reason ?? ''}`);
    const device = new MatterbridgeEndpoint(humiditySensor, { id: 'HumiditySensorPlugin5' })
      .createDefaultBasicInformationClusterServer('HumiditySensor plugin 5', '0x123456789', 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge HumiditySensor')
      .addRequiredClusterServers();
    await this.registerDevice(device);
    this.setSelectDevice('0x123456789', 'HumiditySensor plugin 5');
    this.setSelectEntity('Humidity', 'Humidity', 'matter');
  }
  async onConfigure() {
    this.log.info(`Configuring platform ${this.config.name}`);
  }
  async onShutdown(reason) {
    this.log.info(`Shutting down platform ${this.config.name}: ${reason ?? ''}`);
  }
}
