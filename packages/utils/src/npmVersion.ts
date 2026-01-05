/**
 * @description This file contains the getNpmPackageVersion function.
 * @file npmVersion.ts
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

/**
 * Retrieves the version of an npm package from the npm registry.
 *
 * @param {string} packageName - The name of the npm package.
 * @param {string} [tag] - The tag of the package version to retrieve (default is 'latest').
 * @param {number} [timeout] - The timeout duration in milliseconds (default is 10000ms).
 * @returns {Promise<string>} A promise that resolves to the version string of the package.
 * @throws {Error} If the request fails or the tag is not found.
 */
export async function getNpmPackageVersion(packageName: string, tag: string = 'latest', timeout: number = 10000): Promise<string> {
  const https = await import('node:https');
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${packageName}`;
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
          // console.log(`Package ${packageName} tag ${tag}`, jsonData);
          const version = jsonData['dist-tags']?.[tag];
          if (version) {
            resolve(version);
          } else {
            reject(new Error(`Tag "${tag}" not found for package "${packageName}"`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response JSON: ${error instanceof Error ? error.message : error}`));
        }
      });
    });

    req.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Request failed: ${error instanceof Error ? error.message : error}`));
    });
  });
}
