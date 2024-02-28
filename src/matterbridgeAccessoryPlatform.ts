import { Matterbridge, MatterbridgeEvents } from './matterbridge.js';
import { MatterbridgeDevice } from './matterbridgeDevice.js';
import { AnsiLogger, REVERSE, REVERSEOFF } from 'node-ansi-logger';
import EventEmitter from 'events';

export class MatterbridgeAccessoryPlatform extends EventEmitter {
  protected matterbridge: Matterbridge;
  protected log: AnsiLogger;
  private name = '';
  private type = 'AccessoryPlatform';
  private started = false;
  private stopped = false;

  constructor(matterbridge: Matterbridge, log: AnsiLogger) {
    super();
    this.matterbridge = matterbridge;
    this.log = log;

    log.debug('MatterbridgeAccessoryPlatform loaded');

    matterbridge.on('startAccessoryPlatform', (reason: string) => {
      if (this.started) return;
      this.started = true;
      log.info(`Received ${REVERSE}startAccessoryPlatform${REVERSEOFF} reason: ${reason}`);
      this.onStartAccessoryPlatform();
    });

    matterbridge.on('shutdown', (reason: string) => {
      if (this.stopped) return;
      this.stopped = true;
      log.info(`Received ${REVERSE}shutdown${REVERSEOFF} reason: ${reason}`);
      this.onShutdown();
    });
  }

  // Typed method for emitting events
  override emit<Event extends keyof MatterbridgeEvents>(event: Event, ...args: Parameters<MatterbridgeEvents[Event]>): boolean {
    return super.emit(event, ...args);
  }

  // Typed method for listening to events
  override on<Event extends keyof MatterbridgeEvents>(event: Event, listener: MatterbridgeEvents[Event]): this {
    super.on(event, listener);
    return this;
  }

  // This method must be overridden in the extended class
  onStartAccessoryPlatform() {
    // Plugin initialization logic here
  }

  // This method must be overridden in the extended class
  onShutdown() {
    // Plugin cleanup logic here
  }

  registerDevice(device: MatterbridgeDevice) {
    this.log.debug(`Send ${REVERSE}registerDeviceAccessoryPlatform${REVERSEOFF}`);
    this.emit('registerDeviceAccessoryPlatform', device);
    this.matterbridge.addDevice(this.name, device);
  }
}
