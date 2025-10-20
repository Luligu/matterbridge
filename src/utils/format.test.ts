import { formatBytes, formatUptime, formatTimeStamp, formatPercent } from './format.js';

describe('formatTimeStamp(), formatBytes() and formatUptime()', () => {
  test('Frontend formatTimeStamp', () => {
    // Test the formatTimeStamp functionality
    expect(formatTimeStamp(Date.now())).toBe(new Date(Date.now()).toLocaleString());
  });

  test('Frontend formatPercent', () => {
    // Test the formatPercent functionality
    expect(formatPercent(12.34567)).toBe('12.35 %');
    expect(formatPercent(12.3, 1)).toBe('12.3 %');
    expect(formatPercent(15, 0)).toBe('15 %');
  });

  test('Frontend formatBytes', () => {
    // Test the formatBytes functionality
    expect(formatBytes(1024 ** 3)).toBe('1.00 GB');
    expect(formatBytes(1024 ** 2)).toBe('1.00 MB');
    expect(formatBytes(3000)).toBe('2.93 KB');
    expect(formatBytes(0)).toBe('0.00 B');
  });

  test('Frontend formatUptime', () => {
    // Test the formatUptime functionality
    expect(formatUptime(323456)).toBe('3 days');
    expect(formatUptime(123456)).toBe('1 day');
    expect(formatUptime(7200)).toBe('2 hours');
    expect(formatUptime(3800)).toBe('1 hour');
    expect(formatUptime(3600)).toBe('1 hour');
    expect(formatUptime(120)).toBe('2 minutes');
    expect(formatUptime(65)).toBe('1 minute');
    expect(formatUptime(60)).toBe('1 minute');
    expect(formatUptime(30)).toBe('30 seconds');
    expect(formatUptime(1)).toBe('1 second');
    expect(formatUptime(0)).toBe('0 seconds');
  });
});
