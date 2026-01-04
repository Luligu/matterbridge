/**
 * @description This file contains the getGitHubUpdate function.
 * @file githubVersion.ts
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

export type UpdateJson = {
  latest: string;
  latestDate: string;
  dev: string;
  devDate: string;
  latestMessage: string;
  latestMessageSeverity: 'info' | 'warning' | 'error' | 'success';
  devMessage: string;
  devMessageSeverity: 'info' | 'warning' | 'error' | 'success';
};

/**
 * Retrieves a file from the public directory of the Matterbridge GitHub repository.
 *
 * @param {string} branch - The branch from which to fetch the file.
 * @param {string} file - The file path to fetch.
 * @param {number} [timeout] - The timeout duration in milliseconds (default is 10000ms).
 * @returns {Promise<Record<string, boolean | string | number>>} A promise that resolves to the parsed JSON object from the file.
 * @throws {Error} If the request fails or the JSON parsing fails.
 */
export async function getGitHubUpdate(branch: 'main' | 'dev', file: string, timeout: number = 10000): Promise<UpdateJson> {
  const https = await import('node:https');
  return new Promise((resolve, reject) => {
    const url = `https://matterbridge.io/${branch}_${file}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Request timed out after ${timeout / 1000} seconds`));
    }, timeout);

    const req = https.get(url, { signal: controller.signal }, (res) => {
      let data = '';

      if (res.statusCode !== 200) {
        clearTimeout(timeoutId);
        res.resume(); // Discard response data to close the socket properly
        reject(new Error(`Failed to fetch data. Status code: ${res.statusCode}`));
        return;
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        clearTimeout(timeoutId);
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Failed to parse response JSON: ${error instanceof Error ? error.message : error}`));
        }
      });
    });

    // istanbul ignore next cause it's just a precaution for network errors
    req.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Request failed: ${error instanceof Error ? error.message : error}`));
    });
  });
}
