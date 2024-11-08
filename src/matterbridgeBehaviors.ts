/**
 * This file contains the class MatterbridgeEndpoint that extends the Endpoint class from the Matter.js library.
 *
 * @file matterbridgeBehaviors.ts
 * @author Luca Liguori
 * @date 2024-11-07
 * @version 1.0.0
 *
 * Copyright 2024, 2025, 2026 Luca Liguori.
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

/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unused-vars */

// @matter
import { Behavior } from '@matter/main';
import { OnOffServer } from '@matter/node/behaviors/on-off';

// AnsiLogger module
import { AnsiLogger } from 'node-ansi-logger';

export class MatterbridgeBehaviorDevice {
  private log: AnsiLogger;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(log: AnsiLogger, device: any) {
    this.log = log;
  }

  on() {
    this.log.info(`Switching device on`);
  }

  off() {
    this.log.info(`Switching device off`);
  }
}

export class MatterbridgeBehavior extends Behavior {
  static override readonly id = 'MatterbridgeBehavior';

  declare state: MatterbridgeBehavior.State;
}

export namespace MatterbridgeBehavior {
  export class State {
    deviceCommand!: MatterbridgeBehaviorDevice;
  }
}

export class MatterbridgeOnOffServer extends OnOffServer {
  override async on() {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.on();
    super.on();
  }

  override async off() {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.off();
    super.off();
  }
}
