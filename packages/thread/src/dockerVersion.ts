/**
 * This file contains the getDockerVersion function.
 *
 * @file dockerVersion.ts
 * @author Luca Liguori
 * @created 2026-02-19
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027 Luca Liguori.
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

import { isValidString } from '@matterbridge/utils';

type DockerRegistryTokenResponse = {
  token?: string;
  access_token?: string;
};

type DockerManifestV2 = {
  schemaVersion?: number;
  mediaType?: string;
  config?: { digest?: string };
  manifests?: Array<{ digest?: string; platform?: { architecture?: string; os?: string } }>;
};

type DockerConfigBlob = {
  config?: {
    Labels?: Record<string, string>;
  };
  container_config?: {
    Labels?: Record<string, string>;
  };
};

/**
 * Fetches JSON via HTTPS GET.
 *
 * @param {string} url The URL.
 * @param {Record<string, string> | undefined} headers Optional request headers.
 * @param {number} timeoutMs Timeout in milliseconds.
 * @returns {Promise<T>} Parsed JSON.
 */
async function httpsGetJson<T>(url: string, headers: Record<string, string> | undefined, timeoutMs: number): Promise<T> {
  const https = await import('node:https');
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Request timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);

    const req = https.get(url, { headers, signal: controller.signal }, (res) => {
      let data = '';
      const statusCode = res.statusCode ?? 0;

      if (statusCode >= 300 && statusCode < 400) {
        const locationHeader = Array.isArray(res.headers.location) ? res.headers.location[0] : res.headers.location;
        if (locationHeader) {
          clearTimeout(timeoutId);
          res.resume();

          const redirectedUrl = new URL(locationHeader, url).toString();
          let redirectedHeaders = headers;
          try {
            const fromHost = new URL(url).host;
            const toHost = new URL(redirectedUrl).host;
            if (fromHost !== toHost && redirectedHeaders?.Authorization) {
              const { Authorization: _authorization, ...rest } = redirectedHeaders;
              redirectedHeaders = rest;
            }
          } catch {
            // ignore URL parsing errors
          }

          httpsGetJson<T>(redirectedUrl, redirectedHeaders, timeoutMs).then(resolve).catch(reject);
          return;
        }
      }

      if (statusCode < 200 || statusCode >= 300) {
        clearTimeout(timeoutId);
        res.resume();
        reject(new Error(`Failed to fetch data. Status code: ${statusCode}`));
        return;
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        clearTimeout(timeoutId);
        try {
          resolve(JSON.parse(data) as T);
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

/**
 * Picks a reasonable platform manifest digest (prefers linux/amd64).
 *
 * @param {DockerManifestV2} manifestList The manifest list/index.
 * @returns {string | undefined} The chosen manifest digest.
 */
function pickPlatformManifestDigest(manifestList: DockerManifestV2): string | undefined {
  const manifests = manifestList.manifests;
  if (!manifests || manifests.length === 0) return undefined;
  const linuxAmd64 = manifests.find((m) => m.platform?.os === 'linux' && m.platform?.architecture === 'amd64');
  return linuxAmd64?.digest ?? manifests[0]?.digest;
}

/**
 * Extracts the OCI version label from an image config blob.
 *
 * @param {DockerConfigBlob} config The config blob.
 * @returns {string | undefined} Version label.
 */
function getOciVersionLabel(config: DockerConfigBlob): string | undefined {
  return (
    config.config?.Labels?.['org.opencontainers.image.version'] ??
    config.container_config?.Labels?.['org.opencontainers.image.version'] ??
    config.config?.Labels?.['org.label-schema.version'] ??
    config.container_config?.Labels?.['org.label-schema.version']
  );
}

/**
 * Retrieves the OCI image version label from a Docker Hub image.
 *
 * Example: getDockerVersion('luligu', 'matterbridge', 'latest')
 *
 * @param {string} owner Docker Hub namespace (e.g. luligu).
 * @param {string} repo Docker Hub repository (e.g. matterbridge).
 * @param {string} tag Docker tag (e.g. latest).
 * @param {number} timeoutMs Timeout in milliseconds.
 * @returns {Promise<string | undefined>} The OCI version label (org.opencontainers.image.version) if available.
 */
export async function getDockerVersion(owner: string, repo: string, tag = 'latest', timeoutMs = 5_000): Promise<string | undefined> {
  if (!isValidString(owner, 1) || !isValidString(repo, 1) || !isValidString(tag, 1)) return undefined;

  try {
    const tokenUrl = `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${owner}/${repo}:pull`;
    const tokenJson = await httpsGetJson<DockerRegistryTokenResponse>(tokenUrl, undefined, timeoutMs);
    const token = tokenJson.token ?? tokenJson.access_token;
    if (!isValidString(token, 10)) return undefined;

    const baseHeaders: Record<string, string> = { Authorization: `Bearer ${token}` };

    const manifestUrl = `https://registry-1.docker.io/v2/${owner}/${repo}/manifests/${encodeURIComponent(tag)}`;
    const accept = [
      'application/vnd.docker.distribution.manifest.v2+json',
      'application/vnd.oci.image.manifest.v1+json',
      'application/vnd.docker.distribution.manifest.list.v2+json',
      'application/vnd.oci.image.index.v1+json',
    ].join(', ');

    let manifest = await httpsGetJson<DockerManifestV2>(manifestUrl, { ...baseHeaders, Accept: accept }, timeoutMs);

    if (manifest.config?.digest === undefined && manifest.manifests !== undefined) {
      const digest = pickPlatformManifestDigest(manifest);
      if (!digest) return undefined;
      const byDigestUrl = `https://registry-1.docker.io/v2/${owner}/${repo}/manifests/${digest}`;
      manifest = await httpsGetJson<DockerManifestV2>(byDigestUrl, { ...baseHeaders, Accept: accept }, timeoutMs);
    }

    const configDigest = manifest.config?.digest;
    if (!isValidString(configDigest, 10)) return undefined;

    const configUrl = `https://registry-1.docker.io/v2/${owner}/${repo}/blobs/${configDigest}`;
    const config = await httpsGetJson<DockerConfigBlob>(configUrl, { ...baseHeaders, Accept: 'application/json' }, timeoutMs);

    return getOciVersionLabel(config);
  } catch {
    return undefined;
  }
}
