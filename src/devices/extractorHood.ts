/**
 * @description This file contains the ExtractorHood class.
 * @file src/devices/extractorHood.ts
 * @author Luca Liguori
 * @created 2025-05-25
 * @version 1.1.0
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

// Imports from @matter
import { ActionContext } from '@matter/node';
import { ResourceMonitoring } from '@matter/types/clusters/resource-monitoring';

// Matterbridge
import { extractorHood, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

export class ExtractorHood extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the ExtractorHood class.
   *
   * @param {string} name - The name of the extractor hood.
   * @param {string} serial - The serial number of the extractor hood.
   *
   * @param {number} [hepaCondition] - The initial HEPA filter condition (range 0-100). Default is 100.
   * @param {ResourceMonitoring.ChangeIndication} hepaChangeIndication - The initial HEPA filter change indication. Default is ResourceMonitoring.ChangeIndication.Ok.
   * @param {boolean | undefined} hepaInPlaceIndicator - The HEPA filter in-place indicator. Default is true.
   * @param {number | null | undefined} hepaLastChangedTime - The last time the HEPA filter was changed. Default is null.
   * @param {ResourceMonitoring.ReplacementProduct[]} hepaReplacementProductList - The list of HEPA filter replacement products. Default is an empty array.
   
   * @param {number} [activatedCarbonCondition] - The initial activated carbon filter condition (range 0-100). Default is 100.
   * @param {ResourceMonitoring.ChangeIndication} activatedCarbonChangeIndication - The initial activated carbon filter change indication. Default is ResourceMonitoring.ChangeIndication.Ok.
   * @param {boolean | undefined} activatedCarbonInPlaceIndicator - The activated carbon filter in-place indicator. Default is true.
   * @param {number | null | undefined} activatedCarbonLastChangedTime - The last time the activated carbon filter was changed. Default is null.
   * @param {ResourceMonitoring.ReplacementProduct[]} activatedCarbonReplacementProductList - The list of activated carbon filter replacement products. Default is an empty array.
   */
  constructor(
    name: string,
    serial: string,
    hepaCondition: number = 100,
    hepaChangeIndication: ResourceMonitoring.ChangeIndication = ResourceMonitoring.ChangeIndication.Ok,
    hepaInPlaceIndicator: boolean | undefined = true,
    hepaLastChangedTime: number | null | undefined = null,
    hepaReplacementProductList: ResourceMonitoring.ReplacementProduct[] = [],
    activatedCarbonCondition: number = 100,
    activatedCarbonChangeIndication: ResourceMonitoring.ChangeIndication = ResourceMonitoring.ChangeIndication.Ok,
    activatedCarbonInPlaceIndicator: boolean | undefined = true,
    activatedCarbonLastChangedTime: number | null | undefined = null,
    activatedCarbonReplacementProductList: ResourceMonitoring.ReplacementProduct[] = [],
  ) {
    super([extractorHood, powerSource], { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Extractor Hood');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createBaseFanControlClusterServer();
    this.createDefaultHepaFilterMonitoringClusterServer(hepaCondition, hepaChangeIndication, hepaInPlaceIndicator, hepaLastChangedTime, hepaReplacementProductList);
    this.createDefaultActivatedCarbonFilterMonitoringClusterServer(activatedCarbonCondition, activatedCarbonChangeIndication, activatedCarbonInPlaceIndicator, activatedCarbonLastChangedTime, activatedCarbonReplacementProductList);

    this.subscribeAttribute('fanControl', 'fanMode', (newValue: number, oldValue: number, context: ActionContext) => {
      // if (context.offline === true) return;
      this.log.info(`Fan control fanMode attribute changed: ${newValue}`);
    });

    this.subscribeAttribute('fanControl', 'percentSetting', (newValue: number, oldValue: number, context: ActionContext) => {
      // if (context.offline === true) return;
      this.log.info(`Fan control percentSetting attribute changed: ${newValue}`);
      this.setAttribute('fanControl', 'percentCurrent', newValue, this.log);
    });

    this.subscribeAttribute('hepaFilterMonitoring', 'lastChangedTime', (newValue: number, oldValue: number, context: ActionContext) => {
      // if (context.offline === true) return;
      this.log.info(`Hepa filter monitoring lastChangedTime attribute changed: ${newValue}`);
    });

    this.subscribeAttribute('activatedCarbonFilterMonitoring', 'lastChangedTime', (newValue: number, oldValue: number, context: ActionContext) => {
      // if (context.offline === true) return;
      this.log.info(`Activated carbon filter monitoring lastChangedTime attribute changed: ${newValue}`);
    });
  }
}
