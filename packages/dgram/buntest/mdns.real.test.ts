/**
 * @file packages/dgram/buntest/mdns.real.test.ts
 * @description Real-world mDNS test with two instances communicating with each other.
 * @author Luca Liguori
 */

import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'bun:test';
import type { RemoteInfo } from 'node:dgram';

import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { getMacAddress } from '@matterbridge/utils';

import { DnsClass, DnsRecordType, Mdns, type MdnsMessage } from '../src/mdns.js';
import { MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_PORT } from '../src/multicast.js';

// Setup the test environment
await setupTest('MdnsReal', false, ['--verbose']);

describe('Mdns Real Interaction Tests', () => {
  const MAC_ADDRESSES = new Set(['c4:cb:76:b3:cd:1f', 'fc:b2:14:d7:2e:9a']);

  let mdnsServer: Mdns;
  let mdnsClient: Mdns;
  let serverReady = false;
  let clientReady = false;

  beforeAll(async () => {
    if (!MAC_ADDRESSES.has(getMacAddress() ?? '')) return; // Skip test if not running on one of the expected MAC addresses

    // Create two mDNS instances that will communicate with each other
    mdnsServer = new Mdns('mDNS Server', MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_PORT, 'udp4', true, undefined, '0.0.0.0');
    mdnsClient = new Mdns('mDNS Client', MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_PORT, 'udp4', true, undefined, '0.0.0.0');

    // Wait for both instances to be ready
    const serverReadyPromise = new Promise<void>((resolve) => {
      mdnsServer.on('ready', () => {
        serverReady = true;
        resolve();
      });
    });

    const clientReadyPromise = new Promise<void>((resolve) => {
      mdnsClient.on('ready', () => {
        clientReady = true;
        resolve();
      });
    });

    // Start both instances
    mdnsServer.start();
    mdnsClient.start();

    // Wait for both to be ready
    await Promise.all([serverReadyPromise, clientReadyPromise]);

    if (!mdnsServer.bound || !mdnsClient.bound) throw new Error('mdnsServer or mdnsClient not bound after start()');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    if (!MAC_ADDRESSES.has(getMacAddress() ?? '')) {
      // Skip test if not running on one of the expected MAC addresses
      vi.restoreAllMocks();
      resetTest();
      return;
    }

    // Wait for both instances to be closed
    const serverClosedPromise = new Promise<void>((resolve) => {
      mdnsServer.on('close', () => {
        serverReady = false;
        resolve();
      });
    });
    const clientClosedPromise = new Promise<void>((resolve) => {
      mdnsClient.on('close', () => {
        clientReady = false;
        resolve();
      });
    });

    // Clean up both instances
    if (mdnsServer) {
      mdnsServer.stop();
    }
    if (mdnsClient) {
      mdnsClient.stop();
    }

    // Wait for both to be closed
    await Promise.all([serverClosedPromise, clientClosedPromise]);

    if (mdnsServer.bound || mdnsClient.bound) throw new Error('mdnsServer or mdnsClient is still bound after stop()');
    vi.restoreAllMocks();
    resetTest();
  });

  test('should have both mDNS instances ready', () => {
    if (!MAC_ADDRESSES.has(getMacAddress() ?? '')) return; // Skip test if not running on one of the expected MAC addresses

    expect(serverReady).toBe(true);
    expect(clientReady).toBe(true);
    expect(mdnsServer).toBeDefined();
    expect(mdnsClient).toBeDefined();
  });

  test('should send query from client and receive response from server', async () => {
    if (!MAC_ADDRESSES.has(getMacAddress() ?? '')) return; // Skip test if not running on one of the expected MAC addresses

    expect(serverReady).toBe(true);
    expect(clientReady).toBe(true);
    expect(mdnsServer).toBeDefined();
    expect(mdnsClient).toBeDefined();

    const serviceName = '_matterbridge._tcp.local';
    const instanceName = 'bun._matterbridge._tcp.local';

    // Create promise for server events
    const serverPromise = new Promise<void>((resolve, reject) => {
      let sent = false;
      mdnsServer.on('sent', () => {
        sent = true;
      });
      mdnsServer.on('error', () => {
        reject(new Error('mDNS server error'));
      });
      mdnsServer.onQuery = (rinfo: RemoteInfo, query: MdnsMessage): void => {
        if (query.questions?.find((q) => q.name === serviceName && q.type === DnsRecordType.PTR)) {
          const ptrRdata = mdnsServer.encodeDnsName(instanceName);
          mdnsServer.sendResponse([{ name: serviceName, rtype: DnsRecordType.PTR, rclass: DnsClass.IN, ttl: 120, rdata: ptrRdata }]);
          resolve();
        }
      };
    });

    // Create promise for client events
    const clientPromise = new Promise<void>((resolve, reject) => {
      let sent = false;
      mdnsClient.on('sent', () => {
        sent = true;
      });
      mdnsClient.on('error', () => {
        reject(new Error('mDNS client error'));
      });
      mdnsClient.onResponse = (rinfo: RemoteInfo, response: MdnsMessage): void => {
        if (response.answers?.find((a) => a.name === serviceName && a.type === DnsRecordType.PTR) && sent) {
          const ptrAnswer = response.answers.find((a) => a.name === serviceName && a.type === DnsRecordType.PTR);
          resolve();
        }
      };
      mdnsClient.sendQuery([{ name: serviceName, type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: false }]);
    });

    // Wait for both query and response with timeout
    await Promise.all([serverPromise, clientPromise]);
  });
});
