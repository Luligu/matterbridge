import { MatterbridgeDynamicPlatform, MatterbridgeEndpoint, onOffSwitch } from 'matterbridge';
import { onOffOutlet } from '../../matterbridgeDeviceTypes';

export default function initializePlugin(matterbridge, log, config) {
  return new MockPlatform(matterbridge, log, config);
}

export class MockPlatform extends MatterbridgeDynamicPlatform {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(matterbridge, log, config) {
    super(matterbridge, log, config);
  }
  async onStart(reason) {
    await this.ready;
    this.log.info(`Starting platform ${this.config.name}: ${reason ?? ''}`);
    const device = new MatterbridgeEndpoint(onOffOutlet, { uniqueStorageKey: 'OnOffOutletPlugin2' })
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
