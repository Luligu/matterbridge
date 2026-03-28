/**
 * This file contains the MatterbridgeSwitchServer class of Matterbridge.
 *
 * @file switchServer.ts
 * @author Luca Liguori
 * @created 2026-03-28
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
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
 * limitations under the License.
 */

import { SwitchServer } from '@matter/node/behaviors/switch';

/**
 * Switch server placeholder; the device implementation drives switch logic.
 */
export class MatterbridgeSwitchServer extends SwitchServer {
  /**
   * Intentionally no-op: switch logic is handled by the device implementation.
   */
  override initialize() {
    // Do nothing here, as the device will handle the switch logic: we need to convert something like "single" into the appropriate sequence of state changes and events
  }
}
