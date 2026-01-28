/**
 * This file contains the types for MatterbridgePlatform.
 *
 * @file matterbridgePlatformTypes.ts
 * @author Luca Liguori
 * @created 2024-03-21
 * @version 1.6.1
 * @license Apache-2.0
 *
 * Copyright 2024, 2025, 2026 Luca Liguori.
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

import type { VendorId } from '@matter/main/types';

import type { SystemInformation } from './matterbridgeTypes.js';

/** Platform configuration value type. */
export type PlatformConfigValue = string | number | boolean | bigint | object | undefined | null;

/** Platform configuration type. */
export type PlatformConfig = { name: string; type: string; version: string; debug: boolean; unregisterOnShutdown: boolean } & Record<string, PlatformConfigValue>;

/** Platform schema value type. */
export type PlatformSchemaValue = string | number | boolean | bigint | object | undefined | null;

/** Platform schema type. */
export type PlatformSchema = Record<string, PlatformSchemaValue>;

/** A type representing a subset of readonly properties of Matterbridge for platform use. */
export type PlatformMatterbridge = {
  readonly systemInformation: Readonly<
    Pick<
      SystemInformation,
      | 'interfaceName'
      | 'macAddress'
      | 'ipv4Address'
      | 'ipv6Address'
      | 'nodeVersion'
      | 'hostname'
      | 'user'
      | 'osType'
      | 'osRelease'
      | 'osPlatform'
      | 'osArch'
      | 'totalMemory'
      | 'freeMemory'
      | 'systemUptime'
      | 'processUptime'
      | 'cpuUsage'
      | 'processCpuUsage'
      | 'rss'
      | 'heapTotal'
      | 'heapUsed'
    >
  >;
  readonly rootDirectory: string;
  readonly homeDirectory: string;
  readonly matterbridgeDirectory: string;
  readonly matterbridgePluginDirectory: string;
  readonly matterbridgeCertDirectory: string;
  readonly globalModulesDirectory: string;
  readonly matterbridgeVersion: string;
  readonly matterbridgeLatestVersion: string;
  readonly matterbridgeDevVersion: string;
  readonly frontendVersion: string;
  readonly bridgeMode: 'bridge' | 'childbridge' | 'controller' | '';
  readonly restartMode: 'service' | 'docker' | '';
  readonly virtualMode: 'disabled' | 'outlet' | 'light' | 'switch' | 'mounted_switch';
  readonly aggregatorVendorId: VendorId;
  readonly aggregatorVendorName: string;
  readonly aggregatorProductId: number;
  readonly aggregatorProductName: string;
};
