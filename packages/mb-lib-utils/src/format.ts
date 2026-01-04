/**
 * @description This file contains the format functions.
 * @file format.ts
 * @author Luca Liguori
 * @created 2025-10-20
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

/**
 * Format a timestamp into a human-readable string.
 *
 * @param {number} timestamp - The timestamp in milliseconds since the Unix epoch.
 * @returns {string} - The formatted timestamp.
 */
export function formatTimeStamp(timestamp: number): string {
  return `${new Date(timestamp).toLocaleString()}`;
}

/**
 * Format a percentage into a human-readable string.
 *
 * @param {number} percent - The percentage value.
 * @param {number} digits - The number of decimal places.
 * @returns {string} - The formatted percentage.
 */
export function formatPercent(percent: number, digits: number = 2): string {
  return `${percent.toFixed(digits)} %`;
}

/**
 * Format bytes into a human-readable string.
 *
 * @param {number} bytes - The number of bytes.
 * @param {number} digits - The number of decimal places.
 * @returns {string} - The formatted byte string.
 */
export function formatBytes(bytes: number, digits: number = 2): string {
  if (bytes === 0) return `${bytes.toFixed(digits)} B`;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(digits)} ${units[idx]}`;
}

/**
 * Function to format system uptime with only the most significant unit
 *
 * @param {number} seconds - The number of seconds to format
 * @returns {string} The formatted uptime string
 */
export function formatUptime(seconds: number): string {
  if (seconds >= 86400) {
    const days = Math.floor(seconds / 86400);
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}
