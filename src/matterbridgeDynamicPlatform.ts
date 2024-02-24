import { Matterbridge } from './matterbridge.js';
import { MatterbridgeDevice } from './matterbridgeDevice.js';
import { AnsiLogger, REVERSE, REVERSEOFF } from 'node-ansi-logger';
import EventEmitter from 'events';

export class MatterbridgeDynamicPlatform extends EventEmitter {
  protected matterbridge: Matterbridge;
  protected log: AnsiLogger;
  private type = 'MatterbridgeDynamicPlatform';

  constructor(matterbridge: Matterbridge, log: AnsiLogger) {
    super();
    this.matterbridge = matterbridge;
    this.log = log;

    log.debug(`MatterbridgeDynamicPlatform loaded (matterbridge is running on node v${matterbridge.nodeVersion})`);

    matterbridge.on('startDynamicPlatform', (reason: string) => {
      log.info(`Received ${REVERSE}startDynamicPlatform${REVERSEOFF} reason: ${reason}`);
      this.onStartDynamicPlatform();
    });
  
    matterbridge.on('shutdown', (reason: string) => {
      log.info(`Received ${REVERSE}shutdown${REVERSEOFF} reason: ${reason}`);
      this.onShutdown();
    });
  }

  // This method must be overriden in the extended class
  onStartDynamicPlatform() {
    // Plugin initialization logic here
  }
  
  // This method must be overriden in the extended class
  onShutdown() {
    // Plugin cleanup logic here
  }

  registerDevice(device: MatterbridgeDevice) {
    this.log.debug(`Send ${REVERSE}registerDeviceDynamicPlatform${REVERSEOFF}`);
    this.emit('registerDeviceDynamicPlatform', device);
    this.matterbridge.addBridgedDevice(device);
  }
}