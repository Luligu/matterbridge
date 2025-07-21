import os from 'node:os';
import { AddressInfo } from 'node:net';

import { AnsiLogger, CYAN, LogLevel, nf } from 'node-ansi-logger';

import { jest } from '@jest/globals';

import { Dgram } from './dgram.js';
import { Unicast } from './unicast.js';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false;

if (!debug) {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = jest.spyOn(console, 'log');
  consoleDebugSpy = jest.spyOn(console, 'debug');
  consoleInfoSpy = jest.spyOn(console, 'info');
  consoleWarnSpy = jest.spyOn(console, 'warn');
  consoleErrorSpy = jest.spyOn(console, 'error');
}

function setDebug(debug: boolean) {
  if (debug) {
    loggerLogSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    consoleLogSpy = jest.spyOn(console, 'log');
    consoleDebugSpy = jest.spyOn(console, 'debug');
    consoleInfoSpy = jest.spyOn(console, 'info');
    consoleWarnSpy = jest.spyOn(console, 'warn');
    consoleErrorSpy = jest.spyOn(console, 'error');
  } else {
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
  }
}

describe('Unicast', () => {
  let ucast: Unicast;

  beforeAll(() => {
    //
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    //
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('Create the unicast with udp4 on all interfaces', async () => {
    ucast = new Unicast('Unicast', 'udp4');
    expect(ucast).not.toBeUndefined();
    expect(ucast).toBeInstanceOf(Dgram);
    expect(ucast.socketType).toBe('udp4');

    const ready = new Promise<AddressInfo>((resolve) => {
      ucast.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv4');
        expect(address.address).toBe('0.0.0.0');
        expect(address.port).toBeGreaterThan(0);
        resolve(address);
      });
    });
    ucast.start();
    await ready;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Starting ipv4 dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket listening on'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket broadcast enabled'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket bound to'));

    const closed = new Promise<void>((resolve) => {
      ucast.on('close', () => {
        resolve();
      });
    });
    ucast.stop();
    await closed;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopping dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopped dgram unicast socket.'));
  });

  test('Create the unicast with udp4 on 127.0.0.1', async () => {
    ucast = new Unicast('Unicast', 'udp4', true, undefined, '127.0.0.1');
    expect(ucast).not.toBeUndefined();
    expect(ucast).toBeInstanceOf(Dgram);
    expect(ucast.socketType).toBe('udp4');

    const ready = new Promise<AddressInfo>((resolve) => {
      ucast.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv4');
        expect(address.address).toBe('127.0.0.1');
        expect(address.port).toBeGreaterThan(0);
        resolve(address);
      });
    });
    ucast.start();
    await ready;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Starting ipv4 dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket listening on'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket broadcast enabled'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket bound to'));

    const closed = new Promise<void>((resolve) => {
      ucast.on('close', () => {
        resolve();
      });
    });
    ucast.stop();
    await closed;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopping dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopped dgram unicast socket.'));
  });

  test('Create the unicast with udp4 on external interface', async () => {
    const interfaces = os.networkInterfaces();
    const interfaceName = Object.keys(interfaces).find((name) => interfaces[name]?.some((addr) => addr.family === 'IPv4' && !addr.internal));
    expect(interfaceName).not.toBeUndefined();

    ucast = new Unicast('Unicast', 'udp4', true, interfaceName);
    expect(ucast).not.toBeUndefined();
    expect(ucast).toBeInstanceOf(Dgram);
    expect(ucast.socketType).toBe('udp4');

    const ready = new Promise<AddressInfo>((resolve) => {
      ucast.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv4');
        expect(address.address).toBeDefined();
        expect(address.port).toBeGreaterThan(0);
        resolve(address);
      });
    });
    ucast.start();
    await ready;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Starting ipv4 dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket listening on'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket broadcast enabled'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket bound to'));

    const closed = new Promise<void>((resolve) => {
      ucast.on('close', () => {
        resolve();
      });
    });
    ucast.stop();
    await closed;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopping dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopped dgram unicast socket.'));
  });

  test('Create the unicast with udp4 on all interfaces and port 8989', async () => {
    ucast = new Unicast('Unicast', 'udp4', true, undefined, undefined, 8989);
    expect(ucast).not.toBeUndefined();
    expect(ucast).toBeInstanceOf(Dgram);
    expect(ucast.socketType).toBe('udp4');
    expect(ucast.port).toBe(8989);

    const ready = new Promise<AddressInfo>((resolve) => {
      ucast.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv4');
        expect(address.address).toBe('0.0.0.0');
        expect(address.port).toBe(8989);
        resolve(address);
      });
    });
    ucast.start();
    await ready;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Starting ipv4 dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket listening on'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket broadcast enabled'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket bound to'));

    const closed = new Promise<void>((resolve) => {
      ucast.on('close', () => {
        resolve();
      });
    });
    ucast.stop();
    await closed;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopping dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopped dgram unicast socket.'));
  });

  test('Create the unicast with udp6 on all interfaces', async () => {
    ucast = new Unicast('Unicast', 'udp6');
    expect(ucast).not.toBeUndefined();
    expect(ucast).toBeInstanceOf(Dgram);
    expect(ucast.socketType).toBe('udp6');

    const ready = new Promise<AddressInfo>((resolve) => {
      ucast.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv6');
        expect(address.address).toBe('::');
        expect(address.port).toBeGreaterThan(0);
        resolve(address);
      });
    });
    ucast.start();
    await ready;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Starting ipv6 dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket listening on'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket broadcast enabled'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket bound to'));

    const closed = new Promise<void>((resolve) => {
      ucast.on('close', () => {
        resolve();
      });
    });
    ucast.stop();
    await closed;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopping dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopped dgram unicast socket.'));
  });

  test('Create the unicast with udp6 on ::1', async () => {
    ucast = new Unicast('Unicast', 'udp6', true, undefined, '::1');
    expect(ucast).not.toBeUndefined();
    expect(ucast).toBeInstanceOf(Dgram);
    expect(ucast.socketType).toBe('udp6');

    const ready = new Promise<AddressInfo>((resolve) => {
      ucast.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv6');
        expect(address.address).toBe('::1');
        expect(address.port).toBeGreaterThan(0);
        resolve(address);
      });
    });
    ucast.start();
    await ready;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Starting ipv6 dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket listening on'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket broadcast enabled'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket bound to'));

    const closed = new Promise<void>((resolve) => {
      ucast.on('close', () => {
        resolve();
      });
    });
    ucast.stop();
    await closed;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopping dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopped dgram unicast socket.'));
  });

  test('Create the unicast with udp6 on external interface', async () => {
    const interfaces = os.networkInterfaces();
    const interfaceName = Object.keys(interfaces).find((name) => interfaces[name]?.some((addr) => addr.family === 'IPv6' && !addr.internal));
    expect(interfaceName).not.toBeUndefined();

    ucast = new Unicast('Unicast', 'udp6', true, interfaceName);
    expect(ucast).not.toBeUndefined();
    expect(ucast).toBeInstanceOf(Dgram);
    expect(ucast.socketType).toBe('udp6');

    const ready = new Promise<AddressInfo>((resolve) => {
      ucast.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv6');
        expect(address.address).toBeDefined();
        expect(address.port).toBeGreaterThan(0);
        resolve(address);
      });
    });
    ucast.start();
    await ready;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Starting ipv6 dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket listening on'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket broadcast enabled'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket bound to'));

    const closed = new Promise<void>((resolve) => {
      ucast.on('close', () => {
        resolve();
      });
    });
    ucast.stop();
    await closed;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopping dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopped dgram unicast socket.'));
  });

  test('Create the unicast with udp6 on all interfaces and port 8989', async () => {
    ucast = new Unicast('Unicast', 'udp6', true, undefined, undefined, 8989);
    expect(ucast).not.toBeUndefined();
    expect(ucast).toBeInstanceOf(Dgram);
    expect(ucast.socketType).toBe('udp6');

    const ready = new Promise<AddressInfo>((resolve) => {
      ucast.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv6');
        expect(address.address).toBe('::');
        expect(address.port).toBe(8989);
        resolve(address);
      });
    });
    ucast.start();
    await ready;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Starting ipv6 dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket listening on'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket broadcast enabled'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram unicast socket bound to'));

    const closed = new Promise<void>((resolve) => {
      ucast.on('close', () => {
        resolve();
      });
    });
    ucast.stop();
    await closed;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopping dgram unicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopped dgram unicast socket.'));
  });

  test('Create client server unicast with udp4 on localhost', async () => {
    const server = new Unicast('Server', 'udp4', true, undefined, 'localhost', 8989);
    expect(server).not.toBeUndefined();
    expect(server).toBeInstanceOf(Unicast);
    expect(server.socketType).toBe('udp4');
    const serverReady = new Promise<AddressInfo>((resolve) => {
      server.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv4');
        expect(address.address).toBe('127.0.0.1');
        expect(address.port).toBe(8989);
        resolve(address);
      });
    });
    server.start();
    await serverReady;
    server.log.info(`Server ready on ${CYAN}${server.socketType}${nf} ${CYAN}${server.interfaceAddress}${nf}:${CYAN}${server.port}${nf}`);

    const client = new Unicast('Client', 'udp4', true, undefined, 'localhost');
    let clientPort = 0;
    expect(client).not.toBeUndefined();
    expect(client).toBeInstanceOf(Unicast);
    expect(client.socketType).toBe('udp4');
    const clientReady = new Promise<AddressInfo>((resolve) => {
      client.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv4');
        expect(address.address).toBe('127.0.0.1');
        expect(address.port).toBeGreaterThan(0);
        clientPort = address.port;
        resolve(address);
      });
    });
    client.start();
    await clientReady;
    client.log.info(`Client ready on ${CYAN}${server.socketType}${nf} ${CYAN}${server.interfaceAddress}${nf}:${CYAN}${server.port}${nf}`);

    // Send a message from the client to the server
    const message = 'Hello, server!';
    const messageReceived = new Promise<string>((resolve) => {
      server.on('message', (msg: Buffer, rinfo: AddressInfo) => {
        expect(rinfo.family).toBe('IPv4');
        expect(rinfo.address).toBe('127.0.0.1');
        expect(rinfo.port).toBeGreaterThan(0);
        expect(msg.toString()).toBe(message);
        resolve(msg.toString());
      });
    });
    client.send(Buffer.from(message), 'localhost', 8989);
    await messageReceived;

    // Send a message from the server to the client
    const response = 'Hello, client!';
    const responseReceived = new Promise<string>((resolve) => {
      client.on('message', (msg: Buffer, rinfo: AddressInfo) => {
        expect(rinfo.family).toBe('IPv4');
        expect(rinfo.address).toBe('127.0.0.1');
        expect(rinfo.port).toBeGreaterThan(0);
        expect(msg.toString()).toBe(response);
        resolve(msg.toString());
      });
    });
    server.send(Buffer.from(response), 'localhost', clientPort);
    await responseReceived;

    await new Promise<void>((resolve) => {
      server.on('close', resolve);
      server.stop();
    });

    await new Promise<void>((resolve) => {
      client.on('close', resolve);
      client.stop();
    });
  });

  test('Create client server unicast with udp6 on localhost', async () => {
    const server = new Unicast('Server', 'udp6', true, undefined, 'localhost', 8989);
    expect(server).not.toBeUndefined();
    expect(server).toBeInstanceOf(Unicast);
    expect(server.socketType).toBe('udp6');
    const serverReady = new Promise<AddressInfo>((resolve) => {
      server.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv6');
        expect(address.address).toBe('::1');
        expect(address.port).toBe(8989);
        resolve(address);
      });
    });
    server.start();
    await serverReady;
    server.log.info(`Server ready on ${CYAN}${server.socketType}${nf} ${CYAN}${server.interfaceAddress}${nf}:${CYAN}${server.port}${nf}`);

    const client = new Unicast('Client', 'udp6', true, undefined, 'localhost');
    let clientPort = 0;
    expect(client).not.toBeUndefined();
    expect(client).toBeInstanceOf(Unicast);
    expect(client.socketType).toBe('udp6');
    const clientReady = new Promise<AddressInfo>((resolve) => {
      client.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv6');
        expect(address.address).toBe('::1');
        expect(address.port).toBeGreaterThan(0);
        clientPort = address.port;
        resolve(address);
      });
    });
    client.start();
    await clientReady;
    client.log.info(`Client ready on ${CYAN}${server.socketType}${nf} ${CYAN}${server.interfaceAddress}${nf}:${CYAN}${server.port}${nf}`);

    // Send a message from the client to the server
    const message = 'Hello, server!';
    const messageReceived = new Promise<string>((resolve) => {
      server.on('message', (msg: Buffer, rinfo: AddressInfo) => {
        expect(rinfo.family).toBe('IPv6');
        expect(rinfo.address).toBe('::1');
        expect(rinfo.port).toBeGreaterThan(0);
        expect(msg.toString()).toBe(message);
        resolve(msg.toString());
      });
    });
    client.send(Buffer.from(message), 'localhost', 8989);
    await messageReceived;

    // Send a message from the server to the client
    const response = 'Hello, client!';
    const responseReceived = new Promise<string>((resolve) => {
      client.on('message', (msg: Buffer, rinfo: AddressInfo) => {
        expect(rinfo.family).toBe('IPv6');
        expect(rinfo.address).toBe('::1');
        expect(rinfo.port).toBeGreaterThan(0);
        expect(msg.toString()).toBe(response);
        resolve(msg.toString());
      });
    });
    server.send(Buffer.from(response), 'localhost', clientPort);
    await responseReceived;

    await new Promise<void>((resolve) => {
      server.on('close', resolve);
      server.stop();
    });

    await new Promise<void>((resolve) => {
      client.on('close', resolve);
      client.stop();
    });
  });
});
