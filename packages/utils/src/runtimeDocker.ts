/**
 * @file packages/utils/src/runtimeDocker.ts
 * @description This file contains Docker runtime helpers.
 * @author Luca Liguori
 * @created 2026-10-14
 * @version 1.1.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';

import { hasParameter } from './commandLine.js';
import { logModuleLoaded } from './loader.js';
import { isValidObject } from './validate.js';

logModuleLoaded('RuntimeDocker');

/** File Docker creates in every container (also in dev containers). */
export const DOCKERENV_FILE = '/.dockerenv';

/** File Podman creates in every container. */
export const CONTAINERENV_FILE = '/run/.containerenv';

/** Build config written in the official Matterbridge docker images. */
export const DOCKER_BUILD_CONFIG_FILE = '/matterbridge/.dockerbuild.json';

/** Files a container runtime creates in the container: `/.dockerenv` (Docker, dev containers) and `/run/.containerenv` (Podman). */
export const DOCKER_MARKER_FILES: readonly string[] = [DOCKERENV_FILE, CONTAINERENV_FILE];

/** The kind of container the process runs in. */
export type ContainerKind = 'codespaces' | 'devcontainer' | 'kubernetes' | 'podman' | 'docker';

/** Information about the container the process runs in, see {@link getDockerRuntimeInfo}. */
export interface DockerRuntimeInfo {
  /** True if the process runs in a Linux container of any {@link ContainerKind} (unlike {@link isDocker}, it includes Kubernetes). */
  container: boolean;
  /** The kind of container, or undefined when not in a container. */
  kind: ContainerKind | undefined;
  /** True if Matterbridge was started with the `--docker` parameter, as the official images do. */
  dockerParameter: boolean;
  /** The build config of the official Matterbridge image, or undefined in any other container or outside a container. */
  imageBuildConfig: Record<string, unknown> | undefined;
  /** True if the container network looks like a Docker bridge network (see {@link isDockerBridgeNetwork}). */
  bridgeNetwork: boolean;
}

/** The files read by {@link getDockerRuntimeInfo}; the defaults are the real paths, other paths are for tests. */
export interface DockerRuntimeFiles {
  /** The Docker marker file, {@link DOCKERENV_FILE} by default. */
  dockerenv?: string;
  /** The Podman marker file, {@link CONTAINERENV_FILE} by default. */
  containerenv?: string;
  /** The official image build config, {@link DOCKER_BUILD_CONFIG_FILE} by default. */
  buildConfig?: string;
}

/**
 * Checks if the current process runs in a Linux container: Docker or Podman (a marker file in
 * {@link DOCKER_MARKER_FILES}), a VS Code dev container (`REMOTE_CONTAINERS`) or GitHub Codespaces (`CODESPACES`).
 *
 * Unlike the `--docker` parameter, which the Matterbridge docker images pass, this also detects a dev container or a
 * container where the user starts Matterbridge by hand.
 *
 * @param {readonly string[]} [markerFiles] - The marker files to look for, {@link DOCKER_MARKER_FILES} by default.
 * @returns {boolean} True if the current process runs in a Linux container, false otherwise.
 */
export function isDocker(markerFiles: readonly string[] = DOCKER_MARKER_FILES): boolean {
  if (process.platform !== 'linux') return false;
  if (process.env.REMOTE_CONTAINERS === 'true' || process.env.CODESPACES === 'true') return true;
  return markerFiles.some((file) => existsSync(file));
}

/**
 * Checks if an IPv4 address is in the private range Docker uses for its bridge networks (172.16.0.0/12).
 *
 * @param {string} address - The IPv4 address.
 * @returns {boolean} True if the address is in 172.16.0.0/12.
 */
function isDockerBridgeAddress(address: string): boolean {
  const [first, second] = address.split('.').map(Number);
  return first === 172 && second >= 16 && second <= 31;
}

/**
 * Checks if the network interfaces look like a Docker bridge network: every external IPv4 address is in
 * 172.16.0.0/12, the range Docker uses for its bridge networks. With `--network host` the container sees the host
 * interfaces too, so at least one address is usually outside that range.
 *
 * This is a heuristic meant for a warning only (Matter mDNS does not cross a bridge network): a host whose own network
 * is in 172.16.0.0/12 looks the same. It does not check that the process runs in a container: see {@link isDocker}.
 *
 * @param {NodeJS.Dict<os.NetworkInterfaceInfo[]>} [interfaces] - The network interfaces, `os.networkInterfaces()` by default.
 * @returns {boolean} True if there is at least one external IPv4 address and all of them are in 172.16.0.0/12.
 */
export function isDockerBridgeNetwork(interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces()): boolean {
  const addresses = Object.values(interfaces)
    .flatMap((infos) => infos ?? [])
    .filter((info) => info.family === 'IPv4' && !info.internal)
    .map((info) => info.address);
  return addresses.length > 0 && addresses.every(isDockerBridgeAddress);
}

/**
 * Detects the kind of Linux container the process runs in. Codespaces and dev containers are checked first, since
 * they run on Docker too, then Kubernetes, Podman and Docker.
 *
 * @param {DockerRuntimeFiles} [files] - The files to read; the defaults are the real paths.
 * @returns {ContainerKind | undefined} The kind of container, or undefined when not in a container.
 */
function getContainerKind(files: DockerRuntimeFiles): ContainerKind | undefined {
  if (process.platform !== 'linux') return undefined;
  if (process.env.CODESPACES === 'true') return 'codespaces';
  if (process.env.REMOTE_CONTAINERS === 'true') return 'devcontainer';
  if (process.env.KUBERNETES_SERVICE_HOST) return 'kubernetes';
  if (existsSync(files.containerenv ?? CONTAINERENV_FILE)) return 'podman';
  if (existsSync(files.dockerenv ?? DOCKERENV_FILE)) return 'docker';
  return undefined;
}

/**
 * Reads the build config of the official Matterbridge docker image.
 *
 * @param {string} file - The build config file.
 * @returns {Record<string, unknown> | undefined} The parsed build config, or undefined if it is missing or not a JSON object.
 */
function readImageBuildConfig(file: string): Record<string, unknown> | undefined {
  try {
    const config: unknown = JSON.parse(readFileSync(file, 'utf-8'));
    return isValidObject(config) ? Object.fromEntries(Object.entries(config)) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Collects information about the container the process runs in, mainly for logs and diagnostics: whether it is a
 * container and which kind, whether the `--docker` parameter is set, the build config of the official Matterbridge
 * image and whether the network looks like a Docker bridge network.
 *
 * @param {DockerRuntimeFiles} [files] - The files to read; the defaults are the real paths, other paths are for tests.
 * @param {NodeJS.Dict<os.NetworkInterfaceInfo[]>} [interfaces] - The network interfaces, `os.networkInterfaces()` by default.
 * @returns {DockerRuntimeInfo} The container information.
 */
export function getDockerRuntimeInfo(files: DockerRuntimeFiles = {}, interfaces?: NodeJS.Dict<os.NetworkInterfaceInfo[]>): DockerRuntimeInfo {
  const kind = getContainerKind(files);
  const container = kind !== undefined;
  return {
    container,
    kind,
    dockerParameter: hasParameter('docker'),
    imageBuildConfig: container ? readImageBuildConfig(files.buildConfig ?? DOCKER_BUILD_CONFIG_FILE) : undefined,
    bridgeNetwork: container && isDockerBridgeNetwork(interfaces),
  };
}
