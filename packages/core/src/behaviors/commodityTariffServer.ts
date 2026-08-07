/**
 * @file packages/core/src/behaviors/commodityTariffServer.ts
 * @description This file contains the MatterbridgeCommodityTariffServer class of Matterbridge.
 * @author Luca Liguori
 * @created 2026-08-07
 * @version 1.0.0
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

import { CommodityTariffServer } from '@matter/node/behaviors/commodity-tariff';
import { StatusResponse } from '@matter/types';
import { CommodityTariff } from '@matter/types/clusters/commodity-tariff';

/**
 * CommodityTariff server with the `Pricing` feature (required for the `TariffInfo.Currency` and
 * `TariffComponent.Price` fields — both are conformance-gated by `Pricing` and rejected at
 * construction otherwise) that implements the base `GetTariffComponent` and `GetDayEntry` commands
 * against the endpoint's own already-published `TariffComponents`/`TariffPeriods`/`DayEntries`
 * attributes.
 *
 * matter.js does not yet provide a default implementation of these commands (they throw
 * "unimplemented" by default), which logs a warning every time the cluster is added to an
 * endpoint, so both are implemented here as plain lookups by id. Neither command has side effects,
 * so — unlike action commands such as `Thermostat.setActiveScheduleRequest` — they are not
 * forwarded to the Matterbridge command handler.
 */
export class MatterbridgeCommodityTariffServer extends CommodityTariffServer.with(CommodityTariff.Feature.Pricing) {
  /**
   * Looks up the requested tariff component (and the label/day entries of the tariff period that
   * references it) among the values already published on `TariffComponents`/`TariffPeriods`.
   *
   * @param {CommodityTariff.GetTariffComponentRequest} request - Get-tariff-component request payload.
   * @returns {CommodityTariff.GetTariffComponentResponse} The matching tariff component, with the label and day entry ids of the period it belongs to, if any.
   */
  override getTariffComponent(request: CommodityTariff.GetTariffComponentRequest): CommodityTariff.GetTariffComponentResponse {
    const tariffComponent = (this.state.tariffComponents ?? []).find((component) => component.tariffComponentId === request.tariffComponentId);
    if (!tariffComponent) {
      throw new StatusResponse.NotFoundError(`No TariffComponent with id ${request.tariffComponentId}`);
    }
    const period = (this.state.tariffPeriods ?? []).find((p) => p.tariffComponentIDs.includes(request.tariffComponentId));
    return { label: period?.label ?? null, dayEntryIDs: period?.dayEntryIDs ?? [], tariffComponent };
  }

  /**
   * Looks up the requested day entry among the values already published on `DayEntries`.
   *
   * @param {CommodityTariff.GetDayEntryRequest} request - Get-day-entry request payload.
   * @returns {CommodityTariff.GetDayEntryResponse} The matching day entry.
   */
  override getDayEntry(request: CommodityTariff.GetDayEntryRequest): CommodityTariff.GetDayEntryResponse {
    const dayEntry = (this.state.dayEntries ?? []).find((entry) => entry.dayEntryId === request.dayEntryId);
    if (!dayEntry) {
      throw new StatusResponse.NotFoundError(`No DayEntry with id ${request.dayEntryId}`);
    }
    return { dayEntry };
  }
}
