/**
 * This file contains the class MatterbridgeAccessoryPlatform.
 *
 * @file matterbridgePlatform.ts
 * @author Luca Liguori
 * @date 2024-03-21
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

import { Matterbridge } from './matterbridge.js';
import { AnsiLogger } from 'node-ansi-logger';
import { promises as fs } from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';

export type ConfigValue = string | number | boolean | bigint | object | undefined | null;

export type Config = {
  [key: string]: ConfigValue; // This allows any string as a key, and the value can be ConfigValue.
};

/**
 * Represents a Matterbridge accessory platform.
 *
 */
export class MatterbridgePlatform {
  protected matterbridge: Matterbridge;
  protected log: AnsiLogger;
  protected name = ''; // Will be set by the loadPlugin() method using the package.json value.
  protected type = ''; // Will be set by the extending classes.

  constructor(matterbridge: Matterbridge, log: AnsiLogger) {
    this.matterbridge = matterbridge;
    this.log = log;
  }

  async getConfig(): Promise<Config> {
    const configFile = path.join(this.matterbridge.matterbridgePluginDirectory, 'config.json');
    try {
      await fs.access(configFile);
      this.log.debug(`Config file found: ${configFile}.`);
      const data = await fs.readFile(configFile, 'utf8');
      return JSON.parse(data) as Config;
    } catch (err) {
      if (err instanceof Error) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'ENOENT') {
          try {
            await this.writeFile(configFile, JSON.stringify({ name: this.name, type: this.type }, null, 2));
            this.log.info(`Created config file: ${configFile}.`);
            return { name: this.name, type: this.type };
          } catch (err) {
            this.log.error(`Error creating config file ${configFile}: ${err}`);
            return Promise.reject(err);
          }
        } else {
          this.log.error(`Error accessing config file ${configFile}: ${err}`);
          return Promise.reject(err);
        }
      }
      return Promise.reject(err);
    }
  }

  async setConfig(config: Config): Promise<void> {
    const configFile = path.join(this.matterbridge.matterbridgeDirectory, 'config.json');
    try {
      await this.writeFile(configFile, JSON.stringify(config));
    } catch (err) {
      this.log.error(`Error setting config: ${err}`);
      return Promise.reject(err);
    }
  }

  private async writeFile(filePath: string, data: string) {
    // Write the data to a file
    await writeFile(`${filePath}`, data, 'utf8')
      .then(() => {
        this.log.debug(`Successfully wrote to ${filePath}`);
      })
      .catch((error) => {
        this.log.error(`Error writing to ${filePath}:`, error);
      });
  }
}
