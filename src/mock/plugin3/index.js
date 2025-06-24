// eslint-disable-next-line n/no-missing-import
import { MatterbridgeDynamicPlatform, MatterbridgeEndpoint, onOffLight } from 'matterbridge';

// eslint-disable-next-line jsdoc/require-jsdoc
export default function initializePlugin(matterbridge, log, config) {
  return new MockPlatform(matterbridge, log, config);
}

class MockPlatform extends MatterbridgeDynamicPlatform {
  async onStart(reason) {
    await this.ready;
    this.log.info(`Starting platform ${this.config.name}: ${reason ?? ''}`);
    const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLightPlugin3' })
      .createDefaultBridgedDeviceBasicInformationClusterServer('Light plugin 3', '0x123456789', 0xfff1, 'Matterbridge', 'Matterbridge OnOffLight')
      .addRequiredClusterServers();
    await this.registerDevice(device);
    this.setSelectDevice('0x123456789', 'Light plugin 3', '192.168.0.0', 'hub', [{ name: 'Light', description: 'Light', icon: 'matter' }]);
    this.setSelectEntity('Light', 'Light', 'matter');
  }
  async onConfigure() {
    this.log.info(`Configuring platform ${this.config.name}`);
  }
  async onShutdown(reason) {
    this.log.info(`Shutting down platform ${this.config.name}: ${reason ?? ''}`);
  }
}
