// eslint-disable-next-line n/no-missing-import
import { MatterbridgeDynamicPlatform, MatterbridgeEndpoint, onOffOutlet } from 'matterbridge';

// eslint-disable-next-line jsdoc/require-jsdoc
export default function initializePlugin(matterbridge, log, config) {
  return new MockPlatform(matterbridge, log, config);
}

class MockPlatform extends MatterbridgeDynamicPlatform {
  constructor(matterbridge, log, config) {
    super(matterbridge, log, config);
    if (!config.whitelist) config.whitelist = [];
    if (!config.blackList) config.blackList = [];
  }
  async onStart(reason) {
    await this.ready;
    this.log.info(`Starting platform ${this.config.name}: ${reason ?? ''}`);
    const device = new MatterbridgeEndpoint(onOffOutlet, { id: 'OnOffOutletPlugin2' })
      .createDefaultBridgedDeviceBasicInformationClusterServer('Outlet plugin 2', '0x123456789', 0xfff1, 'Matterbridge', 'Matterbridge OnOffOutlet')
      .addRequiredClusterServers();
    await this.registerDevice(device);
    this.setSelectDevice('0x123456789', 'Outlet plugin 2', '192.168.0.0', 'hub', [{ name: 'Outlet', description: 'Outlet', icon: 'matter' }]);
    this.setSelectEntity('Outlet', 'Outlet', 'matter');
  }
  async onConfigure() {
    this.log.info(`Configuring platform ${this.config.name}`);
  }
  async onShutdown(reason) {
    this.log.info(`Shutting down platform ${this.config.name}: ${reason ?? ''}`);
  }
}
