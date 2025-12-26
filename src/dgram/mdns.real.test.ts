/**
 * @description Real-world mDNS test with two instances communicating with each other.
 * @file mdns.real.test.ts
 * @author Luca Liguori
 * @created 2025-07-21
 * @version 1.0.0
 * @license Apache-2.0
 * @copyright 2025, 2026, 2027 Luca Liguori.
 */

import { RemoteInfo } from 'node:dgram';

import { getMacAddress } from '../utils/network.js';
import { setupTest } from '../jestutils/jestHelpers.js';

import { Mdns, DnsRecordType, DnsClass, MdnsMessage } from './mdns.js';
import { MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_PORT } from './multicast.js';

process.argv.push('--verbose');

// Setup the test environment
await setupTest('MdnsReal', false);

describe('Mdns Real Interaction Tests', () => {
  let mdnsServer: Mdns;
  let mdnsClient: Mdns;
  let serverReady = false;
  let clientReady = false;

  beforeAll(async () => {
    if (getMacAddress() !== 'c4:cb:76:b3:cd:1f') return; // Skip test if not running on the expected MAC address

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

  afterAll(async () => {
    if (getMacAddress() !== 'c4:cb:76:b3:cd:1f') return; // Skip test if not running on the expected MAC address

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
  });

  test('should have both mDNS instances ready', () => {
    if (getMacAddress() !== 'c4:cb:76:b3:cd:1f') return; // Skip test if not running on the expected MAC address

    expect(serverReady).toBe(true);
    expect(clientReady).toBe(true);
    expect(mdnsServer).toBeDefined();
    expect(mdnsClient).toBeDefined();
  });

  test('should send query from client and receive response from server', async () => {
    if (getMacAddress() !== 'c4:cb:76:b3:cd:1f') return; // Skip test if not running on the expected MAC address

    expect(serverReady).toBe(true);
    expect(clientReady).toBe(true);
    expect(mdnsServer).toBeDefined();
    expect(mdnsClient).toBeDefined();

    const serviceName = '_matterbridge._tcp.local';
    const instanceName = 'jest._matterbridge._tcp.local';

    // Create promise for server events
    const serverPromise = new Promise<void>((resolve, reject) => {
      let sent = false;
      mdnsServer.on('sent', () => {
        sent = true;
      });
      mdnsServer.on('error', () => {
        reject(new Error('mDNS server error'));
      });
      mdnsServer.onQuery = (rinfo: RemoteInfo, query: MdnsMessage) => {
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
      mdnsClient.onResponse = (rinfo: RemoteInfo, response: MdnsMessage) => {
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
