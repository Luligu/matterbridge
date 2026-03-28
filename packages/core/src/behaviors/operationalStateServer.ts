/**
 * This file contains the MatterbridgeOperationalStateServer class of Matterbridge.
 *
 * @file operationalStateServer.ts
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

import { MaybePromise } from '@matter/general';
import { OperationalStateServer } from '@matter/node/behaviors/operational-state';
import { OperationalState } from '@matter/types/clusters/operational-state';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * OperationalState server that maps operational commands to Matterbridge command handler calls.
 */
export class MatterbridgeOperationalStateServer extends OperationalStateServer {
  /**
   * Initializes operational state defaults.
   */
  override initialize(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.debug('MatterbridgeOperationalStateServer initialized: setting operational state to Stopped');
    this.state.operationalState = OperationalState.OperationalStateEnum.Stopped;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    super.initialize();
  }

  /**
   * Handles the Pause command.
   *
   * @returns {MaybePromise<OperationalState.OperationalCommandResponse>} The operational command response.
   */
  override async pause(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Pause (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OperationalState.pause', {
      command: 'pause',
      request: {},
      cluster: OperationalStateServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OperationalState.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug('MatterbridgeOperationalStateServer: pause called setting operational state to Paused');
    this.state.operationalState = OperationalState.OperationalStateEnum.Paused;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }

  /**
   * Handles the Stop command.
   *
   * @returns {MaybePromise<OperationalState.OperationalCommandResponse>} The operational command response.
   */
  override async stop(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stop (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OperationalState.stop', {
      command: 'stop',
      request: {},
      cluster: OperationalStateServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OperationalState.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug('MatterbridgeOperationalStateServer: stop called setting operational state to Stopped');
    this.state.operationalState = OperationalState.OperationalStateEnum.Stopped;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }

  /**
   * Handles the Start command.
   *
   * @returns {MaybePromise<OperationalState.OperationalCommandResponse>} The operational command response.
   */
  override async start(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Start (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OperationalState.start', {
      command: 'start',
      request: {},
      cluster: OperationalStateServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OperationalState.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug('MatterbridgeOperationalStateServer: start called setting operational state to Running');
    this.state.operationalState = OperationalState.OperationalStateEnum.Running;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }

  /**
   * Handles the Resume command.
   *
   * @returns {MaybePromise<OperationalState.OperationalCommandResponse>} The operational command response.
   */
  override async resume(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Resume (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OperationalState.resume', {
      command: 'resume',
      request: {},
      cluster: OperationalStateServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OperationalState.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug('MatterbridgeOperationalStateServer: resume called setting operational state to Running');
    this.state.operationalState = OperationalState.OperationalStateEnum.Running;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }
}
