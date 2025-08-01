/**
 * @description This file contains the spawn functions.
 * @file spawn.ts
 * @author Luca Liguori
 * @created 2025-02-16
 * @version 1.1.0
 * @license Apache-2.0
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
 * limitations under the License.
 */

import type { Matterbridge } from '../matterbridge.js';

import { hasParameter } from './commandLine.js';

/**
 * Spawns a child process with the given command and arguments.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance to use for logging and sending messages.
 * @param {string} command - The command to execute.
 * @param {string[]} args - The arguments to pass to the command (default: []).
 * @returns {Promise<boolean>} A promise that resolves when the child process exits successfully, or rejects if there is an error.
 */
export async function spawnCommand(matterbridge: Matterbridge, command: string, args: string[]): Promise<boolean> {
  const { spawn } = await import('node:child_process');

  /*
    npm > npm.cmd on windows
    cmd.exe ['dir'] on windows
    await this.spawnCommand('npm', ['install', '-g', 'matterbridge']);
    */
  const cmdLine = command + ' ' + args.join(' ');
  if (process.platform === 'win32' && command === 'npm') {
    // Must be spawn('cmd.exe', ['/c', 'npm -g install <package>']);
    const argstring = 'npm ' + args.join(' ');
    args.splice(0, args.length, '/c', argstring);
    command = 'cmd.exe';
  }
  // Decide when using sudo on linux and macOS
  // When you need sudo: Spawn stderr: npm error Error: EACCES: permission denied
  // When you don't need sudo: Failed to start child process "npm install -g matterbridge-eve-door": spawn sudo ENOENT
  if (hasParameter('sudo') || (process.platform !== 'win32' && command === 'npm' && !hasParameter('docker') && !hasParameter('nosudo'))) {
    args.unshift(command);
    command = 'sudo';
  }
  matterbridge.log.debug(`Spawn command ${command} with ${args.join(' ')}`);
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    childProcess.on('error', (err) => {
      matterbridge.log.error(`Failed to start child process "${cmdLine}": ${err.message}`);
      reject(err);
    });

    childProcess.on('close', (code, signal) => {
      matterbridge.frontend.wssSendMessage('spawn', matterbridge.log.now(), 'Matterbridge:spawn', `child process closed with code ${code} and signal ${signal}`);
      if (code === 0) {
        if (cmdLine.startsWith('npm install -g')) matterbridge.log.notice(`Package ${cmdLine.replace('npm install -g ', '').replace('--verbose', '').replace('--omit=dev', '')} installed correctly`);
        matterbridge.log.debug(`Child process "${cmdLine}" closed with code ${code} and signal ${signal}`);
        resolve(true);
      } else {
        matterbridge.log.error(`Child process "${cmdLine}" closed with code ${code} and signal ${signal}`);
        reject(new Error(`Child process "${cmdLine}" closed with code ${code} and signal ${signal}`));
      }
    });

    childProcess.on('exit', (code, signal) => {
      matterbridge.frontend.wssSendMessage('spawn', matterbridge.log.now(), 'Matterbridge:spawn', `child process exited with code ${code} and signal ${signal}`);
      if (code === 0) {
        matterbridge.log.debug(`Child process "${cmdLine}" exited with code ${code} and signal ${signal}`);
        resolve(true);
      } else {
        matterbridge.log.error(`Child process "${cmdLine}" exited with code ${code} and signal ${signal}`);
        reject(new Error(`Child process "${cmdLine}" exited with code ${code} and signal ${signal}`));
      }
    });

    childProcess.on('disconnect', () => {
      matterbridge.log.debug(`Child process "${cmdLine}" has been disconnected from the parent`);
      resolve(true);
    });

    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        matterbridge.log.debug(`Spawn output (stdout): ${message}`);
        matterbridge.frontend.wssSendMessage('spawn', matterbridge.log.now(), 'Matterbridge:spawn', message);
      });
    }

    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        matterbridge.log.debug(`Spawn verbose (stderr): ${message}`);
        matterbridge.frontend.wssSendMessage('spawn', matterbridge.log.now(), 'Matterbridge:spawn', message);
      });
    }
  });
}
