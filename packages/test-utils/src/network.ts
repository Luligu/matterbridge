/**
 * @file packages/test-utils/src/network.ts
 * @description This file contains a copy of the getInterfaceName helper of @matterbridge/utils/network, to avoid a dependency cycle with @matterbridge/utils.
 * @author Luca Liguori
 * @created 2026-10-11
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

import os from 'node:os';

// Keep in sync with excludedInterfaceNamePattern in packages/utils/src/network.ts
const excludedInterfaceNamePattern =
  /(tailscale|wireguard|openvpn|zerotier|hamachi|\bwg\d+\b|\btun\d+\b|\btap\d+\b|\butun\d+\b|docker|podman|\bveth[a-z0-9]*\b|\bbr-[a-z0-9]+\b|cni|kube|flannel|calico|virbr\d*\b|vmware|vmnet\d*\b|virtualbox|vboxnet\d*\b|teredo|isatap)/i;

/**
 * Retrieves the first non-internal network interface name, skipping the virtual and VPN interfaces.
 * Copy of getInterfaceName of @matterbridge/utils/network.
 *
 * @returns {string | undefined} The name of the selected network interface, or undefined if not found.
 */
export function getInterfaceName(): string | undefined {
  for (const [interfaceName, interfaceDetails] of Object.entries(os.networkInterfaces())) {
    if (!interfaceName || excludedInterfaceNamePattern.test(interfaceName)) continue;
    for (const detail of interfaceDetails ?? []) {
      if (!detail.internal) return interfaceName;
    }
  }
  return undefined;
}
