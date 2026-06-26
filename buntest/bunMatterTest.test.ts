// buntest/bunMatterTest.test.ts

// Exercises the Bun Matter test environment helpers in ./bunMatterTest.ts against the real matter.js
// runtime on Bun: create the environment, create a server node + aggregator, add and remove a bridged
// device, then flush and tear down. Runs in create-only mode (no network start) to keep it deterministic.
// Run from the repo root with:  bun test  (bunfig.toml scopes discovery to buntest/).
//
// KNOWN FAILURE — Bun + Windows atomic write (EPERM on rename)
// ------------------------------------------------------------
// On Bun/Windows the device add/flush steps fail with:
//   EPERM: operation not permitted, rename '...root.__nextNumber__.tmp' -> '...root.__nextNumber__'
//
// Source of the failure (matter.js storage atomic write):
//   File:     node_modules/@matter/nodejs/src/storage/fs/FileStorageDriver.ts
//   Line:     308  (method #writeAndMoveFile, lines 267-309)
//   Fragment:
//     const handle = await open(tmpName, "w");
//     const writer = handle.createWriteStream({ encoding: isStream ? null : "utf8", flush: true });
//     // ...write...
//     await handle.close();
//     await rename(tmpName, filepath);   // <-- throws EPERM here
//
// Why (and why only Bun on Windows):
//   Windows refuses to rename a file while an OS handle to it is still open (EPERM); POSIX allows it,
//   so Linux/macOS never hit this. Under Node/Windows, FileHandle.close() releases the underlying OS
//   handle before its promise resolves, so the following rename succeeds. Under Bun/Windows, the handle
//   backing handle.createWriteStream()/handle.close() is NOT released by the time close() resolves, so
//   the immediately-following rename still sees an open handle on the .tmp file and fails. Matches the
//   standalone repro in README-BUN.md. matter.js already guards fsync for win32 (FileStorageDriver.ts
//   315-320) but has no guard around rename.
//
// How to fix (decide):
//   1. Bun-side (root cause, preferred): FileHandle.createWriteStream()+close() must release the Windows
//      file handle before close() resolves. File/track a Bun issue.
//   2. matter.js-side: retry rename on win32 EPERM with a short backoff (mirroring the win32 fsync guard),
//      or copyFile+unlink fallback — upstream PR.
//   3. Matterbridge-side stopgap until fixed: custom StorageDriver that retries rename on EPERM when
//      isBun() && process.platform === 'win32'.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { Endpoint } from '@matter/node';
import { BridgedDeviceBasicInformationServer } from '@matter/node/behaviors/bridged-device-basic-information';
import { MountedOnOffControlDevice } from '@matter/node/devices/mounted-on-off-control';
import { VendorId } from '@matter/types/datatype';

import { setupTest } from './bunSetupTest.js';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  deleteDevice,
  destroyTestEnvironment,
  environment,
  flushServerNode,
  getMatterbridge,
  server,
} from './bunMatterTest.js';

const NAME = 'BunMatter';
const MATTER_PORT = 6010;

// Setup the test environment
await setupTest(NAME, false);

describe('bunMatterTest', () => {
  beforeAll(async () => {
    // Setup the Matter test environment and create the server node and aggregator (create-only).
    await createTestEnvironment();
    await createServerNode(MATTER_PORT);
  });

  afterAll(async () => {
    // Flush pending persistence, close the server node and tear down.
    await flushServerNode();
    await destroyTestEnvironment();
  });

  test('creates the matter environment, server node and aggregator', () => {
    expect(environment).toBeDefined();
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(aggregator.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeFalsy();
  });

  test('getMatterbridge returns a mocked platform tagged for Bun', () => {
    const matterbridge = getMatterbridge();
    expect(matterbridge.systemInformation.user).toBe('bun');
    expect(matterbridge.aggregatorProductName).toBe('Matterbridge Bun');
    expect(matterbridge.bridgeMode).toBe('none');
    expect(matterbridge.aggregatorVendorId).toBe(VendorId(0xfff1));
  });

  test('adds and deletes a bridged device on the aggregator', async () => {
    const device = new Endpoint(MountedOnOffControlDevice.with(BridgedDeviceBasicInformationServer), {
      id: 'BunBridgedDevice',
      bridgedDeviceBasicInformation: {
        vendorId: VendorId(0xfff1),
        vendorName: 'Matterbridge',
        productName: 'Bun Bridged Device',
        nodeLabel: 'Bun Bridged Device',
        softwareVersion: 1,
        softwareVersionString: '1.0.0',
      },
      onOff: { onOff: false },
    });

    expect(await addDevice(aggregator, device)).toBe(true);
    expect(aggregator.parts.has(device)).toBeTruthy();

    expect(await deleteDevice(aggregator, device)).toBe(true);
    expect(aggregator.parts.has(device)).toBeFalsy();
  });
});
