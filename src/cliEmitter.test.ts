import { cliEmitter, lastCpuUsage, setLastCpuUsage } from './cliEmitter.ts';

describe('cliEmitter', () => {
  it('should be an instance of EventEmitter', () => {
    expect(cliEmitter).toBeDefined();
    expect(typeof cliEmitter.on).toBe('function');
    expect(typeof cliEmitter.emit).toBe('function');
  });
});

describe('lastCpuUsage variable and setLastCpuUsage', () => {
  it('should default to 0', () => {
    expect(lastCpuUsage).toBe(0);
  });

  it('should update lastCpuUsage via setLastCpuUsage', () => {
    setLastCpuUsage(55);
    expect(lastCpuUsage).toBe(55);
  });
});
