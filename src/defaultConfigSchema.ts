/**
 * This file contains the default config end schema for the plugins.
 *
 * @file utils.ts
 * @author Luca Liguori
 * @date 2024-05-07
 * @version 1.0.0
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

import { PlatformConfig, PlatformSchema } from './matterbridge.js';

export const zigbee2mqtt_config: PlatformConfig = {
  name: 'matterbridge-zigbee2mqtt',
  type: 'DynamicPlatform',
  host: 'localhost',
  username: '',
  password: '',
  port: 1883,
  topic: 'zigbee2mqtt',
  unregisterOnShutdown: false,
  blackList: [],
  whiteList: [],
  switchList: [],
  lightList: [],
  outletList: [],
  featureBlackList: [],
  deviceFeatureBlackList: {},
};

export const zigbee2mqtt_schema: PlatformSchema = {
  title: 'Matterbridge zigbee2mqtt plugin',
  description: 'matterbridge-zigbee2mqtt v. 2.0.13 by https://github.com/Luligu',
  type: 'object',
  required: ['username', 'password', 'host', 'port', 'topic'],
  properties: {
    name: {
      description: 'Plugin name',
      type: 'string',
      readOnly: true,
    },
    type: {
      description: 'Plugin type',
      type: 'string',
      readOnly: true,
    },
    host: {
      description: 'Host',
      type: 'string',
    },
    username: {
      description: 'Username',
      type: 'string',
    },
    password: {
      description: 'Password',
      type: 'string',
    },
    port: {
      description: 'Port',
      type: 'number',
    },
    topic: {
      description: 'Topic',
      type: 'string',
    },
    blackList: {
      description: 'The devices in the list will not be exposed.',
      type: 'array',
      items: {
        type: 'string',
      },
    },
    whiteList: {
      description: 'Only the devices in the list will be exposed.',
      type: 'array',
      items: {
        type: 'string',
      },
    },
    switchList: {
      description: 'The devices in the list will be exposed like switches.',
      type: 'array',
      items: {
        type: 'string',
      },
    },
    lightList: {
      description: 'The devices in the list will be exposed like lights.',
      type: 'array',
      items: {
        type: 'string',
      },
    },
    outletList: {
      description: 'The devices in the list will be exposed like outlets.',
      type: 'array',
      items: {
        type: 'string',
      },
    },
    featureBlackList: {
      description: 'The features in the list will not be exposed for all devices.',
      type: 'array',
      items: {
        type: 'string',
      },
    },
    deviceFeatureBlackList: {
      description: 'List of features not to be exposed for a single device. Enter in the first field the name of the device and in the second field add all the features to exclude.',
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
    },
    unregisterOnShutdown: {
      description: 'Unregister all devices on shutdown (development only)',
      type: 'boolean',
    },
  },
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
};

export const somfytahoma_schema: PlatformSchema = {
  title: 'Matterbridge somfy tahoma plugin',
  description: 'matterbridge-somfy-tahoma v. 1.0.7 by https://github.com/Luligu',
  type: 'object',
  required: ['username', 'password', 'service'],
  properties: {
    name: {
      description: 'Plugin name',
      type: 'string',
      readOnly: true,
    },
    type: {
      description: 'Plugin type',
      type: 'string',
      readOnly: true,
    },
    username: {
      description: 'Username',
      type: 'string',
    },
    password: {
      description: 'Password',
      type: 'string',
    },
    service: {
      description: 'Service name to connect to',
      type: 'string',
      oneOf: [
        {
          title: 'Local API (TaHoma / Switch)',
          enum: ['local'],
        },
        {
          title: 'Somfy Europe (TaHoma / Switch / Connexoon IO)',
          enum: ['somfy_europe'],
        },
        {
          title: 'Somfy Australia (Connexoon RTS)',
          enum: ['somfy_australia'],
        },
        {
          title: 'Somfy North America',
          enum: ['somfy_north_america'],
        },
      ],
    },
    blackList: {
      description: 'The devices in the list will not be exposed.',
      type: 'array',
      items: {
        type: 'string',
      },
    },
    whiteList: {
      description: 'Only the devices in the list will be exposed.',
      type: 'array',
      items: {
        type: 'string',
      },
    },
    movementDuration: {
      description: 'Set the duration in seconds of the full movement for each device. Enter in the first field the name of the device and in the second field the duration in seconds.',
      type: 'object',
      additionalProperties: {
        type: 'integer',
      },
    },
    unregisterOnShutdown: {
      description: 'Unregister all devices on shutdown (development only)',
      type: 'boolean',
    },
  },
};

export const shelly_config: PlatformConfig = {
  name: 'matterbridge-shelly',
  type: 'DynamicPlatform',
  blackList: [],
  whiteList: [],
  deviceIp: {},
  enableMdnsDiscover: true,
  enableStorageDiscover: true,
  resetStorageDiscover: false,
  enableConfigDiscover: false,
  debug: false,
  unregisterOnShutdown: false,
};

export const shelly_schema: PlatformSchema = {
  title: 'Matterbridge shelly plugin',
  description: 'matterbridge-shelly v. 0.0.1 by https://github.com/Luligu',
  type: 'object',
  properties: {
    name: {
      description: 'Plugin name',
      type: 'string',
      readOnly: true,
    },
    type: {
      description: 'Plugin type',
      type: 'string',
      readOnly: true,
    },
    username: {
      description: 'Username (always admin for gen 2 and 3 devices so use admin also for gen 1)',
      type: 'string',
    },
    password: {
      description: 'Password (must be unique for all the devices)',
      type: 'string',
    },
    blackList: {
      description: 'The devices in the list will not be exposed. Use the device id (e.g. shellyplus2pm-5443b23d81f8)',
      type: 'array',
      items: {
        type: 'string',
      },
    },
    whiteList: {
      description: 'Only the devices in the list will be exposed. Use the device id (e.g. shellyplus2pm-5443b23d81f8)',
      type: 'array',
      items: {
        type: 'string',
      },
    },
    deviceIp: {
      description: 'Set the IP address for each device. Enter in the first field the shelly ID of the device and in the second field the IP address. (e.g. shelly1minig3-543204547478: 192.168.1.221)',
      type: 'object',
      additionalProperties: {
        type: 'string',
      },
    },
    enableMdnsDiscover: {
      description: 'Enable the mdns discovery for shelly devices (it will stop after 10 minutes)',
      type: 'boolean',
    },
    enableStorageDiscover: {
      description: 'Enable storage discovery for shelly devices (it will load from the storage the devices already discovered)',
      type: 'boolean',
    },
    resetStorageDiscover: {
      description: 'Reset the storage discovery on the next restart (it will clear the storage of already discovers devices)',
      type: 'boolean',
    },
    enableConfigDiscover: {
      description: 'Enable config discovery for shelly devices (it will load the devices from deviceIp config setting)',
      type: 'boolean',
    },
    enableBleDiscover: {
      description: 'Enable ble discovery for shelly devices (under development)',
      type: 'boolean',
      readOnly: true,
    },
    debug: {
      description: 'Enable the debug for the plugin (development only)',
      type: 'boolean',
    },
    unregisterOnShutdown: {
      description: 'Unregister all devices on shutdown (development only)',
      type: 'boolean',
    },
  },
};
