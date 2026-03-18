/**
 * @description Closure device class exposing the Matter 1.5 ClosureControl cluster.
 * @file src/devices/closure.ts
 * @author Luca Liguori
 * @created 2026-03-02
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

/* eslint-disable @typescript-eslint/no-namespace */

import { AttributeElement, ClusterElement, ClusterModel, CommandElement, DatatypeElement, EventElement, FieldElement } from '@matter/main/model';
import { ClusterBehavior } from '@matter/node';
import { ClusterType } from '@matter/types';

import { ClosureControl } from '../clusters/closure-control.js';
import { MatterbridgeServer } from '../matterbridgeBehaviorsServer.js';
import { closure } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

/**
 * ClosureControl schema.
 */
const ClosureControlSchema = ClusterElement(
  {
    id: ClosureControl.Cluster.id,
    name: ClosureControl.Cluster.name,
    classification: 'application',
  },
  // Matter global attributes.
  AttributeElement({ id: 0xfffd, name: 'ClusterRevision', type: 'ClusterRevision', conformance: 'M', default: ClosureControl.Base.revision }),
  AttributeElement(
    { id: 0xfffc, name: 'FeatureMap', type: 'FeatureMap', conformance: 'M' },
    FieldElement({ name: 'POS', constraint: '0', title: 'Positioning' }),
    FieldElement({ name: 'ML', constraint: '1', title: 'MotionLatching' }),
    FieldElement({ name: 'INS', constraint: '2', title: 'Instantaneous' }),
    FieldElement({ name: 'SPD', constraint: '3', title: 'Speed' }),
    FieldElement({ name: 'VNT', constraint: '4', title: 'Ventilation' }),
    FieldElement({ name: 'PED', constraint: '5', title: 'Pedestrian' }),
    FieldElement({ name: 'CAL', constraint: '6', title: 'Calibration' }),
    FieldElement({ name: 'PRT', constraint: '7', title: 'Protection' }),
    FieldElement({ name: 'MAN', constraint: '8', title: 'ManuallyOperable' }),
  ),

  // Attributes (base + Positioning extension).
  AttributeElement({ name: 'CountdownTime', id: 0x0000, type: 'uint32', conformance: 'POS', default: null, quality: 'X' }),
  AttributeElement({ name: 'MainState', id: 0x0001, type: 'MainStateEnum', conformance: 'M', constraint: 'desc' }),
  AttributeElement({ name: 'CurrentErrorList', id: 0x0002, type: 'list', conformance: 'M', default: [] }, FieldElement({ name: 'entry', type: 'ClosureErrorEnum' })),
  AttributeElement({ name: 'OverallCurrentState', id: 0x0003, type: 'OverallCurrentStateStruct', conformance: 'M', default: null, quality: 'X' }),
  AttributeElement({ name: 'OverallTargetState', id: 0x0004, type: 'OverallTargetStateStruct', conformance: 'M', default: null, quality: 'X' }),

  // Commands.
  CommandElement(
    { name: 'Stop', id: 0x0000, conformance: 'M', direction: 'request', response: 'status' },
    // no arguments
  ),
  CommandElement(
    { name: 'MoveTo', id: 0x0001, conformance: 'M', direction: 'request', response: 'status' },
    FieldElement({ name: 'Position', id: 0, type: 'TargetPositionEnum', conformance: 'O' }),
    FieldElement({ name: 'Latch', id: 1, type: 'bool', conformance: 'O' }),
    FieldElement({ name: 'Speed', id: 2, type: 'ThreeLevelAutoEnum', conformance: 'O' }),
  ),

  // Events.
  EventElement(
    { name: 'OperationalError', id: 0x0000, conformance: 'M', priority: 'critical' },
    FieldElement({ name: 'ErrorState', id: 0, type: 'list', conformance: 'M', constraint: 'max 10' }, FieldElement({ name: 'entry', type: 'ClosureErrorEnum' })),
  ),
  EventElement({ name: 'MovementCompleted', id: 0x0001, conformance: 'M', priority: 'info' }),
  EventElement({ name: 'SecureStateChanged', id: 0x0003, conformance: 'M', priority: 'info' }, FieldElement({ name: 'SecureValue', id: 0, type: 'bool', conformance: 'M' })),

  // Datatypes.
  DatatypeElement(
    { name: 'ClosureErrorEnum', type: 'enum8' },
    FieldElement({ name: 'PhysicallyBlocked', id: 0, conformance: 'M' }),
    FieldElement({ name: 'BlockedBySensor', id: 1, conformance: 'M' }),
    FieldElement({ name: 'TemperatureLimited', id: 2, conformance: 'M' }),
    FieldElement({ name: 'MaintenanceRequired', id: 3, conformance: 'M' }),
    FieldElement({ name: 'InternalInterference', id: 4, conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'CurrentPositionEnum', type: 'enum8' },
    FieldElement({ name: 'FullyClosed', id: 0, conformance: 'M' }),
    FieldElement({ name: 'FullyOpened', id: 1, conformance: 'M' }),
    FieldElement({ name: 'PartiallyOpened', id: 2, conformance: 'M' }),
    FieldElement({ name: 'OpenedForPedestrian', id: 3, conformance: 'M' }),
    FieldElement({ name: 'OpenedForVentilation', id: 4, conformance: 'M' }),
    FieldElement({ name: 'OpenedAtSignature', id: 5, conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'MainStateEnum', type: 'enum8' },
    FieldElement({ name: 'Stopped', id: 0, conformance: 'M' }),
    FieldElement({ name: 'Moving', id: 1, conformance: 'M' }),
    FieldElement({ name: 'WaitingForMotion', id: 2, conformance: 'M' }),
    FieldElement({ name: 'Error', id: 3, conformance: 'M' }),
    FieldElement({ name: 'Calibrating', id: 4, conformance: 'M' }),
    FieldElement({ name: 'Protected', id: 5, conformance: 'M' }),
    FieldElement({ name: 'Disengaged', id: 6, conformance: 'M' }),
    FieldElement({ name: 'SetupRequired', id: 7, conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'TargetPositionEnum', type: 'enum8' },
    FieldElement({ name: 'MoveToFullyClosed', id: 0, conformance: 'M' }),
    FieldElement({ name: 'MoveToFullyOpen', id: 1, conformance: 'M' }),
    FieldElement({ name: 'MoveToPedestrianPosition', id: 2, conformance: 'M' }),
    FieldElement({ name: 'MoveToVentilationPosition', id: 3, conformance: 'M' }),
    FieldElement({ name: 'MoveToSignaturePosition', id: 4, conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'OverallCurrentStateStruct', type: 'struct' },
    FieldElement({ name: 'Position', id: 0, type: 'CurrentPositionEnum', conformance: 'O', default: null, quality: 'X' }),
    FieldElement({ name: 'Latch', id: 1, type: 'bool', conformance: 'O', default: null, quality: 'X' }),
    FieldElement({ name: 'Speed', id: 2, type: 'ThreeLevelAutoEnum', conformance: 'O' }),
    FieldElement({ name: 'SecureState', id: 3, type: 'bool', conformance: 'O', default: null, quality: 'X' }),
  ),
  DatatypeElement(
    { name: 'OverallTargetStateStruct', type: 'struct' },
    FieldElement({ name: 'Position', id: 0, type: 'TargetPositionEnum', conformance: 'O', default: null, quality: 'X' }),
    FieldElement({ name: 'Latch', id: 1, type: 'bool', conformance: 'O', default: null, quality: 'X' }),
    FieldElement({ name: 'Speed', id: 2, type: 'ThreeLevelAutoEnum', conformance: 'O' }),
  ),
);

const ClosureControlBehavior = ClusterBehavior.for(ClusterType(ClosureControl.Base), new ClusterModel(ClosureControlSchema));

export namespace ClosureControlServer {
  export interface State {
    mainState: ClosureControl.MainState;
    currentErrorList: ClosureControl.ClosureError[];
    overallCurrentState: ClosureControl.OverallCurrentState | null;
    overallTargetState: ClosureControl.OverallTargetState | null;
    countdownTime: number | null;
  }
}

/**
 * ClosureControl server that forwards MoveTo/Stop commands to the Matterbridge command handler.
 */
export class ClosureControlServer extends ClosureControlBehavior.with(ClosureControl.Feature.Positioning) {
  declare state: ClosureControlServer.State;

  override moveTo = async (request: ClosureControl.MoveToRequest): Promise<void> => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MoveTo (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ClosureControl.moveTo', {
      command: 'moveTo',
      request,
      cluster: ClosureControlServer.id,
      attributes: this.state as unknown as (typeof ClosureControl.Complete)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

    const previousTarget = this.state.overallTargetState ?? {};
    const nextTarget = {
      ...previousTarget,
      ...(request?.position !== undefined ? { position: request.position } : null),
      ...(request?.latch !== undefined ? { latch: request.latch } : null),
      ...(request?.speed !== undefined ? { speed: request.speed } : null),
    };

    this.state.overallTargetState = nextTarget;
    this.state.mainState = ClosureControl.MainState.Moving;
  };

  override stop = async (): Promise<void> => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stop (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ClosureControl.stop', {
      command: 'stop',
      request: {},
      cluster: ClosureControlServer.id,
      attributes: this.state as unknown as (typeof ClosureControl.Complete)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

    this.state.mainState = ClosureControl.MainState.Stopped;
  };
}

export interface ClosureOptions {
  mainState?: ClosureControl.MainState;
}

/**
 * Matterbridge endpoint representing a closure device.
 */
export class Closure extends MatterbridgeEndpoint {
  /**
   * Creates a Closure endpoint and configures the ClosureControl cluster.
   *
   * @param {string} name - Human-readable device name.
   * @param {string} serial - Device serial number.
   * @param {ClosureOptions} [options] - Optional initial cluster state values.
   */
  constructor(name: string, serial: string, options: ClosureOptions = {}) {
    super([closure], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });

    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Closure');

    this.behaviors.require(ClosureControlServer, {
      mainState: options.mainState ?? ClosureControl.MainState.Stopped,
      currentErrorList: [],
      overallCurrentState: null,
      overallTargetState: null,
      countdownTime: null,
    });
  }

  /**
   * Gets the ClosureControl `mainState` attribute.
   *
   * @returns {ClosureControl.MainState | undefined} Current main state.
   */
  getMainState(): ClosureControl.MainState | undefined {
    return this.getAttribute(ClosureControlServer, 'mainState');
  }
}
