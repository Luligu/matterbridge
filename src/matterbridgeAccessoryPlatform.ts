/**
 * This file contains the class MatterbridgeAccessoryPlatform.
 *
 * @file matterbridgeAccessoryPlatform.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.0.5
 *
 * Copyright 2023, 2024 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License. *
 */

import { Matterbridge, MatterbridgeEvents } from './matterbridge.js';
import { MatterbridgeDevice } from './matterbridgeDevice.js';
import { AnsiLogger } from 'node-ansi-logger';
import EventEmitter from 'events';

export class MatterbridgeAccessoryPlatform extends EventEmitter {
  protected matterbridge: Matterbridge;
  protected log: AnsiLogger;
  private name = '';
  private type = 'AccessoryPlatform';

  constructor(matterbridge: Matterbridge, log: AnsiLogger) {
    super();
    this.matterbridge = matterbridge;
    this.log = log;

    log.debug('MatterbridgeAccessoryPlatform loaded');
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
  async onStart(reason?: string) {
    this.log.error('Plugins must override onStart.', reason);
    throw new Error('Plugins must override onStart.');
  }

  // This method must be overridden in the extended class
  async onShutdown(reason?: string) {
    this.log.error('Plugins must override onShutdown.', reason);
    throw new Error('Plugins must override onShutdown.');
  }

  async registerDevice(device: MatterbridgeDevice) {
    await this.matterbridge.addDevice(this.name, device);
  }
}
