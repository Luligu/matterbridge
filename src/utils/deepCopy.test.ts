// src\utils\deepCopy.test.ts

import { deepCopy } from './deepCopy.ts';

describe('deepCopy', () => {
  // Primitives
  test('copies primitives unchanged', () => {
    expect(deepCopy(42)).toBe(42);
    expect(deepCopy('hello')).toBe('hello');
    expect(deepCopy(true)).toBe(true);
    expect(deepCopy(null)).toBeNull();
    expect(deepCopy(undefined)).toBeUndefined();
  });

  // Arrays
  test('deep copies arrays', () => {
    const arr = [1, [2, 3], { a: 4 }];
    const copy = deepCopy(arr);
    expect(copy).toEqual(arr);
    // Mutating copy does not affect original
    (copy[1] as number[])[0] = 99;
    expect((arr[1] as number[])[0]).toBe(2);
  });

  // Objects
  test('deep copies plain objects', () => {
    const obj = { x: 1, y: { z: 2 } };
    const copy = deepCopy(obj);
    expect(copy).toEqual(obj);
    copy.y.z = 99;
    expect(obj.y.z).toBe(2);
  });

  // Date
  test('deep copies Date instances', () => {
    const date = new Date('2020-01-01T12:00:00.000Z'); // Midday UTC
    expect(date instanceof Date).toBe(true);
    const copy = deepCopy(date);
    expect(copy instanceof Date).toBe(true);
    expect(copy).toEqual(date);
    expect(copy).not.toBe(date);
    // Changing original does not change copy
    date.setFullYear(1999);
    expect(copy.getFullYear()).toBe(2020);
  });

  // RegExp
  test('deep copies RegExp instances', () => {
    const regex = /abc/gi;
    const copy = deepCopy(regex);
    expect(copy).toEqual(regex);
    expect(copy).not.toBe(regex);
  });

  // Map
  test('deep copies Map instances', () => {
    const map = new Map<string, any>([
      ['a', 1],
      ['b', { nested: 2 }],
    ]);
    const copy = deepCopy(map);
    expect(copy).toEqual(map);
    expect(copy).not.toBe(map);
    // Mutate nested value
    (copy.get('b') as any).nested = 99;
    expect((map.get('b') as any).nested).toBe(2);
  });

  test('deep copies Map keys and values when keys are objects', () => {
    const key = { x: 1 };
    const map = new Map<any, string>([[key, 'value']]);
    const copy = deepCopy(map);
    // Extract the only key in the copied map
    const [copyKey] = copy.keys();
    expect(copyKey).not.toBe(key);
    expect(copy.get(copyKey)).toBe('value');
    expect(copy.has(key)).toBe(false);
  });

  // Set
  test('deep copies Set instances', () => {
    const set = new Set<any>([1, { x: 2 }]);
    const copy = deepCopy(set);
    expect(copy).toEqual(set);
    expect(copy).not.toBe(set);
    // Mutate an object inside set
    const originalObj = Array.from(set)[1] as any;
    const copiedObj = Array.from(copy)[1] as any;
    copiedObj.x = 99;
    expect(originalObj.x).toBe(2);
  });

  // Object with custom prototype
  test('copies objects preserving prototype', () => {
    class Foo {
      value: number;
      constructor(v: number) {
        this.value = v;
      }
      method() {
        return this.value;
      }
    }
    const instance = new Foo(5);
    const copy = deepCopy(instance);
    expect(copy).toBeInstanceOf(Foo);
    expect(copy.method()).toBe(5);
    // Changing copy does not affect original
    copy.value = 10;
    expect(instance.value).toBe(5);
  });

  // Nested combinations
  test('deep copies nested combinations', () => {
    const complex = {
      arr: [new Date('2021-01-01'), new Map([['k', [1, 2]]])],
      set: new Set([{ foo: 'bar' }]),
      obj: { inner: new Set([new Date(0)]) },
    };
    const copy = deepCopy(complex);
    expect(copy).toEqual(complex);
    // Mutate deep nested
    (copy.arr[1] as Map<string, any>).get('k')[0] = 99;
    expect((complex.arr[1] as Map<string, any>).get('k')[0]).toBe(1);
  });
});
