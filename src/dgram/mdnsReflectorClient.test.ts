/**
 * @description MdnsReflectorClient unit tests
 * @file mdnsReflectorClient.test.ts
 * @author Luca Liguori
 * @created 2025-12-26
 * @version 1.0.0
 * @license Apache-2.0
 * @copyright 2025, 2026, 2027 Luca Liguori.
 */

import EventEmitter from 'node:events';

import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';

import { setupTest } from '../jestutils/jestHelpers.js';

import { MdnsReflectorClient } from './mdnsReflectorClient.js';

jest.mock('node:dgram');

// Setup the test environment
await setupTest('MdnsReflectorClient', false);

describe('MdnsReflectorClient', () => {
  class FakeEndpoint extends EventEmitter {
    start = jest.fn(() => {
      setImmediate(() => this.emit('bound', { family: 'IPv4', address: '0.0.0.0', port: 1 }));
    });
    stop = jest.fn(() => {
      setImmediate(() => this.emit('close'));
    });
    send = jest.fn();
    socket = {
      setMulticastLoopback: jest.fn(),
    };
  }

  const buildMdnsHeader = (flags: number) => {
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0, 0); // id must be 0 for mDNS
    header.writeUInt16BE(flags, 2);
    header.writeUInt16BE(0, 4);
    header.writeUInt16BE(0, 6);
    header.writeUInt16BE(0, 8);
    header.writeUInt16BE(0, 10);
    return header;
  };

  const mdnsQuery = () => buildMdnsHeader(0x0000);
  const mdnsResponse = () => buildMdnsHeader(0x8000);
  const notMdns = () => {
    const header = Buffer.alloc(12);
    header.writeUInt16BE(1, 0); // non-zero id => not mDNS
    header.writeUInt16BE(0x0000, 2);
    return header;
  };
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('constructor should apply --filter values and set log levels for default/debug/silent', () => {
    const argvBefore = [...process.argv];

    try {
      // Default: no debug/verbose/silent -> endpoint logs should be WARN.
      process.argv = ['node', 'test'];
      const c1 = new MdnsReflectorClient();
      expect((c1 as any).mdnsIpv4.log.logLevel).toBe(LogLevel.WARN);
      expect((c1 as any).mdnsIpv6.log.logLevel).toBe(LogLevel.WARN);

      // Debug: should set main log level to DEBUG.
      process.argv = ['node', 'test', '--debug'];
      const c2 = new MdnsReflectorClient();
      expect((c2 as any).log.logLevel).toBe(LogLevel.DEBUG);

      // Silent: should set main log level to NOTICE.
      process.argv = ['node', 'test', '--silent'];
      const c3 = new MdnsReflectorClient();
      expect((c3 as any).log.logLevel).toBe(LogLevel.NOTICE);

      // Filters: should be applied to both mdns instances.
      process.argv = ['node', 'test', '--filter', 'foo', 'bar'];
      const c4 = new MdnsReflectorClient();
      expect((c4 as any).mdnsIpv4.filters).toEqual(expect.arrayContaining(['foo', 'bar']));
      expect((c4 as any).mdnsIpv6.filters).toEqual(expect.arrayContaining(['foo', 'bar']));
    } finally {
      process.argv = argvBefore;
    }
  });

  it('start/stop should bind and close all sockets', async () => {
    const client = new MdnsReflectorClient();

    const mdnsIpv4 = new FakeEndpoint();
    const mdnsIpv6 = new FakeEndpoint();
    const unicastIpv4 = new FakeEndpoint();
    const unicastIpv6 = new FakeEndpoint();

    (client as any).mdnsIpv4 = mdnsIpv4;
    (client as any).mdnsIpv6 = mdnsIpv6;
    (client as any).unicastIpv4 = unicastIpv4;
    (client as any).unicastIpv6 = unicastIpv6;

    const rmMdns4 = jest.spyOn(mdnsIpv4, 'removeAllListeners');
    const rmMdns6 = jest.spyOn(mdnsIpv6, 'removeAllListeners');
    const rmUni4 = jest.spyOn(unicastIpv4, 'removeAllListeners');
    const rmUni6 = jest.spyOn(unicastIpv6, 'removeAllListeners');

    await client.start();

    expect(mdnsIpv4.start).toHaveBeenCalledTimes(1);
    expect(mdnsIpv6.start).toHaveBeenCalledTimes(1);
    expect(unicastIpv4.start).toHaveBeenCalledTimes(1);
    expect(unicastIpv6.start).toHaveBeenCalledTimes(1);

    await client.stop();

    expect(mdnsIpv4.stop).toHaveBeenCalledTimes(1);
    expect(mdnsIpv6.stop).toHaveBeenCalledTimes(1);
    expect(unicastIpv4.stop).toHaveBeenCalledTimes(1);
    expect(unicastIpv6.stop).toHaveBeenCalledTimes(1);

    expect(rmMdns4).toHaveBeenCalled();
    expect(rmMdns6).toHaveBeenCalled();
    expect(rmUni4).toHaveBeenCalled();
    expect(rmUni6).toHaveBeenCalled();
  });

  it('start should forward ipv4 multicast message to reflector host and localhost', async () => {
    const client = new MdnsReflectorClient();

    const mdnsIpv4 = new FakeEndpoint();
    const mdnsIpv6 = new FakeEndpoint();
    const unicastIpv4 = new FakeEndpoint();
    const unicastIpv6 = new FakeEndpoint();

    (client as any).mdnsIpv4 = mdnsIpv4;
    (client as any).mdnsIpv6 = mdnsIpv6;
    (client as any).unicastIpv4 = unicastIpv4;
    (client as any).unicastIpv6 = unicastIpv6;

    await client.start();

    const payload = mdnsQuery();
    (mdnsIpv4 as any).emit('message', payload, { family: 'IPv4', address: '224.0.0.251', port: 5353, size: payload.length });

    expect(unicastIpv4.send).toHaveBeenCalledWith(payload, 'host.docker.internal', 15353);
    expect(unicastIpv4.send).toHaveBeenCalledWith(payload, 'localhost', 15353);

    await client.stop();
  });

  it('start should forward ipv4 multicast response message to reflector host and localhost', async () => {
    const client = new MdnsReflectorClient();

    const mdnsIpv4 = new FakeEndpoint();
    const mdnsIpv6 = new FakeEndpoint();
    const unicastIpv4 = new FakeEndpoint();
    const unicastIpv6 = new FakeEndpoint();

    (client as any).mdnsIpv4 = mdnsIpv4;
    (client as any).mdnsIpv6 = mdnsIpv6;
    (client as any).unicastIpv4 = unicastIpv4;
    (client as any).unicastIpv6 = unicastIpv6;

    await client.start();

    const payload = mdnsResponse();
    (mdnsIpv4 as any).emit('message', payload, { family: 'IPv4', address: '224.0.0.251', port: 5353, size: payload.length });

    expect(unicastIpv4.send).toHaveBeenCalledWith(payload, 'host.docker.internal', 15353);
    expect(unicastIpv4.send).toHaveBeenCalledWith(payload, 'localhost', 15353);

    await client.stop();
  });

  it('start should forward ipv6 multicast message to reflector host and localhost', async () => {
    const client = new MdnsReflectorClient();

    const mdnsIpv4 = new FakeEndpoint();
    const mdnsIpv6 = new FakeEndpoint();
    const unicastIpv4 = new FakeEndpoint();
    const unicastIpv6 = new FakeEndpoint();

    (client as any).mdnsIpv4 = mdnsIpv4;
    (client as any).mdnsIpv6 = mdnsIpv6;
    (client as any).unicastIpv4 = unicastIpv4;
    (client as any).unicastIpv6 = unicastIpv6;

    await client.start();

    const payload = mdnsQuery();
    (mdnsIpv6 as any).emit('message', payload, { family: 'IPv6', address: 'ff02::fb', port: 5353, size: payload.length });

    expect(unicastIpv6.send).toHaveBeenCalledWith(payload, 'host.docker.internal', 15353);
    expect(unicastIpv6.send).toHaveBeenCalledWith(payload, 'localhost', 15353);

    await client.stop();
  });

  it('start should forward ipv6 multicast response message to reflector host and localhost', async () => {
    const client = new MdnsReflectorClient();

    const mdnsIpv4 = new FakeEndpoint();
    const mdnsIpv6 = new FakeEndpoint();
    const unicastIpv4 = new FakeEndpoint();
    const unicastIpv6 = new FakeEndpoint();

    (client as any).mdnsIpv4 = mdnsIpv4;
    (client as any).mdnsIpv6 = mdnsIpv6;
    (client as any).unicastIpv4 = unicastIpv4;
    (client as any).unicastIpv6 = unicastIpv6;

    await client.start();

    const payload = mdnsResponse();
    (mdnsIpv6 as any).emit('message', payload, { family: 'IPv6', address: 'ff02::fb', port: 5353, size: payload.length });

    expect(unicastIpv6.send).toHaveBeenCalledWith(payload, 'host.docker.internal', 15353);
    expect(unicastIpv6.send).toHaveBeenCalledWith(payload, 'localhost', 15353);

    await client.stop();
  });

  it('should ignore recently reflected multicast message (loop prevention cache)', async () => {
    const argvBefore = [...process.argv];
    // Ensure localhost is NOT set; we only care about suppression.
    process.argv = ['node', 'test'];

    try {
      const client = new MdnsReflectorClient();

      const mdnsIpv4 = new FakeEndpoint();
      const mdnsIpv6 = new FakeEndpoint();
      const unicastIpv4 = new FakeEndpoint();
      const unicastIpv6 = new FakeEndpoint();

      (client as any).mdnsIpv4 = mdnsIpv4;
      (client as any).mdnsIpv6 = mdnsIpv6;
      (client as any).unicastIpv4 = unicastIpv4;
      (client as any).unicastIpv6 = unicastIpv6;

      await client.start();

      // First: message comes from reflector server (unicast) and gets remembered.
      const payload = mdnsResponse();
      (unicastIpv4 as any).emit('message', payload, { family: 'IPv4', address: '127.0.0.1', port: 15353, size: payload.length });
      expect(mdnsIpv4.send).toHaveBeenCalledWith(payload, '224.0.0.251', 5353);

      // Then: the same payload appears on multicast; it should be suppressed (not forwarded to reflector).
      (mdnsIpv4 as any).emit('message', payload, { family: 'IPv4', address: '224.0.0.251', port: 5353, size: payload.length });
      expect(unicastIpv4.send).not.toHaveBeenCalledWith(payload, 'host.docker.internal', 15353);
      expect(unicastIpv4.send).not.toHaveBeenCalledWith(payload, 'localhost', 15353);

      await client.stop();
    } finally {
      process.argv = argvBefore;
    }
  });

  it('should ignore recently reflected multicast query message (loop prevention cache, ipv4)', async () => {
    const argvBefore = [...process.argv];
    process.argv = ['node', 'test'];

    try {
      const client = new MdnsReflectorClient();

      const mdnsIpv4 = new FakeEndpoint();
      const mdnsIpv6 = new FakeEndpoint();
      const unicastIpv4 = new FakeEndpoint();
      const unicastIpv6 = new FakeEndpoint();

      (client as any).mdnsIpv4 = mdnsIpv4;
      (client as any).mdnsIpv6 = mdnsIpv6;
      (client as any).unicastIpv4 = unicastIpv4;
      (client as any).unicastIpv6 = unicastIpv6;

      await client.start();

      const payload = mdnsQuery();
      (unicastIpv4 as any).emit('message', payload, { family: 'IPv4', address: '127.0.0.1', port: 15353, size: payload.length });
      expect(mdnsIpv4.send).toHaveBeenCalledWith(payload, '224.0.0.251', 5353);

      (mdnsIpv4 as any).emit('message', payload, { family: 'IPv4', address: '224.0.0.251', port: 5353, size: payload.length });
      expect(unicastIpv4.send).not.toHaveBeenCalledWith(payload, 'host.docker.internal', 15353);
      expect(unicastIpv4.send).not.toHaveBeenCalledWith(payload, 'localhost', 15353);

      await client.stop();
    } finally {
      process.argv = argvBefore;
    }
  });

  it('should ignore recently reflected multicast message on ipv6 (loop prevention cache)', async () => {
    const argvBefore = [...process.argv];
    process.argv = ['node', 'test'];

    try {
      const client = new MdnsReflectorClient();

      const mdnsIpv4 = new FakeEndpoint();
      const mdnsIpv6 = new FakeEndpoint();
      const unicastIpv4 = new FakeEndpoint();
      const unicastIpv6 = new FakeEndpoint();

      (client as any).mdnsIpv4 = mdnsIpv4;
      (client as any).mdnsIpv6 = mdnsIpv6;
      (client as any).unicastIpv4 = unicastIpv4;
      (client as any).unicastIpv6 = unicastIpv6;

      await client.start();

      const payload = mdnsResponse();
      (unicastIpv6 as any).emit('message', payload, { family: 'IPv6', address: '::1', port: 15353, size: payload.length });
      expect(mdnsIpv6.send).toHaveBeenCalledWith(payload, 'ff02::fb', 5353);

      (mdnsIpv6 as any).emit('message', payload, { family: 'IPv6', address: 'ff02::fb', port: 5353, size: payload.length });
      expect(unicastIpv6.send).not.toHaveBeenCalledWith(payload, 'host.docker.internal', 15353);
      expect(unicastIpv6.send).not.toHaveBeenCalledWith(payload, 'localhost', 15353);

      await client.stop();
    } finally {
      process.argv = argvBefore;
    }
  });

  it('should ignore recently reflected multicast query message on ipv6 (loop prevention cache)', async () => {
    const argvBefore = [...process.argv];
    process.argv = ['node', 'test'];

    try {
      const client = new MdnsReflectorClient();

      const mdnsIpv4 = new FakeEndpoint();
      const mdnsIpv6 = new FakeEndpoint();
      const unicastIpv4 = new FakeEndpoint();
      const unicastIpv6 = new FakeEndpoint();

      (client as any).mdnsIpv4 = mdnsIpv4;
      (client as any).mdnsIpv6 = mdnsIpv6;
      (client as any).unicastIpv4 = unicastIpv4;
      (client as any).unicastIpv6 = unicastIpv6;

      await client.start();

      const payload = mdnsQuery();
      (unicastIpv6 as any).emit('message', payload, { family: 'IPv6', address: '::1', port: 15353, size: payload.length });
      expect(mdnsIpv6.send).toHaveBeenCalledWith(payload, 'ff02::fb', 5353);

      (mdnsIpv6 as any).emit('message', payload, { family: 'IPv6', address: 'ff02::fb', port: 5353, size: payload.length });
      expect(unicastIpv6.send).not.toHaveBeenCalledWith(payload, 'host.docker.internal', 15353);
      expect(unicastIpv6.send).not.toHaveBeenCalledWith(payload, 'localhost', 15353);

      await client.stop();
    } finally {
      process.argv = argvBefore;
    }
  });

  it('should reflect unicast mdns to multicast and optionally localhost when --localhost is set', async () => {
    const argvBefore = [...process.argv];
    if (!process.argv.includes('--localhost')) process.argv.push('--localhost');

    try {
      const client = new MdnsReflectorClient();

      const mdnsIpv4 = new FakeEndpoint();
      const mdnsIpv6 = new FakeEndpoint();
      const unicastIpv4 = new FakeEndpoint();
      const unicastIpv6 = new FakeEndpoint();

      (client as any).mdnsIpv4 = mdnsIpv4;
      (client as any).mdnsIpv6 = mdnsIpv6;
      (client as any).unicastIpv4 = unicastIpv4;
      (client as any).unicastIpv6 = unicastIpv6;

      await client.start();

      const payload = mdnsQuery();
      (unicastIpv4 as any).emit('message', payload, { family: 'IPv4', address: '127.0.0.1', port: 15353, size: payload.length });
      expect(mdnsIpv4.send).toHaveBeenCalledWith(payload, '224.0.0.251', 5353);
      expect(mdnsIpv4.send).toHaveBeenCalledWith(payload, 'localhost', 5353);

      (unicastIpv6 as any).emit('message', payload, { family: 'IPv6', address: '::1', port: 15353, size: payload.length });
      expect(mdnsIpv6.send).toHaveBeenCalledWith(payload, 'ff02::fb', 5353);
      expect(mdnsIpv6.send).toHaveBeenCalledWith(payload, 'localhost', 5353);

      await client.stop();
    } finally {
      process.argv = argvBefore;
    }
  });

  it('should reflect unicast mdns response to multicast and localhost when --localhost is set', async () => {
    const argvBefore = [...process.argv];
    if (!process.argv.includes('--localhost')) process.argv.push('--localhost');

    try {
      const client = new MdnsReflectorClient();

      const mdnsIpv4 = new FakeEndpoint();
      const mdnsIpv6 = new FakeEndpoint();
      const unicastIpv4 = new FakeEndpoint();
      const unicastIpv6 = new FakeEndpoint();

      (client as any).mdnsIpv4 = mdnsIpv4;
      (client as any).mdnsIpv6 = mdnsIpv6;
      (client as any).unicastIpv4 = unicastIpv4;
      (client as any).unicastIpv6 = unicastIpv6;

      await client.start();

      const payload = mdnsResponse();
      (unicastIpv4 as any).emit('message', payload, { family: 'IPv4', address: '127.0.0.1', port: 15353, size: payload.length });
      expect(mdnsIpv4.send).toHaveBeenCalledWith(payload, '224.0.0.251', 5353);
      expect(mdnsIpv4.send).toHaveBeenCalledWith(payload, 'localhost', 5353);

      (unicastIpv6 as any).emit('message', payload, { family: 'IPv6', address: '::1', port: 15353, size: payload.length });
      expect(mdnsIpv6.send).toHaveBeenCalledWith(payload, 'ff02::fb', 5353);
      expect(mdnsIpv6.send).toHaveBeenCalledWith(payload, 'localhost', 5353);

      await client.stop();
    } finally {
      process.argv = argvBefore;
    }
  });

  it('start should attach error handlers for all sockets', async () => {
    const client = new MdnsReflectorClient();

    const mdnsIpv4 = new FakeEndpoint();
    const mdnsIpv6 = new FakeEndpoint();
    const unicastIpv4 = new FakeEndpoint();
    const unicastIpv6 = new FakeEndpoint();

    (client as any).mdnsIpv4 = mdnsIpv4;
    (client as any).mdnsIpv6 = mdnsIpv6;
    (client as any).unicastIpv4 = unicastIpv4;
    (client as any).unicastIpv6 = unicastIpv6;

    const errorSpy = jest.spyOn((client as any).log, 'error');
    await client.start();

    const err = new Error('fail');
    err.stack = 'STACK';
    (mdnsIpv4 as any).emit('error', err);
    (mdnsIpv6 as any).emit('error', err);
    (unicastIpv4 as any).emit('error', err);
    (unicastIpv6 as any).emit('error', err);

    expect(errorSpy).toHaveBeenCalled();
    await client.stop();
  });

  it('start should log received replies from ipv4/ipv6 reflector sockets', async () => {
    const client = new MdnsReflectorClient();

    const mdnsIpv4 = new FakeEndpoint();
    const mdnsIpv6 = new FakeEndpoint();
    const unicastIpv4 = new FakeEndpoint();
    const unicastIpv6 = new FakeEndpoint();

    (client as any).mdnsIpv4 = mdnsIpv4;
    (client as any).mdnsIpv6 = mdnsIpv6;
    (client as any).unicastIpv4 = unicastIpv4;
    (client as any).unicastIpv6 = unicastIpv6;

    const infoSpy = jest.spyOn((client as any).log, 'info');
    await client.start();

    (unicastIpv4 as any).emit('message', Buffer.from('ok4'), { family: 'IPv4', address: '127.0.0.1', port: 15353, size: 3 });
    (unicastIpv6 as any).emit('message', Buffer.from('ok6'), { family: 'IPv6', address: '::1', port: 15353, size: 3 });

    expect(infoSpy).toHaveBeenCalled();
    await client.stop();
  });

  it('helper methods should manage TTL cache correctly', () => {
    const client = new MdnsReflectorClient();
    const cache = new Map<string, number>();

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);

    const key = client.fingerprint(Buffer.from('abc'));
    expect(key).toHaveLength(40);

    expect(client.seenRecently(cache, key)).toBe(false);
    client.remember(cache, key, 10);
    expect(client.seenRecently(cache, key)).toBe(true);

    // Expire
    nowSpy.mockReturnValue(2000);
    expect(client.seenRecently(cache, key)).toBe(false);

    // Prune should remove expired entries
    cache.set('expired', 1500);
    client.prune(cache);
    expect(cache.has('expired')).toBe(false);

    nowSpy.mockRestore();
  });

  it('fingerprint should be deterministic and sensitive to input', () => {
    const client = new MdnsReflectorClient();

    const a1 = client.fingerprint(Buffer.from('abc'));
    const a2 = client.fingerprint(Buffer.from('abc'));
    const b = client.fingerprint(Buffer.from('abcd'));

    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).toHaveLength(40);
  });

  it('remember should overwrite TTL for same key', () => {
    const client = new MdnsReflectorClient();
    const cache = new Map<string, number>();
    const key = client.fingerprint(Buffer.from('k'));

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);

    client.remember(cache, key, 10);
    expect(cache.get(key)).toBe(1010);

    client.remember(cache, key, 50);
    expect(cache.get(key)).toBe(1050);

    nowSpy.mockRestore();
  });

  it('seenRecently should delete expired key and keep valid key', () => {
    const client = new MdnsReflectorClient();
    const cache = new Map<string, number>();
    const keyExpired = client.fingerprint(Buffer.from('expired'));
    const keyValid = client.fingerprint(Buffer.from('valid'));

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(2000);

    cache.set(keyExpired, 1500);
    cache.set(keyValid, 2500);

    expect(client.seenRecently(cache, keyExpired)).toBe(false);
    expect(cache.has(keyExpired)).toBe(false);

    expect(client.seenRecently(cache, keyValid)).toBe(true);
    expect(cache.has(keyValid)).toBe(true);

    nowSpy.mockRestore();
  });

  it('prune should not remove non-expired entries', () => {
    const client = new MdnsReflectorClient();
    const cache = new Map<string, number>();
    const k1 = client.fingerprint(Buffer.from('k1'));
    const k2 = client.fingerprint(Buffer.from('k2'));

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);

    cache.set(k1, 999); // expired
    cache.set(k2, 2000); // valid
    client.prune(cache);

    expect(cache.has(k1)).toBe(false);
    expect(cache.has(k2)).toBe(true);

    nowSpy.mockRestore();
  });

  it('cache suppression should stop after TTL expiry (behavior)', async () => {
    const argvBefore = [...process.argv];
    process.argv = ['node', 'test'];

    const nowSpy = jest.spyOn(Date, 'now');

    try {
      const client = new MdnsReflectorClient();
      const mdnsIpv4 = new FakeEndpoint();
      const mdnsIpv6 = new FakeEndpoint();
      const unicastIpv4 = new FakeEndpoint();
      const unicastIpv6 = new FakeEndpoint();

      (client as any).mdnsIpv4 = mdnsIpv4;
      (client as any).mdnsIpv6 = mdnsIpv6;
      (client as any).unicastIpv4 = unicastIpv4;
      (client as any).unicastIpv6 = unicastIpv6;

      // Use a small TTL to make the test explicit.
      (client as any).TTL_MS = 10;

      await client.start();

      // Remember at t=1000
      nowSpy.mockReturnValue(1000);
      const payload = mdnsResponse();
      (unicastIpv4 as any).emit('message', payload, { family: 'IPv4', address: '127.0.0.1', port: 15353, size: payload.length });
      expect(mdnsIpv4.send).toHaveBeenCalledWith(payload, '224.0.0.251', 5353);

      // Still within TTL => suppressed
      nowSpy.mockReturnValue(1005);
      (mdnsIpv4 as any).emit('message', payload, { family: 'IPv4', address: '224.0.0.251', port: 5353, size: payload.length });
      expect(unicastIpv4.send).not.toHaveBeenCalledWith(payload, 'host.docker.internal', 15353);
      expect(unicastIpv4.send).not.toHaveBeenCalledWith(payload, 'localhost', 15353);

      // After TTL => should forward again
      nowSpy.mockReturnValue(2000);
      (mdnsIpv4 as any).emit('message', payload, { family: 'IPv4', address: '224.0.0.251', port: 5353, size: payload.length });
      expect(unicastIpv4.send).toHaveBeenCalledWith(payload, 'host.docker.internal', 15353);
      expect(unicastIpv4.send).toHaveBeenCalledWith(payload, 'localhost', 15353);

      await client.stop();
    } finally {
      nowSpy.mockRestore();
      process.argv = argvBefore;
    }
  });
});
