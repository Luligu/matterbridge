/**
 * @description This file contains the spawn functions.
 * @file spawn.ts
 * @author Luca Liguori
 * @created 2025-02-16
 * @version 1.2.0
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

import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';
import { hasParameter } from '@matterbridge/utils';

import { BroadcastServer } from './broadcastServer.js';

/**
 * Spawns a child process with the given command and arguments.
 *
 * @param {string} command - The command to execute.
 * @param {string[]} args - The arguments to pass to the command (default: []).
 * @param {'install' | 'uninstall'} packageCommand - The optional package command being executed (e.g., 'install', 'uninstall').
 * @param {string} [packageName] - The optional name of the package being installed.
 * @returns {Promise<boolean>} A promise that resolves to true if the command executed successfully, false otherwise.
 */
export async function spawnCommand(command: string, args: string[], packageCommand?: 'install' | 'uninstall', packageName?: string): Promise<boolean> {
  const { spawn } = await import('node:child_process');

  /** Broadcast server */
  const debug = hasParameter('debug') || hasParameter('verbose');
  const verbose = hasParameter('verbose');
  const log = new AnsiLogger({ logName: 'Spawn', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: debug ? LogLevel.DEBUG : LogLevel.INFO });
  const server = new BroadcastServer('spawn', log);

  const sendLog = (name: string, message: string) => {
    try {
      server.request({ type: 'frontend_logmessage', src: 'spawn', dst: 'frontend', params: { level: 'spawn', time: log.now(), name, message } });
    } catch (err) {
      // istanbul ignore next cause it's a precaution
      log.debug(`Failed to send log message to frontend: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (verbose) log.debug(`Spawning command: ${command} with ${args.join(' ')} ${packageCommand} ${packageName}`);

  /*
   *  npm > npm.cmd on windows
   *  cmd.exe ['dir'] on windows
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
  log.debug(`Spawn command ${command} with ${args.join(' ')}`);

  const success = await new Promise<boolean>((resolve) => {
    if (packageCommand === 'install') sendLog('Matterbridge:spawn-init', `Installing ${packageName}`);
    else if (packageCommand === 'uninstall') sendLog('Matterbridge:spawn-init', `Uninstalling ${packageName}`);

    const childProcess = spawn(command, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    childProcess.on('error', (err) => {
      log.error(`Failed to start child process "${cmdLine}": ${err.message}`);
      sendLog('Matterbridge:spawn-exit-error', 'Spawn process error');
      resolve(false);
    });

    childProcess.on('close', (code, signal) => {
      if (code === 0) {
        log.debug(`Child process "${cmdLine}" closed with code ${code} and signal ${signal}`);
        sendLog('Matterbridge:spawn-exit-success', 'Child process closed');
        resolve(true);
      } else {
        log.error(`Child process "${cmdLine}" closed with code ${code} and signal ${signal}`);
        sendLog('Matterbridge:spawn-exit-error', 'Child process closed');
        resolve(false);
      }
    });

    childProcess.on('exit', (code, signal) => {
      if (code === 0) {
        log.debug(`Child process "${cmdLine}" exited with code ${code} and signal ${signal}`);
        sendLog('Matterbridge:spawn-exit-success', 'Child process exited');
        resolve(true);
      } else {
        log.error(`Child process "${cmdLine}" exited with code ${code} and signal ${signal}`);
        sendLog('Matterbridge:spawn-exit-error', 'Child process exited');
        resolve(false);
      }
    });

    childProcess.on('disconnect', () => {
      log.debug(`Child process "${cmdLine}" has been disconnected from the parent`);
      resolve(true);
    });

    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        const lines = message.split('\n');
        for (const line of lines) {
          log.debug(`Spawn output (stdout): ${line}`);
          sendLog('Matterbridge:spawn', line);
        }
      });
      /*
      childProcess.stdout.on('close', () => {
        log.debug(`Spawn output (stdout): closed`);
        resolve(true);
      });
      childProcess.stdout.on('end', () => {
        log.debug(`Spawn output (stdout): ended`);
        resolve(true);
      });
      childProcess.stdout.on('error', () => {
        log.debug(`Spawn output (stdout): error`);
        resolve(true);
      });
      */
    }

    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        const lines = message.split('\n');
        for (const line of lines) {
          log.debug(`Spawn verbose (stderr): ${line}`);
          sendLog('Matterbridge:spawn', line);
        }
      });
      /*
      childProcess.stderr.on('close', () => {
        log.debug(`Spawn verbose (stderr): closed`);
        resolve(true);
      });
      childProcess.stderr.on('end', () => {
        log.debug(`Spawn verbose (stderr): ended`);
        resolve(true);
      });
      childProcess.stderr.on('error', () => {
        log.debug(`Spawn verbose (stderr): error`);
        resolve(true);
      });
      */
    }
  });
  server.close();
  return success;
}
