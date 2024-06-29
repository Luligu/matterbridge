import { deepEqual, deepCopy, getIpv4InterfaceAddress, getIpv6InterfaceAddress } from 'matterbridge';
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

  test('Address ipv4', () => {
    expect(getIpv4InterfaceAddress()).toBe('192.168.1.189');
  });

  test('Address ipv6', () => {
    expect(getIpv6InterfaceAddress()).toBe('fd78:cbf8:4939:746:d555:85a9:74f6:9c6');
  });
});
