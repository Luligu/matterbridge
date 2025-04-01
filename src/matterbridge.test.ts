/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug'];

import { jest } from '@jest/globals';

// jest.mock('@project-chip/matter-node.js/util');

import { AnsiLogger, db, LogLevel, nf, TimestampFormat } from 'node-ansi-logger';
import { hasParameter, waiter } from './utils/export.js';
import { Matterbridge } from './matterbridge.js';
import { RegisteredPlugin, SessionInformation } from './matterbridgeTypes.js';
import { FabricId, FabricIndex, NodeId, VendorId } from '@matter/main';
import { ExposedFabricInformation } from '@matter/main/protocol';

// Default colors
const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

const exit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  // eslint-disable-next-line no-console
  console.log('mockImplementation of process.exit() called');
  return undefined as never;
});

describe('Matterbridge', () => {
  let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
  let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
  const debug = false;

  if (!debug) {
    // Spy on and mock AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      //
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.info
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      //
    });
  } else {
    // Spy on AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    // Spy on console.log
    consoleLogSpy = jest.spyOn(console, 'log');
    // Spy on console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug');
    // Spy on console.info
    consoleInfoSpy = jest.spyOn(console, 'info');
    // Spy on console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn');
    // Spy on console.error
    consoleErrorSpy = jest.spyOn(console, 'error');
  }

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  describe('Matterbridge loadInstance() and cleanup()', () => {
    let matterbridge: Matterbridge;

    beforeEach(async () => {
      // Clear all mocks
      jest.clearAllMocks();
    });

    test('Matterbridge.loadInstance(false)', async () => {
      expect((Matterbridge as any).instance).toBeUndefined();
      matterbridge = await Matterbridge.loadInstance(false);
      matterbridge.log = new AnsiLogger({ logName: 'Matterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
      expect((Matterbridge as any).instance).toBeDefined();
      expect((matterbridge as any).initialized).toBeFalsy();
      expect(matterbridge).toBeDefined();
      expect(matterbridge.profile).toBe('Jest');
      expect(matterbridge.nodeStorageName).toBe('storage.Jest');
      expect(matterbridge.matterStorageName).toBe('matterstorage.Jest');
      expect(matterbridge.matterbrideLoggerFile).toBe('matterbridge.Jest.log');
      expect(matterbridge.matterLoggerFile).toBe('matter.Jest.log');
      expect(matterbridge.serverNode).toBeUndefined();
      expect(matterbridge.aggregatorNode).toBeUndefined();
      expect(matterbridge.matterStorageManager).toBeUndefined();
      expect(matterbridge.matterStorageService).toBeUndefined();
      expect(matterbridge.matterbridgeContext).toBeUndefined();

      expect((matterbridge as any).initialized).toBeFalsy();
      expect((matterbridge as any).log).toBeDefined();
      expect((matterbridge as any).homeDirectory).toBe('');
      expect((matterbridge as any).matterbridgeDirectory).toBe('');
      expect((matterbridge as any).globalModulesDirectory).toBe('');
      expect((matterbridge as any).matterbridgeLatestVersion).toBe('');
      expect((matterbridge as any).nodeStorage).toBeUndefined();
      expect((matterbridge as any).nodeContext).toBeUndefined();
      expect((matterbridge as any).globalModulesDirectory).toBe('');
      expect((matterbridge as any).matterbridgeLatestVersion).toBe('');
      expect((matterbridge as any).plugins).toBeUndefined();
      expect((matterbridge as any).devices).toBeUndefined();

      expect((matterbridge as any).frontend.httpServer).toBeUndefined();
      expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
      expect((matterbridge as any).frontend.expressApp).toBeUndefined();
      expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();

      // Destroy the Matterbridge instance
      await matterbridge.destroyInstance();

      expect((matterbridge as any).initialized).toBeFalsy();
      expect((matterbridge as any).hasCleanupStarted).toBeFalsy();
      expect((Matterbridge as any).instance).toBeDefined(); // Instance is still defined cause cleanup() is not called when initialized is false
    });

    test('Matterbridge.loadInstance(true) should not initialize', async () => {
      expect((Matterbridge as any).instance).toBeDefined();
      matterbridge = await Matterbridge.loadInstance(true);
      expect((matterbridge as any).initialized).toBeFalsy();
      await matterbridge.initialize();
      expect((matterbridge as any).initialized).toBeTruthy();
      expect(matterbridge.serverNode).toBeDefined();
      expect(matterbridge.aggregatorNode).toBeDefined();
      expect(matterbridge.matterStorageManager).toBeDefined();
      expect(matterbridge.matterStorageService).toBeDefined();
      expect(matterbridge.matterbridgeContext).toBeDefined();
      matterbridge.plugins.clear();
      await matterbridge.plugins.saveToStorage();

      await waiter(
        'Matter server node started',
        () => {
          return (matterbridge as any).configureTimeout !== undefined && (matterbridge as any).reachabilityTimeout !== undefined && matterbridge.serverNode?.lifecycle.isOnline === true;
        },
        false,
        60000,
        1000,
        true,
      );

      expect(matterbridge).toBeDefined();
      expect(matterbridge.profile).toBe('Jest');
      expect(matterbridge.nodeStorageName).toBe('storage.Jest');
      expect(matterbridge.matterStorageName).toBe('matterstorage.Jest');
      expect(matterbridge.matterbrideLoggerFile).toBe('matterbridge.Jest.log');
      expect(matterbridge.matterLoggerFile).toBe('matter.Jest.log');
      expect((matterbridge as any).initialized).toBeTruthy();
      expect((matterbridge as any).log).toBeDefined();
      expect((matterbridge as any).homeDirectory).not.toBe('');
      expect((matterbridge as any).matterbridgeDirectory).not.toBe('');
      expect((matterbridge as any).globalModulesDirectory).not.toBe('');
      expect((matterbridge as any).matterbridgeLatestVersion).not.toBe('');
      expect((matterbridge as any).nodeStorage).toBeDefined();
      expect((matterbridge as any).nodeContext).toBeDefined();
      expect((matterbridge as any).plugins).toBeDefined();
      expect((matterbridge as any).plugins.size).toBe(0);
      expect((matterbridge as any).devices).toBeDefined();
      expect((matterbridge as any).devices.size).toBe(0);

      // -frontend 0
      expect((matterbridge as any).frontend.httpServer).toBeUndefined();
      expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
      expect((matterbridge as any).frontend.expressApp).toBeUndefined();
      expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();

      // Destroy the Matterbridge instance
      await matterbridge.destroyInstance();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed Matterbridge MdnsService`);

      expect((matterbridge as any).initialized).toBeFalsy();
      expect((matterbridge as any).hasCleanupStarted).toBeFalsy();
      expect((Matterbridge as any).instance).toBeUndefined(); // Instance is not defined cause cleanup() has been called
    }, 60000);

    test('Matterbridge.loadInstance(true) with frontend', async () => {
      process.argv = ['node', 'matterbridge.test.js', '-frontend', '8081', '-profile', 'Jest'];

      expect((Matterbridge as any).instance).toBeUndefined();
      matterbridge = await Matterbridge.loadInstance(true);
      expect((Matterbridge as any).instance).toBeDefined();
      expect((matterbridge as any).initialized).toBeTruthy();

      await waiter(
        'Matter server node started',
        () => {
          return (matterbridge as any).configureTimeout !== undefined && (matterbridge as any).reachabilityTimeout !== undefined && matterbridge.serverNode?.lifecycle.isOnline === true;
        },
        false,
        60000,
        1000,
        true,
      );

      expect(matterbridge).toBeDefined();
      expect(matterbridge.profile).toBe('Jest');
      expect((matterbridge as any).initialized).toBeTruthy();
      expect((matterbridge as any).log).toBeDefined();
      expect((matterbridge as any).homeDirectory).not.toBe('');
      expect((matterbridge as any).matterbridgeDirectory).not.toBe('');
      expect((matterbridge as any).nodeStorage).toBeDefined();
      expect((matterbridge as any).nodeContext).toBeDefined();
      expect((matterbridge as any).plugins).toBeDefined();
      expect((matterbridge as any).devices.size).toBe(0);

      // -frontend 8081
      expect((matterbridge as any).frontend.httpServer).toBeDefined();
      expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
      expect((matterbridge as any).frontend.expressApp).toBeDefined();
      expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    }, 60000);

    test('destroy instance', async () => {
      // Destroy the Matterbridge instance
      await matterbridge.destroyInstance();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed Matterbridge MdnsService`);
    }, 60000);
  });

  describe('Matterbridge parseCommandLine()', () => {
    let matterbridge: Matterbridge;

    beforeEach(async () => {
      // Clear all mocks
      jest.clearAllMocks();
    });

    test('Matterbridge profile', async () => {
      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug'];
      matterbridge = await Matterbridge.loadInstance(true);
      if (!(matterbridge as any).initialized) await matterbridge.initialize();
      expect(matterbridge).toBeDefined();
      expect(matterbridge.profile).toBe('Jest');
      expect((matterbridge as any).initialized).toBe(true);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Matterbridge profile: Jest'));

      await waiter(
        'Matter server node started',
        () => {
          return (matterbridge as any).configureTimeout !== undefined && (matterbridge as any).reachabilityTimeout !== undefined && matterbridge.serverNode?.lifecycle.isOnline === true;
        },
        false,
        60000,
        1000,
        true,
      );
    }, 60000);

    test('hasParameter("debug") should return false', async () => {
      expect(hasParameter('debug')).toBeFalsy();
    });

    test('hasParameter("frontend") should return true', async () => {
      expect(hasParameter('frontend')).toBeTruthy();
    });

    test('Sanitize fabrics', () => {
      const fabricInfos: ExposedFabricInformation[] = [
        {
          fabricIndex: FabricIndex(1),
          fabricId: FabricId(45653242346465555556n),
          nodeId: NodeId(556546442432656555556n),
          rootNodeId: NodeId(5565442324264656555556n),
          rootVendorId: VendorId(4996),
          label: 'Fabric 1 label',
        },
        {
          fabricIndex: FabricIndex(2),
          fabricId: FabricId(45654621214656555556n),
          nodeId: NodeId(556546462112156555556n),
          rootNodeId: NodeId(556546412212656555556n),
          rootVendorId: VendorId(4937),
          label: 'Fabric 2 label',
        },
      ];
      expect((matterbridge as any).sanitizeFabricInformations(fabricInfos).length).toBe(2);
      expect(() => {
        JSON.stringify(fabricInfos);
      }).toThrow();
      expect(JSON.stringify((matterbridge as any).sanitizeFabricInformations(fabricInfos)).length).toBe(402);
    });

    test('Sanitize sessions', () => {
      let sessionInfos: SessionInformation[] = [
        {
          name: 'secure/64351',
          nodeId: NodeId(16784206195868397986n),
          peerNodeId: NodeId(1604858123872676291n),
          fabric: { fabricIndex: FabricIndex(2), fabricId: FabricId(456546212146567986n), nodeId: NodeId(1678420619586823323397986n), rootNodeId: NodeId(18446744060824623349729n), rootVendorId: VendorId(4362), label: 'SmartThings Hub 0503' },
          isPeerActive: true,
          secure: true,
          lastInteractionTimestamp: 1720035723121269,
          lastActiveTimestamp: 1720035761223121,
          numberOfActiveSubscriptions: 0,
        },
      ];
      expect(() => {
        JSON.stringify(sessionInfos);
      }).toThrow();
      expect((matterbridge as any).sanitizeSessionInformation(sessionInfos).length).toBe(1);
      expect(JSON.stringify((matterbridge as any).sanitizeSessionInformation(sessionInfos)).length).toBe(464);
      sessionInfos = [
        {
          name: 'secure/64351',
          nodeId: NodeId(16784206195868397986n),
          peerNodeId: NodeId(1604858123872676291n),
          fabric: { fabricIndex: FabricIndex(2), fabricId: FabricId(456546212146567986n), nodeId: NodeId(1678420619586823323397986n), rootNodeId: NodeId(18446744060824623349729n), rootVendorId: VendorId(4362), label: 'SmartThings Hub 0503' },
          isPeerActive: false,
          secure: true,
          lastInteractionTimestamp: 1720035723121269,
          lastActiveTimestamp: 1720035761223121,
          numberOfActiveSubscriptions: 0,
        },
      ];
      expect((matterbridge as any).sanitizeSessionInformation(sessionInfos).length).toBe(0);
    });

    test('getVendorIdName', () => {
      expect((matterbridge as any).getVendorIdName(4937)).toContain('AppleHome');
      expect((matterbridge as any).getVendorIdName(4996)).toContain('AppleKeyChain');
      expect((matterbridge as any).getVendorIdName(4362)).toContain('SmartThings');
      expect((matterbridge as any).getVendorIdName(4939)).toContain('HomeAssistant');
      expect((matterbridge as any).getVendorIdName(24582)).toContain('GoogleHome');
      expect((matterbridge as any).getVendorIdName(4631)).toContain('Alexa');
      expect((matterbridge as any).getVendorIdName(4701)).toContain('Tuya');
      expect((matterbridge as any).getVendorIdName(4718)).toContain('Xiaomi');
      expect((matterbridge as any).getVendorIdName(4742)).toContain('eWeLink');
      expect((matterbridge as any).getVendorIdName(5264)).toContain('Shelly');
      expect((matterbridge as any).getVendorIdName(65521)).toContain('MatterServer');
      expect((matterbridge as any).getVendorIdName(matterbridge.aggregatorVendorId)).toContain('MatterServer');
      expect((matterbridge as any).getVendorIdName(1)).toContain('Unknown vendorId');
    });

    test('spawnCommand', async () => {
      expect(await matterbridge.spawnCommand('npm', ['list', '-g'])).toBeTruthy();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Spawn command'));
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.anything());
    }, 60000);

    test('matterbridge -add mockPlugin1', async () => {
      expect((matterbridge as any).initialized).toBe(true);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect((matterbridge as any).shutdown).toBe(false);

      const shutdownPromise = new Promise((resolve) => {
        matterbridge.on('shutdown', resolve as () => void);
        const interval = setInterval(() => {
          if (matterbridge.shutdown) {
            clearInterval(interval);
            resolve(0);
          }
        }, 250);
      });

      let plugins = (await (matterbridge as any).plugins) as RegisteredPlugin[];
      expect(plugins).toHaveLength(0);

      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-add', './src/mock/plugin1'];
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      await (matterbridge as any).parseCommandLine();
      const log = (matterbridge as any).plugins.log;
      expect(log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock1${nf}`);
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      plugins = (await (matterbridge as any).plugins.array()) as RegisteredPlugin[];
      expect(plugins).toHaveLength(1);
      expect(plugins[0].version).toBe('1.0.1');
      expect(plugins[0].name).toBe('matterbridge-mock1');
      expect(plugins[0].description).toBe('Matterbridge mock plugin 1');
      expect(plugins[0].author).toBe('https://github.com/Luligu');
      expect(plugins[0].enabled).toBeTruthy();
      await shutdownPromise;
      matterbridge.shutdown = false;
      matterbridge.removeAllListeners('shutdown');
    }, 60000);

    test('matterbridge -disable mockPlugin1', async () => {
      expect((matterbridge as any).initialized).toBe(true);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect((matterbridge as any).shutdown).toBe(false);

      const shutdownPromise = new Promise((resolve) => {
        matterbridge.on('shutdown', resolve as () => void);
        const interval = setInterval(() => {
          if (matterbridge.shutdown) {
            clearInterval(interval);
            resolve(0);
          }
        }, 250);
      });

      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-disable', './src/mock/plugin1'];
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      await (matterbridge as any).parseCommandLine();
      expect((matterbridge as any).plugins.log.log).toHaveBeenCalledWith(LogLevel.INFO, `Disabled plugin ${plg}matterbridge-mock1${nf}`);
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      const plugins = (await (matterbridge as any).plugins.array()) as RegisteredPlugin[];
      expect(plugins).toHaveLength(1);
      expect(plugins[0].version).toBe('1.0.1');
      expect(plugins[0].name).toBe('matterbridge-mock1');
      expect(plugins[0].description).toBe('Matterbridge mock plugin 1');
      expect(plugins[0].author).toBe('https://github.com/Luligu');
      expect(plugins[0].enabled).toBeFalsy();
      await shutdownPromise;
      matterbridge.shutdown = false;
      matterbridge.removeAllListeners('shutdown');
    }, 60000);

    test('matterbridge -enable mockPlugin1', async () => {
      expect((matterbridge as any).initialized).toBe(true);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect((matterbridge as any).shutdown).toBe(false);

      const shutdownPromise = new Promise((resolve) => {
        matterbridge.on('shutdown', resolve as () => void);
        const interval = setInterval(() => {
          if (matterbridge.shutdown) {
            clearInterval(interval);
            resolve(0);
          }
        }, 250);
      });

      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-enable', './src/mock/plugin1'];
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      await (matterbridge as any).parseCommandLine();
      expect((matterbridge as any).plugins.log.log).toHaveBeenCalledWith(LogLevel.INFO, `Enabled plugin ${plg}matterbridge-mock1${nf}`);
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      const plugins = (await (matterbridge as any).plugins.array()) as RegisteredPlugin[];
      expect(plugins).toHaveLength(1);
      expect(plugins[0].version).toBe('1.0.1');
      expect(plugins[0].name).toBe('matterbridge-mock1');
      expect(plugins[0].description).toBe('Matterbridge mock plugin 1');
      expect(plugins[0].author).toBe('https://github.com/Luligu');
      expect(plugins[0].enabled).toBeTruthy();
      await shutdownPromise;
      matterbridge.shutdown = false;
      matterbridge.removeAllListeners('shutdown');
    }, 60000);

    test('matterbridge -remove mockPlugin1', async () => {
      expect((matterbridge as any).initialized).toBe(true);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect((matterbridge as any).shutdown).toBe(false);

      const shutdownPromise = new Promise((resolve) => {
        matterbridge.on('shutdown', resolve as () => void);
        const interval = setInterval(() => {
          if (matterbridge.shutdown) {
            clearInterval(interval);
            resolve(0);
          }
        }, 250);
      });

      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-remove', './src/mock/plugin1'];
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      await (matterbridge as any).parseCommandLine();
      expect((matterbridge as any).plugins.log.log).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock1${nf}`);
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      const plugins = (await (matterbridge as any).plugins) as RegisteredPlugin[];
      expect(plugins).toHaveLength(0);
      await shutdownPromise;
      matterbridge.shutdown = false;
      matterbridge.removeAllListeners('shutdown');
    }, 60000);

    test('matterbridge -add mockPlugin1 again', async () => {
      expect((matterbridge as any).initialized).toBe(true);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect((matterbridge as any).shutdown).toBe(false);

      const shutdownPromise = new Promise((resolve) => {
        matterbridge.on('shutdown', resolve as () => void);
        const interval = setInterval(() => {
          if (matterbridge.shutdown) {
            clearInterval(interval);
            resolve(0);
          }
        }, 250);
      });

      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-add', './src/mock/plugin1'];
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      await (matterbridge as any).parseCommandLine();
      expect((matterbridge as any).plugins.log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock1${nf}`);
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      const plugins = (await (matterbridge as any).plugins.array()) as RegisteredPlugin[];
      expect(plugins).toHaveLength(1);
      expect(plugins[0].version).toBe('1.0.1');
      expect(plugins[0].name).toBe('matterbridge-mock1');
      expect(plugins[0].description).toBe('Matterbridge mock plugin 1');
      expect(plugins[0].author).toBe('https://github.com/Luligu');
      expect(plugins[0].enabled).toBeTruthy();

      await shutdownPromise;
      matterbridge.shutdown = false;
      matterbridge.removeAllListeners('shutdown');
    }, 60000);

    test('matterbridge -add mockPlugin2', async () => {
      expect((matterbridge as any).initialized).toBe(true);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect((matterbridge as any).shutdown).toBe(false);

      const shutdownPromise = new Promise((resolve) => {
        matterbridge.on('shutdown', resolve as () => void);
        const interval = setInterval(() => {
          if (matterbridge.shutdown) {
            clearInterval(interval);
            resolve(0);
          }
        }, 250);
      });

      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-add', './src/mock/plugin2'];
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      await (matterbridge as any).parseCommandLine();
      expect((matterbridge as any).plugins.log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock2${nf}`);
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      const plugins = (await (matterbridge as any).plugins.array()) as RegisteredPlugin[];
      expect(plugins).toHaveLength(2);
      expect(plugins[1].version).toBe('1.0.2');
      expect(plugins[1].name).toBe('matterbridge-mock2');
      expect(plugins[1].description).toBe('Matterbridge mock plugin 2');
      expect(plugins[1].author).toBe('https://github.com/Luligu');
      expect(plugins[1].enabled).toBeTruthy();

      await shutdownPromise;
      matterbridge.shutdown = false;
      matterbridge.removeAllListeners('shutdown');
    }, 60000);

    test('matterbridge -add mockPlugin3', async () => {
      expect((matterbridge as any).initialized).toBe(true);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect((matterbridge as any).shutdown).toBe(false);

      const shutdownPromise = new Promise((resolve) => {
        matterbridge.on('shutdown', resolve as () => void);
        const interval = setInterval(() => {
          if (matterbridge.shutdown) {
            clearInterval(interval);
            resolve(0);
          }
        }, 250);
      });

      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-add', './src/mock/plugin3'];
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      await (matterbridge as any).parseCommandLine();
      expect((matterbridge as any).plugins.log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock3${nf}`);
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      const plugins = (await (matterbridge as any).plugins.array()) as RegisteredPlugin[];
      expect(plugins).toHaveLength(3);
      expect(plugins[2].version).toBe('1.0.3');
      expect(plugins[2].name).toBe('matterbridge-mock3');
      expect(plugins[2].description).toBe('Matterbridge mock plugin 3');
      expect(plugins[2].author).toBe('https://github.com/Luligu');
      expect(plugins[2].enabled).toBeTruthy();

      await shutdownPromise;
      matterbridge.shutdown = false;
      matterbridge.removeAllListeners('shutdown');
    }, 60000);

    test('matterbridge start mockPlugin1/2/3', async () => {
      expect((matterbridge as any).initialized).toBe(true);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect((matterbridge as any).shutdown).toBe(false);

      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug'];
      const plugins = (await (matterbridge as any).plugins.array()) as RegisteredPlugin[];
      expect(plugins).toHaveLength(3);

      await (matterbridge as any).plugins.load(plugins[0]);
      expect(plugins[0].loaded).toBeTruthy();
      await (matterbridge as any).plugins.start(plugins[0], 'Jest test');
      expect(plugins[0].started).toBeTruthy();
      expect(plugins[0].configured).toBeFalsy();

      await (matterbridge as any).plugins.load(plugins[1]);
      expect(plugins[1].loaded).toBeTruthy();
      await (matterbridge as any).plugins.start(plugins[1], 'Jest test');
      expect(plugins[1].started).toBeTruthy();
      expect(plugins[1].configured).toBeFalsy();

      await (matterbridge as any).plugins.load(plugins[2]);
      expect(plugins[2].loaded).toBeTruthy();
      await (matterbridge as any).plugins.start(plugins[2], 'Jest test');
      expect(plugins[2].started).toBeTruthy();
      expect(plugins[2].configured).toBeFalsy();
    }, 10000);

    test('matterbridge -help', async () => {
      expect((matterbridge as any).initialized).toBe(true);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect((matterbridge as any).shutdown).toBe(false);

      const shutdownPromise = new Promise((resolve) => {
        matterbridge.on('shutdown', resolve as () => void);
        const interval = setInterval(() => {
          if (matterbridge.shutdown) {
            clearInterval(interval);
            resolve(0);
          }
        }, 250);
      });

      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-help'];
      await (matterbridge as any).parseCommandLine();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Usage: matterbridge [options]'));
      await shutdownPromise;
      matterbridge.shutdown = false;
      matterbridge.removeAllListeners('shutdown');
    });

    test('matterbridge -list', async () => {
      expect((matterbridge as any).initialized).toBe(true);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect((matterbridge as any).shutdown).toBe(false);

      const shutdownPromise = new Promise((resolve) => {
        matterbridge.on('shutdown', resolve as () => void);
        const interval = setInterval(() => {
          if (matterbridge.shutdown) {
            clearInterval(interval);
            resolve(0);
          }
        }, 250);
      });

      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-list'];
      await (matterbridge as any).parseCommandLine();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `│ Registered plugins (3)`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `│ Registered devices (0)`);
      await shutdownPromise;
      matterbridge.shutdown = false;
      matterbridge.removeAllListeners('shutdown');
    }, 60000);

    test('matterbridge -logstorage', async () => {
      expect((matterbridge as any).initialized).toBe(true);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect((matterbridge as any).shutdown).toBe(false);

      const shutdownPromise = new Promise((resolve) => {
        matterbridge.on('shutdown', resolve as () => void);
        const interval = setInterval(() => {
          if (matterbridge.shutdown) {
            clearInterval(interval);
            resolve(0);
          }
        }, 250);
      });

      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-logstorage'];
      await (matterbridge as any).parseCommandLine();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${plg}Matterbridge${nf} storage log`);
      await shutdownPromise;
      matterbridge.shutdown = false;
      matterbridge.removeAllListeners('shutdown');
    }, 60000);

    test('matterbridge -loginterfaces', async () => {
      expect((matterbridge as any).initialized).toBe(true);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect((matterbridge as any).shutdown).toBe(false);

      const shutdownPromise = new Promise((resolve) => {
        matterbridge.on('shutdown', resolve as () => void);
        const interval = setInterval(() => {
          if (matterbridge.shutdown) {
            clearInterval(interval);
            resolve(0);
          }
        }, 250);
      });

      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-loginterfaces'];
      await (matterbridge as any).parseCommandLine();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${plg}Matterbridge${nf} network interfaces log`);
      await shutdownPromise;
      matterbridge.shutdown = false;
      matterbridge.removeAllListeners('shutdown');
    }, 60000);

    test('destroy instance', async () => {
      // Destroy the Matterbridge instance
      await matterbridge.destroyInstance();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed Matterbridge MdnsService`);
    }, 60000);

    test('matterbridge -reset', async () => {
      expect((matterbridge as any).initialized).toBe(false);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect((matterbridge as any).shutdown).toBe(false);

      const shutdownPromise = new Promise((resolve) => {
        matterbridge.on('shutdown', resolve as () => void);
        const interval = setInterval(() => {
          if (matterbridge.shutdown) {
            clearInterval(interval);
            resolve(0);
          }
        }, 250);
      });

      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-reset'];
      (matterbridge as any).initialized = true;
      await (matterbridge as any).parseCommandLine();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Matter storage reset done! Remove the bridge from the controller.');
      await shutdownPromise;
      matterbridge.shutdown = false;
      matterbridge.removeAllListeners('shutdown');
    }, 60000);

    test('matterbridge -reset xxx', async () => {
      expect((matterbridge as any).initialized).toBe(false);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect((matterbridge as any).shutdown).toBe(false);

      const shutdownPromise = new Promise((resolve) => {
        matterbridge.on('shutdown', resolve as () => void);
        const interval = setInterval(() => {
          if (matterbridge.shutdown) {
            clearInterval(interval);
            resolve(0);
          }
        }, 250);
      });

      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-reset', 'xxx'];
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      await (matterbridge as any).parseCommandLine();
      expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, 'Reset plugin xxx');
      (matterbridge as any).log.logLevel = LogLevel.DEBUG;
      await shutdownPromise;
      matterbridge.shutdown = false;
      matterbridge.removeAllListeners('shutdown');
    }, 60000);

    test('matterbridge -factoryreset', async () => {
      expect((matterbridge as any).initialized).toBe(false);
      expect((matterbridge as any).hasCleanupStarted).toBe(false);
      expect((matterbridge as any).shutdown).toBe(false);

      process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest', '-logger', 'debug', '-matterlogger', 'debug', '-factoryreset'];
      (matterbridge as any).initialized = true;
      await (matterbridge as any).parseCommandLine();

      const shutdownPromise = new Promise((resolve) => {
        matterbridge.on('shutdown', resolve as () => void);
        const interval = setInterval(() => {
          if (matterbridge.shutdown) {
            clearInterval(interval);
            resolve(0);
          }
        }, 250);
      });

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Unlinking old matter storage file'));
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Removing matter node storage directory'));
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Removing matter node storage backup directory'));
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Removing storage directory'));
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Removing storage backup directory'));
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Factory reset done! Remove all paired fabrics from the controllers.');
      expect((matterbridge as any).plugins).toHaveLength(0);
      expect((matterbridge as any).devices).toHaveLength(0);

      await shutdownPromise;
      matterbridge.shutdown = false;
      matterbridge.removeAllListeners('shutdown');
    }, 10000);
  });
});
