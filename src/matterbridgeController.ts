/* eslint-disable max-len */
/*
async function startMatterController() {
  log.info('Creating mattercontrollerContext: mattercontrollerContext');
  mattercontrollerContext = storageManager.createContext('mattercontrollerContext');

  await createMatterServer(storageManager);

  log.info('Creating matter commissioning controller');
  commissioningController = new CommissioningController({
    autoConnect: false,
  });
  await matterServer.addCommissioningController(commissioningController);

  log.info('Starting matter server');
  await matterServer.start();
  log.info('Started matter server');

  AllClustersMap[EveHistoryCluster.id] = EveHistoryCluster;
  log.info('Added custom cluster:', getClusterNameById(EveHistoryCluster.id));

  if (hasParameter('ble')) {
    //
  }

  if (hasParameter('pairingcode')) {
    const pairingCode = getParameter('pairingcode');
    const ip = mattercontrollerContext.has('ip') ? mattercontrollerContext.get<string>('ip') : undefined;
    const port = mattercontrollerContext.has('port') ? mattercontrollerContext.get<number>('port') : undefined;

    let longDiscriminator, setupPin, shortDiscriminator;
    if (pairingCode !== undefined) {
      const pairingCodeCodec = ManualPairingCodeCodec.decode(pairingCode);
      shortDiscriminator = pairingCodeCodec.shortDiscriminator;
      longDiscriminator = undefined;
      setupPin = pairingCodeCodec.passcode;
      logger.debug(`Data extracted from pairing code: ${Logger.toJSON(pairingCodeCodec)}`);
    } else {
      longDiscriminator = mattercontrollerContext.get('longDiscriminator', 3840);
      if (longDiscriminator > 4095) throw new Error('Discriminator value must be less than 4096');
      setupPin = mattercontrollerContext.get('pin', 20202021);
    }
    if ((shortDiscriminator === undefined && longDiscriminator === undefined) || setupPin === undefined) {
      throw new Error('Please specify the longDiscriminator of the device to commission with -longDiscriminator or provide a valid passcode with -passcode');
    }

    const commissioningOptions: CommissioningOptions = {
      regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
      regulatoryCountryCode: 'XX',
    };
    const options = {
      commissioning: commissioningOptions,
      discovery: {
        knownAddress: ip !== undefined && port !== undefined ? { ip, port, type: 'udp' } : undefined,
        identifierData: longDiscriminator !== undefined ? { longDiscriminator } : shortDiscriminator !== undefined ? { shortDiscriminator } : {},
      },
      passcode: setupPin,
    } as NodeCommissioningOptions;
    log.info(`Commissioning ... ${JSON.stringify(options)}`);
    const nodeId = await commissioningController.commissionNode(options);
    mattercontrollerContext.set('nodeId', nodeId.nodeId);
    log.info(`Commissioning successfully done with nodeId: ${nodeId.nodeId}`);
    console.log('ActiveSessionInformation:', commissioningController.getActiveSessionInformation());
  } // (hasParameter('pairingcode'))

  if (hasParameter('discover')) {
    Logger.defaultLogLevel = Level.DEBUG;
    const discover = await commissioningController.discoverCommissionableDevices({});
    console.log(discover);
    Logger.defaultLogLevel = Level.INFO;
  }

  log.info(`Commissioning controller is already commisioned: ${commissioningController.isCommissioned()}`);
  const nodes = commissioningController.getCommissionedNodes();
  nodes.forEach(async (nodeId) => {
    log.warn(`Connecting to commissioned node: ${nodeId}`);
    const node = await commissioningController.connectNode(nodeId, {
      attributeChangedCallback: (peerNodeId, { path: { nodeId, clusterId, endpointId, attributeName }, value }) =>
        console.log(`\x1b[37;44mattributeChangedCallback ${peerNodeId}: Attribute ${nodeId}/${endpointId}/${clusterId}/${attributeName} changed to ${Logger.toJSON(value)}\x1b[40;0m`),
      eventTriggeredCallback: (peerNodeId, { path: { nodeId, clusterId, endpointId, eventName }, events }) =>
        console.log(`\x1b[37;44meventTriggeredCallback ${peerNodeId}: Event ${nodeId}/${endpointId}/${clusterId}/${eventName} triggered with ${Logger.toJSON(events)}\x1b[40;0m`),
      stateInformationCallback: (peerNodeId, info) => {
        switch (info) {
          case NodeStateInformation.Connected:
            console.log(`\x1b[37;44mstateInformationCallback ${peerNodeId}: Node ${nodeId} connected\x1b[40;0m`);
            break;
          case NodeStateInformation.Disconnected:
            console.log(`\x1b[37;44mstateInformationCallback ${peerNodeId}: Node ${nodeId} disconnected\x1b[40;0m`);
            break;
          case NodeStateInformation.Reconnecting:
            console.log(`\x1b[37;44mstateInformationCallback ${peerNodeId}: Node ${nodeId} reconnecting\x1b[40;0m`);
            break;
          case NodeStateInformation.WaitingForDeviceDiscovery:
            console.log(`\x1b[37;44mstateInformationCallback ${peerNodeId}: Node ${nodeId} waiting for device discovery\x1b[40;0m`);
            break;
          case NodeStateInformation.StructureChanged:
            console.log(`\x1b[37;44mstateInformationCallback ${peerNodeId}: Node ${nodeId} structure changed\x1b[40;0m`);
            break;
          case NodeStateInformation.Decommissioned:
            console.log(`\x1b[37;44mstateInformationCallback ${peerNodeId}: Node ${nodeId} decommissioned\x1b[40;0m`);
            break;
          default:
            console.log(`\x1b[37;44mstateInformationCallback ${peerNodeId}: Node ${nodeId} NodeStateInformation.${info}\x1b[40;0m`);
            break;
        }
      },
    });

    const info = node.getRootClusterClient(BasicInformationCluster);
    let name = '';
    if (info !== undefined) {
      log.info(`Node ${nodeId} VendorName ${await info.getVendorNameAttribute()}`); // This call is executed remotely
      log.info(`Node ${nodeId} ProductName ${(name = await info.getProductNameAttribute())}`); // This call is executed remotely
      log.info(`Node ${nodeId} NodeLabel ${await info.getNodeLabelAttribute()}`); // This call is executed remotely
      log.info(`Node ${nodeId} ProductLabel ${await info.getProductLabelAttribute()}`); // This call is executed remotely
      log.info(`Node ${nodeId} SerialNumber ${await info.getSerialNumberAttribute()}`); // This call is executed remotely
      log.info(`Node ${nodeId} UniqueId ${await info.getUniqueIdAttribute()}`); // This call is executed remotely
    } else {
      log.error('No BasicInformation Cluster found. This should never happen!');
    }

    log.warn(`Logging commissioned node: ${nodeId} name: ${name}`);
    //node.logStructure();

    const mattercontrollerNodeContext = storageManager.createContext(name);
    const interactionClient = await node.getInteractionClient();

    // Log BasicInformationCluster
    const attributesInfoCluster = await interactionClient.getMultipleAttributes({
      attributes: [{ clusterId: BasicInformationCluster.id }],
    });
    attributesInfoCluster.forEach((attribute) => {
      log.info(
        `${name}:BasicInformationCluster ${attribute.path.nodeId}-${attribute.path.endpointId}-${attribute.path.clusterId} id: ${attribute.path.attributeId} name: ${attribute.path.attributeName}: ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
      );
    });

    // Log PowerSourceConfigurationCluster
    const attributesPowerConfigCluster = await interactionClient.getMultipleAttributes({
      attributes: [{ clusterId: PowerSourceConfigurationCluster.id }],
    });
    attributesPowerConfigCluster.forEach((attribute) => {
      log.info(
        `${name}:PowerSourceConfigurationCluster ${attribute.path.nodeId}-${attribute.path.endpointId}-${attribute.path.clusterId} id: ${attribute.path.attributeId} name: ${attribute.path.attributeName}: ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
      );
    });

    // Log PowerSourceCluster
    const attributesPowerCluster = await interactionClient.getMultipleAttributes({
      attributes: [{ clusterId: PowerSourceCluster.id }],
    });
    attributesPowerCluster.forEach((attribute) => {
      log.info(
        `${name}:PowerSourceCluster ${attribute.path.nodeId}-${attribute.path.endpointId}-${attribute.path.clusterId} id: ${attribute.path.attributeId} name: ${attribute.path.attributeName}: ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
      );
    });

    // Log ThreadNetworkDiagnostics
    const attributesThreadCluster = await interactionClient.getMultipleAttributes({
      attributes: [{ clusterId: ThreadNetworkDiagnosticsCluster.id }]
    });
    attributesThreadCluster.forEach(attribute => {
      log.info(`${name}:ThreadNetworkDiagnosticsCluster ${attribute.path.nodeId}-${attribute.path.endpointId}-${attribute.path.clusterId} id: ${attribute.path.attributeId} name: ${attribute.path.attributeName}: ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`);
    });

    const devices = node.getDevices();
    devices.forEach(async (device) => {
      log.info(`Device id: ${device.id} name: ${device.name}`);
      //logEndpoint(device);

      const eveHistory = device.getClusterClient(EveHistoryCluster);
      if (eveHistory !== undefined) {
        log.info(`EveHistory found on id: ${device.id} name: ${device.name}`);

        // Log EveHistoryCluster
        const attributesEveHistoryCluster = await interactionClient.getMultipleAttributes({
          attributes: [{ clusterId: EveHistoryCluster.id }],
        });
        attributesEveHistoryCluster.forEach((attribute) => {
          log.info(
            `${name}:EveHistoryCluster ${attribute.path.nodeId}-${attribute.path.endpointId}-${attribute.path.clusterId} id: ${attribute.path.attributeId} name: ${attribute.path.attributeName}: ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
          );
        });

        const history = new MatterHistory(log, name, { fileName: name + '_history.json' });
        let logMessage = '';

        // Get and decode HistoryStatus
        const historyStatus: Uint8Array = await eveHistory.getHistoryStatusAttribute();
        log.info((logMessage = history.decodeHistoryStatus(Buffer.from(historyStatus))));
        fs.appendFileSync(name + '.log', logMessage + '\n');

        // Set HistorySetTime
        const bufferSetTime = history.encodeHistorySetTime();
        log.info((logMessage = history.decodeHistorySetTime(bufferSetTime)));
        fs.appendFileSync(name + '.log', logMessage + '\n');
        await eveHistory.setHistorySetTimeAttribute(bufferSetTime);

        // Set HistoryRequest
        const entryNumber = mattercontrollerNodeContext.get('nextEntry', history.getFirstEntry());
        const bufferRequest = history.encodeHistoryRequest(history.clamp(entryNumber, history.getFirstEntry(), history.getLastEntry()));
        log.info((logMessage = history.decodeHistoryRequest(bufferRequest)));
        fs.appendFileSync(name + '.log', logMessage + '\n');
        await eveHistory.setHistoryRequestAttribute(bufferRequest);

        // Get HistoryEntries
        let historyEntries: Uint8Array = await eveHistory.getHistoryEntriesAttribute();
        let bufferHistoryEntries = Buffer.from(historyEntries);
        //console.log(history.historyEntriesToString(bufferHistoryEntries));
        while (bufferHistoryEntries.length > 0) {
          for (let i = 0; i < bufferHistoryEntries.length; ) {
            const bufferHistoryEntry = Buffer.copyBytesFrom(bufferHistoryEntries, i, bufferHistoryEntries.readUInt8(i));
            i += bufferHistoryEntries.readUInt8(i);
            history.decodeHistoryEntry(bufferHistoryEntry);
            log.info((logMessage = history.historyEntryToString(bufferHistoryEntry)));
            fs.appendFileSync(name + '.log', logMessage + '\n');
            mattercontrollerNodeContext.set('nextEntry', bufferHistoryEntry.readUInt32LE(1) + 1);
          }
          historyEntries = await eveHistory.getHistoryEntriesAttribute();
          bufferHistoryEntries = Buffer.from(historyEntries);
          //console.log(history.historyEntriesToString(bufferHistoryEntries));
        }
        history.writeHistoryFile();
        //history.logHistory(true);

        eveHistory.subscribeHistoryStatusAttribute(
          (value: Uint8Array) => { log.warn('Received EveHistoryStatus:', value.toHex()) }, 0, 30)
          .then(() => { log.warn('Subscription successful to EveHistoryStatus.') })
          .catch((error) => { log.error('Error during subscription to EveHistoryStatus:', error) });

        eveHistory.subscribeHistoryEntriesAttribute(
          (value: Uint8Array) => { log.warn('Received EveHistoryEntries:', value.toHex()) }, 0, 30)
          .then(() => { log.warn('Subscription successful to EveHistoryEntries.') })
          .catch((error) => { log.error('Error during subscription to EveHistoryEntries:', error) });

        setInterval(async () => {
          try {
            const attributesEveCluster = await interactionClient.getMultipleAttributes({
              attributes: [{ clusterId: EveHistoryCluster.id }],
            });
            log.info('\x1b[97;45mEve device: ' + name + '\x1b[40;0m');

            attributesEveCluster.forEach((attribute) => {
              if (attribute.path.attributeId === EveHistoryCluster.attributes.ConfigDataGet.id) {
                const data = Buffer.from(attribute.value);
                logMessage = `ConfigDataGet(${data.length}): [${data.toHex()}]`;
                log.info(logMessage);
                log.info('*' + history.decodeConfigData(data));
                fs.appendFileSync(name + '.config.log', logMessage + '\n');
              } else if (attribute.path.attributeId === EveHistoryCluster.attributes.HistoryStatus.id) {
                logMessage = history.decodeHistoryStatus(Buffer.from(attribute.value));
                log.info(logMessage);
                fs.appendFileSync(name + '.log', logMessage + '\n');
              } else if (attribute.path.attributeId === EveHistoryCluster.attributes.HistoryEntries.id) {
                const bufferHistoryEntries = Buffer.from(attribute.value);
                for (let i = 0; i < bufferHistoryEntries.length; ) {
                  const bufferHistoryEntry = Buffer.copyBytesFrom(bufferHistoryEntries, i, bufferHistoryEntries.readUInt8(i));
                  i += bufferHistoryEntries.readUInt8(i);
                  history.decodeHistoryEntry(bufferHistoryEntry);
                  log.info((logMessage = history.historyEntryToString(bufferHistoryEntry)));
                  fs.appendFileSync(name + '.log', logMessage + '\n');
                }
                history.writeHistoryFile();
              } else if (attribute.path.attributeId === EveHistoryCluster.attributes.TimesOpened.id) {
                log.info(`TimesOpened: ${attribute.value}`);
              } else if (attribute.path.attributeId === EveHistoryCluster.attributes.LastEvent.id) {
                log.info(`LastEvent: ${attribute.value}=${history.secsToDateString(attribute.value + history.getInitialTime() - history.getTimeOffset())}`);
              } else if (attribute.path.attributeId === EveHistoryCluster.attributes.ResetTotal.id) {
                log.info(`ResetTotal: ${attribute.value}=${history.secsToDateStringSinceEveEpoch(attribute.value)}`);
              } else if (attribute.path.attributeId === EveHistoryCluster.attributes.Voltage.id) {
                log.info(`Voltage: ${attribute.value}`);
              } else if (attribute.path.attributeId === EveHistoryCluster.attributes.Current.id) {
                log.info(`Current: ${attribute.value}`);
              } else if (attribute.path.attributeId === EveHistoryCluster.attributes.Consumption.id) {
                log.info(`Consumption: ${attribute.value}`);
              } else if (attribute.path.attributeId === EveHistoryCluster.attributes.TotalConsumption.id) {
                log.info(`TotalConsumption: ${attribute.value}`);
              } else if (attribute.path.attributeId === EveHistoryCluster.attributes.ChildLock.id) {
                log.info(`ChildLock: ${attribute.value}`);
              } else if (attribute.path.attributeId === EveHistoryCluster.attributes.MotionSensitivity.id) {
                log.info(`MotionSensitivity: ${attribute.value}`);
              } else if (attribute.path.attributeId === EveHistoryCluster.attributes.RLoc.id) {
                log.info((logMessage = `RLoc: 0x${attribute.value.toString(16)}`));
              } else {
                if (attribute.path.attributeId >= 0x130a0000) {
                  log.info(`Unknown attribute ${attribute.path.attributeName} type: ${typeof attribute.value} value: [${attribute.value.toString(16)}]${attribute.value}`);
                }
              }
            });
          } catch (error) {
            console.error(error);
          }
        }, 30000);
      } else {
        log.info(`EveHistory not found on ${device.id} name: ${device.name}`);
      }
    }); // devices.forEach(async device => {
  }); // nodes.forEach(async nodeId => {

  if (hasParameter('unpairall')) {
    nodes.forEach(async (nodeId) => {
      await commissioningController.removeNode(nodeId);
    });
    process.exit(0);
  }
}
*/
