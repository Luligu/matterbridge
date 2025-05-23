import { MatterbridgeAccessoryPlatform, MatterbridgeEndpoint, onOffSwitch } from 'matterbridge';
import { temperatureSensor } from '../../matterbridgeDeviceTypes';

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
    const device = new MatterbridgeEndpoint(temperatureSensor, { uniqueStorageKey: 'TemperatureSensorPlugin4' })
      .createDefaultBasicInformationClusterServer('TemperatureSensor plugin 4', '0x123456789', 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge TemperatureSensor')
      .addRequiredClusterServers();
    await this.registerDevice(device);
    this.setSelectDevice('0x123456789', 'TemperatureSensor plugin 4');
    this.setSelectEntity('Temperature', 'Temperature', 'matter');
  }
  async onConfigure() {
    this.log.info(`Configuring platform ${this.config.name}`);
  }
  async onShutdown(reason) {
    this.log.info(`Shutting down platform ${this.config.name}: ${reason ?? ''}`);
  }
}
