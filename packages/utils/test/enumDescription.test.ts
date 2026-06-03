import { getEnumDescription } from './enumDescription.js';

enum DoorState {
  DoorOpen = 0,
  DoorClosed = 1,
  DoorJammed = 2,
  DoorForcedOpen = 3,
  DoorUnspecifiedError = 4,
  DoorAjar = 5,
}

enum ConnectionState {
  connected = 'connected',
  timed_out = 'timed_out',
}

describe('getEnumDescription()', () => {
  test('returns the exact enum key for numeric enum values', () => {
    expect(getEnumDescription(DoorState, DoorState.DoorOpen)).toBe('DoorOpen');
    expect(getEnumDescription(DoorState, DoorState.DoorClosed)).toBe('DoorClosed');
    expect(getEnumDescription(DoorState, DoorState.DoorJammed)).toBe('DoorJammed');
  });

  test('returns the exact enum key for string enum values', () => {
    expect(getEnumDescription(ConnectionState, ConnectionState.connected)).toBe('connected');
    expect(getEnumDescription(ConnectionState, ConnectionState.timed_out)).toBe('timed_out');
  });

  test('returns Invalid by default for missing or unknown values', () => {
    expect(getEnumDescription(DoorState, 999 as DoorState)).toBe('Invalid');
    expect(getEnumDescription(DoorState, null)).toBe('Invalid');
    expect(getEnumDescription(DoorState, undefined)).toBe('Invalid');
  });

  test('returns the fallback when the value is not part of the enum', () => {
    expect(getEnumDescription(DoorState, 999 as DoorState, { fallback: 'Unknown door state' })).toBe('Unknown door state');
    expect(getEnumDescription(DoorState, null, { fallback: 'Unknown door state' })).toBe('Unknown door state');
    expect(getEnumDescription(DoorState, undefined, { fallback: 'Unknown door state' })).toBe('Unknown door state');
  });
});
