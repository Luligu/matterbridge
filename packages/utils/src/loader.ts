/**
 * This file contains the loader function.
 *
 * @file loader.ts
 * @author Luca Liguori
 * @created 2025-10-12
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
 * Loader function to log module loading times.
 *
 * Use with matterbridge --loader --logger fatal --matterlogger fatal
 *
 * @param {string} moduleName - The name of the module being loaded.
 * @param {string} [color] - The color code for the log message.
 */
export function logModuleLoaded(moduleName: string, color: string = '\u001B[32m'): void {
  if (process.argv.includes('--loader')) {
    // eslint-disable-next-line no-console
    console.log(
      `${color}[` +
        new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }) +
        `] ${moduleName} loaded.\u001B[40;0m`,
    );
  }
}
