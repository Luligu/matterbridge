/**
 * @file packages/core/src/devices/extractorHood.ts
 * @description This file contains the ExtractorHood class.
 * @author Luca Liguori
 * @created 2025-05-25
 * @version 1.2.0
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

// @matter
import type { EndpointNumber } from '@matter/types';
import { ResourceMonitoring } from '@matter/types/clusters/resource-monitoring';
import type { Semtag } from '@matter/types/globals';
// @matterbridge
import { fireAndForget } from '@matterbridge/utils/wait';

// Matterbridge
import { extractorHood, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

/**
 * Options for configuring an {@link ExtractorHood} endpoint.
 */
export interface ExtractorHoodOptions {
  /** Endpoint operating mode. */
  mode?: 'server' | 'matter';
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
  /** Semantic tags for endpoint disambiguation. */
  tagList?: Semtag[];
  /** Initial HEPA filter condition from 0 to 100. */
  hepaCondition?: number;
  /** Initial HEPA filter change indication. */
  hepaChangeIndication?: ResourceMonitoring.ChangeIndication;
  /** HEPA filter in-place indicator. */
  hepaInPlaceIndicator?: boolean;
  /** HEPA filter last-changed time. */
  hepaLastChangedTime?: number | null;
  /** HEPA replacement products. */
  hepaReplacementProductList?: ResourceMonitoring.ReplacementProduct[];
  /** Initial activated-carbon filter condition from 0 to 100. */
  activatedCarbonCondition?: number;
  /** Initial activated-carbon filter change indication. */
  activatedCarbonChangeIndication?: ResourceMonitoring.ChangeIndication;
  /** Activated-carbon filter in-place indicator. */
  activatedCarbonInPlaceIndicator?: boolean;
  /** Activated-carbon filter last-changed time. */
  activatedCarbonLastChangedTime?: number | null;
  /** Activated-carbon replacement products. */
  activatedCarbonReplacementProductList?: ResourceMonitoring.ReplacementProduct[];
}

/**
 * Matterbridge endpoint representing an extractor hood device.
 */
export class ExtractorHood extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the ExtractorHood class.
   *
   * @param {string} name - The name of the extractor hood.
   * @param {string} serial - The serial number of the extractor hood.
   *
   * @param {ExtractorHoodOptions} [options] - Endpoint and initial filter configuration.
   */
  constructor(name: string, serial: string, options?: ExtractorHoodOptions);

  /**
   * Creates an instance using the legacy positional configuration.
   *
   * @deprecated Pass an {@link ExtractorHoodOptions} object as the third argument instead.
   */
  // oxfmt-ignore
  constructor(name: string, serial: string, hepaCondition?: number, hepaChangeIndication?: ResourceMonitoring.ChangeIndication, hepaInPlaceIndicator?: boolean, hepaLastChangedTime?: number | null, hepaReplacementProductList?: ResourceMonitoring.ReplacementProduct[], activatedCarbonCondition?: number, activatedCarbonChangeIndication?: ResourceMonitoring.ChangeIndication, activatedCarbonInPlaceIndicator?: boolean, activatedCarbonLastChangedTime?: number | null, activatedCarbonReplacementProductList?: ResourceMonitoring.ReplacementProduct[]);

  constructor(
    name: string,
    serial: string,
    optionsOrHepaCondition?: ExtractorHoodOptions | number,
    hepaChangeIndication?: ResourceMonitoring.ChangeIndication,
    hepaInPlaceIndicator?: boolean,
    hepaLastChangedTime?: number | null,
    hepaReplacementProductList?: ResourceMonitoring.ReplacementProduct[],
    activatedCarbonCondition?: number,
    activatedCarbonChangeIndication?: ResourceMonitoring.ChangeIndication,
    activatedCarbonInPlaceIndicator?: boolean,
    activatedCarbonLastChangedTime?: number | null,
    activatedCarbonReplacementProductList?: ResourceMonitoring.ReplacementProduct[],
  ) {
    const options: ExtractorHoodOptions =
      typeof optionsOrHepaCondition === 'object'
        ? optionsOrHepaCondition
        : {
            hepaCondition: optionsOrHepaCondition,
            hepaChangeIndication,
            hepaInPlaceIndicator,
            hepaLastChangedTime,
            hepaReplacementProductList,
            activatedCarbonCondition,
            activatedCarbonChangeIndication,
            activatedCarbonInPlaceIndicator,
            activatedCarbonLastChangedTime,
            activatedCarbonReplacementProductList,
          };
    super([extractorHood, powerSource], {
      id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number: options.number,
      tagList: options.tagList,
      mode: options.mode,
    });
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Extractor Hood');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createBaseFanControlClusterServer();
    this.createDefaultHepaFilterMonitoringClusterServer(
      options.hepaCondition ?? 100,
      options.hepaChangeIndication ?? ResourceMonitoring.ChangeIndication.Ok,
      options.hepaInPlaceIndicator ?? true,
      options.hepaLastChangedTime ?? null,
      options.hepaReplacementProductList ?? [],
    );
    this.createDefaultActivatedCarbonFilterMonitoringClusterServer(
      options.activatedCarbonCondition ?? 100,
      options.activatedCarbonChangeIndication ?? ResourceMonitoring.ChangeIndication.Ok,
      options.activatedCarbonInPlaceIndicator ?? true,
      options.activatedCarbonLastChangedTime ?? null,
      options.activatedCarbonReplacementProductList ?? [],
    );

    this.subscribeAttribute('fanControl', 'fanMode', (newValue: number, oldValue: number, context) => {
      if (context.fabric === undefined) return;
      this.log.info(`Fan control fanMode attribute changed: ${newValue}`);
    });

    this.subscribeAttribute('fanControl', 'percentSetting', (newValue: number, oldValue: number, context) => {
      if (context.fabric === undefined) return;
      this.log.info(`Fan control percentSetting attribute changed: ${newValue}`);
      fireAndForget(this.setAttribute('fanControl', 'percentCurrent', newValue, this.log), this.log, 'ExtractorHood setAttribute');
    });

    this.subscribeAttribute('hepaFilterMonitoring', 'lastChangedTime', (newValue: number, oldValue: number, context) => {
      if (context.fabric === undefined) return;
      this.log.info(`Hepa filter monitoring lastChangedTime attribute changed: ${newValue}`);
    });

    this.subscribeAttribute('activatedCarbonFilterMonitoring', 'lastChangedTime', (newValue: number, oldValue: number, context) => {
      if (context.fabric === undefined) return;
      this.log.info(`Activated carbon filter monitoring lastChangedTime attribute changed: ${newValue}`);
    });
  }
}
