/**
 * @file packages/types/buntest/matterbridgePlatformTypes.test.ts
 * @description Type-level tests for the platform types in matterbridgePlatformTypes.
 * @author Luca Liguori
 */

import { describe, expect, expectTypeOf, test } from 'bun:test';

import type { VendorId } from '@matter/types';

import type { BasePlatformConfig, PlatformConfig, PlatformConfigValue, PlatformMatterbridge, PlatformSchema } from '../src/matterbridgePlatformTypes.js';
import type { BridgeMode, RestartMode, SystemInformation, VirtualMode } from '../src/matterbridgeTypes.js';

// matterbridgePlatformTypes.ts declares types only and compiles to an empty module, so these assertions are
// enforced by `npm run typecheck`; the runtime expectations only check that the sample values are built as typed.

describe('matterbridgePlatformTypes', () => {
  describe('PlatformConfig', () => {
    const base: BasePlatformConfig = { name: 'matterbridge-test', type: 'DynamicPlatform', version: '1.0.0', debug: false, unregisterOnShutdown: false };

    test('should accept the base fields with extra plugin settings', () => {
      const config: PlatformConfig = { ...base, host: 'localhost', port: 8080, enabled: true, big: 1n, list: ['a'], nested: { a: 1 }, empty: null, unset: undefined };

      expectTypeOf(config.name).toEqualTypeOf<string>();
      expectTypeOf(config.debug).toEqualTypeOf<boolean>();
      expectTypeOf(config.host).toEqualTypeOf<PlatformConfigValue>();
      expect(config).toMatchObject({ name: 'matterbridge-test', host: 'localhost', port: 8080 });
    });

    test('should reject a config when a base field is missing', () => {
      // @ts-expect-error unregisterOnShutdown is a required base field
      const config: PlatformConfig = { name: 'matterbridge-test', type: 'DynamicPlatform', version: '1.0.0', debug: false };
      expect(config.unregisterOnShutdown).toBeUndefined();
    });

    test('should reject a base field with the wrong type', () => {
      // @ts-expect-error debug must be a boolean
      const config: PlatformConfig = { ...base, debug: 'true' };
      expect<string | boolean>(config.debug).toBe('true');
    });

    test('should reject a symbol as a plugin setting', () => {
      // @ts-expect-error a symbol is not a PlatformConfigValue
      const config: PlatformConfig = { ...base, token: Symbol('token') };
      expect(typeof config.token).toBe('symbol');
    });

    test('should accept a base config as a platform config without extra settings', () => {
      expectTypeOf<PlatformConfig>().toExtend<BasePlatformConfig>();
      expectTypeOf<BasePlatformConfig>().toExtend<PlatformConfig>();
    });
  });

  describe('PlatformSchema', () => {
    test('should accept a JSON schema shaped object', () => {
      const schema: PlatformSchema = { title: 'Test', type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false };

      expectTypeOf(schema.title).toEqualTypeOf<string | number | boolean | bigint | object | undefined | null>();
      expect(schema.required).toEqual(['name']);
    });
  });

  describe('PlatformMatterbridge', () => {
    const systemInformation: PlatformMatterbridge['systemInformation'] = {
      interfaceName: 'eth0',
      macAddress: 'aa:bb:cc:dd:ee:ff',
      ipv4Address: '192.168.1.10',
      ipv6Address: 'fe80::1',
      nodeVersion: '24.0.0',
      hostname: 'host',
      user: 'user',
      osType: 'Linux',
      osRelease: '6.0.0',
      osPlatform: 'linux',
      osArch: 'x64',
      totalMemory: '8 GB',
      freeMemory: '4 GB',
      systemUptime: '1 hour',
      processUptime: '1 minute',
      cpuUsage: '1 %',
      processCpuUsage: '1 %',
      rss: '100 MB',
      heapTotal: '50 MB',
      heapUsed: '25 MB',
    };

    const matterbridge: PlatformMatterbridge = {
      systemInformation,
      uuid: '00000000-0000-0000-0000-000000000000',
      rootDirectory: 'root',
      homeDirectory: 'home',
      matterbridgeDirectory: 'matterbridge',
      matterbridgePluginDirectory: 'plugins',
      matterbridgeCertDirectory: 'cert',
      globalModulesDirectory: 'modules',
      matterbridgeVersion: '3.0.0',
      matterbridgeLatestVersion: '3.0.0',
      matterbridgeDevVersion: '3.0.1-dev',
      frontendVersion: '3.0.0',
      bridgeMode: 'bridge',
      restartMode: 'service',
      virtualMode: 'outlet',
      aggregatorVendorId: 0xfff1 as VendorId,
      aggregatorVendorName: 'Matterbridge',
      aggregatorProductId: 0x8000,
      aggregatorProductName: 'Matterbridge aggregator',
    };

    test('should expose the system information without the Bun version', () => {
      expectTypeOf<keyof PlatformMatterbridge['systemInformation']>().toEqualTypeOf<Exclude<keyof SystemInformation, 'bunVersion'>>();
      expect(Object.keys(matterbridge.systemInformation)).toHaveLength(20);
    });

    test('should use the matterbridge mode types', () => {
      expectTypeOf(matterbridge.bridgeMode).toEqualTypeOf<BridgeMode>();
      expectTypeOf(matterbridge.restartMode).toEqualTypeOf<RestartMode>();
      expectTypeOf(matterbridge.virtualMode).toEqualTypeOf<VirtualMode>();
      expectTypeOf(matterbridge.aggregatorVendorId).toEqualTypeOf<VendorId>();
      expect(matterbridge).toMatchObject({ bridgeMode: 'bridge', restartMode: 'service', virtualMode: 'outlet', aggregatorVendorId: 0xfff1 });
    });

    test('should reject an unknown bridge mode', () => {
      // @ts-expect-error 'hub' is not a BridgeMode
      const invalid: PlatformMatterbridge = { ...matterbridge, bridgeMode: 'hub' };
      expect<string>(invalid.bridgeMode).toBe('hub');
    });

    test('should make every property readonly', () => {
      expectTypeOf<PlatformMatterbridge>().toEqualTypeOf<Readonly<PlatformMatterbridge>>();
      expectTypeOf<PlatformMatterbridge['systemInformation']>().toEqualTypeOf<Readonly<PlatformMatterbridge['systemInformation']>>();
    });

    test('should reject writes to the platform and system information properties', () => {
      const copy = { ...matterbridge, systemInformation: { ...systemInformation } } as PlatformMatterbridge;

      // @ts-expect-error uuid is readonly
      copy.uuid = 'changed';
      // @ts-expect-error systemInformation fields are readonly
      copy.systemInformation.hostname = 'changed';
      expect(copy.uuid).toBe('changed');
      expect(copy.systemInformation.hostname).toBe('changed');
      expect(matterbridge.systemInformation.hostname).toBe('host');
    });
  });
});
