/**
 * @file packages/core/src/devices/temperatureControl.ts
 * @description This file contains the TemperatureControlCluster helper functions.
 * @author Luca Liguori
 * @created 2025-05-18
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
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

// @matter
import { TemperatureControlServer } from '@matter/node/behaviors/temperature-control';
import { Status, StatusResponseError } from '@matter/types';
import { TemperatureControl } from '@matter/types/clusters/temperature-control';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';

/**
 * Creates a TemperatureControl Cluster Server with feature TemperatureLevel.
 *
 * @param {MatterbridgeEndpoint} endpoint - The Matterbridge endpoint instance.
 * @param {number} selectedTemperatureLevel - The selected temperature level as an index of the supportedTemperatureLevels array. Defaults to 1 (which corresponds to 'Warm').
 * @param {string[]} supportedTemperatureLevels - The supported temperature levels. Defaults to ['Cold', 'Warm', 'Hot', '30°', '40°', '60°', '80°'].
 *
 * @returns {this} The current MatterbridgeEndpoint instance for chaining.
 */
export function createLevelTemperatureControlClusterServer(
  endpoint: MatterbridgeEndpoint,
  selectedTemperatureLevel: number = 1,
  supportedTemperatureLevels: string[] = ['Cold', 'Warm', 'Hot', '30°', '40°', '60°', '80°'],
): MatterbridgeEndpoint {
  endpoint.behaviors.require(MatterbridgeLevelTemperatureControlServer.with(TemperatureControl.Feature.TemperatureLevel), {
    selectedTemperatureLevel,
    supportedTemperatureLevels,
  });
  return endpoint;
}

/**
 * Creates a TemperatureControl Cluster Server with features TemperatureNumber and TemperatureStep.
 *
 * @param {MatterbridgeEndpoint} endpoint - The Matterbridge endpoint instance.
 * @param {number} temperatureSetpoint - The temperature setpoint * 100. Defaults to 40 * 100 (which corresponds to 40°C).
 * @param {number} minTemperature - The minimum temperature * 100. Defaults to 30 * 100 (which corresponds to 30°C). Fixed attribute.
 * @param {number} maxTemperature - The maximum temperature * 100. Defaults to 60 * 100 (which corresponds to 60°C). Fixed attribute.
 * @param {number} [step] - The step size for temperature changes. Defaults to 10 * 100 (which corresponds to 10°C). Fixed attribute.
 *
 * @returns {this} The current MatterbridgeEndpoint instance for chaining.
 */
export function createNumberTemperatureControlClusterServer(
  endpoint: MatterbridgeEndpoint,
  temperatureSetpoint: number = 40 * 100,
  minTemperature: number = 30 * 100,
  maxTemperature: number = 60 * 100,
  step: number = 10 * 100,
): MatterbridgeEndpoint {
  endpoint.behaviors.require(MatterbridgeNumberTemperatureControlServer.with(TemperatureControl.Feature.TemperatureNumber, TemperatureControl.Feature.TemperatureStep), {
    temperatureSetpoint,
    minTemperature, // Fixed attribute
    maxTemperature, // Fixed attribute
    step, // Fixed attribute
  });
  return endpoint;
}

/**
 * Temperature control server that exposes discrete temperature levels.
 */
export class MatterbridgeLevelTemperatureControlServer extends TemperatureControlServer.with(TemperatureControl.Feature.TemperatureLevel) {
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

  /**
   * Initializes the server and logs the configured temperature levels.
   */
  override initialize(): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeLevelTemperatureControlServer: initialized with selectedTemperatureLevel ${this.state.selectedTemperatureLevel} and supportedTemperatureLevels: ${this.state.supportedTemperatureLevels.join(', ')} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }

  /**
   * Handles the TemperatureControl `SetTemperature` command.
   *
   * @param {TemperatureControl.SetTemperatureRequest} request - Temperature set request payload.
   */
  override async setTemperature(request: TemperatureControl.SetTemperatureRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeLevelTemperatureControlServer: setting temperature level to ${request.targetTemperatureLevel} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('TemperatureControl.setTemperature', {
      command: 'setTemperature',
      request,
      cluster: TemperatureControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof TemperatureControl)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    // Matter 1.6.0 § 8.2.6.1: TargetTemperatureLevel is mandatory when the TemperatureLevel feature is supported, so reject a command without it with INVALID_COMMAND.
    if (request.targetTemperatureLevel === undefined) {
      throw new StatusResponseError(
        `MatterbridgeLevelTemperatureControlServer: setTemperature requires targetTemperatureLevel (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.InvalidCommand,
      );
    }
    // Matter 1.6.0 § 8.2.6.1.2 and § 8.2.6.1.3: Reject a TargetTemperatureLevel outside the SupportedTemperatureLevels list with CONSTRAINT_ERROR, leaving SelectedTemperatureLevel unchanged.
    if (request.targetTemperatureLevel < 0 || request.targetTemperatureLevel >= this.state.supportedTemperatureLevels.length) {
      throw new StatusResponseError(
        `MatterbridgeLevelTemperatureControlServer: targetTemperatureLevel ${request.targetTemperatureLevel} is outside the supportedTemperatureLevels list (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    device.log.debug(
      `MatterbridgeLevelTemperatureControlServer: setTemperature called setting selectedTemperatureLevel to ${request.targetTemperatureLevel}: ${this.state.supportedTemperatureLevels[request.targetTemperatureLevel]} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // Matter 1.6.0 § 8.2.6.1.3: Set SelectedTemperatureLevel to TargetTemperatureLevel and respond with SUCCESS.
    this.state.selectedTemperatureLevel = request.targetTemperatureLevel;
    this.endpoint.emitCommand(TemperatureControl, 'setTemperature', request, this.context);
  }
}

/**
 * Temperature control server that exposes a numeric temperature setpoint.
 */
export class MatterbridgeNumberTemperatureControlServer extends TemperatureControlServer.with(
  TemperatureControl.Feature.TemperatureNumber,
  TemperatureControl.Feature.TemperatureStep,
) {
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

  /**
   * Initializes the server and logs the configured setpoint constraints.
   */
  override initialize(): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeNumberTemperatureControlServer: initialized with temperatureSetpoint ${this.state.temperatureSetpoint} minTemperature ${this.state.minTemperature} maxTemperature ${this.state.maxTemperature} step ${this.state.step} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }

  /**
   * Handles the TemperatureControl `SetTemperature` command.
   *
   * @param {TemperatureControl.SetTemperatureRequest} request - Temperature set request payload.
   */
  override async setTemperature(request: TemperatureControl.SetTemperatureRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeNumberTemperatureControlServer: setting temperature to ${request.targetTemperature} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('TemperatureControl.setTemperature', {
      command: 'setTemperature',
      request,
      cluster: TemperatureControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof TemperatureControl)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    // Matter 1.6.0 § 8.2.6.1: TargetTemperature is mandatory when the TemperatureNumber feature is supported, so reject a command without it with INVALID_COMMAND.
    if (request.targetTemperature === undefined) {
      throw new StatusResponseError(
        `MatterbridgeNumberTemperatureControlServer: setTemperature requires targetTemperature (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.InvalidCommand,
      );
    }
    // Matter 1.6.0 § 8.2.6.1.1: Reject a TargetTemperature outside MinTemperature to MaxTemperature inclusive with CONSTRAINT_ERROR, leaving TemperatureSetpoint unchanged.
    if (request.targetTemperature < this.state.minTemperature || request.targetTemperature > this.state.maxTemperature) {
      throw new StatusResponseError(
        `MatterbridgeNumberTemperatureControlServer: targetTemperature ${request.targetTemperature} must be between minTemperature ${this.state.minTemperature} and maxTemperature ${this.state.maxTemperature} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.0 § 8.2.6.1.3: With the Step feature, reject a TargetTemperature where (TargetTemperature - MinTemperature) % Step != 0 with CONSTRAINT_ERROR, leaving TemperatureSetpoint unchanged.
    if ((request.targetTemperature - this.state.minTemperature) % this.state.step !== 0) {
      throw new StatusResponseError(
        `MatterbridgeNumberTemperatureControlServer: targetTemperature ${request.targetTemperature} is not aligned to step ${this.state.step} from minTemperature ${this.state.minTemperature} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    device.log.debug(
      `MatterbridgeNumberTemperatureControlServer: setTemperature called setting temperatureSetpoint to ${request.targetTemperature} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // Matter 1.6.0 § 8.2.6.1.3: Set TemperatureSetpoint to TargetTemperature and respond with SUCCESS.
    this.state.temperatureSetpoint = request.targetTemperature;
    this.endpoint.emitCommand(TemperatureControl, 'setTemperature', request, this.context);
  }
}
