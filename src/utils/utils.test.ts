import { deepEqual, deepCopy, getIpv4InterfaceAddress, getIpv6InterfaceAddress, logInterfaces, isValidIpv4Address, waiter, wait } from './utils';
import { promises as fs } from 'fs';
import path from 'path';

describe('Utils test', () => {
  const obj1 = {
    a: 1,
    b: '2',
    c: {
      d: 3,
      e: '4',
    },
  };

  const obj2 = {
    a: 1,
    b: '2',
    c: {
      d: 3,
      e: '4',
    },
  };

  let roller2PM = {};
  let switch2PM = {};

  beforeAll(async () => {
    let data = await fs.readFile(path.join('src', 'mock', 'shellyplus2pm-5443b23d81f8.roller.json'), 'utf8');
    roller2PM = JSON.parse(data);
    data = await fs.readFile(path.join('src', 'mock', 'shellyplus2pm-5443b23d81f8.switch.json'), 'utf8');
    switch2PM = JSON.parse(data);
  });

  test('Deep equal', () => {
    expect(deepEqual(obj1, obj2)).toBeTruthy();
  });

  test('Deep copy', () => {
    const copy = deepCopy(obj1);
    expect(deepEqual(obj1, copy)).toBeTruthy();
  });

  test('Deep equal false', async () => {
    expect(deepEqual(roller2PM, switch2PM)).toBeFalsy();
  });

  test('Deep equal true', () => {
    expect(deepEqual(switch2PM, switch2PM)).toBeTruthy();
  });

  test('Deep copy switch2PM', () => {
    const copy = deepCopy(switch2PM);
    expect(deepEqual(switch2PM, copy)).toBeTruthy();
  });

  test('Deep copy roller2PM', () => {
    const copy = deepCopy(roller2PM);
    expect(deepEqual(roller2PM, copy)).toBeTruthy();
  });

  test('Deep copy switch2PM changed', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const copy: any = deepCopy(switch2PM);
    copy.status.ws.connected = true;
    expect(deepEqual(switch2PM, copy)).toBeFalsy();
  });

  test('Deep copy equal bridge-info', async () => {
    const data = await fs.readFile(path.join('src', 'mock', 'bridge-info.json'), 'utf8');
    const bridgeInfo = JSON.parse(data);
    const copy = deepCopy(bridgeInfo);
    expect(deepEqual(bridgeInfo, copy)).toBeTruthy();
  });

  test('Deep equal bridge-info', async () => {
    const data = await fs.readFile(path.join('src', 'mock', 'bridge-info.json'), 'utf8');
    const bridgeInfo = JSON.parse(data);
    const copy = deepCopy(bridgeInfo);
    copy.version = '1.0.0';
    expect(deepEqual(bridgeInfo, copy)).toBeFalsy();
  });

  test('Deep copy equal bridge-devices', async () => {
    const data = await fs.readFile(path.join('src', 'mock', 'bridge-devices.json'), 'utf8');
    const bridgeDevices = JSON.parse(data);
    const copy = deepCopy(bridgeDevices);
    expect(deepEqual(bridgeDevices, copy)).toBeTruthy();
  });

  test('Deep copy equal bridge-groups', async () => {
    const data = await fs.readFile(path.join('src', 'mock', 'bridge-groups.json'), 'utf8');
    const bridgeGroups = JSON.parse(data);
    const copy = deepCopy(bridgeGroups);
    expect(deepEqual(bridgeGroups, copy)).toBeTruthy();
  });

  test('Address ipv4', () => {
    expect(getIpv4InterfaceAddress()).not.toBe('192.168.1.000');
  });

  test('Address ipv6', () => {
    expect(getIpv6InterfaceAddress()).not.toBe('fd78::4939:746:d555:85a9:74f6:9c6');
  });

  test('Log interfaces', () => {
    expect(logInterfaces()).not.toBe('fd78::4939:746:d555:85a9:74f6:9c6');
  });

  test('Is valid ipv4 address', () => {
    expect(isValidIpv4Address('192.168.1.1')).toBeTruthy();
    expect(isValidIpv4Address('192.168.1.0001')).toBeFalsy();
    expect(isValidIpv4Address('192a.168.1.1')).toBeFalsy();
    expect(isValidIpv4Address('256.256.256.256')).toBeFalsy();
    expect(isValidIpv4Address('192.168.1.1.1')).toBeFalsy();
    expect(isValidIpv4Address('192.168.1')).toBeFalsy();
    expect(isValidIpv4Address('abc.def.ghi.jkl')).toBeFalsy();
  });

  test('Waiter for true condition', async () => {
    expect(
      await waiter(
        'Test with jest',
        () => {
          return true;
        },
        false,
        500,
        100,
      ),
    ).toBe(true);
  }, 5000);

  test('Waiter for false condition', async () => {
    expect(
      await waiter(
        'Test with jest',
        () => {
          return false;
        },
        false,
        500,
        100,
      ),
    ).toBe(false);
  }, 5000);

  test('Wait function', async () => {
    expect(await wait(500, 'Test with jest')).toBeUndefined();
  }, 5000);
});
