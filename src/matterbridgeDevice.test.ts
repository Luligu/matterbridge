/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { jest } from '@jest/globals';

import { AnsiLogger, LogLevel } from 'node-ansi-logger';
import { bridgedNode, MatterbridgeDevice, powerSource } from './matterbridgeDevice.js';

describe('Matterbridge platform', () => {
  beforeAll(async () => {
    // Mock the AnsiLogger.log method
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'debug').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked debug: ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'info').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked info: ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'warn').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked warn: ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'error').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked error: ${message}`, ...parameters);
    });
  });

  afterAll(async () => {
    // Restore the mocked AnsiLogger.log method
    (AnsiLogger.prototype.log as jest.Mock).mockRestore();
  }, 60000);

  test('create a device syncronously', async () => {
    const device = new MatterbridgeDevice(bridgedNode);
    expect(device.getDeviceTypes().length).toBeGreaterThan(0);
    expect(device.getDeviceTypes()[0].name).toBe('MA-bridgedNode');
  });

  test('create a device asyncronously', async () => {
    const device = await MatterbridgeDevice.loadInstance(powerSource);
    expect(device.getDeviceTypes().length).toBeGreaterThan(0);
    expect(device.getDeviceTypes()[0].name).toBe('MA-powerSource');
  });
});
