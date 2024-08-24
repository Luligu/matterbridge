import {
  deepEqual,
  deepCopy,
  getIpv4InterfaceAddress,
  getIpv6InterfaceAddress,
  logInterfaces,
  isValidIpv4Address,
  waiter,
  wait,
  getMacAddress,
  isValidNumber,
  isValidBoolean,
  isValidString,
  isValidObject,
  isValidArray,
  isValidNull,
  isValidUndefined,
  createZip,
} from './utils';
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

  test('copies primitive values', () => {
    expect(deepCopy(42)).toBe(42);
    expect(deepCopy('string')).toBe('string');
    expect(deepCopy(true)).toBe(true);
    expect(deepCopy(undefined)).toBe(undefined);
    expect(deepCopy(null)).toBe(null);
    const symbol = Symbol('sym');
    expect(deepCopy(symbol)).toBe(symbol);
  });

  test('copies arrays', () => {
    const arr = [1, 'two', [3, 4], { five: 6 }];
    const copiedArr = deepCopy(arr);
    expect(copiedArr).toEqual(arr);
    expect(copiedArr).not.toBe(arr);
    expect(copiedArr[2]).not.toBe(arr[2]);
    expect(copiedArr[3]).not.toBe(arr[3]);
  });

  test('copies Date objects', () => {
    const date = new Date();
    const copiedDate = deepCopy(date);
    expect(copiedDate).toEqual(date);
    expect(copiedDate).not.toBe(date);
  });

  test('copies Map objects', () => {
    const map = new Map([
      [1, 'one'],
      [2, 'two'],
    ]);
    const copiedMap = deepCopy(map);
    expect(copiedMap).toEqual(map);
    expect(copiedMap).not.toBe(map);
  });

  test('copies Set objects', () => {
    const set = new Set([1, 'two', { three: 4 }]);
    const copiedSet = deepCopy(set);
    expect(copiedSet).toEqual(set);
    expect(copiedSet).not.toBe(set);
  });

  test('copies generic objects', () => {
    const obj = {
      num: 1,
      str: 'string',
      arr: [2, 3],
      obj: { nested: true },
      date: new Date(),
      map: new Map([[1, 'one']]),
      set: new Set([1, 2, 3]),
    };
    const copiedObj = deepCopy(obj);
    expect(copiedObj).toEqual(obj);
    expect(copiedObj).not.toBe(obj);
    expect(copiedObj.arr).not.toBe(obj.arr);
    expect(copiedObj.obj).not.toBe(obj.obj);
    expect(copiedObj.date).not.toBe(obj.date);
    expect(copiedObj.map).not.toBe(obj.map);
    expect(copiedObj.set).not.toBe(obj.set);
  });

  test('Address ipv4', () => {
    expect(getIpv4InterfaceAddress()).not.toBe('192.168.1.000');
    expect(getIpv4InterfaceAddress()).toBeDefined();
  });

  test('Address ipv6', () => {
    expect(getIpv6InterfaceAddress()).not.toBe('fd78::4939:746:d555:85a9:74f6:9c6');
    expect(getIpv6InterfaceAddress()).toBeDefined();
  });

  test('Address mac', () => {
    expect(getMacAddress()).not.toBe('');
    expect(getMacAddress()).toBeDefined();
  });

  test('Log interfaces', () => {
    expect(logInterfaces(false)).not.toBe('fd78::4939:746:d555:85a9:74f6:9c6');
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

  it('should validate number', () => {
    expect(isValidNumber(1222222)).toBe(true);
    expect(isValidNumber(NaN)).toBe(false);
    expect(isValidNumber(true)).toBe(false);
    expect(isValidNumber(false)).toBe(false);
    expect(isValidNumber(1212222222222222222111122222222n)).toBe(false);
    expect(isValidNumber('string')).toBe(false);
    expect(isValidNumber(null)).toBe(false);
    expect(isValidNumber(undefined)).toBe(false);
    expect(isValidNumber({ x: 1, y: 4 })).toBe(false);
    expect(isValidNumber([1, 4, 'string'])).toBe(false);
  });
  it('should validate number in range', () => {
    expect(isValidNumber(5, 0, 100)).toBe(true);
    expect(isValidNumber(-5, 0, 100)).toBe(false);
    expect(isValidNumber(5555, 0, 100)).toBe(false);
    expect(isValidNumber(5, -100, 100)).toBe(true);
    expect(isValidNumber(-50, -100, 100)).toBe(true);
    expect(isValidNumber(0, 0, 100)).toBe(true);
    expect(isValidNumber(100, 0, 100)).toBe(true);
    expect(isValidNumber(0, 0)).toBe(true);
    expect(isValidNumber(-1, 0)).toBe(false);
    expect(isValidNumber(123, 0)).toBe(true);
    expect(isValidNumber(100, 0, 100)).toBe(true);
  });

  it('should validate boolean', () => {
    expect(isValidBoolean(1222222)).toBe(false);
    expect(isValidBoolean(NaN)).toBe(false);
    expect(isValidBoolean(true)).toBe(true);
    expect(isValidBoolean(false)).toBe(true);
    expect(isValidBoolean(1212222222222222222111122222222n)).toBe(false);
    expect(isValidBoolean('string')).toBe(false);
    expect(isValidBoolean(null)).toBe(false);
    expect(isValidBoolean(undefined)).toBe(false);
    expect(isValidBoolean({ x: 1, y: 4 })).toBe(false);
    expect(isValidBoolean([1, 4, 'string'])).toBe(false);
  });

  it('should validate string', () => {
    expect(isValidString(1222222)).toBe(false);
    expect(isValidString(NaN)).toBe(false);
    expect(isValidString(true)).toBe(false);
    expect(isValidString(false)).toBe(false);
    expect(isValidString(1212222222222222222111122222222n)).toBe(false);
    expect(isValidString('string')).toBe(true);
    expect(isValidString('string', 1, 20)).toBe(true);
    expect(isValidString('string', 0)).toBe(true);
    expect(isValidString('string', 10)).toBe(false);
    expect(isValidString('', 1)).toBe(false);
    expect(isValidString('1234', 1, 3)).toBe(false);
    expect(isValidString(null)).toBe(false);
    expect(isValidString(undefined)).toBe(false);
    expect(isValidString({ x: 1, y: 4 })).toBe(false);
    expect(isValidString([1, 4, 'string'])).toBe(false);
  });

  it('should validate object', () => {
    expect(isValidObject(1222222)).toBe(false);
    expect(isValidObject(NaN)).toBe(false);
    expect(isValidObject(true)).toBe(false);
    expect(isValidObject(false)).toBe(false);
    expect(isValidObject(1212222222222222222111122222222n)).toBe(false);
    expect(isValidObject('string')).toBe(false);
    expect(isValidObject(null)).toBe(false);
    expect(isValidObject(undefined)).toBe(false);
    expect(isValidObject({ x: 1, y: 4 })).toBe(true);
    expect(isValidObject([1, 4, 'string'])).toBe(false);

    expect(isValidObject({ x: 1, y: 4 }, 1, 2)).toBe(true);
    expect(isValidObject({ x: 1, y: 4 }, 2, 2)).toBe(true);
    expect(isValidObject({ x: 1, y: 4 }, 2, 3)).toBe(true);
    expect(isValidObject({ x: 1, y: 4 }, 3, 3)).toBe(false);
    expect(isValidObject({ x: 1, y: 4 }, 1, 1)).toBe(false);
  });

  it('should validate array', () => {
    expect(isValidArray(1222222)).toBe(false);
    expect(isValidArray(NaN)).toBe(false);
    expect(isValidArray(true)).toBe(false);
    expect(isValidArray(false)).toBe(false);
    expect(isValidArray(1212222222222222222111122222222n)).toBe(false);
    expect(isValidArray('string')).toBe(false);
    expect(isValidArray(null)).toBe(false);
    expect(isValidArray(undefined)).toBe(false);
    expect(isValidArray({ x: 1, y: 4 })).toBe(false);
    expect(isValidArray([1, 4, 'string'])).toBe(true);

    expect(isValidArray([1, 4, 'string'], 3, 3)).toBe(true);
    expect(isValidArray([1, 4, 'string'], 4, 4)).toBe(false);
    expect(isValidArray([1, 4, 'string'], 1, 2)).toBe(false);
    expect(isValidArray([1, 4, 'string'], 0, 3)).toBe(true);
  });

  it('should validate null', () => {
    expect(isValidNull(1222222)).toBe(false);
    expect(isValidNull(NaN)).toBe(false);
    expect(isValidNull(true)).toBe(false);
    expect(isValidNull(false)).toBe(false);
    expect(isValidNull(1212222222222222222111122222222n)).toBe(false);
    expect(isValidNull('string')).toBe(false);
    expect(isValidNull(null)).toBe(true);
    expect(isValidNull(undefined)).toBe(false);
    expect(isValidNull({ x: 1, y: 4 })).toBe(false);
    expect(isValidNull([1, 4, 'string'])).toBe(false);
  });

  it('should validate undefined', () => {
    expect(isValidUndefined(1222222)).toBe(false);
    expect(isValidUndefined(NaN)).toBe(false);
    expect(isValidUndefined(true)).toBe(false);
    expect(isValidUndefined(false)).toBe(false);
    expect(isValidUndefined(1212222222222222222111122222222n)).toBe(false);
    expect(isValidUndefined('string')).toBe(false);
    expect(isValidUndefined(null)).toBe(false);
    expect(isValidUndefined(undefined)).toBe(true);
    expect(isValidUndefined({ x: 1, y: 4 })).toBe(false);
    expect(isValidUndefined([1, 4, 'string'])).toBe(false);
  });

  it('should zip a file', async () => {
    await fs.mkdir('test', { recursive: true });
    const size = await createZip(path.join('test', 'tsconfig.zip'), 'tsconfig.json');
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a fullpath file', async () => {
    const size = await createZip(path.join('test', 'fulltsconfig.zip'), path.resolve('tsconfig.json'));
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a directory', async () => {
    const size = await createZip(path.join('test', 'docker.zip'), 'docker');
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a fullpath directory', async () => {
    const size = await createZip(path.join('test', 'fulldocker.zip'), path.resolve('docker'));
    expect(size).toBeGreaterThan(0);
  });
  it('should zip a sub directory', async () => {
    const size = await createZip(path.join('test', 'utils.zip'), path.join('src', 'utils'));
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a fullpath sub directory', async () => {
    const size = await createZip(path.join('test', 'fullutils.zip'), path.resolve('src', 'utils'));
    expect(size).toBeGreaterThan(0);
  });

  it('should zip a glob', async () => {
    const size = await createZip(path.join('test', 'glob.zip'), path.join('*.js'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip a full glob path', async () => {
    const size = await createZip(path.join('test', 'fullglob.zip'), path.resolve('*.js'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip a glob with **', async () => {
    const size = await createZip(path.join('test', 'globstars.zip'), path.join('docker', '**', 'Dockerfile.*'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip a full glob path with **', async () => {
    const size = await createZip(path.join('test', 'fullglobstars.zip'), path.resolve('docker', '**', 'Dockerfile.*'));
    expect(size).toBeGreaterThan(0);
  }, 60000);

  it('should zip with an array', async () => {
    const size = await createZip(path.join('test', 'array.zip'), 'package.json', '*.js', path.join('src', 'utils'));
    expect(size).toBeGreaterThan(0);
  }, 60000);
});
