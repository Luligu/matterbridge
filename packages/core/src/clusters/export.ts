/**
 * @file packages/core/src/clusters/export.ts
 * @description Exports core cluster modules.
 * @author Luca Liguori
 * @created 2026-03-04
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

/**
 * No custom clusters to export at this time.
 * This file is kept for consistency and future use when custom clusters are added to the core package.
 * The 3 clusters present (ClosureControl, ClosureDimension, SoilMeasurement) are now all defined in matter.js.
 * Are there only to provide an example of custom clusters.
 */

// oxlint-disable-next-line jsdoc/require-returns
export const noop = (): void => undefined;
