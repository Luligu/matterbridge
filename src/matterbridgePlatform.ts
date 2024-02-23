import { AnsiLogger, REVERSE, REVERSEOFF } from 'node-ansi-logger';
import EventEmitter from 'events';
import { Matterbridge } from './matterbridge.js';

export class MatterbridgePlatform extends EventEmitter {
    
  constructor(matterbridge: Matterbridge, log: AnsiLogger) {
    super();
    log.debug(`MatterbridgePlatform loaded (matterbridge is running on node v${matterbridge.nodeVersion})`);

    matterbridge.on('startPlatform', (reason: string) => {
      log.info(`Received ${REVERSE}startPlatform${REVERSEOFF} reason: ${reason}`);
      this.onStartPlatform(matterbridge, log);
    });
  
    matterbridge.on('shutdown', (reason: string) => {
      log.info(`Received ${REVERSE}shutdown${REVERSEOFF} reason: ${reason}`);
      this.onShutdown(matterbridge, log);
    });
  }

  // This method must be overriden in the extended class
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onStartPlatform(matterbridge: Matterbridge, log: AnsiLogger) {
    // Plugin initialization logic here
  }

  // This method must be overriden in the extended class
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onShutdown(matterbridge: Matterbridge, log: AnsiLogger) {
    // Plugin cleanup logic here
  }
}