/**
 * This file contains the shelly api functions.
 *
 * @file shelly.ts
 * @author Luca Liguori
 * @date 2025-02-19
 * @version 1.0.3
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
 * limitations under the License. *
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { RequestOptions } from 'node:http';
import { WS_ID_SHELLY_MAIN_UPDATE, WS_ID_SHELLY_SYS_UPDATE } from './frontend.js';
import { debugStringify } from './logger/export.js';
import { Matterbridge } from './matterbridge.js';

/**
 * Fetches Shelly system updates. If available: logs the result, sends a snackbar message, and broadcasts the message.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function getShellySysUpdate(matterbridge: Matterbridge): Promise<void> {
  getShelly('/api/updates/sys/check', 60 * 1000)
    .then(async (data: { name: string }[]) => {
      if (data.length > 0) {
        matterbridge.matterbridgeInformation.shellySysUpdate = true;
        matterbridge.frontend.wssBroadcastMessage(WS_ID_SHELLY_SYS_UPDATE, 'shelly-sys-update', { available: true });
        for (const update of data) {
          if (update.name) matterbridge.log.notice(`Shelly system update available: ${update.name}`);
          if (update.name) matterbridge.frontend.wssSendSnackbarMessage(`Shelly system update available: ${update.name}`, 10);
        }
      }
    })
    .catch((error) => {
      matterbridge.log.warn(`Error getting Shelly system updates: ${error instanceof Error ? error.message : error}`);
    });
}

/**
 * Triggers Shelly system updates.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function triggerShellySysUpdate(matterbridge: Matterbridge): Promise<void> {
  getShelly('/api/updates/sys/perform', 10 * 1000)
    .then(async () => {
      matterbridge.log.debug(`Triggered Shelly system updates`);
    })
    .catch((error) => {
      matterbridge.log.debug(`****Error triggering Shelly system updates: ${error instanceof Error ? error.message : error}`);
    })
    .finally(() => {
      matterbridge.matterbridgeInformation.shellySysUpdate = false;
      matterbridge.log.notice(`Installing Shelly system update...`);
      matterbridge.frontend.wssSendSnackbarMessage('Installing Shelly system update...', 15);
      matterbridge.frontend.wssBroadcastMessage(WS_ID_SHELLY_SYS_UPDATE, 'shelly-sys-update', { available: false });
      verifyShellyUpdate(matterbridge, '/api/updates/sys/status', 'Shelly system update');
    });
}

/**
 * Fetches Shelly main updates. If available: logs the result, sends a snackbar message, and broadcasts the message.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function getShellyMainUpdate(matterbridge: Matterbridge): Promise<void> {
  getShelly('/api/updates/main/check', 60 * 1000)
    .then(async (data: { name: string }[]) => {
      if (data.length > 0) {
        matterbridge.matterbridgeInformation.shellyMainUpdate = true;
        matterbridge.frontend.wssBroadcastMessage(WS_ID_SHELLY_MAIN_UPDATE, 'shelly-main-update', { available: true });
        for (const update of data) {
          if (update.name) matterbridge.log.notice(`Shelly software update available: ${update.name}`);
          if (update.name) matterbridge.frontend.wssSendSnackbarMessage(`Shelly software update available: ${update.name}`, 10);
        }
      }
    })
    .catch((error) => {
      matterbridge.log.warn(`Error getting Shelly main updates: ${error instanceof Error ? error.message : error}`);
    });
}

/**
 * Triggers Shelly main updates.
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function triggerShellyMainUpdate(matterbridge: Matterbridge): Promise<void> {
  getShelly('/api/updates/main/perform', 10 * 1000)
    .then(async () => {
      // {"updatingInProgress":true} or {"updatingInProgress":false}
      matterbridge.log.debug(`Triggered Shelly main updates`);
    })
    .catch((error) => {
      matterbridge.log.debug(`****Error triggering Shelly main updates: ${error instanceof Error ? error.message : error}`);
    })
    .finally(() => {
      matterbridge.matterbridgeInformation.shellyMainUpdate = false;
      matterbridge.log.notice(`Installing Shelly software update...`);
      matterbridge.frontend.wssSendSnackbarMessage('Installing Shelly software update...', 15);
      matterbridge.frontend.wssBroadcastMessage(WS_ID_SHELLY_MAIN_UPDATE, 'shelly-main-update', { available: false });
      verifyShellyUpdate(matterbridge, '/api/updates/main/status', 'Shelly software update');
    });
}

/**
 * Verifies Shelly update.
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @param {string} api - The api to call: /api/updates/sys/status or /api/updates/main/status
 * @param {string} name - The name of the update.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
async function verifyShellyUpdate(matterbridge: Matterbridge, api: string, name: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      matterbridge.log.warn(`${name} check timed out`);
      clearInterval(interval);
      resolve();
    }, 600 * 1000); // 10 minutes
    const interval = setInterval(() => {
      getShelly(api, 10 * 1000)
        .then(async (data: { updatingInProgress: boolean }) => {
          if (data.updatingInProgress) {
            matterbridge.log.debug(`${name} in progress...`);
            matterbridge.frontend.wssSendSnackbarMessage(`${name} in progress...`, 20);
          } else {
            matterbridge.log.notice(`${name} installed`);
            matterbridge.frontend.wssSendSnackbarMessage(`${name} installed`, 20);
            clearInterval(interval);
            clearTimeout(timeout);
            resolve();
          }
        })
        .catch((error) => {
          matterbridge.log.warn(`Error getting status of ${name}: ${error instanceof Error ? error.message : error}`);
          clearInterval(interval);
          clearTimeout(timeout);
          resolve();
        });
    }, 15 * 1000); // 15 seconds
  });
}

/**
 * Triggers Shelly change network configuration.
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @param {object} config - The network configuration.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function triggerShellyChangeIp(matterbridge: Matterbridge, config: { type: 'static' | 'dhcp'; ip: string; subnet: string; gateway: string; dns: string }): Promise<void> {
  const api = config.type === 'static' ? '/api/network/connection/static' : '/api/network/connection/dynamic';
  const data: { interface: string; addr?: string; mask?: string; gw?: string; dns?: string } = { interface: 'end0' };
  if (config.type === 'static') {
    data['addr'] = config.ip;
    data['mask'] = config.subnet;
    data['gw'] = config.gateway;
    data['dns'] = config.dns;
  }

  matterbridge.log.debug(`Triggering Shelly network configuration change: ${debugStringify(config)}`);

  postShelly(api, data, 60 * 1000)
    .then(async () => {
      matterbridge.log.debug(`Triggered Shelly network configuration change: ${debugStringify(config)}`);
    })
    .catch((error) => {
      matterbridge.log.debug(`****Error triggering Shelly network configuration change: ${error instanceof Error ? error.message : error}`);
    })
    .finally(() => {
      matterbridge.log.notice(`Changed Shelly network configuration`);
      matterbridge.frontend.wssSendSnackbarMessage('Changed Shelly network configuration');
    });
}

/**
 * Triggers Shelly system reboot.
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function triggerShellyReboot(matterbridge: Matterbridge): Promise<void> {
  matterbridge.log.debug(`Triggering Shelly system reboot`);

  postShelly('/api/system/reboot', {}, 60 * 1000)
    .then(async () => {
      matterbridge.log.debug(`Triggered Shelly system reboot`);
    })
    .catch((error) => {
      matterbridge.log.debug(`****Error triggering Shelly system reboot: ${error instanceof Error ? error.message : error}`);
    })
    .finally(() => {
      matterbridge.log.notice(`Rebooting Shelly board...`);
      matterbridge.frontend.wssSendSnackbarMessage('Rebooting Shelly board...');
    });
}

/**
 * Fetches Shelly system log and write it to shelly.log.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function createShellySystemLog(matterbridge: Matterbridge): Promise<void> {
  const { promises: fs } = await import('node:fs');
  const path = await import('node:path');

  matterbridge.log.debug(`Downloading Shelly system log...`);

  getShelly('/api/logs/system', 60 * 1000)
    .then(async (data) => {
      fs.writeFile(path.join(matterbridge.matterbridgeDirectory, 'shelly.log'), data)
        .then(() => {
          matterbridge.log.notice(`Shelly system log ready for download`);
          matterbridge.frontend.wssSendSnackbarMessage('Shelly system log ready for download');
        })
        .catch((error) => {
          matterbridge.log.warn(`Error writing Shelly system log to file: ${error instanceof Error ? error.message : error}`);
        });
    })
    .catch((error) => {
      matterbridge.log.warn(`Error getting Shelly system log: ${error instanceof Error ? error.message : error}`);
    });
}

/**
 * Perform a GET to Shelly board apis.
 * @param {string} api - The api to call:
 *
 *      /api/updates/sys/check => [{name:string; ...}]
 *      /api/updates/sys/perform => {"updatingInProgress":true} or {"updatingInProgress":false}
 *      /api/updates/sys/status => {"updatingInProgress":true} or {"updatingInProgress":false}
 *      /api/updates/main/check => [{name:string; ...}]
 *      /api/updates/main/perform => {"updatingInProgress":true} or {"updatingInProgress":false}
 *      /api/updates/main/status  => {"updatingInProgress":true} or {"updatingInProgress":false}
 *
 *      /api/logs/system => text
 *
 * @param {number} [timeout=5000] - The timeout duration in milliseconds (default is 60000ms).
 * @returns {Promise<any>} A promise that resolves to the response.
 * @throws {Error} If the request fails.
 */
async function getShelly(api: string, timeout = 60000): Promise<any> {
  const http = await import('node:http');
  return new Promise((resolve, reject) => {
    const url = `http://127.0.0.1:8101${api}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Request timed out after ${timeout / 1000} seconds`));
    }, timeout).unref();

    const req = http.get(url, { signal: controller.signal }, (res) => {
      let data = '';

      if (res.statusCode !== 200) {
        clearTimeout(timeoutId);
        res.resume(); // Discard response data to close the socket properly
        req.destroy(); // Forcefully close the request
        reject(new Error(`Failed to fetch data. Status code: ${res.statusCode}`));
        return;
      }

      res.on('data', (chunk) => {
        // console.log(chunk);
        data += chunk;
      });

      res.on('end', () => {
        clearTimeout(timeoutId);
        if (api !== '/api/logs/system') {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (error) {
            reject(new Error(`Failed to parse response JSON: ${error instanceof Error ? error.message : error}`));
          }
        } else {
          // console.log(data);
          resolve(data);
        }
      });
    });

    req.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Request failed: ${error instanceof Error ? error.message : error}`));
    });
  });
}

/**
 * Perform a POST request to Shelly board apis.
 * @param {string} api - The api to call:
 *
 *     Set static ip
 *     /api/network/connection/static -d '{"interface": "end0", "addr": "10.11.12.101", "mask": "255.255.255.0", "gw": "10.11.12.1", "dns": "1.1.1.1"}' => {}
 *
 *     Set dhcp
 *     /api/network/connection/dynamic -d '{"interface": "end0"}' => {}
 *
 *     Reboot
 *     /api/system/reboot => {"success":true}
 *
 *     curl -H "Content-Type: application/json" -X POST http://127.0.0.1:8101/api/network/connection/dynamic
 *        -d '{"interface": "end0"}'
 *
 *     curl -H "Content-Type: application/json" -X POST http://127.0.0.1:8101/api/network/connection/static
 *        -d '{"interface": "end0", "addr": "192.168.1.64", "mask": "255.255.255.0", "gw": "192.168.1.1", "dns": "192.168.1.1"}'
 *
 * @param {number} [timeout=5000] - The timeout duration in milliseconds (default is 60000ms).
 * @returns {Promise<any>} A promise that resolves to the response.
 * @throws {Error} If the request fails.
 */
async function postShelly(api: string, data: any, timeout = 60000): Promise<any> {
  const http = await import('node:http');
  return new Promise((resolve, reject) => {
    const url = `http://127.0.0.1:8101${api}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Request timed out after ${timeout / 1000} seconds`));
    }, timeout).unref();

    const jsonData = JSON.stringify(data);
    const options: RequestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonData),
      },
      signal: controller.signal,
    };

    const req = http.request(url, options, (res) => {
      let responseData = '';

      // Check for non-success status codes (e.g., 300+)
      if (res.statusCode && res.statusCode >= 300) {
        clearTimeout(timeoutId);
        res.resume(); // Discard response data to free up memory
        req.destroy(); // Close the request
        return reject(new Error(`Failed to post data. Status code: ${res.statusCode}`));
      }

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        clearTimeout(timeoutId);
        try {
          const jsonResponse = JSON.parse(responseData);
          resolve(jsonResponse);
        } catch (err) {
          reject(new Error(`Failed to parse response JSON: ${err instanceof Error ? err.message : err}`));
        }
      });
    });

    req.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Request failed: ${error instanceof Error ? error.message : error}`));
    });

    // Send the JSON data
    req.write(jsonData);
    req.end();
  });
}
