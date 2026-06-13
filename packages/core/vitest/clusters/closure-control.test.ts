// vitest\clusters\closure-control.test.ts

const NAME = 'ClosureControlCluster';

import { ThreeLevelAuto } from '@matter/types/globals';
import { setupTest } from '@matterbridge/vitest-utils';

import { ClosureControl } from '../../src/clusters/closure-control.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test('has the expected cluster identity', () => {
    expect(ClosureControl.id).toBe(0x0104);
    expect(ClosureControl.name).toBe('ClosureControl');
    expect(ClosureControl.revision).toBe(1);
  });

  test('exposes the expected feature constants', () => {
    expect(ClosureControl.Feature).toEqual({
      Positioning: 'Positioning',
      MotionLatching: 'MotionLatching',
      Instantaneous: 'Instantaneous',
      Speed: 'Speed',
      Ventilation: 'Ventilation',
      Pedestrian: 'Pedestrian',
      Calibration: 'Calibration',
      Protection: 'Protection',
      ManuallyOperable: 'ManuallyOperable',
    });

    expect(new ClosureControl.FeatureMap({ positioning: true, motionLatching: true })).toEqual({ positioning: true, motionLatching: true });
  });

  test('exposes the expected attributes', () => {
    expect(ClosureControl.attributes).toHaveProperty('countdownTime');
    expect(ClosureControl.attributes).toHaveProperty('mainState');
    expect(ClosureControl.attributes).toHaveProperty('currentErrorList');
    expect(ClosureControl.attributes).toHaveProperty('overallCurrentState');
    expect(ClosureControl.attributes).toHaveProperty('overallTargetState');
    expect(ClosureControl.attributes).toHaveProperty('latchControlModes');
  });

  test('exposes the expected commands and events', () => {
    expect(ClosureControl.commands).toHaveProperty('stop');
    expect(ClosureControl.commands).toHaveProperty('moveTo');
    expect(ClosureControl.commands).toHaveProperty('calibrate');
    expect(ClosureControl.events).toHaveProperty('operationalError');
    expect(ClosureControl.events).toHaveProperty('movementCompleted');
    expect(ClosureControl.events).toHaveProperty('engageStateChanged');
    expect(ClosureControl.events).toHaveProperty('secureStateChanged');
  });

  test('exposes the expected enum constants', () => {
    expect(ClosureControl.ClosureError.PhysicallyBlocked).toBe(0);
    expect(ClosureControl.CurrentPosition.FullyOpened).toBe(1);
    expect(ClosureControl.MainState.SetupRequired).toBe(7);
    expect(ClosureControl.TargetPosition.MoveToSignaturePosition).toBe(4);
  });

  test('creates expected struct and bitmap values', () => {
    expect(new ClosureControl.LatchControlModes({ remoteLatching: true })).toEqual({ remoteLatching: true });
    expect(new ClosureControl.OverallCurrentState({ secureState: null })).toEqual({ secureState: null });
    expect(new ClosureControl.OverallTargetState({ position: ClosureControl.TargetPosition.MoveToFullyOpen })).toEqual({ position: ClosureControl.TargetPosition.MoveToFullyOpen });
    expect(new ClosureControl.MoveToRequest({ speed: ThreeLevelAuto.Auto })).toEqual({ speed: ThreeLevelAuto.Auto });
    expect(
      new ClosureControl.OperationalErrorEvent({
        errorState: [ClosureControl.ClosureError.MaintenanceRequired],
      }),
    ).toEqual({ errorState: [ClosureControl.ClosureError.MaintenanceRequired] });
    expect(new ClosureControl.EngageStateChangedEvent({ engageValue: true })).toEqual({ engageValue: true });
    expect(new ClosureControl.SecureStateChangedEvent({ secureValue: false })).toEqual({ secureValue: false });
  });
});
