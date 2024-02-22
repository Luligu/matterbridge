/* eslint-disable @typescript-eslint/no-unused-vars */
import { AnsiLogger, TimestampFormat, dn, gn, db, wr, zb } from 'node-ansi-logger';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import os from 'os';
import path from 'path';

export class MatterBridge extends EventEmitter {
  private log: AnsiLogger;

  constructor() {
    super();
    this.log = new AnsiLogger({ logName: 'MatterBridge', logTimestampFormat: TimestampFormat.TIME_MILLIS });

    this.logNodeAndSystemInfo();

    this.log.debug('Created MatterBridge');
  }

  logNodeAndSystemInfo() { 

    // Node information
    const version = process.versions.node;
    const versionMajor = parseInt(version.split('.')[0]);
    const versionMinor = parseInt(version.split('.')[1]);
    const versionPatch = parseInt(version.split('.')[2]);

    // Host system information
    const osType = os.type(); // "Windows_NT", "Darwin", etc.
    const osRelease = os.release(); // Kernel version
    const osPlatform = os.platform(); // "win32", "linux", "darwin", etc.
    const osArch = os.arch(); // "x64", "arm", etc.
    const totalMemory = os.totalmem() / 1024 / 1024 / 1024; // Convert to GB
    const freeMemory = os.freemem() / 1024 / 1024 / 1024; // Convert to GB
    const systemUptime = os.uptime() / 60 / 60; // Convert to hours

    // Log the system information
    this.log.info(`Host System Information:
          - Node.js: ${versionMajor}.${versionMinor}.${versionPatch}
          - OS Type: ${osType}
          - OS Release: ${osRelease}
          - Platform: ${osPlatform}
          - Architecture: ${osArch}
          - Total Memory: ${totalMemory.toFixed(2)} GB
          - Free Memory: ${freeMemory.toFixed(2)} GB
          - System Uptime: ${systemUptime.toFixed(2)} hours`);

    // Command line arguments (excluding 'node' and the script name)
    const cmdArgs = process.argv.slice(2).join(' ');
    this.log.info(`Command Line Arguments: ${cmdArgs}`);

    // Current working directory
    const currentDir = process.cwd();
    this.log.info(`Current Working Directory: ${currentDir}`);

    // Package root directory
    const currentFileDirectory = path.dirname(fileURLToPath(import.meta.url));
    const packageRootDirectory = path.resolve(currentFileDirectory, '../');
    this.log.info(`Package Root Directory: ${packageRootDirectory}`);
  }
}