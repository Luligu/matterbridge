/**
 * This file contains a generic, data-driven factory to create cluster servers on a MatterbridgeEndpoint.
 *
 * @file matterbridgeFactory.ts
 * @author Luca Liguori
 * @created 2026-06-10
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026 Luca Liguori.
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

// @matter
import { Behavior, ClusterBehavior } from '@matter/node';
import { getClusterNameById } from '@matter/types/cluster';
import { ClusterId } from '@matter/types/datatype';
// AnsiLogger module
import { db, hk } from 'node-ansi-logger';

// matterbridge
import type { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

/**
 * Options for the generic cluster server factory.
 */
export interface CreateClusterServerOptions {
  /** Cluster features to select, as a lowercase boolean record (e.g. `{ lighting: true, offOnly: false }`) or an array of feature names (e.g. `['Lighting']`). Selected features replace the server default selection. */
  features?: Record<string, boolean> | string[];
  /** Initial cluster attribute values, used as the behavior state defaults. The caller must supply the attributes mandatory for the chosen feature set. */
  attributes?: Record<string, unknown>;
}

/**
 * Converts a PascalCase cluster name to the hyphen-separated matter.js behavior module subpath.
 *
 * A separator is inserted before an uppercase letter only when the previous emitted character was not
 * uppercase, so consecutive capitals and digits stay grouped (e.g. `OnOff` -> `on-off`,
 * `Pm25ConcentrationMeasurement` -> `pm25-concentration-measurement`).
 *
 * @param {string} name - The PascalCase name to convert.
 * @returns {string} The hyphen-separated lowercase subpath.
 */
export function snakeCase(name: string): string {
  let result = '';
  let needSeparator = false;
  for (const char of name) {
    if (char >= 'A' && char <= 'Z') {
      if (needSeparator) {
        result += '-';
        needSeparator = false;
      }
      result += char.toLowerCase();
    } else {
      result += char;
      needSeparator = true;
    }
  }
  return result;
}

/**
 * Converts a hyphen- or underscore-separated name to PascalCase, the inverse of {@link snakeCase}.
 *
 * Each separated piece keeps its remaining characters and only its first character is uppercased
 * (e.g. `on-off` -> `OnOff`, `pm25-concentration-measurement` -> `Pm25ConcentrationMeasurement`).
 *
 * @param {string} name - The hyphen- or underscore-separated name to convert.
 * @returns {string} The PascalCase name.
 */
export function pascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .filter((piece) => piece.length > 0)
    .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1))
    .join('');
}

/**
 * Converts a hyphen- or underscore-separated name to camelCase.
 *
 * Behaves like {@link pascalCase} but lowercases the first character of the result
 * (e.g. `on-off` -> `onOff`, `level-control` -> `levelControl`).
 *
 * @param {string} name - The hyphen- or underscore-separated name to convert.
 * @returns {string} The camelCase name.
 */
export function camelCase(name: string): string {
  const pascal = pascalCase(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Lazily resolves the stock matter.js server behavior for a given cluster id.
 *
 * Only the single matter.js server module for the requested cluster is dynamically imported, so the
 * whole `@matter/node/behaviors` barrel is never eagerly loaded. Unknown or non-server cluster ids
 * resolve to `undefined`.
 *
 * @param {ClusterId} clusterId - The cluster id to resolve the server behavior for.
 * @param {Record<string, boolean> | string[]} [features] - Lowercase boolean feature record or array of feature names. Truthy keys or listed names are applied with `.with(...)`, replacing the server default feature selection.
 * @returns {Promise<Behavior.Type | undefined>} The resolved (and optionally feature-selected) server behavior, or `undefined` if no matter.js server exists for the cluster id.
 *
 * @example
 *
 * Features can be selected with a boolean record or an array of feature names:
 * ```typescript
 * const onOffServer = await getServerBehaviorFromClusterId(OnOff.id);
 * const lightingServer = await getServerBehaviorFromClusterId(OnOff.id, { lighting: true });
 * const lightingServerFromArray = await getServerBehaviorFromClusterId(OnOff.id, ['Lighting']);
 * ```
 */
export async function getServerBehaviorFromClusterId(clusterId: ClusterId, features?: Record<string, boolean> | string[]): Promise<Behavior.Type | undefined> {
  // getClusterNameById returns "Unknown cluster 0x..." for ids that are not in the Matter model.
  const name = getClusterNameById(clusterId);
  if (name.includes('Unknown cluster')) return undefined;

  let mod: Record<string, unknown>;
  try {
    mod = (await import(`@matter/node/behaviors/${snakeCase(name)}`)) as Record<string, unknown>;
  } catch {
    // istanbul ignore next -- Defensive: every known matter.js cluster resolves to a behavior module.
    return undefined;
  }

  const base = mod[`${name}Server`] as Behavior.Type | undefined;
  // istanbul ignore next -- Defensive: every stock matter.js behavior module that resolves exposes a cluster-behavior <Name>Server.
  if (!base || !ClusterBehavior.isType(base)) return undefined;

  const featureNames = (
    Array.isArray(features)
      ? features
      : Object.entries(features ?? {})
          .filter(([, enabled]) => enabled)
          .map(([key]) => key)
  ).map((key) => pascalCase(key));

  return featureNames.length > 0 ? base.with(...featureNames) : base;
}

/**
 * Generic, data-driven factory that requires the stock matter.js server behavior for a cluster id on
 * the given endpoint, optionally selecting features and seeding attribute defaults.
 *
 * This is an alternative cluster-creation path to the dedicated `createDefault*ClusterServer()`
 * methods on {@link MatterbridgeEndpoint}. It uses the stock matter.js `*Server` behaviors (which
 * implement the cluster commands), resolved lazily by cluster id. Call it before `registerDevice()`.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to add the cluster server to.
 * @param {ClusterId} clusterId - The cluster id to create the server for.
 * @param {CreateClusterServerOptions} [options] - Optional features and attribute defaults.
 * @returns {Promise<MatterbridgeEndpoint>} The same endpoint, for convenience. If no matter.js server exists for the cluster id, the endpoint is returned unchanged and a warning is logged.
 *
 * @example
 *
 * Features can be selected with a boolean record or an array of feature names:
 * ```typescript
 * await createClusterServer(device, OnOff.id, { features: { lighting: true }, attributes: { onOff: false } });
 * await createClusterServer(device, OnOff.id, { features: ['Lighting'], attributes: { onOff: false } });
 * ```
 */
export async function createClusterServer(endpoint: MatterbridgeEndpoint, clusterId: ClusterId, options?: CreateClusterServerOptions): Promise<MatterbridgeEndpoint> {
  const type = await getServerBehaviorFromClusterId(clusterId, options?.features);
  if (!type) {
    endpoint.log.warn(`createClusterServer: no matter.js server for clusterId ${hk}0x${clusterId.toString(16).padStart(4, '0')}${db}`);
    return endpoint;
  }
  endpoint.behaviors.require(type, options?.attributes ?? {});
  return endpoint;
}
