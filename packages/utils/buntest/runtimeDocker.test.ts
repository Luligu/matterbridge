/**
 * @file packages/utils/buntest/runtimeDocker.test.ts
 * @description This file contains the tests for runtimeDocker.
 * @author Luca Liguori
 */

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { NetworkInterfaceInfo } from 'node:os';
import os from 'node:os';
import path from 'node:path';

import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import type { ContainerKind } from '../src/runtimeDocker.js';
import { CONTAINERENV_FILE, DOCKER_BUILD_CONFIG_FILE, DOCKER_MARKER_FILES, DOCKERENV_FILE, getDockerRuntimeInfo, isDocker, isDockerBridgeNetwork } from '../src/runtimeDocker.js';

// Setup the test environment
await setupTest('RuntimeDocker', false);

const originalPlatform = process.platform;
const originalRemoteContainers = process.env.REMOTE_CONTAINERS;
const originalCodespaces = process.env.CODESPACES;
const originalKubernetes = process.env.KUBERNETES_SERVICE_HOST;
const originalArgv = [...process.argv];
const tempDir = mkdtempSync(path.join(os.tmpdir(), 'matterbridge-runtime-docker-'));
const markerFile = path.join(tempDir, '.dockerenv');
const missingFile = path.join(tempDir, 'missing');
const buildConfigFile = path.join(tempDir, '.dockerbuild.json');
const invalidConfigFile = path.join(tempDir, 'invalid.json');
const arrayConfigFile = path.join(tempDir, 'array.json');
writeFileSync(markerFile, '');
writeFileSync(buildConfigFile, JSON.stringify({ version: '3.10.14', dev: true }));
writeFileSync(invalidConfigFile, '{ not json');
writeFileSync(arrayConfigFile, '[]');

/**
 * Builds a network interface entry for the bridge network tests.
 *
 * @param {string} address - The address.
 * @param {'IPv4' | 'IPv6'} [family] - The address family, IPv4 by default.
 * @param {boolean} [internal] - Whether the interface is internal, false by default.
 * @returns {NetworkInterfaceInfo} The network interface entry.
 */
function iface(address: string, family: 'IPv4' | 'IPv6' = 'IPv4', internal = false): NetworkInterfaceInfo {
  return { address, family, internal, netmask: '', mac: '', cidr: null, ...(family === 'IPv6' ? { scopeid: 0 } : {}) } as NetworkInterfaceInfo;
}

const bridgeInterfaces = { lo: [iface('127.0.0.1', 'IPv4', true)], eth0: [iface('172.17.0.2'), iface('fe80::1', 'IPv6')] };
const hostInterfaces = { lo: [iface('127.0.0.1', 'IPv4', true)], docker0: [iface('172.17.0.1')], eth0: [iface('192.168.1.50')] };

/**
 * Restores an environment variable to its original value.
 *
 * @param {string} name - The environment variable name.
 * @param {string | undefined} value - The original value, or undefined to delete it.
 */
function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else process.env[name] = value;
}

beforeEach(() => {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  delete process.env.REMOTE_CONTAINERS;
  delete process.env.CODESPACES;
  delete process.env.KUBERNETES_SERVICE_HOST;
});

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform });
  restoreEnv('REMOTE_CONTAINERS', originalRemoteContainers);
  restoreEnv('CODESPACES', originalCodespaces);
  restoreEnv('KUBERNETES_SERVICE_HOST', originalKubernetes);
  process.argv.splice(0, process.argv.length, ...originalArgv);
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('isDocker()', () => {
  it('should look for the Docker and Podman marker files by default', () => {
    expect(DOCKER_MARKER_FILES).toEqual(['/.dockerenv', '/run/.containerenv']);
  });

  it('should return true on Linux when a marker file exists', () => {
    expect(isDocker([missingFile, markerFile])).toBe(true);
  });

  it('should return false on Linux when no marker file exists and no container variable is set', () => {
    expect(isDocker([missingFile])).toBe(false);
  });

  it.each(['REMOTE_CONTAINERS', 'CODESPACES'])('should return true on Linux when %s is true', (name) => {
    process.env[name] = 'true';

    expect(isDocker([missingFile])).toBe(true);
  });

  it.each(['darwin', 'win32'])('should return false on %s even when a marker file exists or a container variable is set', (platform) => {
    Object.defineProperty(process, 'platform', { value: platform });
    process.env.REMOTE_CONTAINERS = 'true';

    expect(isDocker([markerFile])).toBe(false);
  });

  it('should use the default marker files when none are passed', () => {
    expect(typeof isDocker()).toBe('boolean');
  });
});

describe('isDockerBridgeNetwork()', () => {
  it('should return true when every external IPv4 address is in 172.16.0.0/12', () => {
    expect(isDockerBridgeNetwork(bridgeInterfaces)).toBe(true);
    expect(isDockerBridgeNetwork({ eth0: [iface('172.31.255.10')] })).toBe(true);
  });

  it('should return false when the host interfaces are visible, as with --network host', () => {
    expect(isDockerBridgeNetwork(hostInterfaces)).toBe(false);
  });

  it('should return false for addresses just outside 172.16.0.0/12', () => {
    expect(isDockerBridgeNetwork({ eth0: [iface('172.15.0.2')] })).toBe(false);
    expect(isDockerBridgeNetwork({ eth0: [iface('172.32.0.2')] })).toBe(false);
  });

  it('should return false when there is no external IPv4 address', () => {
    expect(isDockerBridgeNetwork({ lo: [iface('127.0.0.1', 'IPv4', true)], eth0: [iface('fe80::1', 'IPv6')], empty: undefined })).toBe(false);
  });

  it('should use the real network interfaces when none are passed', () => {
    expect(typeof isDockerBridgeNetwork()).toBe('boolean');
  });
});

describe('getDockerRuntimeInfo()', () => {
  const files = { dockerenv: missingFile, containerenv: missingFile, buildConfig: missingFile };

  it('should export the real file paths', () => {
    expect(DOCKERENV_FILE).toBe('/.dockerenv');
    expect(CONTAINERENV_FILE).toBe('/run/.containerenv');
    expect(DOCKER_BUILD_CONFIG_FILE).toBe('/matterbridge/.dockerbuild.json');
  });

  it('should report no container outside a container', () => {
    expect(getDockerRuntimeInfo(files, bridgeInterfaces)).toEqual({ container: false, kind: undefined, dockerParameter: false, imageBuildConfig: undefined, bridgeNetwork: false });
  });

  it('should report no container on a platform other than linux', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    process.env.CODESPACES = 'true';

    expect(getDockerRuntimeInfo({ ...files, dockerenv: markerFile }, bridgeInterfaces).container).toBe(false);
  });

  const kinds: [ContainerKind, Record<string, string>, Record<string, string>][] = [
    ['codespaces', { CODESPACES: 'true', REMOTE_CONTAINERS: 'true' }, {}],
    ['devcontainer', { REMOTE_CONTAINERS: 'true' }, {}],
    ['kubernetes', { KUBERNETES_SERVICE_HOST: '10.0.0.1' }, {}],
    ['podman', {}, { containerenv: markerFile, dockerenv: markerFile }],
    ['docker', {}, { dockerenv: markerFile }],
  ];

  it.each(kinds)('should detect the %s container kind', (kind, env, markers) => {
    Object.assign(process.env, env);

    const info = getDockerRuntimeInfo({ ...files, ...markers }, hostInterfaces);

    expect(info.container).toBe(true);
    expect(info.kind).toBe(kind);
    expect(info.bridgeNetwork).toBe(false);
  });

  it('should read the official image build config, the docker parameter and the bridge network in a container', () => {
    process.argv.push('--docker');

    const info = getDockerRuntimeInfo({ ...files, dockerenv: markerFile, buildConfig: buildConfigFile }, bridgeInterfaces);

    expect(info).toEqual({ container: true, kind: 'docker', dockerParameter: true, imageBuildConfig: { version: '3.10.14', dev: true }, bridgeNetwork: true });
  });

  it.each([
    ['missing', missingFile],
    ['not valid JSON', invalidConfigFile],
    ['not an object', arrayConfigFile],
  ])('should ignore an image build config that is %s', (_label, buildConfig) => {
    expect(getDockerRuntimeInfo({ ...files, dockerenv: markerFile, buildConfig }, hostInterfaces).imageBuildConfig).toBeUndefined();
  });

  it('should use the real files and interfaces when none are passed', () => {
    expect(typeof getDockerRuntimeInfo().container).toBe('boolean');
  });

  it('should read the default image build config path in a container when no files are passed', () => {
    process.env.CODESPACES = 'true';

    const info = getDockerRuntimeInfo(undefined, hostInterfaces);

    expect(info.container).toBe(true);
    expect(info.kind).toBe('codespaces');
    expect(info.bridgeNetwork).toBe(false);
  });
});
