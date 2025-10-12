import { cliEmitter, lastOsCpuUsage, setLastOsCpuUsage, lastProcessCpuUsage, setLastProcessCpuUsage } from './cliEmitter.js';

describe('cliEmitter', () => {
  it('should be an instance of EventEmitter', () => {
    expect(cliEmitter).toBeDefined();
    expect(typeof cliEmitter.on).toBe('function');
    expect(typeof cliEmitter.emit).toBe('function');
  });
});

describe('lastOsCpuUsage variable and setLastOsCpuUsage', () => {
  it('should default to 0', () => {
    expect(lastOsCpuUsage).toBe(0);
  });

  it('should update lastOsCpuUsage via setLastOsCpuUsage', () => {
    setLastOsCpuUsage(55);
    expect(lastOsCpuUsage).toBe(55);
  });
});

describe('lastProcessCpuUsage variable and setLastProcessCpuUsage', () => {
  it('should default to 0', () => {
    expect(lastProcessCpuUsage).toBe(0);
  });

  it('should update lastProcessCpuUsage via setLastProcessCpuUsage', () => {
    setLastProcessCpuUsage(55);
    expect(lastProcessCpuUsage).toBe(55);
  });
});
