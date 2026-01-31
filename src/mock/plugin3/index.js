/* eslint-disable n/no-missing-import */
import { MatterbridgeDynamicPlatform } from '../../matterbridgeDynamicPlatform.js';
import { MatterbridgeEndpoint } from '../../matterbridgeEndpoint.js';
import { onOffLight } from '../../matterbridgeDeviceTypes.js';

// eslint-disable-next-line jsdoc/require-jsdoc
export default function initializePlugin(matterbridge, log, config) {
  return new MockPlatform(matterbridge, log, config);
}

class MockPlatform extends MatterbridgeDynamicPlatform {
  async onStart(reason) {
    await this.ready;
    this.log.info(`Starting platform ${this.config.name}: ${reason ?? ''}`);
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLightPlugin3' })
      .createDefaultBridgedDeviceBasicInformationClusterServer('Light plugin 3', '0x123456789', 0xfff1, 'Matterbridge', 'Matterbridge OnOffLight')
      .addRequiredClusterServers();
    await this.registerDevice(device);
    this.setSelectDevice('0x123456789', 'Light plugin 3', '192.168.0.0', 'hub', [{ name: 'Light', description: 'Light', icon: 'matter' }]);
    this.setSelectEntity('Light', 'Light', 'matter');
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
