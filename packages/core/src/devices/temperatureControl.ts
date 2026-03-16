/**
 * @description This file contains the TemperatureControlCluster helper functions.
 * @file src/devices/temperatureControl.ts
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

// Imports from @matter
import { MaybePromise } from '@matter/general';
import { TemperatureControlServer } from '@matter/node/behaviors/temperature-control';
import { TemperatureControl } from '@matter/types/clusters/temperature-control';

// Matterbridge imports
import { MatterbridgeServer } from '../matterbridgeBehaviorsServer.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

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
  /**
   * Initializes the server and logs the configured temperature levels.
   */
  override initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeLevelTemperatureControlServer initialized with selectedTemperatureLevel ${this.state.selectedTemperatureLevel} and supportedTemperatureLevels: ${this.state.supportedTemperatureLevels.join(', ')}`,
    );
  }

  /**
   * Handles the TemperatureControl `SetTemperature` command.
   *
   * @param {TemperatureControl.SetTemperatureRequest} request - Temperature set request payload.
   */
  override setTemperature(request: TemperatureControl.SetTemperatureRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`SetTemperature (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('setTemperature', { request, cluster: TemperatureControlServer.id, attributes: this.state, endpoint: this.endpoint });
    if (request.targetTemperatureLevel !== undefined && request.targetTemperatureLevel >= 0 && request.targetTemperatureLevel < this.state.supportedTemperatureLevels.length) {
      device.log.debug(
        `MatterbridgeLevelTemperatureControlServer: setTemperature called setting selectedTemperatureLevel to ${request.targetTemperatureLevel}: ${this.state.supportedTemperatureLevels[request.targetTemperatureLevel]}`,
      );
      this.state.selectedTemperatureLevel = request.targetTemperatureLevel;
    } else {
      device.log.error(`MatterbridgeLevelTemperatureControlServer: setTemperature called with invalid targetTemperatureLevel ${request.targetTemperatureLevel}`);
    }
  }
}

/**
 * Temperature control server that exposes a numeric temperature setpoint.
 */
export class MatterbridgeNumberTemperatureControlServer extends TemperatureControlServer.with(
  TemperatureControl.Feature.TemperatureNumber,
  TemperatureControl.Feature.TemperatureStep,
) {
  /**
   * Initializes the server and logs the configured setpoint constraints.
   */
  override initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeNumberTemperatureControlServer initialized with temperatureSetpoint ${this.state.temperatureSetpoint} minTemperature ${this.state.minTemperature} maxTemperature ${this.state.maxTemperature} step ${this.state.step}`,
    );
  }

  /**
   * Handles the TemperatureControl `SetTemperature` command.
   *
   * @param {TemperatureControl.SetTemperatureRequest} request - Temperature set request payload.
   */
  override setTemperature(request: TemperatureControl.SetTemperatureRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`SetTemperature (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('setTemperature', { request, cluster: TemperatureControlServer.id, attributes: this.state, endpoint: this.endpoint });
    if (request.targetTemperature !== undefined && request.targetTemperature >= this.state.minTemperature && request.targetTemperature <= this.state.maxTemperature) {
      device.log.debug(`MatterbridgeNumberTemperatureControlServer: setTemperature called setting temperatureSetpoint to ${request.targetTemperature}`);
      this.state.temperatureSetpoint = request.targetTemperature;
    } else {
      device.log.error(`MatterbridgeNumberTemperatureControlServer: setTemperature called with invalid targetTemperature ${request.targetTemperature}`);
    }
  }
}
