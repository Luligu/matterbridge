/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest'];

interface SessionInformation {
  name: string;
  nodeId: NodeId;
  peerNodeId: NodeId;
  fabric?: ExposedFabricInformation;
  isPeerActive: boolean;
  secure: boolean;
  lastInteractionTimestamp?: number;
  lastActiveTimestamp?: number;
  numberOfActiveSubscriptions: number;
}

import { jest } from '@jest/globals';

jest.mock('@project-chip/matter-node.js/util');

import { AnsiLogger, db, LogLevel, nf } from 'node-ansi-logger';
import { hasParameter } from '@project-chip/matter-node.js/util';
import { Matterbridge } from './matterbridge.js';
import { ExposedFabricInformation } from '@project-chip/matter-node.js/fabric';
import { FabricId, FabricIndex, NodeId, VendorId } from '@project-chip/matter-node.js/datatype';
import path from 'path';
import { RegisteredPlugin } from './matterbridgeTypes.js';

// Default colors
const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

describe('Matterbridge loadInstance() and cleanup()', () => {
  let matterbridge: Matterbridge;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let loggerLogSpy: jest.SpiedFunction<(level: LogLevel, message: string, ...parameters: any[]) => void>;

  beforeAll(async () => {
    // Spy on and mock the AnsiLogger.log method
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // Mock implementation or empty function
    });
  });

  beforeEach(() => {
    loggerLogSpy.mockClear();
    consoleLogSpy.mockClear();
  });

  afterAll(async () => {
    // Restore the mocked AnsiLogger.log method
    loggerLogSpy.mockRestore();
    // Restore the mocked console.log
    consoleLogSpy.mockRestore();
  }, 60000);

  test('Matterbridge.loadInstance(false)', async () => {
    // console.log('Loading Matterbridge.loadInstance(false)');
    matterbridge = await Matterbridge.loadInstance(false);
    // console.log('Loaded Matterbridge.loadInstance(false)');

    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('Jest');
    expect((matterbridge as any).initialized).toBeFalsy();
    expect((matterbridge as any).log).toBeUndefined();
    expect((matterbridge as any).homeDirectory).toBe('');
    expect((matterbridge as any).matterbridgeDirectory).toBe('');
    expect((matterbridge as any).nodeStorage).toBeUndefined();
    expect((matterbridge as any).nodeContext).toBeUndefined();
    expect((matterbridge as any).plugins).toBeUndefined();
    expect((matterbridge as any).registeredDevices).toHaveLength(0);
    expect((matterbridge as any).globalModulesDirectory).toBe('');
    expect((matterbridge as any).matterbridgeLatestVersion).toBe('');

    expect((matterbridge as any).httpServer).toBeUndefined();
    expect((matterbridge as any).httpsServer).toBeUndefined();
    expect((matterbridge as any).expressApp).toBeUndefined();
    expect((matterbridge as any).webSocketServer).toBeUndefined();

    // Destroy the Matterbridge instance
    // console.log('Destroying Matterbridge.loadInstance(false)');
    await matterbridge.destroyInstance();
    // console.log('Destroyed Matterbridge.loadInstance(false)');
  });

  test('Matterbridge.loadInstance(true)', async () => {
    // console.log('Loading Matterbridge.loadInstance(false)');
    matterbridge = await Matterbridge.loadInstance(true);
    expect((matterbridge as any).initialized).toBeFalsy();
    if (!(matterbridge as any).initialized) await matterbridge.initialize();
    // console.log('Loaded Matterbridge.loadInstance(false)');

    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('Jest');
    expect((matterbridge as any).initialized).toBeTruthy();
    expect((matterbridge as any).log).toBeDefined();
    expect((matterbridge as any).homeDirectory).not.toBe('');
    expect((matterbridge as any).matterbridgeDirectory).not.toBe('');
    expect((matterbridge as any).nodeStorage).toBeDefined();
    expect((matterbridge as any).nodeContext).toBeDefined();
    expect((matterbridge as any).plugins).toBeDefined();
    expect((matterbridge as any).registeredDevices).toHaveLength(0);

    expect((matterbridge as any).httpServer).toBeUndefined();
    expect((matterbridge as any).httpsServer).toBeUndefined();
    expect((matterbridge as any).expressApp).toBeUndefined();
    expect((matterbridge as any).webSocketServer).toBeUndefined();

    // Destroy the Matterbridge instance
    // console.log('Destroying Matterbridge.loadInstance(false)');
    await matterbridge.destroyInstance();
    // console.log('Destroyed Matterbridge.loadInstance(false)');
  });

  test('Matterbridge.loadInstance(true) with frontend', async () => {
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '8081', '-profile', 'Jest'];

    // console.log('Loading Matterbridge.loadInstance(false)');
    matterbridge = await Matterbridge.loadInstance(true);
    expect((matterbridge as any).initialized).toBeTruthy();
    if (!(matterbridge as any).initialized) await matterbridge.initialize();
    // console.log('Loaded Matterbridge.loadInstance(false)');

    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('Jest');
    expect((matterbridge as any).initialized).toBeTruthy();
    expect((matterbridge as any).log).toBeDefined();
    expect((matterbridge as any).homeDirectory).not.toBe('');
    expect((matterbridge as any).matterbridgeDirectory).not.toBe('');
    expect((matterbridge as any).nodeStorage).toBeDefined();
    expect((matterbridge as any).nodeContext).toBeDefined();
    expect((matterbridge as any).plugins).toBeDefined();
    expect((matterbridge as any).registeredDevices).toHaveLength(0);

    expect((matterbridge as any).httpServer).toBeDefined();
    expect((matterbridge as any).httpsServer).toBeUndefined();
    expect((matterbridge as any).expressApp).toBeDefined();
    expect((matterbridge as any).webSocketServer).toBeDefined();

    // Destroy the Matterbridge instance
    // console.log('Destroying Matterbridge.loadInstance(false)');
    await matterbridge.destroyInstance();
    // console.log('Destroyed Matterbridge.loadInstance(false)');

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest'];
  });
});

describe('Matterbridge', () => {
  let matterbridge: Matterbridge;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let loggerLogSpy: jest.SpiedFunction<(level: LogLevel, message: string, ...parameters: any[]) => void>;

  beforeAll(async () => {
    // Mock the AnsiLogger.log method
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.error(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // Mock implementation or empty function
    });

    // console.log('Loading Matterbridge.loadInstance(true)');
    matterbridge = await Matterbridge.loadInstance(true);
    if (!(matterbridge as any).initialized) await matterbridge.initialize();
    // console.log('Loaded Matterbridge.loadInstance(true)');
  });

  beforeEach(() => {
    loggerLogSpy.mockClear();
    consoleLogSpy.mockClear();
  });

  afterAll(async () => {
    // Destroy the Matterbridge instance
    // console.log('Destroying Matterbridge.loadInstance(true)');
    await matterbridge.destroyInstance();
    // console.log('Destroyed Matterbridge.loadInstance(true)');

    // Restore the mocked AnsiLogger.log method
    loggerLogSpy.mockRestore();
    // Restore the mocked console.log
    consoleLogSpy.mockRestore();
  }, 60000);

  test('Matterbridge profile', async () => {
    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('Jest');
  });

  test('should do a partial mock of AnsiLogger', () => {
    const log = new AnsiLogger({ logName: 'Mocked log' });
    expect(log).toBeDefined();
    log.log(LogLevel.INFO, 'Hello, world!');
    log.setLogDebug(true);
    expect(log.log).toBeDefined();
    expect(log.log).toHaveBeenCalled();
    expect(log.log).toHaveBeenLastCalledWith(LogLevel.INFO, 'Hello, world!');
  });

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
    const sessionInfos: SessionInformation[] = [
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
    expect((matterbridge as any).sanitizeSessionInformation(sessionInfos).length).toBe(1);
    expect(() => {
      JSON.stringify(sessionInfos);
    }).toThrow();
    expect(JSON.stringify((matterbridge as any).sanitizeSessionInformation(sessionInfos)).length).toBe(465);
  });

  test('matterbridge -help', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-help'];
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).log.log).toHaveBeenCalled();
    await shutdownPromise;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -list', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-list'];
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `│ Registered plugins (0)`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `│ Registered devices (0)`);
    await shutdownPromise;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -logstorage', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-logstorage'];
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `${plg}Matterbridge${nf} storage log`);
    await shutdownPromise;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -loginterfaces', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-loginterfaces'];
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `${plg}Matterbridge${nf} network interfaces log`);
    await shutdownPromise;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -reset', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-reset'];
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, 'Reset done! Remove the device from the controller.');
    await shutdownPromise;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -reset xxx', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-reset', 'xxx'];
    (matterbridge as any).log.setLogDebug(true);
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, 'Reset plugin xxx');
    (matterbridge as any).log.setLogDebug(true);
    await shutdownPromise;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -add mockPlugin1', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    let plugins = (await (matterbridge as any).plugins) as RegisteredPlugin[];
    expect(plugins).toHaveLength(0);

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-add', './src/mock/plugin1'];
    (matterbridge as any).log.setLogDebug(true);
    loggerLogSpy.mockClear();
    consoleLogSpy.mockClear();
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    await (matterbridge as any).parseCommandLine();
    const log = (matterbridge as any).plugins.log;
    expect(log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock1${nf}`);
    // expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, `Registering plugin ./src/mock/plugin1`);
    // expect(consoleLogSpy).toHaveBeenCalledWith(`Added plugin ${plg}matterbridge-mock1${nf}`);
    // expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Plugin ${plg}${path.resolve('./src/mock/plugin1/package.json')}${nf} type DynamicPlatform added to matterbridge`);
    (matterbridge as any).log.setLogDebug(false);
    plugins = (await (matterbridge as any).plugins.array()) as RegisteredPlugin[];
    expect(plugins).toHaveLength(1);
    expect(plugins[0].version).toBe('1.0.1');
    expect(plugins[0].name).toBe('matterbridge-mock1');
    expect(plugins[0].description).toBe('Matterbridge mock plugin 1');
    expect(plugins[0].author).toBe('https://github.com/Luligu');
    // expect(plugins[0].type).toBe('DynamicPlatform');
    expect(plugins[0].enabled).toBeTruthy();
    await shutdownPromise;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -disable mockPlugin1', async () => {
    loggerLogSpy.mockClear();
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-disable', './src/mock/plugin1'];
    (matterbridge as any).log.setLogDebug(true);
    loggerLogSpy.mockClear();
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).plugins.log.log).toHaveBeenCalledWith(LogLevel.INFO, `Disabled plugin ${plg}matterbridge-mock1${nf}`);
    (matterbridge as any).log.setLogDebug(false);
    const plugins = (await (matterbridge as any).plugins.array()) as RegisteredPlugin[];
    expect(plugins).toHaveLength(1);
    expect(plugins[0].version).toBe('1.0.1');
    expect(plugins[0].name).toBe('matterbridge-mock1');
    expect(plugins[0].description).toBe('Matterbridge mock plugin 1');
    expect(plugins[0].author).toBe('https://github.com/Luligu');
    // expect(plugins[0].type).toBe('DynamicPlatform');
    expect(plugins[0].enabled).toBeFalsy();
    await shutdownPromise;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -enable mockPlugin1', async () => {
    loggerLogSpy.mockClear();
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-enable', './src/mock/plugin1'];
    (matterbridge as any).log.setLogDebug(true);
    loggerLogSpy.mockClear();
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).plugins.log.log).toHaveBeenCalledWith(LogLevel.INFO, `Enabled plugin ${plg}matterbridge-mock1${nf}`);
    (matterbridge as any).log.setLogDebug(false);
    const plugins = (await (matterbridge as any).plugins.array()) as RegisteredPlugin[];
    expect(plugins).toHaveLength(1);
    expect(plugins[0].version).toBe('1.0.1');
    expect(plugins[0].name).toBe('matterbridge-mock1');
    expect(plugins[0].description).toBe('Matterbridge mock plugin 1');
    expect(plugins[0].author).toBe('https://github.com/Luligu');
    // expect(plugins[0].type).toBe('DynamicPlatform');
    expect(plugins[0].enabled).toBeTruthy();
    await shutdownPromise;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -remove mockPlugin1', async () => {
    loggerLogSpy.mockClear();
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-remove', './src/mock/plugin1'];
    (matterbridge as any).log.setLogDebug(true);
    loggerLogSpy.mockClear();
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).plugins.log.log).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock1${nf}`);
    (matterbridge as any).log.setLogDebug(false);
    const plugins = (await (matterbridge as any).plugins) as RegisteredPlugin[];
    expect(plugins).toHaveLength(0);
    await shutdownPromise;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge -add mockPlugin1/2/3', async () => {
    loggerLogSpy.mockClear();
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-add', './src/mock/plugin1'];
    (matterbridge as any).log.setLogDebug(true);
    loggerLogSpy.mockClear();
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).plugins.log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock1${nf}`);
    (matterbridge as any).log.setLogDebug(false);
    let plugins = (await (matterbridge as any).plugins.array()) as RegisteredPlugin[];
    expect(plugins).toHaveLength(1);
    expect(plugins[0].version).toBe('1.0.1');
    expect(plugins[0].name).toBe('matterbridge-mock1');
    expect(plugins[0].description).toBe('Matterbridge mock plugin 1');
    expect(plugins[0].author).toBe('https://github.com/Luligu');
    // expect(plugins[0].type).toBe('DynamicPlatform');
    expect(plugins[0].enabled).toBeTruthy();

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-add', './src/mock/plugin2'];
    (matterbridge as any).log.setLogDebug(true);
    loggerLogSpy.mockClear();
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).plugins.log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock2${nf}`);
    (matterbridge as any).log.setLogDebug(false);
    plugins = (await (matterbridge as any).plugins.array()) as RegisteredPlugin[];
    expect(plugins).toHaveLength(2);
    expect(plugins[1].version).toBe('1.0.2');
    expect(plugins[1].name).toBe('matterbridge-mock2');
    expect(plugins[1].description).toBe('Matterbridge mock plugin 2');
    expect(plugins[1].author).toBe('https://github.com/Luligu');
    // expect(plugins[1].type).toBe('DynamicPlatform');
    expect(plugins[1].enabled).toBeTruthy();

    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-add', './src/mock/plugin3'];
    (matterbridge as any).log.setLogDebug(true);
    loggerLogSpy.mockClear();
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).plugins.log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock3${nf}`);
    (matterbridge as any).log.setLogDebug(false);
    plugins = (await (matterbridge as any).plugins.array()) as RegisteredPlugin[];
    expect(plugins).toHaveLength(3);
    expect(plugins[2].version).toBe('1.0.3');
    expect(plugins[2].name).toBe('matterbridge-mock3');
    expect(plugins[2].description).toBe('Matterbridge mock plugin 3');
    expect(plugins[2].author).toBe('https://github.com/Luligu');
    // expect(plugins[2].type).toBe('DynamicPlatform');
    expect(plugins[2].enabled).toBeTruthy();

    await shutdownPromise;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);

  test('matterbridge start mockPlugin1/2/3', async () => {
    loggerLogSpy.mockClear();
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0'];
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

  test('matterbridge -factoryreset', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-factoryreset'];
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, 'Factory reset done! Remove all paired devices from the controllers.');
    expect((matterbridge as any).plugins).toHaveLength(0);
    await shutdownPromise;
    matterbridge.removeAllListeners('shutdown');
  }, 60000);
});
