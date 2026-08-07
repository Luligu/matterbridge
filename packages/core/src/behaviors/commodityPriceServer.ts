/**
 * @file packages/core/src/behaviors/commodityPriceServer.ts
 * @description This file contains the MatterbridgeCommodityPriceServer class of Matterbridge.
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

import { CommodityPriceServer } from '@matter/node/behaviors/commodity-price';
import type { CommodityPrice } from '@matter/types/clusters/commodity-price';

/**
 * CommodityPrice server that implements the base `GetDetailedPrice` command by returning the
 * endpoint's own already-published `CurrentPrice` attribute as-is.
 *
 * matter.js does not yet provide a default implementation of this command (it throws
 * "unimplemented" by default), which logs a warning every time the cluster is added to an
 * endpoint. The `Details` field of the request (which fields of the `CommodityPriceStruct` to
 * include) is not honored: the `Description`/`Components` fields are omitted from `CurrentPrice`
 * regardless, per the base cluster's own requirement, so there is nothing extra to add back in
 * without the `Forecasting`/other optional features this base implementation doesn't assume.
 */
export class MatterbridgeCommodityPriceServer extends CommodityPriceServer {
  /**
   * Returns the endpoint's own already-published `CurrentPrice` attribute as the detailed price.
   *
   * @returns {CommodityPrice.GetDetailedPriceResponse} The current price, unchanged.
   */
  override getDetailedPriceRequest(): CommodityPrice.GetDetailedPriceResponse {
    return { currentPrice: this.state.currentPrice };
  }
}
