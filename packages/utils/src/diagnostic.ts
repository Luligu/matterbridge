/**
 * This file contains the diagnostic functions.
 *
 * @file diagnostic.ts
 * @author Luca Liguori
 * @created 2026-06-30
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

import { logModuleLoaded } from './loader.js';

logModuleLoaded('Diagnostic');

/**
 * Writes a concise diagnostic breadcrumb to stderr.
 *
 * @param {string} context - The diagnostic context.
 * @param {string} message - The diagnostic message.
 * @returns {void}
 */
export function writeDiagnostic(context: string, message: string): void {
  process.stderr.write(`\u001B[37;44m[diagnostic]\u001B[0m ${context}: ${message}\n`);
}
