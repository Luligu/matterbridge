/**
 * @file packages/utils/src/measurementUtils.ts
 * @description This file contains the measurement utilities.
 * @author Luca Liguori
 * @created 2026-08-29
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
 * Convert an illuminance value in lux to the Matter encoded representation used by the
 * IlluminanceMeasurement cluster's MeasuredValue attribute.
 *
 * Per the Matter Application Cluster spec §2.2.5.1: MeasuredValue = 10,000 x log10(illuminance) + 1,
 * where 1 lx <= illuminance <= 3.576 Mlx, corresponding to a MeasuredValue in the range 1 to 0xFFFE.
 * A MeasuredValue of 0 indicates an illuminance too low to be measured (0xFFFF is reserved / invalid).
 *
 * Edge cases handled:
 *  - NaN / non‑finite inputs -> treated as 0 (too low to be measured)
 *  - lux < 1 -> treated as 0 (too low to be measured, per the spec's lower encoding bound)
 *  - Very large inputs -> capped at 0xFFFE
 *
 * @param {number} lux Illuminance in lux. Fractional values allowed.
 * @returns {number} Encoded Matter illuminance value (0, or 1 .. 0xFFFE)
 */
export function luxToMatter(lux: number): number {
  // Matter 1.6.0 § 2.2.5.1: MeasuredValue is 0, or in the range 1 to 0xFFFE for 1 lx <= illuminance <= 3.576 Mlx.
  if (!Number.isFinite(lux) || lux < 1) return 0;
  // Matter 1.6.0 § 2.2.5.1: MeasuredValue = 10,000 x log10(illuminance) + 1.
  const encoded = Math.round(10000 * Math.log10(lux) + 1);
  return Math.min(encoded, 0xfffe);
}

/**
 * Convert a Matter encoded IlluminanceMeasurement MeasuredValue back to lux. This is the inverse of
 * luxToMatter: illuminance = 10 ^ ((MeasuredValue - 1) / 10000). Results are rounded to the nearest
 * integer lux for simplicity.
 *
 * Edge cases handled:
 *  - NaN / non‑finite / value <= 0 inputs -> treated as 0 lx (0 is the "too low to be measured" sentinel)
 *  - Inputs > 0xFFFE are capped at 0xFFFE (0xFFFF is reserved / invalid per spec)
 *
 * @param {number} value Encoded Matter illuminance value (0 .. 0xFFFE)
 * @returns {number} Illuminance in lux (integer, >= 0)
 */
export function matterToLux(value: number): number {
  // Matter 1.6.0 § 2.2.5.1: MeasuredValue = 0 indicates an illuminance too low to be measured.
  if (!Number.isFinite(value) || value <= 0) return 0;
  const v = Math.min(value, 0xfffe);
  // Matter 1.6.0 § 2.2.5.1: illuminance = 10 ^ ((MeasuredValue - 1) / 10,000), the inverse of luxToMatter.
  return Math.round(Math.pow(10, (v - 1) / 10000));
}
