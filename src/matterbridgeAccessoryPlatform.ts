import { Matterbridge } from './matterbridge.js';
import { MatterbridgeDevice } from './matterbridgeDevice.js';
import { AnsiLogger, REVERSE, REVERSEOFF } from 'node-ansi-logger';
import EventEmitter from 'events';

export class MatterbridgeAccessoryPlatform extends EventEmitter {
  protected matterbridge: Matterbridge;
  protected log: AnsiLogger;
  private type = 'MatterbridgePlatform';

  constructor(matterbridge: Matterbridge, log: AnsiLogger) {
    super();
    this.matterbridge = matterbridge;
    this.log = log;

    log.debug(`MatterbridgePlatform loaded (matterbridge is running on node v${matterbridge.nodeVersion})`);

    matterbridge.on('startPlatform', (reason: string) => {
      log.info(`Received ${REVERSE}startPlatform${REVERSEOFF} reason: ${reason}`);
      this.onStartPlatform();
    });

    matterbridge.on('shutdown', (reason: string) => {
      log.info(`Received ${REVERSE}shutdown${REVERSEOFF} reason: ${reason}`);
      this.onShutdown();
    });
  }

  // This method must be overriden in the extended class
  onStartPlatform() {
    // Plugin initialization logic here
  }

  // This method must be overriden in the extended class
  onShutdown() {
    // Plugin cleanup logic here
  }

  registerDevice(device: MatterbridgeDevice) {
    this.log.debug(`Send ${REVERSE}registerDevicePlatform${REVERSEOFF}`);
    this.emit('registerDevicePlatform', device);
    this.matterbridge.addDevice(device);
  }
}
