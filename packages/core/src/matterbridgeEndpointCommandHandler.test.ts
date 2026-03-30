import { NamedHandler } from '@matter/general';

import type { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import {
  CommandHandler,
  type CommandHandlerData,
  type CommandHandlerExecutionResult,
  type CommandHandlerFunction,
  type CommandHandlers,
} from './matterbridgeEndpointCommandHandler.js';

type LocalHandlers = {
  'OnOff.on': CommandHandlerFunction<'OnOff.on'>;
  'OnOff.off': CommandHandlerFunction<'OnOff.off'>;
  'OnOff.toggle': CommandHandlerFunction<'OnOff.toggle'>;
};

function createOnOffCommandData<T extends keyof LocalHandlers>(command: T): CommandHandlerData<T> {
  const shortCommand = (command.includes('.') ? command.split('.').pop() : command) as unknown as CommandHandlerData<T>['command'];
  return {
    command: shortCommand,
    request: {},
    cluster: 'onOff',
    attributes: { onOff: command === 'OnOff.off' } as unknown as CommandHandlerData<T>['attributes'],
    endpoint: {} as MatterbridgeEndpoint,
  } as CommandHandlerData<T>;
}

function createDoorLockGetUserCommandData(): CommandHandlerData<'DoorLock.getUser'> {
  return {
    command: 'getUser',
    request: { userIndex: 1 } as CommandHandlerData<'DoorLock.getUser'>['request'],
    cluster: 'doorLock',
    attributes: {} as unknown as CommandHandlerData<'DoorLock.getUser'>['attributes'],
    endpoint: {} as MatterbridgeEndpoint,
  } as CommandHandlerData<'DoorLock.getUser'>;
}

describe('CommandHandler', () => {
  test('hasHandler matches NamedHandler before and after registration', () => {
    const commandHandler = new CommandHandler();
    const namedHandler = new NamedHandler<LocalHandlers>();
    const onHandler: CommandHandlerFunction<'OnOff.on'> = async () => {};

    expect(commandHandler.hasHandler('OnOff.on')).toBe(namedHandler.hasHandler('OnOff.on'));

    commandHandler.addHandler('OnOff.on', onHandler);
    namedHandler.addHandler('OnOff.on', onHandler);

    expect(commandHandler.hasHandler('OnOff.on')).toBe(namedHandler.hasHandler('OnOff.on'));
    expect(commandHandler.hasHandler('OnOff.off')).toBe(namedHandler.hasHandler('OnOff.off'));
  });

  test('executeHandler passes the typed payload to the matching handler', async () => {
    const commandHandler = new CommandHandler();
    const namedHandler = new NamedHandler<LocalHandlers>();
    const payload = createOnOffCommandData('OnOff.on');
    const commandCalls: CommandHandlerData<'OnOff.on'>[] = [];
    const namedCalls: CommandHandlerData<'OnOff.on'>[] = [];
    const commandSpy: CommandHandlerFunction<'OnOff.on'> = async (data) => {
      commandCalls.push(data);
    };
    const namedSpy: CommandHandlerFunction<'OnOff.on'> = async (data) => {
      namedCalls.push(data);
    };

    commandHandler.addHandler('OnOff.on', commandSpy);
    namedHandler.addHandler('OnOff.on', namedSpy);

    await commandHandler.executeHandler('OnOff.on', payload);
    await namedHandler.executeHandler('OnOff.on', payload);

    expect(commandCalls).toEqual(namedCalls);
    expect(commandCalls).toHaveLength(1);
    expect(commandCalls[0]).toBe(payload);
  });

  test('executeHandler runs only the first matching handler like NamedHandler', async () => {
    const commandHandler = new CommandHandler();
    const namedHandler = new NamedHandler<LocalHandlers>();
    const payload = createOnOffCommandData('OnOff.on');
    const commandCalls: string[] = [];
    const namedCalls: string[] = [];

    commandHandler.addHandler('OnOff.on', async () => {
      commandCalls.push('first');
    });
    commandHandler.addHandler('OnOff.on', async () => {
      commandCalls.push('second');
    });
    namedHandler.addHandler('OnOff.on', async () => {
      namedCalls.push('first');
    });
    namedHandler.addHandler('OnOff.on', async () => {
      namedCalls.push('second');
    });

    await commandHandler.executeHandler('OnOff.on', payload);
    await namedHandler.executeHandler('OnOff.on', payload);

    expect(commandCalls).toEqual(namedCalls);
    expect(commandCalls).toEqual(['first']);
  });

  test('executeHandler returns undefined for an unregistered command like NamedHandler', async () => {
    const commandHandler = new CommandHandler();
    const namedHandler = new NamedHandler<LocalHandlers>();
    const payload = createOnOffCommandData('OnOff.toggle');

    await expect(commandHandler.executeHandler('OnOff.toggle', payload)).resolves.toBeUndefined();
    await expect(namedHandler.executeHandler('OnOff.toggle', payload)).resolves.toBeUndefined();
  });

  test('executeHandler returns the mapped command response when the handler provides one', async () => {
    const commandHandler = new CommandHandler();
    const payload = createDoorLockGetUserCommandData();
    const expectedResponse = {
      userIndex: 1,
      userName: 'Guest',
      userUniqueId: 1234,
      userStatus: null,
      userType: null,
      credentialRule: null,
      credentials: null,
      creatorFabricIndex: null,
      lastModifiedFabricIndex: null,
      nextUserIndex: null,
    } satisfies NonNullable<CommandHandlerExecutionResult<'DoorLock.getUser'>>;

    commandHandler.addHandler('DoorLock.getUser', async (data) => {
      expect(data).toBe(payload);
      return expectedResponse;
    });

    await expect(commandHandler.executeHandler('DoorLock.getUser', payload)).resolves.toEqual(expectedResponse);
  });

  test('removeHandler matches NamedHandler semantics across command and handler combinations', async () => {
    const commandHandler = new CommandHandler();
    const namedHandler = new NamedHandler<LocalHandlers>();
    const sharedHandler: CommandHandlerFunction<'OnOff.on'> = async () => {};
    const distinctOnHandler: CommandHandlerFunction<'OnOff.on'> = async () => {};
    const offHandler: CommandHandlerFunction<'OnOff.off'> = async () => {};

    commandHandler.addHandler('OnOff.on', sharedHandler);
    commandHandler.addHandler('OnOff.on', distinctOnHandler);
    commandHandler.addHandler('OnOff.off', offHandler);

    namedHandler.addHandler('OnOff.on', sharedHandler);
    namedHandler.addHandler('OnOff.on', distinctOnHandler);
    namedHandler.addHandler('OnOff.off', offHandler);

    commandHandler.removeHandler('OnOff.on', sharedHandler);
    namedHandler.removeHandler('OnOff.on', sharedHandler);

    expect(commandHandler.hasHandler('OnOff.on')).toBe(namedHandler.hasHandler('OnOff.on'));
    expect(commandHandler.hasHandler('OnOff.off')).toBe(namedHandler.hasHandler('OnOff.off'));

    await expect(commandHandler.executeHandler('OnOff.on', createOnOffCommandData('OnOff.on'))).resolves.toBeUndefined();
    await expect(namedHandler.executeHandler('OnOff.on', createOnOffCommandData('OnOff.on'))).resolves.toBeUndefined();

    await expect(commandHandler.executeHandler('OnOff.off', createOnOffCommandData('OnOff.off'))).resolves.toBeUndefined();
    await expect(namedHandler.executeHandler('OnOff.off', createOnOffCommandData('OnOff.off'))).resolves.toBeUndefined();
  });
});

describe('CommandHandler type bindings', () => {
  test('addHandler infers the payload type from CommandHandlers', async () => {
    const commandHandler = new CommandHandler();
    let onCommand: CommandHandlers | undefined;
    let identifyCommand: CommandHandlers | undefined;

    commandHandler.addHandler('OnOff.on', async (data) => {
      const typedRequest: CommandHandlerData<'OnOff.on'>['request'] = data.request;
      const typedCluster: CommandHandlerData<'OnOff.on'>['cluster'] = data.cluster;
      const typedAttributes: CommandHandlerData<'OnOff.on'>['attributes'] = data.attributes;
      const typedEndpoint: MatterbridgeEndpoint = data.endpoint;

      onCommand = 'OnOff.on';
      expect(typedRequest).toEqual({});
      expect(typedCluster).toBe('onOff');
      expect(typedAttributes).toBe(data.attributes);
      expect(typedEndpoint).toBe(data.endpoint);
    });

    commandHandler.addHandler('Identify.triggerEffect', async (data) => {
      const typedRequest: CommandHandlerData<'Identify.triggerEffect'>['request'] = data.request;
      const typedCluster: CommandHandlerData<'Identify.triggerEffect'>['cluster'] = data.cluster;
      const typedAttributes: CommandHandlerData<'Identify.triggerEffect'>['attributes'] = data.attributes;
      const typedEndpoint: MatterbridgeEndpoint = data.endpoint;

      identifyCommand = 'Identify.triggerEffect';
      expect(typedRequest).toBe(data.request);
      expect(typedCluster).toBe('identify');
      expect(typedAttributes).toBe(data.attributes);
      expect(typedEndpoint).toBe(data.endpoint);
    });

    await commandHandler.executeHandler('OnOff.on', createOnOffCommandData('OnOff.on'));
    await commandHandler.executeHandler('Identify.triggerEffect', {
      command: 'triggerEffect',
      request: {} as CommandHandlerData<'Identify.triggerEffect'>['request'],
      cluster: 'identify',
      attributes: {} as unknown as CommandHandlerData<'Identify.triggerEffect'>['attributes'],
      endpoint: {} as MatterbridgeEndpoint,
    });

    expect(onCommand).toBe('OnOff.on');
    expect(identifyCommand).toBe('Identify.triggerEffect');

    if (await Promise.resolve(process.env.MATTERBRIDGE_TYPECHECK_NEGATIVE === '1')) {
      // @ts-expect-error intentional type-check guard for CommandHandlers
      const invalidCommand: CommandHandlers = 'OnOff.invalid';
      void invalidCommand;

      commandHandler.addHandler('Identify.triggerEffect', async (data) => {
        // @ts-expect-error intentional type-check guard for command-specific cluster inference
        const wrongCluster: 'onOff' = data.cluster;
        void wrongCluster;
      });
    }
  });

  test('executeHandler and removeHandler require the same command specific types', async () => {
    const commandHandler = new CommandHandler();
    const offWithEffectHandler: CommandHandlerFunction<'OnOff.offWithEffect'> = async (data) => {
      const typedRequest: CommandHandlerData<'OnOff.offWithEffect'>['request'] = data.request;
      const typedCluster: CommandHandlerData<'OnOff.offWithEffect'>['cluster'] = data.cluster;

      expect(typedRequest).toBe(data.request);
      expect(typedCluster).toBe('onOff');
    };

    commandHandler.addHandler('OnOff.offWithEffect', offWithEffectHandler);
    await commandHandler.executeHandler('OnOff.offWithEffect', {
      command: 'offWithEffect',
      request: {} as CommandHandlerData<'OnOff.offWithEffect'>['request'],
      cluster: 'onOff',
      attributes: {} as unknown as CommandHandlerData<'OnOff.offWithEffect'>['attributes'],
      endpoint: {} as MatterbridgeEndpoint,
    });
    commandHandler.removeHandler('OnOff.offWithEffect', offWithEffectHandler);

    if (await Promise.resolve(process.env.MATTERBRIDGE_TYPECHECK_NEGATIVE === '1')) {
      const wrongHandler: CommandHandlerFunction<'OnOff.on'> = async () => {};

      // @ts-expect-error intentional type-check guard for removeHandler command-handler pairing
      commandHandler.removeHandler('OnOff.offWithEffect', wrongHandler);
      // @ts-expect-error intentional type-check guard for executeHandler payload inference
      await commandHandler.executeHandler('OnOff.offWithEffect', createOnOffCommandData('OnOff.on'));
    }
  });

  test('short aliases map to the same types as fully qualified identify commands', async () => {
    const commandHandler = new CommandHandler();
    let identifyAliasCalled = false;
    let triggerEffectAliasCalled = false;

    const identifyAliasPayload: CommandHandlerData<'identify'> = {
      command: 'identify',
      request: {} as CommandHandlerData<'Identify.identify'>['request'],
      cluster: 'identify',
      attributes: {} as unknown as CommandHandlerData<'Identify.identify'>['attributes'],
      endpoint: {} as MatterbridgeEndpoint,
    };
    const identifyQualifiedPayload: CommandHandlerData<'Identify.identify'> = identifyAliasPayload;
    const triggerEffectAliasPayload: CommandHandlerData<'triggerEffect'> = {
      command: 'triggerEffect',
      request: {} as CommandHandlerData<'Identify.triggerEffect'>['request'],
      cluster: 'identify',
      attributes: {} as unknown as CommandHandlerData<'Identify.triggerEffect'>['attributes'],
      endpoint: {} as MatterbridgeEndpoint,
    };
    const triggerEffectQualifiedPayload: CommandHandlerData<'Identify.triggerEffect'> = triggerEffectAliasPayload;

    commandHandler.addHandler('identify', async (data) => {
      const typedAliasData: CommandHandlerData<'identify'> = data;
      const typedQualifiedData: CommandHandlerData<'Identify.identify'> = data;

      identifyAliasCalled = true;
      expect(typedAliasData).toBe(identifyAliasPayload);
      expect(typedQualifiedData).toBe(identifyQualifiedPayload);
      expect(typedAliasData.cluster).toBe('identify');
    });

    commandHandler.addHandler('triggerEffect', async (data) => {
      const typedAliasData: CommandHandlerData<'triggerEffect'> = data;
      const typedQualifiedData: CommandHandlerData<'Identify.triggerEffect'> = data;

      triggerEffectAliasCalled = true;
      expect(typedAliasData).toBe(triggerEffectAliasPayload);
      expect(typedQualifiedData).toBe(triggerEffectQualifiedPayload);
      expect(typedAliasData.cluster).toBe('identify');
    });

    await commandHandler.executeHandler('identify', identifyAliasPayload);
    await commandHandler.executeHandler('triggerEffect', triggerEffectAliasPayload);

    expect(identifyAliasCalled).toBe(true);
    expect(triggerEffectAliasCalled).toBe(true);
  });

  test('executeHandler falls back from a qualified command to its short alias', async () => {
    const commandHandler = new CommandHandler();
    const payload = createOnOffCommandData('OnOff.on');
    const calls: CommandHandlerData<'on'>[] = [];

    commandHandler.addHandler('on', async (data) => {
      calls.push(data);
    });

    await commandHandler.executeHandler('OnOff.on', payload);

    expect(calls).toEqual([payload]);
  });

  test('executeHandler prefers an exact qualified handler over the short alias fallback', async () => {
    const commandHandler = new CommandHandler();
    const payload = createOnOffCommandData('OnOff.on');
    const calls: string[] = [];

    commandHandler.addHandler('on', async () => {
      calls.push('alias');
    });
    commandHandler.addHandler('OnOff.on', async () => {
      calls.push('qualified');
    });

    await commandHandler.executeHandler('OnOff.on', payload);

    expect(calls).toEqual(['qualified']);
  });
});
