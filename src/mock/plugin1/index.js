import { MatterbridgeDynamicPlatform, MatterbridgeEndpoint, onOffSwitch } from 'matterbridge';

export default function initializePlugin(matterbridge, log, config) {
  return new MockPlatform(matterbridge, log, config);
}

export class MockPlatform extends MatterbridgeDynamicPlatform {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(matterbridge, log, config) {
    super(matterbridge, log, config);
  }
  async onStart(reason) {
    this.log.info(`Starting platform ${this.config.name}: ${reason ?? ''}`);
    const device = new MatterbridgeEndpoint(onOffSwitch, { uniqueStorageKey: 'OnOffSwitchPlugin1' })
      .createDefaultBridgedDeviceBasicInformationClusterServer('Switch plugin 1', '0x123456789', 0xfff1, 'Matterbridge', 'Matterbridge OnOffSwitch')
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
