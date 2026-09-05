import { onOffLightSwitch } from '../../matterbridgeDeviceTypes.js';
import { MatterbridgeDynamicPlatform } from '../../matterbridgeDynamicPlatform.js';
import { MatterbridgeEndpoint } from '../../matterbridgeEndpoint.js';

export default function initializePlugin(matterbridge, log, config) {
  return new MockPlatform(matterbridge, log, config);
}

class MockPlatform extends MatterbridgeDynamicPlatform {
  constructor(matterbridge, log, config) {
    super(matterbridge, log, config);
    config.whitelist ??= [];
    config.blackList ??= [];
  }
  async onStart(reason) {
    await this.ready;
    this.log.info(`Starting platform ${this.config.name}: ${reason ?? ''}`);
    const device = new MatterbridgeEndpoint(onOffLightSwitch, { id: 'OnOffSwitchPlugin1' })
      .createDefaultBridgedDeviceBasicInformationClusterServer('Switch plugin 1', '0x123456789', 0xfff1, 'Matterbridge', 'Matterbridge OnOffSwitch')
      .addRequiredClusterServers();
    await this.registerDevice(device);
    this.setSelectDevice('0x123456789', 'Switch plugin 1', '192.168.0.0', 'hub', [{ name: 'Switch', description: 'Switch', icon: 'matter' }]);
    this.setSelectEntity('Switch', 'Switch', 'matter');
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
