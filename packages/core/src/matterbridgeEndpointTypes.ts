/**
 * This file contains the types for MatterbridgeEndpoint.
 *
 * @file matterbridgeEndpointTypes.ts
 * @author Luca Liguori
 * @created 2025-11-10
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
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

// istanbul ignore if -- Loader logs are not relevant for coverage
// eslint-disable-next-line no-console
if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mMatterbridgeEndpointTypes loaded.\u001B[40;0m');

// @matter
import { ClusterId, EndpointNumber } from '@matter/types/datatype';
import { Semtag } from '@matter/types/globals';

// matterbridge
import type { DeviceTypeDefinition } from './matterbridgeDeviceTypes.js';

export type PrimitiveTypes = boolean | number | bigint | string | object | undefined | null;

export interface SerializedMatterbridgeEndpoint {
  pluginName: string;
  deviceName: string;
  serialNumber: string;
  uniqueId: string;
  productId?: number;
  productName?: string;
  vendorId?: number;
  vendorName?: string;
  deviceTypes: DeviceTypeDefinition[];
  number: EndpointNumber | undefined;
  id: string | undefined;
  clusterServersId: ClusterId[];
}

/**
 *  MatterbridgeEndpointOptions interface is used to define the options for a Matterbridge endpoint.
 *
 *  @remarks
 *  - tagList?: Semtag[]. It is used to disambiguate the sibling child endpoints (9.2.3. Disambiguation rule).
 *    - mfgCode: VendorId | null,
 *    - namespaceId: number,
 *    - tag: number,
 *    - label: string | undefined | null
 *  - mode?: 'server' | 'matter'. It is used to activate a special mode for the endpoint.
 *  - id?: string. It is the unique storage key for the endpoint.
 *  - number?: EndpointNumber. It is the endpoint number for the endpoint.
 */
export interface MatterbridgeEndpointOptions {
  /**
   *  The semantic tags array for the endpoint.
   *  The tagList is used to disambiguate the sibling child endpoints (9.2.3. Disambiguation rule).
   *  The tagList is used to identify the endpoint and to provide additional information about the endpoint.
   *
   *  @remarks
   *    - mfgCode: VendorId | null,
   *    - namespaceId: number,
   *    - tag: number,
   *    - label: string | undefined | null
   *  @remarks
   *  Use the getSemtag() utility function to create the Semtag objects for the tagList.
   */
  tagList?: Semtag[];
  /**
   * Activates a special mode for this endpoint.
   * - 'server': it creates the device server node and add the device as Matter device that needs to be paired individually.
   *   In this case the Matterbridge bridge mode (bridge or childbridge) is not relevant. The device is independent.
   *
   * - 'matter': it adds the device directly to the Matterbridge server node as Matter device alongside the aggregator. In this case the implementation must respect
   *   the 9.2.3. Disambiguation rule (i.e. use taglist if needed cause the device doesn't have nodeLabel).
   *   Furthermore the device will be a part of the bridge (i.e. will have the same name and will be in the same room).
   *   See 9.12.2.2. Native Matter functionality in Bridge.
   *
   * @remarks
   * Always use createDefaultBasicInformationClusterServer() to create the BasicInformation cluster server when using mode 'server' or 'matter'.
   */
  mode?: 'server' | 'matter';
  /**
   * The unique storage key for the endpoint.
   * If not provided, a default key will be used.
   */
  id?: string;
  /**
   * The endpoint number for the endpoint.
   * If not provided, the endpoint will be created with the next available endpoint number.
   * If provided, the endpoint will be created with the specified endpoint number.
   */
  number?: EndpointNumber;
}
