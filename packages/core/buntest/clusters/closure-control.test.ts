/**
 * @file packages/core/buntest/clusters/closure-control.test.ts
 * @description This file contains the bun tests for the ClosureControl cluster definition.
 * @author Luca Liguori
 */

import { describe, expect, test } from 'bun:test';

import { ThreeLevelAuto } from '@matter/types/globals';

import { ClosureControl } from '../../src/clusters/closure-control.js';

describe('ClosureControl cluster', () => {
  test('identity, features, attributes, commands and events', () => {
    expect({ id: ClosureControl.id, name: ClosureControl.name, revision: ClosureControl.revision }).toMatchObject({ id: 0x0104, name: 'ClosureControl', revision: 1 });
    const features = ['Positioning', 'MotionLatching', 'Instantaneous', 'Speed', 'Ventilation', 'Pedestrian', 'Calibration', 'Protection', 'ManuallyOperable'];
    expect(Object.entries(ClosureControl.Feature)).toEqual(features.map((feature) => [feature, feature]));
    expect(new ClosureControl.FeatureMap({ positioning: true, motionLatching: true })).toMatchObject({ positioning: true, motionLatching: true });
    expect(Object.keys(ClosureControl.attributes)).toEqual(
      expect.arrayContaining(['countdownTime', 'mainState', 'currentErrorList', 'overallCurrentState', 'overallTargetState', 'latchControlModes']),
    );
    expect(Object.keys(ClosureControl.commands)).toEqual(expect.arrayContaining(['stop', 'moveTo', 'calibrate']));
    expect(Object.keys(ClosureControl.events)).toEqual(expect.arrayContaining(['operationalError', 'movementCompleted', 'engageStateChanged', 'secureStateChanged']));
  });

  test('enum, struct and bitmap values', () => {
    expect(ClosureControl.ClosureError.PhysicallyBlocked).toBe(0);
    expect(ClosureControl.CurrentPosition.FullyOpened).toBe(1);
    expect(ClosureControl.MainState.SetupRequired).toBe(7);
    expect(ClosureControl.TargetPosition.MoveToSignaturePosition).toBe(4);
    expect(new ClosureControl.LatchControlModes({ remoteLatching: true })).toMatchObject({ remoteLatching: true });
    expect(new ClosureControl.OverallCurrentState({ secureState: null })).toMatchObject({ secureState: null });
    expect(new ClosureControl.OverallTargetState({ position: ClosureControl.TargetPosition.MoveToFullyOpen })).toMatchObject({
      position: ClosureControl.TargetPosition.MoveToFullyOpen,
    });
    expect(new ClosureControl.MoveToRequest({ speed: ThreeLevelAuto.Auto })).toMatchObject({ speed: ThreeLevelAuto.Auto });
    expect(new ClosureControl.OperationalErrorEvent({ errorState: [ClosureControl.ClosureError.MaintenanceRequired] })).toMatchObject({
      errorState: [ClosureControl.ClosureError.MaintenanceRequired],
    });
    expect(new ClosureControl.EngageStateChangedEvent({ engageValue: true })).toMatchObject({ engageValue: true });
    expect(new ClosureControl.SecureStateChangedEvent({ secureValue: false })).toMatchObject({ secureValue: false });
  });
});
