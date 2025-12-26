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

import { setupTest } from '../jestutils/jestHelpers.js';

import { MdnsReflectorClient } from './mdnsReflectorClient.js';

process.argv.push('--verbose');

jest.mock('node:dgram');

// Setup the test environment
await setupTest('MdnsReflectorClient', false);

describe('MdnsReflectorClient', () => {
  class FakeEndpoint extends EventEmitter {
    start = jest.fn(() => {
      setImmediate(() => this.emit('bound', { family: 'IPv4', address: '0.0.0.0', port: 1 }));
    });
    stop = jest.fn(() => {
      setImmediate(() => this.emit('closed'));
    });
    send = jest.fn();
    log = { error: jest.fn() };
  }

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

    const payload = Buffer.from([1, 2, 3]);
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

    const payload = Buffer.from([9, 8, 7]);
    (mdnsIpv6 as any).emit('message', payload, { family: 'IPv6', address: 'ff02::fb', port: 5353, size: payload.length });

    expect(unicastIpv6.send).toHaveBeenCalledWith(payload, 'host.docker.internal', 15353);
    expect(unicastIpv6.send).toHaveBeenCalledWith(payload, 'localhost', 15353);

    await client.stop();
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

    const noticeSpy = jest.spyOn((client as any).log, 'notice');
    await client.start();

    (unicastIpv4 as any).emit('message', Buffer.from('ok4'), { family: 'IPv4', address: '127.0.0.1', port: 15353, size: 3 });
    (unicastIpv6 as any).emit('message', Buffer.from('ok6'), { family: 'IPv6', address: '::1', port: 15353, size: 3 });

    expect(noticeSpy).toHaveBeenCalled();
    await client.stop();
  });
});
