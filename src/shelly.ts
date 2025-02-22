/* eslint-disable @typescript-eslint/no-explicit-any */
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
  fetchShelly('/api/updates/sys/check', 60 * 1000)
    .then(async (data: { name: string }[]) => {
      if (data.length > 0) {
        matterbridge.matterbridgeInformation.shellySysUpdate = true;
        matterbridge.log.notice(`Shelly system update available: ${debugStringify(data)}`);
        matterbridge.frontend.wssSendSnackbarMessage('Shelly system update available', 60);
        matterbridge.frontend.wssBroadcastMessage(WS_ID_SHELLY_SYS_UPDATE, 'shelly-sys-update', { available: true });
        for (const update of data) {
          if (update.name) matterbridge.frontend.wssSendSnackbarMessage('Shelly system update available: ' + update.name, 10);
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
  fetchShelly('/api/updates/sys/perform', 10 * 1000)
    .then(async () => {
      // {"updatingInProgress":true} or {"updatingInProgress":false}
      matterbridge.log.debug(`Triggered Shelly system updates`);
    })
    .catch((error) => {
      matterbridge.log.debug(`****Error triggering Shelly system updates: ${error instanceof Error ? error.message : error}`);
    })
    .finally(() => {
      matterbridge.matterbridgeInformation.shellySysUpdate = false;
      matterbridge.log.notice(`Installing Shelly system update...`);
      matterbridge.frontend.wssSendSnackbarMessage('Installing Shelly system update...', 60);
      matterbridge.frontend.wssBroadcastMessage(WS_ID_SHELLY_SYS_UPDATE, 'shelly-sys-update', { available: false });
    });
}

/**
 * Fetches Shelly main updates. If available: logs the result, sends a snackbar message, and broadcasts the message.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function getShellyMainUpdate(matterbridge: Matterbridge): Promise<void> {
  fetchShelly('/api/updates/main/check', 60 * 1000)
    .then(async (data: { name: string }[]) => {
      if (data.length > 0) {
        matterbridge.matterbridgeInformation.shellyMainUpdate = true;
        matterbridge.log.notice(`Shelly software update available: ${debugStringify(data)}`);
        matterbridge.frontend.wssSendSnackbarMessage('Shelly software update available', 60);
        matterbridge.frontend.wssBroadcastMessage(WS_ID_SHELLY_MAIN_UPDATE, 'shelly-main-update', { available: true });
        for (const update of data) {
          if (update.name) matterbridge.frontend.wssSendSnackbarMessage('Shelly software update available: ' + update.name, 10);
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
  fetchShelly('/api/updates/main/perform', 10 * 1000)
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
      matterbridge.frontend.wssSendSnackbarMessage('Installing Shelly software update...', 60);
      matterbridge.frontend.wssBroadcastMessage(WS_ID_SHELLY_MAIN_UPDATE, 'shelly-main-update', { available: false });
    });
}

/**
 * Perform a call to Shelly board apis.
 * @param {string} api - The api to call:
 *
 *     /api/updates/sys/check => [{name:string; ...}]
 *     /api/updates/sys/perform => {"updatingInProgress":true} or {"updatingInProgress":false}
 *     /api/updates/sys/status => {"updatingInProgress":true} or {"updatingInProgress":false}
 *     /api/updates/main/check => [{name:string; ...}]
 *     /api/updates/main/perform => {"updatingInProgress":true} or {"updatingInProgress":false}
 *     /api/updates/main/status  => {"updatingInProgress":true} or {"updatingInProgress":false}
 *
 *     curl -X POST http://127.0.0.1:8101/api/system/reboot => {"success":true}
 *
 * @param {number} [timeout=5000] - The timeout duration in milliseconds (default is 60000ms).
 * @returns {Promise<any>} A promise that resolves to the response.
 * @throws {Error} If the request fails.
 */
async function fetchShelly(api: string, timeout = 60000): Promise<any> {
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

    req.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Request failed: ${error instanceof Error ? error.message : error}`));
    });
  });
}

/*
https://mtrbrgup.shelly.cloud/updates/system/dpkg.json
https://mtrbrgup.shelly.cloud/updates/npm/latest

apt-get install -y nodejs=22.13.1-1nodesource1 -y --allow-downgrades
apt-get install -y nodejs=22.14.0-1nodesource1 -y
*/
/*
Feb 21 16:40:22 matterbridge matterbridge-updater.sh[1704]: INFO [16:40:21.481] (shelly-matter-bridge/1704): npm install -g https://mtrbrgup.shelly.cloud/updates/npm/matterbridge-2.1.5.tgz
Feb 21 16:42:16 matterbridge matterbridge-updater.sh[1704]: INFO [16:42:15.991] (shelly-matter-bridge/1704): npm install -g https://mtrbrgup.shelly.cloud/updates/npm/matterbridge-2.1.5.tgz -> changed 172 packages in 2m
Feb 21 16:42:16 matterbridge matterbridge-updater.sh[1704]: 42 packages are looking for funding
Feb 21 16:42:16 matterbridge matterbridge-updater.sh[1704]:   run `npm fund` for details
Feb 21 16:42:16 matterbridge matterbridge-updater.sh[1704]: INFO [16:42:16.010] (shelly-matter-bridge/1704): npm install -g https://mtrbrgup.shelly.cloud/updates/npm/matterbridge-shelly-1.1.6.tgz
Feb 21 16:42:41 matterbridge matterbridge-updater.sh[1704]: INFO [16:42:41.172] (shelly-matter-bridge/1704): npm install -g https://mtrbrgup.shelly.cloud/updates/npm/matterbridge-shelly-1.1.6.tgz -> changed 40 packages in 20s
Feb 21 16:42:41 matterbridge matterbridge-updater.sh[1704]: 12 packages are looking for funding
Feb 21 16:42:41 matterbridge matterbridge-updater.sh[1704]:   run `npm fund` for details
Feb 21 16:42:41 matterbridge matterbridge-updater.sh[1704]: INFO [16:42:41.174] (shelly-matter-bridge/1704): cp /root/.npm/lib/node_modules/shelly-matter-bridge/image-build/files/var/services/shelly-matter-bridge/matterbridge.sh /var/services/shelly-matter-bridge/
Feb 21 16:42:44 matterbridge matterbridge-updater.sh[1704]: INFO [16:42:44.136] (shelly-matter-bridge/1704): cp /root/.npm/lib/node_modules/shelly-matter-bridge/image-build/files/var/services/shelly-matter-bridge/matterbridge-updater.sh /var/services/shelly-matter-bridge/
Feb 21 16:42:47 matterbridge matterbridge-updater.sh[1704]: INFO [16:42:46.998] (shelly-matter-bridge/1704): cp /root/.npm/lib/node_modules/shelly-matter-bridge/image-build/files/var/services/shelly-matter-bridge/matterbridge-updater-gpio.sh /var/services/shelly-matter-bridge/
Feb 21 16:42:50 matterbridge matterbridge-updater.sh[1704]: INFO [16:42:49.878] (shelly-matter-bridge/1704): chmod +x /var/services/shelly-matter-bridge/matterbridge.sh
Feb 21 16:42:53 matterbridge matterbridge-updater.sh[1704]: INFO [16:42:52.753] (shelly-matter-bridge/1704): chmod +x /var/services/shelly-matter-bridge/matterbridge-updater.sh
Feb 21 16:42:56 matterbridge matterbridge-updater.sh[1704]: INFO [16:42:55.600] (shelly-matter-bridge/1704): chmod +x /var/services/shelly-matter-bridge/matterbridge-updater-gpio.sh
Feb 21 16:42:59 matterbridge matterbridge-updater.sh[1704]: INFO [16:42:58.452] (shelly-matter-bridge/1704): matterbridge -add matterbridge-shelly
Feb 21 16:43:28 matterbridge matterbridge-updater.sh[1704]: [150B blob data]
Feb 21 16:43:28 matterbridge matterbridge-updater.sh[1704]: [134B blob data]
Feb 21 16:43:28 matterbridge matterbridge-updater.sh[1704]: INFO [16:43:27.466] (shelly-matter-bridge/1704): systemctl restart matterbridge
*/
