/**
 * This file contains the default config for the plugins.
 *
 * @file defaultConfigSchema.ts
 * @author Luca Liguori
 * @date 2024-05-07
 * @version 1.0.1
 *
 * Copyright 2024 Luca Liguori.
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

import { PlatformConfig } from './matterbridgePlatform.js';

export const zigbee2mqtt_config: PlatformConfig = {
  name: 'matterbridge-zigbee2mqtt',
  type: 'DynamicPlatform',
  host: 'localhost',
  username: '',
  password: '',
  port: 1883,
  topic: 'zigbee2mqtt',
  blackList: [],
  whiteList: [],
  switchList: [],
  lightList: [],
  outletList: [],
  featureBlackList: [],
  deviceFeatureBlackList: {},
  debug: false,
  unregisterOnShutdown: false,
};

export const somfytahoma_config: PlatformConfig = {
  name: 'matterbridge-somfy-tahoma',
  type: 'DynamicPlatform',
  username: '',
  password: '',
  service: 'somfy_europe',
  blackList: [],
  whiteList: [],
  movementDuration: {},
  debug: false,
  unregisterOnShutdown: false,
};

export const shelly_config: PlatformConfig = {
  name: 'matterbridge-shelly',
  type: 'DynamicPlatform',
  username: '',
  password: '',
  exposeSwitch: 'switch',
  switchList: [],
  lightList: [],
  outletList: [],
  exposeInput: 'momentary',
  inputContactList: [],
  inputMomentaryList: [],
  inputLatchingList: [],
  exposeInputEvent: 'momentary',
  inputEventList: [],
  exposePowerMeter: 'matter13',
  blackList: [],
  whiteList: [],
  nocacheList: [],
  deviceIp: {},
  enableMdnsDiscover: true,
  enableStorageDiscover: true,
  resetStorageDiscover: false,
  enableConfigDiscover: false,
  enableBleDiscover: true,
  failsafeCount: 0,
  postfix: '',
  debug: false,
  debugMdns: false,
  debugCoap: false,
  debugWs: false,
  unregisterOnShutdown: false,
};
