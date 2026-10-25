/**
 * @file packages/core/buntest/protectPrototypes.test.ts
 * @description This file contains the tests for the protected prototypes of the core classes.
 * @author Luca Liguori
 */

const NAME = 'ProtectPrototypes';
const MATTER_PORT = 6013;
const MATTER_CREATE_ONLY = true;

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'bun:test';

import { createServerNode, createTestEnvironment, destroyTestEnvironment, flushServerNode, startServerNode, stopServerNode } from '@matterbridge/test-utils/buntest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { ThreadsManager } from '@matterbridge/thread/manager';
import { BroadcastServer } from '@matterbridge/thread/server';
import { ThreadsWrapper } from '@matterbridge/thread/wrapper';

import { MatterbridgeServer } from '../src/behaviors/matterbridgeServer.js';
import { MatterbridgeWebRtcTransportProviderServer } from '../src/behaviors/webRtcTransportProviderServer.js';
import { MatterbridgeWebRtcTransportRequestorServer } from '../src/behaviors/webRtcTransportRequestorServer.js';
import { WeriftWebRtcSession } from '../src/behaviors/weriftSession.js';
import { Matterbridge } from '../src/matterbridge.js';
import { MatterbridgeAccessoryPlatform } from '../src/matterbridgeAccessoryPlatform.js';
import { onOffLight } from '../src/matterbridgeDeviceTypes.js';
import { MatterbridgeDynamicPlatform } from '../src/matterbridgeDynamicPlatform.js';
import { MatterbridgeEndpoint } from '../src/matterbridgeEndpoint.js';
import { CommandHandler } from '../src/matterbridgeEndpointCommandHandler.js';
import { MatterbridgePlatform } from '../src/matterbridgePlatform.js';
import { protectCorePrototypes } from '../src/protectPrototypes.js';

// Setup the test environment
await setupTest(NAME, false);

/** The function used to test patching a method. */
const patch = (): string => 'patched';

/** A plain class that is not protected. */
class Plain {
  readonly value = 1;
}

/** The protected classes. */
const protectedClasses: [string, { readonly prototype: object }][] = [
  ['BroadcastServer', BroadcastServer],
  ['ThreadsManager', ThreadsManager],
  ['ThreadsWrapper', ThreadsWrapper],
  ['Matterbridge', Matterbridge],
  ['MatterbridgeEndpoint', MatterbridgeEndpoint],
  ['MatterbridgePlatform', MatterbridgePlatform],
  ['MatterbridgeDynamicPlatform', MatterbridgeDynamicPlatform],
  ['MatterbridgeAccessoryPlatform', MatterbridgeAccessoryPlatform],
  ['CommandHandler', CommandHandler],
  ['MatterbridgeServer', MatterbridgeServer],
  ['WeriftWebRtcSession', WeriftWebRtcSession],
  ['MatterbridgeWebRtcTransportProviderServer', MatterbridgeWebRtcTransportProviderServer],
  ['MatterbridgeWebRtcTransportRequestorServer', MatterbridgeWebRtcTransportRequestorServer],
];

describe('ProtectPrototypes', () => {
  beforeAll(async () => {
    // Importing the core classes does not freeze them: the cli does, before loading the Matterbridge instance
    expect(Object.isFrozen(MatterbridgeEndpoint.prototype)).toBe(false);
    await protectCorePrototypes();

    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT, undefined, 0, 0, 0);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // No errors logged during tests
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode(0, 0, 0, 0);
    else await stopServerNode();
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  it.each(protectedClasses)('should freeze the prototype of %s', (_name, type) => {
    expect(Object.isFrozen(type.prototype)).toBe(true);
  });

  it.each(protectedClasses)('should throw when a method is assigned or defined on the prototype of %s', (_name, type) => {
    const proto = type.prototype as Record<string, unknown>;
    expect(() => {
      proto.patchedMethod = patch;
    }).toThrow(TypeError);
    expect(() => Object.defineProperty(proto, 'patchedMethod', { value: patch })).toThrow(TypeError);
    expect(proto.patchedMethod).toBeUndefined();
  });

  it('should throw when an inherited method is assigned on the prototype of a subclass', () => {
    class PatchedPlatform extends MatterbridgeDynamicPlatform {}
    expect(() => {
      (PatchedPlatform.prototype as unknown as Record<string, unknown>).onStart = patch;
    }).toThrow(TypeError);
    expect(Object.isFrozen(PatchedPlatform.prototype)).toBe(false);
  });

  it('should allow subclasses declared with the class syntax to override the methods', () => {
    class TestPlatform extends MatterbridgeDynamicPlatform {
      override async onStart(): Promise<void> {
        // Overridden
      }
    }
    expect(TestPlatform.prototype.onStart).not.toBe(MatterbridgeDynamicPlatform.prototype.onStart);

    class TestEndpoint extends MatterbridgeEndpoint {
      readonly label = 'test';
      getLabel(): string {
        return this.label;
      }
    }
    const endpoint = new TestEndpoint(onOffLight, { id: 'ProtectedTestEndpoint' });
    expect(endpoint.getLabel()).toBe('test');
  });

  it('should not freeze the prototype of an unprotected class', () => {
    expect(Object.isFrozen(Plain.prototype)).toBe(false);
  });
});
