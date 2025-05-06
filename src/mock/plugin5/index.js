import { MatterbridgeAccessoryPlatform, MatterbridgeEndpoint, onOffSwitch } from 'matterbridge';
import { humiditySensor } from '../../matterbridgeDeviceTypes';

export default function initializePlugin(matterbridge, log, config) {
  return new MockPlatform(matterbridge, log, config);
}

export class MockPlatform extends MatterbridgeAccessoryPlatform {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(matterbridge, log, config) {
    super(matterbridge, log, config);
  }
  async onStart(reason) {
    await this.ready;
    this.log.info(`Starting platform ${this.config.name}: ${reason ?? ''}`);
    const device = new MatterbridgeEndpoint(humiditySensor, { uniqueStorageKey: 'HumiditySensorPlugin5' })
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
