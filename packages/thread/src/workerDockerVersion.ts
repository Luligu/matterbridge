/**
 * This file contains the workerDockerVersion thread.
 *
 * @file workerDockerVersion.ts
 * @author Luca Liguori
 * @created 2026-03-22
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

import { readFileSync } from 'node:fs';

import { DockerBuildConfig } from '@matterbridge/types';
import { inspectError } from '@matterbridge/utils/error';
import { debugStringify, LogLevel } from 'node-ansi-logger';

import { getDockerVersion } from './dockerVersion.js';
import { WorkerWrapper } from './workerWrapper.js';

export default new WorkerWrapper('DockerVersion', async (worker) => {
  worker.logger(LogLevel.INFO, `Starting docker version check...`);
  let success = false;
  let dockerBuildConfig: DockerBuildConfig | undefined;
  let dockerVersionLatest: string | undefined;
  let dockerVersionDev: string | undefined;
  try {
    dockerBuildConfig = JSON.parse(readFileSync('/matterbridge/.dockerbuild.json', 'utf-8'));
    worker.logger(LogLevel.DEBUG, `Docker build config: ${debugStringify(dockerBuildConfig)}`);
    worker.logger(LogLevel.INFO, `Docker build config: version=${dockerBuildConfig?.version} dev=${dockerBuildConfig?.dev}`);
  } catch (_error) {
    worker.logger(LogLevel.DEBUG, `Failed to read docker build config`);
  }
  try {
    dockerVersionLatest = await getDockerVersion('luligu', 'matterbridge', 'latest');
    dockerVersionDev = await getDockerVersion('luligu', 'matterbridge', 'dev');
    worker.logger(LogLevel.INFO, `Docker version check succeeded: latest=${dockerVersionLatest}, dev=${dockerVersionDev}, current=${dockerBuildConfig?.version ?? 'unknown'}`);
    success = true;
  } catch (error) {
    const errorMessage = inspectError(worker.log, `Failed to check docker version`, error);
    worker.logger(LogLevel.ERROR, errorMessage);
  }
  if (dockerBuildConfig && dockerBuildConfig.dev === false && dockerVersionLatest && dockerBuildConfig.version !== dockerVersionLatest)
    worker.logger(LogLevel.WARN, `You are using the v.${dockerBuildConfig.version} latest Docker image. Please pull the latest Docker image v.${dockerVersionLatest}.`);
  if (dockerBuildConfig && dockerBuildConfig.dev === true && dockerVersionDev && dockerBuildConfig.version !== dockerVersionDev)
    worker.logger(LogLevel.WARN, `You are using the v.${dockerBuildConfig.version} dev Docker image. Please pull the dev Docker image v.${dockerVersionDev}.`);

  worker.server.request({
    type: 'matterbridge_docker_version',
    src: `manager`,
    dst: 'matterbridge',
    params: {
      dockerVersion: dockerBuildConfig?.version,
      dockerDev: dockerBuildConfig?.dev,
      dockerLatestVersion: dockerVersionLatest,
      dockerDevVersion: dockerVersionDev,
    },
  });
  return success;
});
