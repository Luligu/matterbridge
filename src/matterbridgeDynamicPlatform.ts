import { AnsiLogger, REVERSE, REVERSEOFF } from 'node-ansi-logger';
import EventEmitter from 'events';
import { Matterbridge } from './matterbridge.js';

export class MatterbridgeDynamicPlatform extends EventEmitter {
    
  constructor(matterbridge: Matterbridge, log: AnsiLogger) {
    super();
    log.debug(`MatterbridgeDynamicPlatform loaded (matterbridge is running on node v${matterbridge.nodeVersion})`);

    matterbridge.on('startDynamicPlatform', (reason: string) => {
      log.info(`Received ${REVERSE}startDynamicPlatform${REVERSEOFF} reason: ${reason}`);
      this.onStartDynamicPlatform(matterbridge, log);
    });
  
    matterbridge.on('shutdown', (reason: string) => {
      log.info(`Received ${REVERSE}shutdown${REVERSEOFF} reason: ${reason}`);
      this.onShutdown(matterbridge, log);
    });
  }

  // This method must be overriden in the extended class
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onStartDynamicPlatform(matterbridge: Matterbridge, log: AnsiLogger) {
    // Plugin initialization logic here
  }
  
  // This method must be overriden in the extended class
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onShutdown(matterbridge: Matterbridge, log: AnsiLogger) {
    // Plugin cleanup logic here
  }
}