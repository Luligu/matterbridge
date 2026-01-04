/**
 * @description This file contains the getGlobalNodeModules function.
 * @file npmRoot.ts
 * @author Luca Liguori
 * @created 2024-02-17
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2024, 2025, 2026 Luca Liguori.
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

// Node.js modules import types
import type { ExecException } from 'node:child_process';

/**
 * Retrieves the path to the global Node.js modules directory.
 *
 * @returns {Promise<string>} A promise that resolves to the path of the global Node.js modules directory.
 */
export async function getGlobalNodeModules(): Promise<string> {
  const { exec } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    exec('npm root -g', (error: ExecException | null, stdout: string) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}
