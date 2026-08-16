/**
 * @file packages/core/src/behaviors/smokeCoAlarmServer.ts
 * @description This file contains the MatterbridgeSmokeCoAlarmServer class of Matterbridge.
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

/* oxlint-disable typescript/no-unsafe-type-assertion */

import { SmokeCoAlarmServer } from '@matter/node/behaviors/smoke-co-alarm';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { Status, StatusResponseError } from '@matter/types';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * Smoke/CO Alarm server that forwards self-test commands to the Matterbridge command handler.
 */
export class MatterbridgeSmokeCoAlarmServer extends SmokeCoAlarmServer.with(SmokeCoAlarm.Feature.SmokeAlarm, SmokeCoAlarm.Feature.CoAlarm) {
  /**
   * Handles the SelfTestRequest command.
   */
  override async selfTestRequest(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Testing SmokeCOAlarm (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('SmokeCoAlarm.selfTestRequest', {
      command: 'selfTestRequest',
      request: {},
      cluster: SmokeCoAlarmServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof SmokeCoAlarm)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    /**
     * Matter 1.6 Application Cluster Specification, 2.11.9.1.1 SelfTestRequest:
     * only one SelfTestRequest may be processed at a time. When ExpressedState is any of
     * SmokeAlarm, COAlarm, Testing, InterconnectSmoke, or InterconnectCO, the device SHALL NOT
     * execute the self-test and SHALL return BUSY.
     *
     * Matterbridge rule: forward the command to the plugin before enforcing local behavior.
     */
    if (this.state.expressedState !== SmokeCoAlarm.ExpressedState.Normal || this.state.testInProgress) {
      throw new StatusResponseError('SmokeCOAlarm self-test is busy', Status.Busy);
    }
    device.log.debug(`MatterbridgeSmokeCoAlarmServer: selfTestRequest called`);
  }
}
