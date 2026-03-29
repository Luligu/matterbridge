/**
 * Data model script.
 *
 * This script will fetch from the connectedhomeip GitHub repository the data model files and convert them to JSON.
 *
 * It supports environment variables to customize the version and output paths.
 *
 * MATTER_DATA_MODEL_VERSION - The default version is 1.5.0.
 * MATTER_DATA_MODEL_XML_OUT - Where to store the downloaded XMLs (default: chip/<version>/xml).
 */

/* eslint-disable no-console */

const MATTER_DATA_MODEL_VERSION = process.env.MATTER_DATA_MODEL_VERSION || '1.5.0';
const MATTER_DATA_MODEL_VERSION_REMOTE = MATTER_DATA_MODEL_VERSION.replace(/^(\d+\.\d+)\.0$/, '$1');
const SRC_PATH = `https://raw.githubusercontent.com/project-chip/connectedhomeip/master/data_model/${MATTER_DATA_MODEL_VERSION_REMOTE}/`;
const DATA_MODEL_PATHS = {
  clusters: `${SRC_PATH}clusters/`,
  clustersIds: `${SRC_PATH}clusters/cluster_ids.json`,
  deviceTypes: `${SRC_PATH}device_types/`,
  deviceTypesIds: `${SRC_PATH}device_types/device_type_ids.json`,
  namespaces: `${SRC_PATH}namespaces/`,
};
const DST_PATH = `chip/${MATTER_DATA_MODEL_VERSION}/`;
const XML_DST_PATH = process.env.MATTER_DATA_MODEL_XML_OUT || `chip/${MATTER_DATA_MODEL_VERSION}/xml`;
const OUTPUT_NAMESPACES = 'namespaces.json';
const OUTPUT_DEVICE_TYPES = 'deviceTypes.json';
const OUTPUT_CLUSTERS = 'clusters.json';
const GITHUB_API_BASE = 'https://api.github.com/repos/project-chip/connectedhomeip/contents';
const DEVICE_TYPES_DIRECTORY_API = `${GITHUB_API_BASE}/data_model/${MATTER_DATA_MODEL_VERSION_REMOTE}/device_types?ref=master`;
const CLUSTERS_DIRECTORY_API = `${GITHUB_API_BASE}/data_model/${MATTER_DATA_MODEL_VERSION_REMOTE}/clusters?ref=master`;
const GITHUB_API_HEADERS = {
  'User-Agent': 'matterbridge-data-model-script',
  'Accept': 'application/vnd.github.v3+json',
};

const sanitizeKey = (value) => value.replace(/[\s/]+/g, '');
const normalizeDisplayName = (value) => (typeof value === 'string' ? value.replace(/\s*\/\s*/g, '') : value);

const isValidTsIdentifier = (value) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);

const escapeSingleQuotedTsStringLiteral = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n');

const formatTsStringLiteralKey = (key) => `'${escapeSingleQuotedTsStringLiteral(key)}'`;

const toLowerCamelCase = (value) => {
  if (!value) {
    return value;
  }

  const parts = value.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+/g) || [value];

  return parts
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join('');
};

const lowerFirstCharacter = (value) => {
  if (!value) {
    return value;
  }

  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
};

const isDoNotUseEntryKey = (value) => typeof value === 'string' && value.trim().toLowerCase() === 'donotuse';

const formatTsPropertyKey = (key) => (isValidTsIdentifier(key) ? key : formatTsStringLiteralKey(key));

const wrapNullableType = (tsType) => (tsType.includes('|') ? `(${tsType}) | null` : `${tsType} | null`);

const formatEntryXmlType = (entry) => {
  const rawType = typeof entry?.type === 'string' ? entry.type.trim() : '';

  if (!rawType) {
    return undefined;
  }

  if (rawType.toLowerCase() !== 'list') {
    return rawType;
  }

  const elementTypeName = typeof entry?.entries?.[0]?.type === 'string' ? entry.entries[0].type.trim() : '';
  return elementTypeName ? `list<${elementTypeName}>` : 'list';
};

const getConverterTypeSortSubject = (xmlType) => {
  if (typeof xmlType !== 'string') {
    return '';
  }

  const trimmed = xmlType.trim();
  const listMatch = /^list<(.+)>$/i.exec(trimmed);
  return listMatch ? listMatch[1].trim() : trimmed;
};

const normalizeConverterXmlType = (xmlType) => {
  const sortSubject = getConverterTypeSortSubject(xmlType);
  return sortSubject || undefined;
};

const getConverterTypeCaseSortRank = (xmlType) => {
  const normalizedXmlType = normalizeConverterXmlType(xmlType);

  if (!normalizedXmlType) {
    return 1;
  }

  return /^[a-z]/.test(normalizedXmlType) ? 0 : 1;
};

const normalizeConverterTsType = (tsType) => {
  if (typeof tsType !== 'string') {
    return undefined;
  }

  let normalized = tsType
    .trim()
    .replace(/\s*\|\s*null/g, '')
    .trim();

  while (normalized.startsWith('(') && normalized.endsWith(')')) {
    normalized = normalized.slice(1, -1).trim();
  }

  while (normalized.endsWith('[]')) {
    normalized = normalized.slice(0, -2).trim();
  }

  while (normalized.startsWith('(') && normalized.endsWith(')')) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized || undefined;
};

const MATTER_DATATYPE_TS_MAP = {
  // Matter "seed" datatypes (Core spec §7.19)
  'status': 'Status',
  'vendor-id': 'VendorId',
  'fabric-idx': 'FabricIndex',
  'endpoint-no': 'EndpointNumber',
  'cluster-id': 'ClusterId',
  'zoneid': 'ZoneId',
  'group-id': 'GroupId',
  'node-id': 'NodeId',
  'subject-id': 'SubjectId',
  'tlsendpointid': 'TLSEndpointId',
  'tlscaid': 'TLSCAId',
  'tlsccdid': 'TLSCCDId',
  'webrtcsessionid': 'WebRTCSessionId',
  'pushtransportconnectionid': 'PushTransportConnectionId',
  'audiostreamid': 'AudioStreamId',
  'videostreamid': 'VideoStreamId',
  'snapshotstreamid': 'SnapshotStreamId',
  'message-id': 'Bytes',
  'ipv6adr': 'Bytes',
  'ipv6pre': 'Bytes',
  'octstr': 'Bytes',
  'elapsed-s': 'ElapsedS',
  'epoch-us': 'EpochUs',

  // Compact temperature aliases (0.1°C resolution, value = °C × 10)
  'signedtemperature': 'SignedTemperature10Ths',
  'unsignedtemperature': 'UnsignedTemperature10Ths',

  // Matter global structs referenced as list element types
  'semantictagstruct': 'Semtag',

  // Common structs referenced across clusters
  'labelstruct': 'LabelStruct',

  // Common unit/bitmap datatypes used by clusters
  'map16': 'MatterBitmap',
  'amperage-ma': 'Int64',
  'voltage-mv': 'Int64',
  'power-mw': 'Int64',
  'energy-mwh': 'Int64',
  'power-mva': 'Int64',
  'power-mvar': 'Int64',
};

const resolvePrimitiveOrSeedTypeToTs = (typeName) => {
  if (!typeName || typeof typeName !== 'string') {
    return undefined;
  }

  const trimmed = typeName.trim();
  const normalized = trimmed.toLowerCase();

  if (normalized === 'bool' || normalized === 'boolean') {
    return 'boolean';
  }

  if (normalized === 'single' || normalized === 'double') {
    return 'number';
  }

  if (normalized === 'percent') {
    return 'Percent';
  }

  if (normalized === 'percent100ths') {
    return 'Percent100Ths';
  }

  if (normalized === 'temperature') {
    return 'Temperature100Ths';
  }

  if (normalized === 'epoch-s' || normalized === 'epoch_s') {
    return 'EpochS';
  }

  const mapped = MATTER_DATATYPE_TS_MAP[normalized];
  if (mapped) {
    return mapped;
  }

  // Integer sizes. Note that 64-bit values in Matter.js are generally represented as number | bigint.
  const intMatch = /^(u?int)(8|16|24|32|40|48|56|64)(s)?$/i.exec(trimmed);
  if (intMatch) {
    const bits = Number(intMatch[2]);
    return bits === 64 ? 'Int64' : 'number';
  }

  if (/^(float|float32|float64)$/i.test(trimmed)) {
    return 'number';
  }

  if (/^enum\d*$/i.test(trimmed)) {
    return 'MatterEnum';
  }

  if (/^bitmap\d*$/i.test(trimmed)) {
    return 'MatterBitmap';
  }

  if (normalized.endsWith('char_string') || normalized.endsWith('string')) {
    return 'string';
  }

  if (normalized === 'octet_string' || normalized === 'long_octet_string') {
    return 'string';
  }

  return undefined;
};

const resolveClusterDataTypeToTs = (typeName, clusterEntry) => {
  const dataType = clusterEntry?.dataTypes?.[typeName];
  if (!dataType || typeof dataType !== 'object') {
    return undefined;
  }

  const kind = (dataType.type || '').toLowerCase();
  if (kind === 'enum') {
    return 'MatterEnum';
  }
  if (kind === 'bitmap') {
    return 'MatterBitmap';
  }
  if (kind === 'struct') {
    return 'MatterStruct';
  }

  return undefined;
};

const resolveNamedMatterTypeToTs = (typeName) => {
  if (!typeName || typeof typeName !== 'string') {
    return undefined;
  }

  const trimmed = typeName.trim();

  if (/Enum$/i.test(trimmed)) {
    return 'MatterEnum';
  }

  if (/Bitmap$/i.test(trimmed)) {
    return 'MatterBitmap';
  }

  if (/Struct$/i.test(trimmed)) {
    return 'MatterStruct';
  }

  return undefined;
};

const resolveTypeNameToTs = (typeName, clusterEntry) => {
  const primitive = resolvePrimitiveOrSeedTypeToTs(typeName);
  if (primitive) {
    return primitive;
  }

  const clusterType = resolveClusterDataTypeToTs(typeName, clusterEntry);
  if (clusterType) {
    return clusterType;
  }

  return resolveNamedMatterTypeToTs(typeName);
};

const typedEntryToTsTypeDiagnostic = (entry, clusterEntry) => {
  const rawType = entry?.type;

  /** @type {{ tsType: string, baseTsType: string, rawType?: string, reason?: string, details?: Record<string, unknown> }} */
  const diagnostic = { tsType: 'unknown', baseTsType: 'unknown' };

  if (!rawType || typeof rawType !== 'string') {
    diagnostic.reason = 'missing-type';
    return diagnostic;
  }

  const typeName = rawType.trim();
  const normalized = typeName.toLowerCase();

  diagnostic.rawType = typeName;

  let baseTsType;

  if (normalized === 'list') {
    const elementTypeName = entry?.entries?.[0]?.type;
    if (typeof elementTypeName === 'string' && elementTypeName.trim()) {
      const resolved = resolveTypeNameToTs(elementTypeName.trim(), clusterEntry);
      baseTsType = `${resolved || 'unknown'}[]`;
      if (!resolved) {
        diagnostic.reason = 'list-element-unresolved';
        diagnostic.details = { elementType: elementTypeName.trim() };
      }
    } else {
      baseTsType = 'unknown[]';
      diagnostic.reason = 'list-missing-element-type';
    }
  } else {
    const resolved = resolveTypeNameToTs(typeName, clusterEntry);
    baseTsType = resolved || 'unknown';
    if (!resolved) {
      diagnostic.reason = 'unresolved-type';
    }
  }

  if (entry?.qualityNullable === true) {
    diagnostic.baseTsType = baseTsType;
    diagnostic.tsType = wrapNullableType(baseTsType);
    return diagnostic;
  }

  diagnostic.baseTsType = baseTsType;
  diagnostic.tsType = baseTsType;
  return diagnostic;
};

const applyAttributeTypeOverrides = (diagnostic, clusterEntry, clusterKey, attributeKey) => {
  if (typeof attributeKey === 'string') {
    const normalizedAttributeKey = attributeKey.trim().toLowerCase();
    const baseCluster = typeof clusterEntry?.classification?.baseCluster === 'string' ? clusterEntry.classification.baseCluster : '';
    const isModeCluster =
      clusterKey === 'ModeSelect' ||
      clusterKey === 'ModeBaseCluster' ||
      (typeof clusterKey === 'string' && clusterKey.endsWith('Mode')) ||
      baseCluster.toLowerCase().includes('mode base');

    if (isModeCluster) {
      if (normalizedAttributeKey === 'currentmode') {
        diagnostic.reason = 'override';
        diagnostic.baseTsType = 'ModeId';
        diagnostic.tsType = 'ModeId';
        return diagnostic;
      }

      if (normalizedAttributeKey === 'onmode' || normalizedAttributeKey === 'startupmode') {
        diagnostic.reason = 'override';
        diagnostic.baseTsType = 'ModeId | null';
        diagnostic.tsType = 'ModeId | null';
        return diagnostic;
      }

      if (normalizedAttributeKey === 'supportedmodes') {
        diagnostic.reason = 'override';
        diagnostic.baseTsType = 'SupportedModes[]';
        diagnostic.tsType = 'SupportedModes[]';
        return diagnostic;
      }
    }

    if (clusterKey === 'DoorLock' && normalizedAttributeKey === 'securitylevel') {
      diagnostic.reason = 'override';
      diagnostic.baseTsType = 'number';
      diagnostic.tsType = 'number';
      return diagnostic;
    }

    if (clusterKey === 'PumpConfigurationandControl' && normalizedAttributeKey === 'alarmmask') {
      diagnostic.reason = 'override';
      diagnostic.baseTsType = 'MatterBitmap';
      diagnostic.tsType = 'MatterBitmap';
      return diagnostic;
    }

    if (normalizedAttributeKey === 'donotuse') {
      diagnostic.reason = 'override';
      diagnostic.baseTsType = 'never';
      diagnostic.tsType = 'never';
      return diagnostic;
    }
  }

  return diagnostic;
};

const entryToTsTypeDiagnostic = (entry, clusterEntry, options = {}) => {
  const diagnostic = typedEntryToTsTypeDiagnostic(entry, clusterEntry);

  if (options.entryKind === 'attribute') {
    return applyAttributeTypeOverrides(diagnostic, clusterEntry, options.clusterKey, options.entryKey);
  }

  return diagnostic;
};

const generateClusterTypesTs = (clustersByKey, versionLabel, unknownTypeUsages, converterTypeUsages) => {
  const clusterKeys = Object.keys(clustersByKey).sort((left, right) => left.localeCompare(right));
  const clusterLines = [];
  const matterDatatypeImports = new Set();
  const matterGlobalImports = new Set();
  const matterRootImports = new Set();
  const matterClusterImports = new Set();
  const converterTypeMappings = new Map();
  let usesMatterBytes = false;

  const recordUnknownTypeUsage = (entry) => {
    if (!Array.isArray(unknownTypeUsages) || typeof entry?.baseTsType !== 'string' || !entry.baseTsType.startsWith('unknown')) {
      return;
    }

    const rest = { ...entry };
    delete rest.baseTsType;
    unknownTypeUsages.push(rest);
  };

  const recordConverterTypeMapping = (entry, tsType) => {
    if (!Array.isArray(converterTypeUsages) || typeof tsType !== 'string') {
      return;
    }

    const xmlType = normalizeConverterXmlType(formatEntryXmlType(entry));
    const pureTsType = normalizeConverterTsType(tsType);
    if (!xmlType || !pureTsType) {
      return;
    }

    const existing = converterTypeMappings.get(xmlType) || { xmlType, tsTypes: new Set(), occurrences: 0 };
    existing.tsTypes.add(pureTsType);
    existing.occurrences += 1;
    converterTypeMappings.set(xmlType, existing);
  };

  const trackImportsForType = (tsType) => {
    if (typeof tsType !== 'string') {
      return;
    }
    if (/\bVendorId\b/.test(tsType)) matterDatatypeImports.add('VendorId');
    if (/\bFabricIndex\b/.test(tsType)) matterDatatypeImports.add('FabricIndex');
    if (/\bEndpointNumber\b/.test(tsType)) matterDatatypeImports.add('EndpointNumber');
    if (/\bClusterId\b/.test(tsType)) matterDatatypeImports.add('ClusterId');
    if (/\bGroupId\b/.test(tsType)) matterDatatypeImports.add('GroupId');
    if (/\bNodeId\b/.test(tsType)) matterDatatypeImports.add('NodeId');
    if (/\bSubjectId\b/.test(tsType)) matterDatatypeImports.add('SubjectId');
    if (/\bStatus\b/.test(tsType)) matterGlobalImports.add('Status');
    if (/\bBytes\b/.test(tsType)) usesMatterBytes = true;
    if (/\bSemtag\b/.test(tsType)) matterRootImports.add('Semtag');
    if (/\bModeSelect\b/.test(tsType)) matterClusterImports.add('ModeSelect');
  };

  clusterLines.push('export type MatterClusterTypes = {');

  for (const clusterKey of clusterKeys) {
    const clusterEntry = clustersByKey[clusterKey];
    const features = clusterEntry?.features && typeof clusterEntry.features === 'object' ? clusterEntry.features : {};
    const featureKeys = Object.keys(features);
    const commands = clusterEntry?.commands && typeof clusterEntry.commands === 'object' ? clusterEntry.commands : {};
    const commandKeys = Object.keys(commands);
    const events = clusterEntry?.events && typeof clusterEntry.events === 'object' ? clusterEntry.events : {};
    const eventKeys = Object.keys(events);
    const attributes = clusterEntry?.attributes && typeof clusterEntry.attributes === 'object' ? clusterEntry.attributes : {};
    const attributeKeys = Object.keys(attributes);
    const clusterTypeKey = formatTsStringLiteralKey(clusterKey);

    clusterLines.push(`  ${clusterTypeKey}: {`);

    if (featureKeys.length === 0) {
      clusterLines.push('    features: {};');
    } else {
      clusterLines.push('    features: {');
      const sortedFeatureKeys = featureKeys.sort((left, right) => left.localeCompare(right));

      for (const featureKey of sortedFeatureKeys) {
        const featureEntry = features[featureKey];
        const featureCode = typeof featureEntry?.code === 'string' && featureEntry.code.trim() ? featureEntry.code.trim() : featureKey;
        const featureName = typeof featureEntry?.name === 'string' && featureEntry.name.trim() ? featureEntry.name.trim() : featureKey;
        const featureSummary = typeof featureEntry?.summary === 'string' ? featureEntry.summary.replace(/\s+/g, ' ').trim() : '';
        const tsFeatureKey = formatTsPropertyKey(featureCode);
        const tsFeatureValue = formatTsStringLiteralKey(featureName);

        clusterLines.push(featureSummary ? `      ${tsFeatureKey}: ${tsFeatureValue}; // ${featureSummary}` : `      ${tsFeatureKey}: ${tsFeatureValue};`);
      }

      clusterLines.push('    };');
    }

    if (attributeKeys.length === 0) {
      clusterLines.push('    attributes: {};');
    } else {
      clusterLines.push('    attributes: {');

      const usedKeys = new Set();
      const sortedAttributeKeys = attributeKeys.sort((left, right) => left.localeCompare(right));

      for (const attributeKey of sortedAttributeKeys) {
        const attributeEntry = attributes[attributeKey];
        let propKey = toLowerCamelCase(attributeKey);

        if (usedKeys.has(propKey)) {
          const suffix = typeof attributeEntry?.id === 'number' ? attributeEntry.id : usedKeys.size + 1;
          propKey = `${propKey}_${suffix}`;
        }

        usedKeys.add(propKey);

        const tsPropertyKey = formatTsPropertyKey(propKey);
        const { tsType, baseTsType, rawType, reason, details } = entryToTsTypeDiagnostic(attributeEntry, clusterEntry, {
          entryKind: 'attribute',
          clusterKey,
          entryKey: attributeKey,
        });

        trackImportsForType(tsType);
        recordConverterTypeMapping(attributeEntry, tsType);

        recordUnknownTypeUsage({
          kind: 'attribute',
          cluster: clusterKey,
          clusterId: clusterEntry?.id,
          attribute: attributeKey,
          property: propKey,
          xmlType: rawType,
          tsType,
          baseTsType,
          reason,
          details,
        });

        clusterLines.push(`      ${tsPropertyKey}: ${tsType};`);
      }

      clusterLines.push('    };');
    }

    const requestCommands = commandKeys.map((commandKey) => commands[commandKey]).filter((commandEntry) => commandEntry && commandEntry.direction === 'commandToServer');

    if (requestCommands.length === 0) {
      clusterLines.push('    commands: {};');
    } else {
      clusterLines.push('    commands: {');

      const usedCommandKeys = new Set();
      const sortedCommands = requestCommands.sort((left, right) => (left.name || '').localeCompare(right.name || ''));

      for (const commandEntry of sortedCommands) {
        let commandPropertyKey = lowerFirstCharacter(commandEntry.name || '');

        if (usedCommandKeys.has(commandPropertyKey)) {
          const suffix = typeof commandEntry?.id === 'number' ? commandEntry.id : usedCommandKeys.size + 1;
          commandPropertyKey = `${commandPropertyKey}_${suffix}`;
        }

        usedCommandKeys.add(commandPropertyKey);

        const tsCommandKey = formatTsPropertyKey(commandPropertyKey);
        const commandArguments =
          commandEntry?.arguments && typeof commandEntry.arguments === 'object'
            ? Object.entries(commandEntry.arguments).filter(([argumentKey]) => !isDoNotUseEntryKey(argumentKey))
            : [];

        if (commandArguments.length === 0) {
          clusterLines.push(`      ${tsCommandKey}: undefined;`);
          continue;
        }

        clusterLines.push(`      ${tsCommandKey}: {`);

        const usedArgumentKeys = new Set();
        const sortedArguments = [...commandArguments].sort((left, right) => {
          const leftId = typeof left[1]?.id === 'number' ? left[1].id : Number.POSITIVE_INFINITY;
          const rightId = typeof right[1]?.id === 'number' ? right[1].id : Number.POSITIVE_INFINITY;
          if (leftId !== rightId) {
            return leftId - rightId;
          }
          return left[0].localeCompare(right[0]);
        });

        for (const [argumentKey, argumentEntry] of sortedArguments) {
          let argumentPropertyKey = toLowerCamelCase(argumentKey);

          if (usedArgumentKeys.has(argumentPropertyKey)) {
            const suffix = typeof argumentEntry?.id === 'number' ? argumentEntry.id : usedArgumentKeys.size + 1;
            argumentPropertyKey = `${argumentPropertyKey}_${suffix}`;
          }

          usedArgumentKeys.add(argumentPropertyKey);

          const tsArgumentKey = formatTsPropertyKey(argumentPropertyKey);
          const { tsType, baseTsType, rawType, reason, details } = entryToTsTypeDiagnostic(argumentEntry, clusterEntry, {
            entryKind: 'commandRequest',
            clusterKey,
            entryKey: argumentKey,
          });
          trackImportsForType(tsType);
          recordConverterTypeMapping(argumentEntry, tsType);
          recordUnknownTypeUsage({
            kind: 'commandRequest',
            cluster: clusterKey,
            clusterId: clusterEntry?.id,
            command: commandEntry?.name || commandPropertyKey,
            field: argumentKey,
            property: argumentPropertyKey,
            xmlType: rawType,
            tsType,
            baseTsType,
            reason,
            details,
          });
          clusterLines.push(`        ${tsArgumentKey}: ${tsType};`);
        }

        clusterLines.push('      };');
      }

      clusterLines.push('    };');
    }

    if (eventKeys.length === 0) {
      clusterLines.push('    events: {};');
    } else {
      clusterLines.push('    events: {');

      const sortedEventKeys = eventKeys.sort((left, right) => {
        const leftId = typeof events[left]?.id === 'number' ? events[left].id : Number.POSITIVE_INFINITY;
        const rightId = typeof events[right]?.id === 'number' ? events[right].id : Number.POSITIVE_INFINITY;
        if (leftId !== rightId) {
          return leftId - rightId;
        }
        return left.localeCompare(right);
      });

      for (const eventKey of sortedEventKeys) {
        const eventEntry = events[eventKey];
        const eventPropertyKey = formatTsPropertyKey(eventEntry?.name || eventKey);
        const eventFields = eventEntry?.fields && typeof eventEntry.fields === 'object' ? Object.entries(eventEntry.fields) : [];

        if (eventFields.length === 0) {
          clusterLines.push(`      ${eventPropertyKey}: undefined;`);
          continue;
        }

        clusterLines.push(`      ${eventPropertyKey}: {`);

        const usedFieldKeys = new Set();
        const sortedFields = [...eventFields].sort((left, right) => {
          const leftId = typeof left[1]?.id === 'number' ? left[1].id : Number.POSITIVE_INFINITY;
          const rightId = typeof right[1]?.id === 'number' ? right[1].id : Number.POSITIVE_INFINITY;
          if (leftId !== rightId) {
            return leftId - rightId;
          }
          return left[0].localeCompare(right[0]);
        });

        for (const [fieldKey, fieldEntry] of sortedFields) {
          let fieldPropertyKey = toLowerCamelCase(fieldKey);

          if (usedFieldKeys.has(fieldPropertyKey)) {
            const suffix = typeof fieldEntry?.id === 'number' ? fieldEntry.id : usedFieldKeys.size + 1;
            fieldPropertyKey = `${fieldPropertyKey}_${suffix}`;
          }

          usedFieldKeys.add(fieldPropertyKey);

          const tsFieldKey = formatTsPropertyKey(fieldPropertyKey);
          const { tsType, baseTsType, rawType, reason, details } = entryToTsTypeDiagnostic(fieldEntry, clusterEntry, {
            entryKind: 'eventPayload',
            clusterKey,
            entryKey: fieldKey,
          });
          trackImportsForType(tsType);
          recordConverterTypeMapping(fieldEntry, tsType);
          recordUnknownTypeUsage({
            kind: 'eventPayload',
            cluster: clusterKey,
            clusterId: clusterEntry?.id,
            event: eventEntry?.name || eventKey,
            field: fieldKey,
            property: fieldPropertyKey,
            xmlType: rawType,
            tsType,
            baseTsType,
            reason,
            details,
          });
          clusterLines.push(`        ${tsFieldKey}: ${tsType};`);
        }

        clusterLines.push('      };');
      }

      clusterLines.push('    };');
    }

    clusterLines.push('  };');
  }

  clusterLines.push('};');

  const lines = [];

  lines.push('/**');
  lines.push(' * Generated by scripts/data-model.mjs. Do not edit.');
  lines.push(' *');
  lines.push(' * @file matterDataModel.ts');
  lines.push(` * @remarks Matter data model version: ${versionLabel}`);
  lines.push(' */');
  lines.push('/* eslint-disable @typescript-eslint/no-empty-object-type */');

  // Keep import order compatible with simple-import-sort.
  if (usesMatterBytes) {
    lines.push("import type { Bytes } from '@matter/general';");
  }
  if (matterRootImports.size > 0) {
    const sorted = [...matterRootImports].sort((left, right) => left.localeCompare(right));
    lines.push(`import type { ${sorted.join(', ')} } from '@matter/types';`);
  }
  if (matterClusterImports.size > 0) {
    const sorted = [...matterClusterImports].sort((left, right) => left.localeCompare(right));
    lines.push(`import type { ${sorted.join(', ')} } from '@matter/types/clusters';`);
  }
  if (matterDatatypeImports.size > 0) {
    const sorted = [...matterDatatypeImports].sort((left, right) => left.localeCompare(right));
    lines.push(`import type { ${sorted.join(', ')} } from '@matter/types/datatype';`);
  }
  if (matterGlobalImports.size > 0) {
    const sorted = [...matterGlobalImports].sort((left, right) => left.localeCompare(right));
    lines.push(`import type { ${sorted.join(', ')} } from '@matter/types/globals';`);
  }

  lines.push('');
  lines.push('/** Epoch time in seconds since the Matter epoch (2000-01-01 00:00:00 UTC). */');
  lines.push('export type EpochS = number;');
  lines.push('');
  lines.push('/** Epoch time in microseconds since the Matter epoch (2000-01-01 00:00:00 UTC) - commonly represented as number or bigint. */');
  lines.push('export type EpochUs = number | bigint;');
  lines.push('');
  lines.push('/** Elapsed time in seconds. */');
  lines.push('export type ElapsedS = number;');
  lines.push('');
  lines.push('/** 64-bit signed/unsigned integer (commonly represented as number or bigint). */');
  lines.push('export type Int64 = number | bigint;');
  lines.push('');
  lines.push('/** Generic enum representation used for Matter enums. */');
  lines.push('export type MatterEnum = number;');
  lines.push('');
  lines.push('/** Generic bitmap representation used for Matter bitmaps. */');
  lines.push('export type MatterBitmap = number;');
  lines.push('');
  lines.push('/** Generic struct representation used when Matter struct fields are not expanded. */');
  lines.push('export type MatterStruct = Record<string, unknown>;');
  lines.push('');
  lines.push('/** Percentage value in whole percent units. */');
  lines.push('export type Percent = number;');
  lines.push('');
  lines.push('/** Percentage value in hundredths of a percent. */');
  lines.push('export type Percent100Ths = number;');
  lines.push('');
  lines.push('/** Temperature in hundredths of a degree Celsius (0.01°C), value = °C × 100. */');
  lines.push('export type Temperature100Ths = number;');
  lines.push('');
  lines.push('/** SignedTemperature (spec): temperature in tenths of a degree Celsius (0.1°C), value = °C × 10. */');
  lines.push('export type SignedTemperature10Ths = number;');
  lines.push('');
  lines.push('/** UnsignedTemperature (spec): temperature in tenths of a degree Celsius (0.1°C), value = °C × 10. */');
  lines.push('export type UnsignedTemperature10Ths = number;');
  lines.push('');
  lines.push('/** Zone identifier used by Zone Management cluster datatypes. */');
  lines.push('export type ZoneId = number;');
  lines.push('');
  lines.push('/** TLS endpoint identifier used by TLS Client Management cluster datatypes. */');
  lines.push('export type TLSEndpointId = number;');
  lines.push('');
  lines.push('/** TLS certificate authority identifier used by TLS certificate-management cluster datatypes. */');
  lines.push('export type TLSCAId = number;');
  lines.push('');
  lines.push('/** TLS client certificate descriptor identifier used by TLS certificate-management cluster datatypes. */');
  lines.push('export type TLSCCDId = number;');
  lines.push('');
  lines.push('/** WebRTC session identifier used by WebRTC transport cluster datatypes. */');
  lines.push('export type WebRTCSessionId = number;');
  lines.push('');
  lines.push('/** Push transport connection identifier used by AV stream transport cluster datatypes. */');
  lines.push('export type PushTransportConnectionId = number;');
  lines.push('');
  lines.push('/** Audio stream identifier used by camera AV stream-management cluster datatypes. */');
  lines.push('export type AudioStreamId = number;');
  lines.push('');
  lines.push('/** Video stream identifier used by camera and WebRTC stream-management cluster datatypes. */');
  lines.push('export type VideoStreamId = number;');
  lines.push('');
  lines.push('/** Snapshot stream identifier used by camera AV stream-management cluster datatypes. */');
  lines.push('export type SnapshotStreamId = number;');
  lines.push('');
  lines.push('/** Mode identifier used by mode-related clusters. */');
  lines.push('export type ModeId = number;');
  lines.push('');
  lines.push('/** SupportedModes entry used by mode-related clusters. */');
  lines.push('export type SupportedModes = {');
  lines.push('  label: string;');
  lines.push('  mode: ModeId;');
  lines.push('  semanticTags: Semtag[];');
  lines.push('};');
  lines.push('');

  lines.push('/** LabelStruct used by FixedLabel/UserLabel clusters. */');
  lines.push('export type LabelStruct = {');
  lines.push('  label: string;');
  lines.push('  value: string;');
  lines.push('};');
  lines.push('');

  lines.push(...clusterLines);
  lines.push('');
  lines.push('export type ClusterName = keyof MatterClusterTypes;');
  lines.push("export type ClusterFeatures<C extends ClusterName> = MatterClusterTypes[C]['features'];");
  lines.push('export type FeatureCode<C extends ClusterName> = keyof ClusterFeatures<C>;');
  lines.push('export type FeatureName<C extends ClusterName> = ClusterFeatures<C>[keyof ClusterFeatures<C>];');
  lines.push("export type ClusterCommands<C extends ClusterName> = MatterClusterTypes[C]['commands'];");
  lines.push('export type CommandName<C extends ClusterName> = keyof ClusterCommands<C>;');
  lines.push("export type ClusterAttributes<C extends ClusterName> = MatterClusterTypes[C]['attributes'];");
  lines.push('export type AttributeName<C extends ClusterName> = keyof ClusterAttributes<C>;');
  lines.push("export type ClusterEvents<C extends ClusterName> = MatterClusterTypes[C]['events'];");
  lines.push('export type EventName<C extends ClusterName> = keyof ClusterEvents<C>;');

  if (Array.isArray(converterTypeUsages)) {
    for (const mapping of [...converterTypeMappings.values()].sort((left, right) => {
      const rankDifference = getConverterTypeCaseSortRank(left.xmlType) - getConverterTypeCaseSortRank(right.xmlType);
      if (rankDifference !== 0) {
        return rankDifference;
      }

      return left.xmlType.localeCompare(right.xmlType);
    })) {
      converterTypeUsages.push({
        xmlType: mapping.xmlType,
        tsTypes: [...mapping.tsTypes].sort((left, right) => left.localeCompare(right)),
        occurrences: mapping.occurrences,
      });
    }
  }

  return `${lines.join('\n')}\n`;
};

const greenText = (value) => (process.env.NO_COLOR ? value : `\x1b[32m${value}\x1b[0m`);
const yellowText = (value) => (process.env.NO_COLOR ? value : `\x1b[33m${value}\x1b[0m`);

const cloneDeep = (value) => {
  if (value === undefined) {
    return undefined;
  }

  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
};

const mergeClusterSection = (baseSection, derivedSection) => {
  if (baseSection === undefined) {
    return cloneDeep(derivedSection);
  }

  if (derivedSection === undefined) {
    return cloneDeep(baseSection);
  }

  if (!baseSection || !derivedSection || typeof baseSection !== 'object' || typeof derivedSection !== 'object' || Array.isArray(baseSection) || Array.isArray(derivedSection)) {
    return cloneDeep(derivedSection);
  }

  const merged = cloneDeep(baseSection);

  for (const [key, value] of Object.entries(derivedSection)) {
    merged[key] = Object.prototype.hasOwnProperty.call(merged, key) ? mergeClusterSection(merged[key], value) : cloneDeep(value);
  }

  return merged;
};

const resolveClusterTemplateKey = (clustersByKey, clusterName) => {
  if (!clusterName || typeof clusterName !== 'string') {
    return undefined;
  }

  for (const candidate of [clusterName, `${clusterName} Cluster`]) {
    const key = sanitizeKey(candidate);
    if (clustersByKey[key]) {
      return key;
    }
  }

  return undefined;
};

import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { request } from 'node:https';
import { join } from 'node:path';

const fetchRemoteText = async (url, { description, headers = {}, maxRedirects = 5 } = {}) => {
  const label = description || url;

  const download = (target, redirectCount = 0) =>
    new Promise((resolve, reject) => {
      const req = request(target, { headers }, (res) => {
        const { statusCode = 0, headers: responseHeaders } = res;

        if (statusCode >= 300 && statusCode < 400 && responseHeaders.location) {
          if (redirectCount >= maxRedirects) {
            reject(new Error(`Too many redirects while fetching ${label}`));
            return;
          }

          const redirectUrl = new URL(responseHeaders.location, target).toString();
          resolve(download(redirectUrl, redirectCount + 1));
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`Failed to download ${label}: ${statusCode}`));
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      });

      req.on('error', (error) => {
        reject(new Error(`Request error while fetching ${label}: ${error.message}`));
      });

      req.end();
    });

  return download(url);
};

const fetchJson = async (url, { description, headers, maxRedirects } = {}) => {
  const text = await fetchRemoteText(url, { description, headers, maxRedirects });

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Unable to parse JSON from ${description || url}: ${error.message}`, { cause: error });
  }
};

const fetchJsonAndSave = async (url, outputPath, { description, headers, maxRedirects } = {}) => {
  const text = await fetchRemoteText(url, { description, headers, maxRedirects });
  await writeFile(outputPath, text);
  console.log(greenText(`Saved ${description || url} to ${outputPath}.`));

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Unable to parse JSON from ${description || url}: ${error.message}`, { cause: error });
  }
};

const decodeEntities = (value) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

const parseHexId = (rawValue, context) => {
  const value = rawValue.trim();
  const match = value.match(/^0x([0-9a-fA-F]+)$/);

  if (!match) {
    throw new Error(`Invalid hex id "${rawValue}" encountered while parsing ${context}.`);
  }

  const digits = match[1];

  return Number.parseInt(digits, 16);
};

const parseAttributes = (fragment) => {
  const attributes = {};
  const attrRegex = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*"([^"]*)"/g;

  let match;
  while ((match = attrRegex.exec(fragment)) !== null) {
    const [, key, rawValue] = match;
    attributes[key] = decodeEntities(rawValue.trim());
  }

  return attributes;
};

const parseNumericValue = (rawValue) => {
  if (rawValue === undefined) {
    return undefined;
  }

  const value = rawValue.trim();

  if (/^[-+]?0x[0-9a-f]+$/i.test(value)) {
    return Number.parseInt(value, 16);
  }

  if (/^[-+]?\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? value : parsed;
  }

  return value;
};

const parseScalarValue = (rawValue) => {
  if (rawValue === undefined) {
    return undefined;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return '';
  }

  const normalized = trimmed.toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  const numeric = parseNumericValue(trimmed);
  if (typeof numeric === 'number') {
    return numeric;
  }

  return trimmed;
};

const toCamelCase = (value) => value.replace(/[-_:](\w)/g, (match, letter) => letter.toUpperCase());

const prefixDirectiveKey = (prefix, key) => {
  const camelKey = toCamelCase(key);
  return `${prefix}${camelKey.charAt(0).toUpperCase()}${camelKey.slice(1)}`;
};

const CONFORMANCE_TAGS = [
  ['mandatoryConform', 'mandatory'],
  ['optionalConform', 'optional'],
  ['disallowConform', 'disallow'],
  ['provisionalConform', 'provisional'],
  ['deprecateConform', 'deprecate'],
  ['otherwiseConform', 'otherwise'],
];

const parseConformanceEntries = (fragment) => {
  if (!fragment) {
    return [];
  }

  const entries = [];

  for (const [tag, status] of CONFORMANCE_TAGS) {
    const regex = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
    let match;

    while ((match = regex.exec(fragment)) !== null) {
      const attributes = parseAttributes(match[0]);
      const entry = { status };

      if (Object.keys(attributes).length > 0) {
        entry.attributes = attributes;
      }

      entries.push(entry);
    }
  }

  return entries;
};

const extractConditions = (fragment) => {
  if (!fragment) {
    return [];
  }

  const conditions = [];
  const regex = /<condition\b[^>]*>/gi;
  let match;

  while ((match = regex.exec(fragment)) !== null) {
    const attributes = parseAttributes(match[0]);
    const { name, summary = '', ...rest } = attributes;

    if (!name) {
      continue;
    }

    const condition = { name };

    if (summary) {
      condition.summary = summary;
    }

    if (Object.keys(rest).length > 0) {
      condition.attributes = rest;
    }

    conditions.push(condition);
  }

  return conditions;
};

const extractFeatureRefs = (fragment) => {
  if (!fragment) {
    return [];
  }

  const names = new Set();
  const regex = /<feature\b[^>]*>/gi;
  let match;

  while ((match = regex.exec(fragment)) !== null) {
    const attributes = parseAttributes(match[0]);
    const { name } = attributes;

    if (name) {
      names.add(name);
    }
  }

  return [...names];
};

const extractDirectiveList = (fragment, tagName) => {
  if (!fragment) {
    return [];
  }

  const regex = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  const directives = [];
  let match;

  while ((match = regex.exec(fragment)) !== null) {
    const attributes = parseAttributes(match[0]);

    if (Object.keys(attributes).length > 0) {
      directives.push(attributes);
    } else {
      directives.push({});
    }
  }

  return directives;
};

const extractTopLevelTagFragments = (source, tagName) => {
  if (!source) {
    return [];
  }

  const fragments = [];
  const regex = new RegExp(`<\\/${tagName}\\s*>|<${tagName}\\b[^>]*?(?:\\/\\s*>|>)`, 'gi');
  let depth = 0;
  let start = -1;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const fragment = match[0];
    const isClosing = fragment.startsWith(`</${tagName}`);

    if (isClosing) {
      if (depth === 0) {
        continue;
      }

      depth -= 1;

      if (depth === 0 && start !== -1) {
        fragments.push(source.slice(start, regex.lastIndex));
        start = -1;
      }

      continue;
    }

    const isSelfClosing = /\/\s*>$/.test(fragment);

    if (depth === 0) {
      start = match.index;
    }

    if (isSelfClosing) {
      if (depth === 0 && start !== -1) {
        fragments.push(source.slice(start, regex.lastIndex));
        start = -1;
      }

      continue;
    }

    depth += 1;
  }

  return fragments;
};

const extractAccessDirectives = (fragment) => extractDirectiveList(fragment, 'access');
const extractQualityDirectives = (fragment) => extractDirectiveList(fragment, 'quality');

const extractEntryDirectives = (fragment) => {
  if (!fragment) {
    return [];
  }

  const regex = /<entry\b[^>]*>/gi;
  const entries = [];
  let match;

  while ((match = regex.exec(fragment)) !== null) {
    const attributes = parseAttributes(match[0]);

    if (Object.keys(attributes).length > 0) {
      entries.push(attributes);
    } else {
      entries.push({});
    }
  }

  return entries;
};

const extractConstraintSnippets = (fragment) => {
  if (!fragment) {
    return [];
  }

  const regex = /<constraint\b[^>]*>([\s\S]*?)<\/constraint>/gi;
  const constraints = [];
  let match;

  while ((match = regex.exec(fragment)) !== null) {
    const [, body] = match;
    const normalized = body.replace(/\s+/g, ' ').trim();

    if (normalized) {
      constraints.push(normalized);
    }
  }

  return constraints;
};

const removeSegments = (source, segments) => {
  if (!segments || segments.length === 0) {
    return source;
  }

  const sorted = [...segments].sort((left, right) => left.start - right.start);
  let result = '';
  let cursor = 0;

  for (const { start, end } of sorted) {
    if (cursor < start) {
      result += source.slice(cursor, start);
    }

    cursor = Math.max(cursor, end);
  }

  if (cursor < source.length) {
    result += source.slice(cursor);
  }

  return result;
};

const parseEnumItems = (enumBody, enumName, clusterName, contextLabel) => {
  const items = [];
  const itemRegex = /<item\b[^>]*?(?:\/\s*>|>[\s\S]*?<\/item>)/gi;
  let match;

  while ((match = itemRegex.exec(enumBody)) !== null) {
    const fragment = match[0];
    const openingMatch = fragment.match(/<item\b[^>]*>/i);

    if (!openingMatch) {
      throw new Error(`Unable to parse enum item in ${enumName} for cluster ${clusterName} (${contextLabel}).`);
    }

    const attributes = parseAttributes(openingMatch[0]);
    const { name, summary = '', value, ...rest } = attributes;

    if (!name) {
      throw new Error(`Enum item without a name encountered in ${enumName} for cluster ${clusterName} (${contextLabel}).`);
    }

    const entry = { name };

    if (value !== undefined) {
      const parsedValue = parseNumericValue(value);
      entry.value = parsedValue !== undefined ? parsedValue : value;
    }

    if (summary) {
      entry.summary = summary;
    }

    if (Object.keys(rest).length > 0) {
      entry.attributes = rest;
    }

    let body = '';

    if (!fragment.trimEnd().endsWith('/>')) {
      body = fragment.slice(openingMatch[0].length, fragment.length - '</item>'.length);
    }

    const conformances = parseConformanceEntries(body);
    if (conformances.length > 0) {
      entry.conformance = conformances;
    }

    const conditions = extractConditions(body);
    if (conditions.length > 0) {
      entry.conditions = conditions;
    }

    const features = extractFeatureRefs(body);
    if (features.length > 0) {
      entry.features = features;
    }

    const access = extractAccessDirectives(body);
    if (access.length > 0) {
      entry.access = access;
    }

    const quality = extractQualityDirectives(body);
    if (quality.length > 0) {
      entry.quality = quality;
    }

    const constraints = extractConstraintSnippets(body);
    if (constraints.length > 0) {
      entry.constraints = constraints;
    }

    items.push(entry);
  }

  return items;
};

const parseBitmapFields = (bitmapBody, bitmapName, clusterName, contextLabel) => {
  const fields = [];
  const fieldRegex = /<bitfield\b[^>]*?(?:\/\s*>|>[\s\S]*?<\/bitfield>)/gi;
  let match;

  while ((match = fieldRegex.exec(bitmapBody)) !== null) {
    const fragment = match[0];
    const openingMatch = fragment.match(/<bitfield\b[^>]*>/i);

    if (!openingMatch) {
      throw new Error(`Unable to parse bitfield in ${bitmapName} for cluster ${clusterName} (${contextLabel}).`);
    }

    const attributes = parseAttributes(openingMatch[0]);
    const { name, summary = '', bit, ...rest } = attributes;

    if (!name) {
      throw new Error(`Bitfield without a name encountered in ${bitmapName} for cluster ${clusterName} (${contextLabel}).`);
    }

    const entry = { name };

    if (bit !== undefined) {
      const parsedBit = parseNumericValue(bit);
      entry.bit = parsedBit !== undefined ? parsedBit : bit;
    }

    if (summary) {
      entry.summary = summary;
    }

    if (Object.keys(rest).length > 0) {
      entry.attributes = rest;
    }

    let body = '';

    if (!fragment.trimEnd().endsWith('/>')) {
      body = fragment.slice(openingMatch[0].length, fragment.length - '</bitfield>'.length);
    }

    const conformances = parseConformanceEntries(body);
    if (conformances.length > 0) {
      entry.conformance = conformances;
    }

    const conditions = extractConditions(body);
    if (conditions.length > 0) {
      entry.conditions = conditions;
    }

    const features = extractFeatureRefs(body);
    if (features.length > 0) {
      entry.features = features;
    }

    const access = extractAccessDirectives(body);
    if (access.length > 0) {
      entry.access = access;
    }

    const quality = extractQualityDirectives(body);
    if (quality.length > 0) {
      entry.quality = quality;
    }

    const constraints = extractConstraintSnippets(body);
    if (constraints.length > 0) {
      entry.constraints = constraints;
    }

    fields.push(entry);
  }

  return fields;
};

const parseStructFields = (structBody, structName, clusterName, contextLabel) => {
  const fields = [];
  const segments = [];
  const fieldRegex = /<field\b[^>]*?(?:\/\s*>|>[\s\S]*?<\/field>)/gi;
  let match;

  while ((match = fieldRegex.exec(structBody)) !== null) {
    const fragment = match[0];
    const start = match.index;
    const end = fieldRegex.lastIndex;
    segments.push({ start, end });

    const openingMatch = fragment.match(/<field\b[^>]*>/i);

    if (!openingMatch) {
      throw new Error(`Unable to parse struct field in ${structName} for cluster ${clusterName} (${contextLabel}).`);
    }

    const attributes = parseAttributes(openingMatch[0]);
    const { name, summary = '', id, type, ...rest } = attributes;

    if (!name) {
      throw new Error(`Struct field without a name encountered in ${structName} for cluster ${clusterName} (${contextLabel}).`);
    }

    const fieldEntry = { name };

    if (type !== undefined) {
      fieldEntry.type = type;
    }

    if (id !== undefined) {
      const parsedId = parseNumericValue(id);
      fieldEntry.id = parsedId !== undefined ? parsedId : id;
    }

    if (summary) {
      fieldEntry.summary = summary;
    }

    if (Object.keys(rest).length > 0) {
      fieldEntry.attributes = rest;
    }

    let body = '';

    if (!fragment.trimEnd().endsWith('/>')) {
      body = fragment.slice(openingMatch[0].length, fragment.length - '</field>'.length);
    }

    const conformances = parseConformanceEntries(body);
    if (conformances.length > 0) {
      fieldEntry.conformance = conformances;
    }

    const conditions = extractConditions(body);
    if (conditions.length > 0) {
      fieldEntry.conditions = conditions;
    }

    const features = extractFeatureRefs(body);
    if (features.length > 0) {
      fieldEntry.features = features;
    }

    const access = extractAccessDirectives(body);
    if (access.length > 0) {
      fieldEntry.access = access;
    }

    const quality = extractQualityDirectives(body);
    if (quality.length > 0) {
      fieldEntry.quality = quality;
    }

    const entries = extractEntryDirectives(body);
    if (entries.length > 0) {
      fieldEntry.entries = entries;
    }

    const constraints = extractConstraintSnippets(body);
    if (constraints.length > 0) {
      fieldEntry.constraints = constraints;
    }

    fields.push(fieldEntry);
  }

  const remainder = removeSegments(structBody, segments);

  return { fields, remainder };
};

const parseDataTypesBlock = (xmlContent, clusterName, contextLabel) => {
  const match = xmlContent.match(/<dataTypes\b[^>]*>([\s\S]*?)<\/dataTypes>/i);

  if (!match) {
    return {};
  }

  const [, body] = match;
  const dataTypes = {};
  const regex = /<(enum|bitmap|struct)\b[^>]*?(?:\/\s*>|>[\s\S]*?<\/\1>)/gi;
  let typeMatch;

  while ((typeMatch = regex.exec(body)) !== null) {
    const fullMatch = typeMatch[0];
    const rawType = typeMatch[1];
    const openingMatch = fullMatch.match(new RegExp(`<${rawType}\\b[^>]*>`, 'i'));

    if (!openingMatch) {
      throw new Error(`Unable to parse ${rawType} definition for cluster ${clusterName} (${contextLabel}).`);
    }

    const typeAttributes = parseAttributes(openingMatch[0]);
    const { name, summary = '', ...rest } = typeAttributes;

    if (!name) {
      throw new Error(`Data type (${rawType}) without a name encountered in cluster ${clusterName} (${contextLabel}).`);
    }

    const typeBody = fullMatch.trimEnd().endsWith('/>') ? '' : fullMatch.slice(openingMatch[0].length, fullMatch.length - `</${rawType}>`.length);

    const definition = {
      type: rawType.toLowerCase(),
      name,
    };

    if (summary) {
      definition.summary = summary;
    }

    if (Object.keys(rest).length > 0) {
      definition.attributes = rest;
    }

    if (definition.type === 'enum') {
      const entries = parseEnumItems(typeBody, name, clusterName, contextLabel);
      if (entries.length > 0) {
        definition.entries = entries;
      }
    } else if (definition.type === 'bitmap') {
      const fields = parseBitmapFields(typeBody, name, clusterName, contextLabel);
      if (fields.length > 0) {
        definition.fields = fields;
      }
    } else if (definition.type === 'struct') {
      const { fields, remainder } = parseStructFields(typeBody, name, clusterName, contextLabel);

      if (fields.length > 0) {
        definition.fields = fields;
      }

      const structConformance = parseConformanceEntries(remainder);
      if (structConformance.length > 0) {
        definition.conformance = structConformance;
      }

      const structConditions = extractConditions(remainder);
      if (structConditions.length > 0) {
        definition.conditions = structConditions;
      }

      const structFeatures = extractFeatureRefs(remainder);
      if (structFeatures.length > 0) {
        definition.features = structFeatures;
      }

      const structAccess = extractAccessDirectives(remainder);
      if (structAccess.length > 0) {
        definition.access = structAccess;
      }

      const structQuality = extractQualityDirectives(remainder);
      if (structQuality.length > 0) {
        definition.quality = structQuality;
      }

      const structEntries = extractEntryDirectives(remainder);
      if (structEntries.length > 0) {
        definition.entries = structEntries;
      }

      const structConstraints = extractConstraintSnippets(remainder);
      if (structConstraints.length > 0) {
        definition.constraints = structConstraints;
      }
    }

    dataTypes[name] = definition;
  }

  return dataTypes;
};

const parseAttributesBlock = (xmlContent, clusterName, contextLabel) => {
  const match = xmlContent.match(/<attributes\b[^>]*>([\s\S]*?)<\/attributes>/i);

  if (!match) {
    return {};
  }

  const [, body] = match;
  const attributes = {};
  const attributeFragments = extractTopLevelTagFragments(body, 'attribute');

  for (const fullMatch of attributeFragments) {
    const openingMatch = fullMatch.match(/<attribute\b[^>]*>/i);

    if (!openingMatch) {
      throw new Error(`Unable to parse attribute definition for cluster ${clusterName} (${contextLabel}).`);
    }

    const attributeAttributes = parseAttributes(openingMatch[0]);
    const { id, name, type, summary = '', ...rest } = attributeAttributes;

    if (!name) {
      throw new Error(`Attribute without a name encountered in cluster ${clusterName} (${contextLabel}).`);
    }

    const entry = { name };

    if (id !== undefined) {
      entry.id = parseHexId(id, `attribute ${name} in cluster ${clusterName}`);
    }

    if (type !== undefined) {
      entry.type = type;
    }

    if (summary) {
      entry.summary = summary;
    }

    for (const [key, value] of Object.entries(rest)) {
      const normalizedKey = toCamelCase(key);
      entry[normalizedKey] = parseScalarValue(value);
    }

    let attributeBody = '';

    if (!fullMatch.trimEnd().endsWith('/>')) {
      attributeBody = fullMatch.slice(openingMatch[0].length, fullMatch.length - '</attribute>'.length);
    }

    const directiveSegments = [];

    const accessRegex = /<access\b[^>]*?(?:\/\s*>|>[\s\S]*?<\/access>)/gi;
    let accessMatch;
    while ((accessMatch = accessRegex.exec(attributeBody)) !== null) {
      directiveSegments.push({ start: accessMatch.index, end: accessRegex.lastIndex });
      const accessAttributes = parseAttributes(accessMatch[0]);

      for (const [key, value] of Object.entries(accessAttributes)) {
        const propertyKey = prefixDirectiveKey('access', key);
        entry[propertyKey] = parseScalarValue(value);
      }
    }

    const qualityRegex = /<quality\b[^>]*?(?:\/\s*>|>[\s\S]*?<\/quality>)/gi;
    let qualityMatch;
    while ((qualityMatch = qualityRegex.exec(attributeBody)) !== null) {
      directiveSegments.push({ start: qualityMatch.index, end: qualityRegex.lastIndex });
      const qualityAttributes = parseAttributes(qualityMatch[0]);

      for (const [key, value] of Object.entries(qualityAttributes)) {
        const propertyKey = prefixDirectiveKey('quality', key);
        entry[propertyKey] = parseScalarValue(value);
      }
    }

    const remainder = removeSegments(attributeBody, directiveSegments);

    const conformances = parseConformanceEntries(remainder);
    if (conformances.length > 0) {
      entry.conformance = conformances;
    }

    const conditions = extractConditions(remainder);
    if (conditions.length > 0) {
      entry.conditions = conditions;
    }

    const features = extractFeatureRefs(remainder);
    if (features.length > 0) {
      entry.features = features;
    }

    const entries = extractEntryDirectives(remainder);
    if (entries.length > 0) {
      entry.entries = entries;
    }

    const constraints = extractConstraintSnippets(remainder);
    if (constraints.length > 0) {
      entry.constraints = constraints;
    }

    attributes[name] = entry;
  }

  return attributes;
};

const parseCommandArguments = (commandBody, commandName, clusterName, contextLabel, directiveSegments) => {
  const argumentsMap = {};

  const processTag = (tagName) => {
    const regex = new RegExp(`<${tagName}\\b[^>]*?(?:\\/\\s*>|>[\\s\\S]*?<\\/${tagName}>)`, 'gi');
    regex.lastIndex = 0;
    let match;

    while ((match = regex.exec(commandBody)) !== null) {
      directiveSegments.push({ start: match.index, end: regex.lastIndex });
      const fragment = match[0];
      const openingMatch = fragment.match(new RegExp(`<${tagName}\\b[^>]*>`, 'i'));

      if (!openingMatch) {
        throw new Error(`Unable to parse ${tagName} definition for command ${commandName} in cluster ${clusterName} (${contextLabel}).`);
      }

      const parameterAttributes = parseAttributes(openingMatch[0]);
      const { name, id, fieldId, type, summary = '', ...rest } = parameterAttributes;

      if (!name) {
        throw new Error(`Parameter without a name encountered in command ${commandName} for cluster ${clusterName} (${contextLabel}).`);
      }

      const parameterEntry = { name };

      if (id !== undefined) {
        parameterEntry.id = parseNumericValue(id);
      }

      if (fieldId !== undefined) {
        parameterEntry.fieldId = parseNumericValue(fieldId);
      }

      if (type !== undefined) {
        parameterEntry.type = type;
      }

      if (summary) {
        parameterEntry.summary = summary;
      }

      for (const [key, value] of Object.entries(rest)) {
        const normalizedKey = toCamelCase(key);
        parameterEntry[normalizedKey] = parseScalarValue(value);
      }

      let parameterBody = '';

      if (!fragment.trimEnd().endsWith('/>')) {
        parameterBody = fragment.slice(openingMatch[0].length, fragment.length - `</${tagName}>`.length);
      }

      const qualityRegex = /<quality\b[^>]*?(?:\/\s*>|>[\s\S]*?<\/quality>)/gi;
      let qualityMatch;
      while ((qualityMatch = qualityRegex.exec(parameterBody)) !== null) {
        const qualityAttributes = parseAttributes(qualityMatch[0]);

        for (const [key, value] of Object.entries(qualityAttributes)) {
          const propertyKey = prefixDirectiveKey('quality', key);
          parameterEntry[propertyKey] = parseScalarValue(value);
        }
      }

      const parameterConformance = parseConformanceEntries(parameterBody);
      if (parameterConformance.length > 0) {
        parameterEntry.conformance = parameterConformance;
      }

      const parameterConditions = extractConditions(parameterBody);
      if (parameterConditions.length > 0) {
        parameterEntry.conditions = parameterConditions;
      }

      const parameterFeatures = extractFeatureRefs(parameterBody);
      if (parameterFeatures.length > 0) {
        parameterEntry.features = parameterFeatures;
      }

      const parameterEntries = extractEntryDirectives(parameterBody);
      if (parameterEntries.length > 0) {
        parameterEntry.entries = parameterEntries;
      }

      const parameterConstraints = extractConstraintSnippets(parameterBody);
      if (parameterConstraints.length > 0) {
        parameterEntry.constraints = parameterConstraints;
      }

      if (argumentsMap[name]) {
        console.log(`Warning: Duplicate parameter name "${name}" encountered in command ${commandName} for cluster ${clusterName} (${contextLabel}). Overwriting previous entry.`);
      }

      argumentsMap[name] = parameterEntry;
    }
  };

  processTag('arg');
  processTag('field');

  return argumentsMap;
};

const parseCommandsBlock = (xmlContent, clusterName, contextLabel) => {
  const commandRegex = /<command\b[^>]*?(?:\/\s*>|>[\s\S]*?<\/command>)/gi;
  if (!commandRegex.test(xmlContent)) {
    return {};
  }

  commandRegex.lastIndex = 0;
  const commands = {};
  let commandMatch;

  while ((commandMatch = commandRegex.exec(xmlContent)) !== null) {
    const fragment = commandMatch[0];
    const openingMatch = fragment.match(/<command\b[^>]*>/i);

    if (!openingMatch) {
      throw new Error(`Unable to parse command definition for cluster ${clusterName} (${contextLabel}).`);
    }

    const commandAttributes = parseAttributes(openingMatch[0]);
    const { name, code, summary = '', ...rest } = commandAttributes;

    if (!name) {
      throw new Error(`Command without a name encountered in cluster ${clusterName} (${contextLabel}).`);
    }

    const commandEntry = { name };

    if (code !== undefined) {
      commandEntry.id = parseNumericValue(code);
    }

    if (summary) {
      commandEntry.summary = summary;
    }

    for (const [key, value] of Object.entries(rest)) {
      const normalizedKey = toCamelCase(key);
      commandEntry[normalizedKey] = parseScalarValue(value);
    }

    let commandBody = '';

    if (!fragment.trimEnd().endsWith('/>')) {
      commandBody = fragment.slice(openingMatch[0].length, fragment.length - '</command>'.length);
    }

    const directiveSegments = [];

    const descriptionMatch = commandBody.match(/<description>([\s\S]*?)<\/description>/i);
    if (descriptionMatch) {
      const [matchText, body] = descriptionMatch;
      const start = descriptionMatch.index ?? commandBody.indexOf(matchText);
      const end = start + matchText.length;
      directiveSegments.push({ start, end });
      const description = body.replace(/\s+/g, ' ').trim();
      if (description) {
        commandEntry.description = description;
      }
    }

    const argumentsMap = parseCommandArguments(commandBody, name, clusterName, contextLabel, directiveSegments);
    if (Object.keys(argumentsMap).length > 0) {
      commandEntry.arguments = argumentsMap;
    }

    const accessRegex = /<access\b[^>]*?(?:\/\s*>|>[\s\S]*?<\/access>)/gi;
    let accessMatch;
    while ((accessMatch = accessRegex.exec(commandBody)) !== null) {
      directiveSegments.push({ start: accessMatch.index, end: accessRegex.lastIndex });
      const accessAttributes = parseAttributes(accessMatch[0]);

      for (const [key, value] of Object.entries(accessAttributes)) {
        const propertyKey = prefixDirectiveKey('access', key);
        commandEntry[propertyKey] = parseScalarValue(value);
      }
    }

    const qualityRegex = /<quality\b[^>]*?(?:\/\s*>|>[\s\S]*?<\/quality>)/gi;
    let qualityMatch;
    while ((qualityMatch = qualityRegex.exec(commandBody)) !== null) {
      directiveSegments.push({ start: qualityMatch.index, end: qualityRegex.lastIndex });
      const qualityAttributes = parseAttributes(qualityMatch[0]);

      for (const [key, value] of Object.entries(qualityAttributes)) {
        const propertyKey = prefixDirectiveKey('quality', key);
        commandEntry[propertyKey] = parseScalarValue(value);
      }
    }

    const remainder = removeSegments(commandBody, directiveSegments);

    const conformances = parseConformanceEntries(remainder);
    if (conformances.length > 0) {
      commandEntry.conformance = conformances;
    }

    const conditions = extractConditions(remainder);
    if (conditions.length > 0) {
      commandEntry.conditions = conditions;
    }

    const features = extractFeatureRefs(remainder);
    if (features.length > 0) {
      commandEntry.features = features;
    }

    const constraints = extractConstraintSnippets(remainder);
    if (constraints.length > 0) {
      commandEntry.constraints = constraints;
    }

    if (commands[name]) {
      console.log(`Warning: Duplicate command name "${name}" encountered in cluster ${clusterName} (${contextLabel}). Overwriting previous entry.`);
    }

    commands[name] = commandEntry;
  }

  return commands;
};

const parseEventsBlock = (xmlContent, clusterName, contextLabel) => {
  const eventRegex = /<event\b[^>]*?(?:\/\s*>|>[\s\S]*?<\/event>)/gi;
  if (!eventRegex.test(xmlContent)) {
    return {};
  }

  eventRegex.lastIndex = 0;
  const events = {};
  let eventMatch;

  while ((eventMatch = eventRegex.exec(xmlContent)) !== null) {
    const fragment = eventMatch[0];
    const openingMatch = fragment.match(/<event\b[^>]*>/i);

    if (!openingMatch) {
      throw new Error(`Unable to parse event definition for cluster ${clusterName} (${contextLabel}).`);
    }

    const eventAttributes = parseAttributes(openingMatch[0]);
    const { name, code, summary = '', ...rest } = eventAttributes;

    if (!name) {
      throw new Error(`Event without a name encountered in cluster ${clusterName} (${contextLabel}).`);
    }

    const eventEntry = { name };

    if (code !== undefined) {
      eventEntry.id = parseNumericValue(code);
    }

    if (summary) {
      eventEntry.summary = summary;
    }

    for (const [key, value] of Object.entries(rest)) {
      const normalizedKey = toCamelCase(key);
      eventEntry[normalizedKey] = parseScalarValue(value);
    }

    let eventBody = '';

    if (!fragment.trimEnd().endsWith('/>')) {
      eventBody = fragment.slice(openingMatch[0].length, fragment.length - '</event>'.length);
    }

    const directiveSegments = [];

    const descriptionMatch = eventBody.match(/<description>([\s\S]*?)<\/description>/i);
    if (descriptionMatch) {
      const [matchText, body] = descriptionMatch;
      const start = descriptionMatch.index ?? eventBody.indexOf(matchText);
      const end = start + matchText.length;
      directiveSegments.push({ start, end });
      const description = body.replace(/\s+/g, ' ').trim();
      if (description) {
        eventEntry.description = description;
      }
    }

    const fieldRegex = /<field\b[^>]*?(?:\/\s*>|>[\s\S]*?<\/field>)/gi;
    const fields = {};
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(eventBody)) !== null) {
      directiveSegments.push({ start: fieldMatch.index, end: fieldRegex.lastIndex });
      const fieldFragment = fieldMatch[0];
      const fieldOpeningMatch = fieldFragment.match(/<field\b[^>]*>/i);

      if (!fieldOpeningMatch) {
        throw new Error(`Unable to parse field definition for event ${name} in cluster ${clusterName} (${contextLabel}).`);
      }

      const fieldAttributes = parseAttributes(fieldOpeningMatch[0]);
      const { name: fieldName, id, type, summary: fieldSummary = '', ...fieldRest } = fieldAttributes;

      if (!fieldName) {
        throw new Error(`Field without a name encountered in event ${name} for cluster ${clusterName} (${contextLabel}).`);
      }

      const fieldEntry = { name: fieldName };

      if (id !== undefined) {
        fieldEntry.id = parseNumericValue(id);
      }

      if (type !== undefined) {
        fieldEntry.type = type;
      }

      if (fieldSummary) {
        fieldEntry.summary = fieldSummary;
      }

      for (const [key, value] of Object.entries(fieldRest)) {
        const normalizedKey = toCamelCase(key);
        fieldEntry[normalizedKey] = parseScalarValue(value);
      }

      let fieldBody = '';

      if (!fieldFragment.trimEnd().endsWith('/>')) {
        fieldBody = fieldFragment.slice(fieldOpeningMatch[0].length, fieldFragment.length - '</field>'.length);
      }

      const fieldConformance = parseConformanceEntries(fieldBody);
      if (fieldConformance.length > 0) {
        fieldEntry.conformance = fieldConformance;
      }

      const fieldConditions = extractConditions(fieldBody);
      if (fieldConditions.length > 0) {
        fieldEntry.conditions = fieldConditions;
      }

      const fieldFeatures = extractFeatureRefs(fieldBody);
      if (fieldFeatures.length > 0) {
        fieldEntry.features = fieldFeatures;
      }

      const qualityRegex = /<quality\b[^>]*?(?:\/\s*>|>[\s\S]*?<\/quality>)/gi;
      let qualityMatch;
      while ((qualityMatch = qualityRegex.exec(fieldBody)) !== null) {
        const qualityAttributes = parseAttributes(qualityMatch[0]);

        for (const [key, value] of Object.entries(qualityAttributes)) {
          const propertyKey = prefixDirectiveKey('quality', key);
          fieldEntry[propertyKey] = parseScalarValue(value);
        }
      }

      const fieldEntries = extractEntryDirectives(fieldBody);
      if (fieldEntries.length > 0) {
        fieldEntry.entries = fieldEntries;
      }

      const fieldConstraints = extractConstraintSnippets(fieldBody);
      if (fieldConstraints.length > 0) {
        fieldEntry.constraints = fieldConstraints;
      }

      fields[fieldName] = fieldEntry;
    }

    if (Object.keys(fields).length > 0) {
      eventEntry.fields = fields;
    }

    const remainder = removeSegments(eventBody, directiveSegments);

    const conformances = parseConformanceEntries(remainder);
    if (conformances.length > 0) {
      eventEntry.conformance = conformances;
    }

    const conditions = extractConditions(remainder);
    if (conditions.length > 0) {
      eventEntry.conditions = conditions;
    }

    const features = extractFeatureRefs(remainder);
    if (features.length > 0) {
      eventEntry.features = features;
    }

    const constraints = extractConstraintSnippets(remainder);
    if (constraints.length > 0) {
      eventEntry.constraints = constraints;
    }

    if (events[name]) {
      console.log(`Warning: Duplicate event name "${name}" encountered in cluster ${clusterName} (${contextLabel}). Overwriting previous entry.`);
    }

    events[name] = eventEntry;
  }

  return events;
};

const parseNamespaceXml = (xmlContent) => {
  const namespaceTagMatch = xmlContent.match(/<namespace[\s\S]*?>/i);
  if (!namespaceTagMatch) {
    throw new Error('Unable to locate namespace definition.');
  }

  const namespaceAttributes = parseAttributes(namespaceTagMatch[0]);
  const { id, name } = namespaceAttributes;

  if (!id || !name) {
    throw new Error('Namespace attributes "id" or "name" are missing.');
  }

  const tagMatches = [...xmlContent.matchAll(/<tag\b[^>]*>/gi)];
  const tags = tagMatches.map((match) => {
    const tagAttributes = parseAttributes(match[0]);
    const { id: tagId, name: tagName } = tagAttributes;

    if (!tagId || !tagName) {
      throw new Error('Tag attributes "id" or "name" are missing.');
    }

    return { id: tagId, name: tagName };
  });

  const hexId = parseHexId(id, `namespace ${name || 'unknown'}`);
  const hexTags = tags.map(({ id: tagId, name: tagName }) => ({
    id: parseHexId(tagId, `tag ${tagName || 'unknown'} in namespace ${name || 'unknown'}`),
    name: tagName,
  }));

  return { id: hexId, name, tags: hexTags };
};

const parseDeviceTypeXml = (xmlContent, contextLabel) => {
  const deviceTypeMatch = xmlContent.match(/<deviceType\b[^>]*>/i);
  if (!deviceTypeMatch) {
    throw new Error(`Unable to locate device type definition in ${contextLabel}.`);
  }

  const deviceTypeAttributes = parseAttributes(deviceTypeMatch[0]);
  const { id, name, revision } = deviceTypeAttributes;

  if (!name) {
    throw new Error(`Device type name is missing in ${contextLabel}.`);
  }

  const isBaseDeviceType = contextLabel.toLowerCase() === 'basedevicetype.xml' || name.trim().toLowerCase() === 'base device type';

  if (!id && !isBaseDeviceType) {
    console.log(`Skipping ${contextLabel} (device type "${name}") because it does not declare an id.`);
    return null;
  }

  const parsedId = id ? parseHexId(id, `device type ${name}`) : 0;
  if (!id && isBaseDeviceType) {
    console.log(`Device type ${name} in ${contextLabel} does not declare an id; defaulting to 0.`);
  }

  if (!revision) {
    throw new Error(`Device type revision is missing for ${name}.`);
  }

  const revisionValue = Number.parseInt(revision, 10);
  if (Number.isNaN(revisionValue)) {
    throw new Error(`Invalid revision "${revision}" for device type ${name}.`);
  }

  const revisionMatches = [...xmlContent.matchAll(/<revision\b[^>]*>/gi)];
  const revisionHistory = revisionMatches.map((match) => {
    const revisionAttributes = parseAttributes(match[0]);
    const { revision: revisionAttr, summary = '' } = revisionAttributes;

    if (!revisionAttr) {
      throw new Error(`Revision entry missing revision attribute for device type ${name}.`);
    }

    const revisionNumber = Number.parseInt(revisionAttr, 10);
    if (Number.isNaN(revisionNumber)) {
      throw new Error(`Invalid revision value "${revisionAttr}" in revision history for device type ${name}.`);
    }

    return {
      revision: revisionNumber,
      summary,
    };
  });

  const classificationMatch = xmlContent.match(/<classification\b[^>]*>/i);
  let classificationClass;
  let scope;

  if (!classificationMatch) {
    if (!isBaseDeviceType) {
      throw new Error(`Missing classification block for device type ${name}.`);
    }

    classificationClass = 'utility';
    scope = 'endpoint';
    console.log(`Device type ${name} in ${contextLabel} does not declare classification; using defaults.`);
  } else {
    const classificationAttributes = parseAttributes(classificationMatch[0]);
    classificationClass = classificationAttributes.class;
    scope = classificationAttributes.scope;

    if (!classificationClass || !scope) {
      throw new Error(`Classification attributes are incomplete for device type ${name}.`);
    }
  }

  const conditionsMatch = xmlContent.match(/<conditions\b[^>]*>([\s\S]*?)<\/conditions>/i);
  const conditions = [];

  if (conditionsMatch) {
    const [, conditionsBody] = conditionsMatch;
    const conditionTagMatches = [...conditionsBody.matchAll(/<condition\b[^>]*>/gi)];

    for (const match of conditionTagMatches) {
      const conditionAttributes = parseAttributes(match[0]);
      const { name: conditionName, summary = '', ...rest } = conditionAttributes;

      if (!conditionName) {
        throw new Error(`Condition without name encountered in device type ${name}.`);
      }

      conditions.push({ name: conditionName, summary, ...rest });
    }
  }

  const clustersMatch = xmlContent.match(/<clusters\b[^>]*>([\s\S]*?)<\/clusters>/i);
  const clustersBody = clustersMatch ? clustersMatch[1] : '';
  const clusterMatches = [...clustersBody.matchAll(/<cluster\b[^>]*?(?:\/>|>[\s\S]*?<\/cluster>)/gi)];
  const clusters = clusterMatches.map((match) => {
    const fullCluster = match[0];
    const openingTagMatch = fullCluster.match(/<cluster\b[^>]*>/i);

    if (!openingTagMatch) {
      throw new Error(`Unable to parse cluster definition for device type ${name}.`);
    }

    const clusterAttributes = parseAttributes(openingTagMatch[0]);
    const { id: clusterId, name: clusterName, side } = clusterAttributes;

    if (!clusterId || !clusterName || !side) {
      throw new Error(`Cluster definition is incomplete in device type ${name}.`);
    }

    let clusterBody = '';

    if (!fullCluster.trimEnd().endsWith('/>')) {
      clusterBody = fullCluster.slice(openingTagMatch[0].length, fullCluster.length - '</cluster>'.length);
    }

    const isMandatory = /^\s*(?:<!--[\s\S]*?-->\s*)*<mandatoryConform\b/i.test(clusterBody);

    const features = {};
    const featuresMatch = clusterBody.match(/<features\b[^>]*>([\s\S]*?)<\/features>/i);

    if (featuresMatch) {
      const [, featuresBody] = featuresMatch;
      const featureMatches = [...featuresBody.matchAll(/<feature\b[^>]*?(?:\/>|>[\s\S]*?<\/feature>)/gi)];

      let unnamedFeatureCounter = 0;

      for (const featureMatch of featureMatches) {
        const fullFeature = featureMatch[0];
        const featureOpeningTagMatch = fullFeature.match(/<feature\b[^>]*>/i);

        if (!featureOpeningTagMatch) {
          throw new Error(`Unable to parse feature definition for cluster ${clusterName} in device type ${name}.`);
        }

        const featureAttributes = parseAttributes(featureOpeningTagMatch[0]);
        const { code = '', name: rawFeatureName, summary = '', ...rest } = featureAttributes;

        const featureName = rawFeatureName || code || `UnnamedFeature${++unnamedFeatureCounter}`;

        if (!rawFeatureName) {
          const fallbackLabel = code ? `code "${code}"` : `generated name "${featureName}"`;
          console.log(`Warning: Feature without a name encountered in cluster ${clusterName} for device type ${name}. Using ${fallbackLabel}.`);
        }

        let featureBody = '';
        if (!fullFeature.trimEnd().endsWith('/>')) {
          featureBody = fullFeature.slice(featureOpeningTagMatch[0].length, fullFeature.length - '</feature>'.length);
        }

        const conformance = [];
        if (/<mandatoryConform\b/i.test(featureBody)) {
          conformance.push('mandatory');
        }
        if (/<optionalConform\b/i.test(featureBody)) {
          conformance.push('optional');
        }
        if (/<disallowConform\b/i.test(featureBody)) {
          conformance.push('disallow');
        }
        if (/<provisionalConform\b/i.test(featureBody)) {
          conformance.push('provisional');
        }
        if (/<deprecateConform\b/i.test(featureBody)) {
          conformance.push('deprecate');
        }
        if (/<otherwiseConform\b/i.test(featureBody)) {
          conformance.push('otherwise');
        }

        const featureConditions = [];
        const featureConditionMatches = [...featureBody.matchAll(/<condition\b[^>]*>/gi)];

        for (const conditionMatch of featureConditionMatches) {
          const conditionAttributes = parseAttributes(conditionMatch[0]);
          const { name: conditionName, summary = '', ...conditionRest } = conditionAttributes;

          if (!conditionName) {
            throw new Error(`Condition without a name referenced in feature ${featureName} of cluster ${clusterName} for device type ${name}.`);
          }

          const conditionOutput = { name: conditionName };

          if (summary) {
            conditionOutput.summary = summary;
          }

          const restEntries = Object.entries(conditionRest);
          if (restEntries.length > 0) {
            conditionOutput.attributes = Object.fromEntries(restEntries);
          }

          featureConditions.push(conditionOutput);
        }

        const featureOutput = {
          name: featureName,
          code,
        };

        if (summary) {
          featureOutput.summary = summary;
        }

        const extraAttributes = Object.entries(rest);
        if (extraAttributes.length > 0) {
          featureOutput.attributes = Object.fromEntries(extraAttributes);
        }

        if (conformance.length > 0) {
          featureOutput.conformance = conformance;
        }

        if (featureConditions.length > 0) {
          featureOutput.conditions = featureConditions;
        }

        const featureKey = featureName;

        if (features[featureKey]) {
          console.log(`Warning: Duplicate feature name "${featureKey}" encountered in cluster ${clusterName} for device type ${name}. Overwriting previous entry.`);
        }

        features[featureKey] = featureOutput;
      }
    }

    return {
      id: parseHexId(clusterId, `cluster ${clusterName} in device type ${name}`),
      name: normalizeDisplayName(clusterName),
      side,
      mandatory: isMandatory,
      ...(Object.keys(features).length > 0 ? { features } : {}),
    };
  });

  return {
    name,
    id: parsedId,
    revision: revisionValue,
    revisionHistory,
    conditions,
    class: classificationClass,
    scope,
    clusters,
  };
};

const parseClusterIdsBlock = (xmlContent) => {
  const match = xmlContent.match(/<clusterIds\b[^>]*>([\s\S]*?)<\/clusterIds>/i);
  if (!match) {
    return [];
  }

  const [, body] = match;
  const clusterIdMatches = [...body.matchAll(/<clusterId\b[^>]*\/>/gi)];
  const results = [];

  for (const entry of clusterIdMatches) {
    const attributes = parseAttributes(entry[0]);
    const { id, name, picsCode } = attributes;
    if (!id || !name) {
      continue;
    }
    results.push({ id, name, ...(picsCode ? { picsCode } : {}) });
  }

  return results;
};

const parseClusterXml = (xmlContent, contextLabel) => {
  const clusterMatch = xmlContent.match(/<cluster\b[^>]*>/i);
  if (!clusterMatch) {
    throw new Error(`Unable to locate cluster definition in ${contextLabel}.`);
  }

  const clusterAttributes = parseAttributes(clusterMatch[0]);
  const { id, name, revision } = clusterAttributes;

  if (!name) {
    throw new Error(`Cluster name is missing in ${contextLabel}.`);
  }

  if (!revision) {
    throw new Error(`Cluster revision is missing in ${contextLabel}.`);
  }

  const revisionValue = Number.parseInt(revision, 10);
  if (Number.isNaN(revisionValue)) {
    throw new Error(`Invalid revision \\"${revision}\\" for cluster ${name} in ${contextLabel}.`);
  }

  const revisionHistoryMatch = xmlContent.match(/<revisionHistory\b[^>]*>([\s\S]*?)<\/revisionHistory>/i);
  const revisionHistory = [];

  if (revisionHistoryMatch) {
    const [, revisionHistoryBody] = revisionHistoryMatch;
    const revisionMatches = [...revisionHistoryBody.matchAll(/<revision\b[^>]*>/gi)];

    for (const revisionMatchEntry of revisionMatches) {
      const revisionAttributes = parseAttributes(revisionMatchEntry[0]);
      const { revision: revisionAttr, summary = '' } = revisionAttributes;

      if (!revisionAttr) {
        throw new Error(`Revision entry missing revision attribute for cluster ${name}.`);
      }

      const revisionNumber = Number.parseInt(revisionAttr, 10);
      if (Number.isNaN(revisionNumber)) {
        throw new Error(`Invalid revision value \\"${revisionAttr}\\" in revision history for cluster ${name}.`);
      }

      revisionHistory.push({
        revision: revisionNumber,
        summary,
      });
    }
  }

  const classificationMatch = xmlContent.match(/<classification\b[^>]*>/i);
  if (!classificationMatch) {
    throw new Error(`Missing classification block for cluster ${name}.`);
  }

  const classificationAttributes = parseAttributes(classificationMatch[0]);
  const classification = { ...classificationAttributes };

  const features = {};
  const featuresMatch = xmlContent.match(/<features\b[^>]*>([\s\S]*?)<\/features>/i);

  if (featuresMatch) {
    const [, featuresBody] = featuresMatch;
    const featureMatches = [...featuresBody.matchAll(/<feature\b[^>]*?(?:\/>|>[\s\S]*?<\/feature>)/gi)];

    for (const featureMatch of featureMatches) {
      const fullFeature = featureMatch[0];
      const featureOpeningTagMatch = fullFeature.match(/<feature\b[^>]*>/i);

      if (!featureOpeningTagMatch) {
        throw new Error(`Unable to parse feature definition for cluster ${name} in ${contextLabel}.`);
      }

      const featureAttributes = parseAttributes(featureOpeningTagMatch[0]);
      const { code = '', name: featureName, summary = '', bit, ...rest } = featureAttributes;

      if (!featureName) {
        throw new Error(`Feature without a name encountered in cluster ${name} (${contextLabel}).`);
      }

      let featureBody = '';
      if (!fullFeature.trimEnd().endsWith('/>')) {
        featureBody = fullFeature.slice(featureOpeningTagMatch[0].length, fullFeature.length - '</feature>'.length);
      }

      const conformance = [];
      if (/<mandatoryConform\b/i.test(featureBody)) {
        conformance.push('mandatory');
      }
      if (/<optionalConform\b/i.test(featureBody)) {
        conformance.push('optional');
      }
      if (/<disallowConform\b/i.test(featureBody)) {
        conformance.push('disallow');
      }
      if (/<provisionalConform\b/i.test(featureBody)) {
        conformance.push('provisional');
      }
      if (/<deprecateConform\b/i.test(featureBody)) {
        conformance.push('deprecate');
      }
      if (/<otherwiseConform\b/i.test(featureBody)) {
        conformance.push('otherwise');
      }

      const featureConditions = [];
      const featureConditionMatches = [...featureBody.matchAll(/<condition\b[^>]*>/gi)];

      for (const conditionMatch of featureConditionMatches) {
        const conditionAttributes = parseAttributes(conditionMatch[0]);
        const { name: conditionName, summary: conditionSummary = '', ...conditionRest } = conditionAttributes;

        if (!conditionName) {
          throw new Error(`Condition without a name referenced in feature ${featureName} of cluster ${name} (${contextLabel}).`);
        }

        const conditionOutput = { name: conditionName };

        if (conditionSummary) {
          conditionOutput.summary = conditionSummary;
        }

        const restEntries = Object.entries(conditionRest);
        if (restEntries.length > 0) {
          conditionOutput.attributes = Object.fromEntries(restEntries);
        }

        featureConditions.push(conditionOutput);
      }

      const featureOutput = {
        name: featureName,
        code,
      };

      if (bit !== undefined) {
        const normalizedBit = bit.trim();
        let numericBit;

        if (/^0x[0-9a-f]+$/i.test(normalizedBit)) {
          numericBit = Number.parseInt(normalizedBit, 16);
        } else if (/^[0-9]+$/.test(normalizedBit)) {
          numericBit = Number.parseInt(normalizedBit, 10);
        }

        featureOutput.bit = Number.isNaN(numericBit) || numericBit === undefined ? normalizedBit : numericBit;
      }

      if (summary) {
        featureOutput.summary = summary;
      }

      const extraAttributes = Object.entries(rest);
      if (extraAttributes.length > 0) {
        featureOutput.attributes = Object.fromEntries(extraAttributes);
      }

      if (conformance.length > 0) {
        featureOutput.conformance = conformance;
      }

      if (featureConditions.length > 0) {
        featureOutput.conditions = featureConditions;
      }

      const featureKey = featureName;

      if (features[featureKey]) {
        console.log(`Warning: Duplicate feature name "${featureKey}" encountered in cluster ${name} (${contextLabel}). Overwriting previous entry.`);
      }

      features[featureKey] = featureOutput;
    }
  }

  const clusterIds = !id ? parseClusterIdsBlock(xmlContent) : [];
  const shouldExpandClusterIds = !id && clusterIds.length > 0;

  if (!id && !shouldExpandClusterIds) {
    console.log(`Cluster ${name} in ${contextLabel} does not declare an id; defaulting to 0.`);
  }

  const dataTypes = parseDataTypesBlock(xmlContent, name, contextLabel);
  const attributes = parseAttributesBlock(xmlContent, name, contextLabel);
  const commands = parseCommandsBlock(xmlContent, name, contextLabel);
  const events = parseEventsBlock(xmlContent, name, contextLabel);
  const hasDataTypes = Object.keys(dataTypes).length > 0;
  const hasAttributes = Object.keys(attributes).length > 0;
  const hasCommands = Object.keys(commands).length > 0;
  const hasEvents = Object.keys(events).length > 0;

  const baseEntry = {
    id: id ? parseHexId(id, `cluster ${name}`) : 0,
    definitionName: name,
    revision: revisionValue,
    revisionHistory,
    classification,
    ...(Object.keys(features).length > 0 ? { features } : {}),
    ...(hasDataTypes ? { dataTypes } : {}),
    ...(hasAttributes ? { attributes } : {}),
    ...(hasCommands ? { commands } : {}),
    ...(hasEvents ? { events } : {}),
  };

  if (!shouldExpandClusterIds) {
    return baseEntry;
  }

  const expandedClusterList = clusterIds.map(({ id: clusterId, name: clusterName }) => `  - [${clusterId}] ${clusterName}`).join('\n');

  console.warn(
    yellowText(
      `Cluster ${name} in ${contextLabel} does not declare an id; expanding metadata for ${clusterIds.length} <clusterId> entr${clusterIds.length === 1 ? 'y' : 'ies'}:\n${expandedClusterList}`,
    ),
  );

  const expandedEntries = clusterIds
    .map(({ id: clusterId, name: clusterName, picsCode }) => {
      const expanded = {
        ...baseEntry,
        id: parseHexId(clusterId, `clusterId ${clusterName} in ${contextLabel}`),
        definitionName: clusterName,
      };

      if (picsCode && expanded.classification && typeof expanded.classification === 'object') {
        expanded.classification = { ...expanded.classification, picsCode };
      }

      return expanded;
    })
    .filter(Boolean);

  return [baseEntry, ...expandedEntries];
};

/** Fetch all namespaces */

const namespacesFiles = [
  'Namespace-Common-Area.xml',
  'Namespace-Common-Closure.xml',
  'Namespace-Common-CompassDirection.xml',
  'Namespace-Common-CompassLocation.xml',
  'Namespace-Common-Direction.xml',
  'Namespace-Common-Landmark.xml',
  'Namespace-Common-Level.xml',
  'Namespace-Common-Location.xml',
  'Namespace-Common-Number.xml',
  'Namespace-Common-Position.xml',
  'Namespace-Common-RelativePosition.xml',
  'Namespace-ElectricalMeasurement.xml',
  'Namespace-Laundry.xml',
  'Namespace-PowerSource.xml',
  'Namespace-Refrigerator.xml',
  'Namespace-RoomAirConditioner.xml',
  'Namespace-Switches.xml',
];
const namespacesOutput = {};

console.log(`Fetching namespaces for Matter data model v${MATTER_DATA_MODEL_VERSION}`);

await mkdir(XML_DST_PATH, { recursive: true });

await mkdir(join(XML_DST_PATH, 'namespaces'), { recursive: true });

for (const filename of namespacesFiles) {
  console.log(`Downloading ${filename}...`);
  const xml = await fetchRemoteText(`${DATA_MODEL_PATHS.namespaces}${filename}`, {
    description: `namespace ${filename}`,
  });

  await writeFile(join(XML_DST_PATH, 'namespaces', filename), xml);

  const { id, name, tags } = parseNamespaceXml(xml);
  const key = sanitizeKey(name);
  namespacesOutput[key] = { id, name, tags };
}

await mkdir(DST_PATH, { recursive: true });

const outputPath = join(DST_PATH, OUTPUT_NAMESPACES);
const sortedNamespaces = Object.fromEntries(Object.entries(namespacesOutput).sort(([left], [right]) => left.localeCompare(right)));
const serializedNamespaces = `${JSON.stringify(sortedNamespaces, null, 2)}\n`;
await writeFile(outputPath, serializedNamespaces);
console.log(greenText(`Namespaces JSON written to ${outputPath} (${Object.keys(namespacesOutput).length} entries).`));

/** Fetch all device types */

console.log(`Fetching device type identifiers for Matter data model v${MATTER_DATA_MODEL_VERSION}`);
const deviceTypeIdsOutputPath = join(XML_DST_PATH, 'device_type_ids.json');
const deviceTypeIds = await fetchJsonAndSave(DATA_MODEL_PATHS.deviceTypesIds, deviceTypeIdsOutputPath, {
  description: 'device_type_ids.json',
});
const deviceTypeIdEntries = Object.entries(deviceTypeIds);
console.log(`Fetched ${deviceTypeIdEntries.length} device type identifier entries.`);

console.log('Listing available device type XML files...');
const deviceTypeDirectoryEntries = await fetchJson(DEVICE_TYPES_DIRECTORY_API, {
  description: 'device type directory listing',
  headers: GITHUB_API_HEADERS,
});

if (!Array.isArray(deviceTypeDirectoryEntries)) {
  throw new Error('Unexpected response while listing device type files.');
}

const deviceTypeFiles = deviceTypeDirectoryEntries.filter((entry) => entry.type === 'file' && typeof entry.name === 'string' && entry.name.toLowerCase().endsWith('.xml'));
console.log(`Discovered ${deviceTypeFiles.length} device type XML file(s).`);

const parsedDeviceTypes = new Map();

await mkdir(join(XML_DST_PATH, 'device_types'), { recursive: true });

for (const { name: filename, download_url: downloadUrl } of deviceTypeFiles) {
  if (!downloadUrl) {
    console.log(`Skipping ${filename} because it does not expose a download URL.`);
    continue;
  }

  console.log(`Downloading ${filename}...`);
  const xml = await fetchRemoteText(downloadUrl, {
    description: `device type ${filename}`,
  });

  await writeFile(join(XML_DST_PATH, 'device_types', filename), xml);

  const parsed = parseDeviceTypeXml(xml, filename);
  if (!parsed) {
    continue;
  }

  if (parsedDeviceTypes.has(parsed.name)) {
    console.log(`Warning: Duplicate device type definition detected for ${parsed.name}. Overwriting previous entry.`);
  }

  parsedDeviceTypes.set(parsed.name, parsed);
}

const deviceTypesOutput = {};

const sortedDeviceTypeIds = deviceTypeIdEntries
  .map(([rawId, displayName]) => ({
    id: Number.parseInt(rawId, 10),
    name: displayName,
  }))
  .filter(({ id, name }) => {
    if (Number.isNaN(id)) {
      console.log(`Skipping device type id entry with non-numeric id "${name}".`);
      return false;
    }
    return true;
  })
  .sort((left, right) => left.id - right.id);

for (const { id, name } of sortedDeviceTypeIds) {
  const parsed = parsedDeviceTypes.get(name);

  if (!parsed) {
    console.log(`Warning: No device type XML found for "${name}" (id ${id}).`);
    continue;
  }

  if (parsed.id !== id) {
    console.log(`Warning: Device type id mismatch for "${name}": ids.json=${id}, xml=${parsed.id}.`);
  }

  const key = sanitizeKey(name);
  deviceTypesOutput[key] = {
    name: normalizeDisplayName(name),
    id: parsed.id,
    revision: parsed.revision,
    revisionHistory: parsed.revisionHistory,
    conditions: parsed.conditions,
    ...(name.trim().toLowerCase() === 'base device type' ? {} : { class: parsed.class, scope: parsed.scope }),
    clusters: parsed.clusters,
  };

  parsedDeviceTypes.delete(name);
}

if (parsedDeviceTypes.size > 0) {
  console.log(`Including ${parsedDeviceTypes.size} additional device type definition(s) not listed in device_type_ids.json.`);
  const remainingEntries = [...parsedDeviceTypes.entries()].sort(([leftName], [rightName]) => leftName.localeCompare(rightName));

  for (const [name, parsed] of remainingEntries) {
    const key = sanitizeKey(name);
    deviceTypesOutput[key] = {
      name: normalizeDisplayName(name),
      id: parsed.id,
      revision: parsed.revision,
      revisionHistory: parsed.revisionHistory,
      conditions: parsed.conditions,
      ...(name.trim().toLowerCase() === 'base device type' ? {} : { class: parsed.class, scope: parsed.scope }),
      clusters: parsed.clusters,
    };
  }
}

const deviceTypesOutputPath = join(DST_PATH, OUTPUT_DEVICE_TYPES);
const sortedDeviceTypes = Object.fromEntries(Object.entries(deviceTypesOutput).sort(([left], [right]) => left.localeCompare(right)));
const serializedDeviceTypes = `${JSON.stringify(sortedDeviceTypes, null, 2)}\n`;
await writeFile(deviceTypesOutputPath, serializedDeviceTypes);
console.log(greenText(`Device types JSON written to ${deviceTypesOutputPath} (${Object.keys(deviceTypesOutput).length} entries).`));

/** Fetch all clusters */

console.log(`Fetching cluster identifiers for Matter data model v${MATTER_DATA_MODEL_VERSION}`);
const clusterIdsOutputPath = join(XML_DST_PATH, 'cluster_ids.json');
const clusterIds = await fetchJsonAndSave(DATA_MODEL_PATHS.clustersIds, clusterIdsOutputPath, {
  description: 'cluster_ids.json',
});

const clusterIdEntries = Object.entries(clusterIds)
  .map(([rawId, name]) => ({
    id: Number.parseInt(rawId, 10),
    name,
  }))
  .filter(({ id, name }) => {
    if (Number.isNaN(id)) {
      console.log(`Skipping cluster id entry with non-numeric id "${name}".`);
      return false;
    }
    return true;
  })
  .sort((left, right) => left.id - right.id);

console.log(`Fetched ${clusterIdEntries.length} cluster identifier entries.`);

console.log('Listing available cluster XML files...');
const clusterDirectoryEntries = await fetchJson(CLUSTERS_DIRECTORY_API, {
  description: 'cluster directory listing',
  headers: GITHUB_API_HEADERS,
});

if (!Array.isArray(clusterDirectoryEntries)) {
  throw new Error('Unexpected response while listing cluster files.');
}

const clusterFiles = clusterDirectoryEntries.filter((entry) => entry.type === 'file' && typeof entry.name === 'string' && entry.name.toLowerCase().endsWith('.xml'));
console.log(`Discovered ${clusterFiles.length} cluster XML file(s).`);

const parsedClustersById = new Map();

await mkdir(join(XML_DST_PATH, 'clusters'), { recursive: true });

for (const { name: filename, download_url: downloadUrl } of clusterFiles) {
  if (!downloadUrl) {
    console.log(`Skipping ${filename} because it does not expose a download URL.`);
    continue;
  }

  console.log(`Downloading ${filename}...`);
  const xml = await fetchRemoteText(downloadUrl, {
    description: `cluster ${filename}`,
  });

  await writeFile(join(XML_DST_PATH, 'clusters', filename), xml);

  const parsed = parseClusterXml(xml, filename);
  const parsedList = Array.isArray(parsed) ? parsed : [parsed];

  for (const parsedEntry of parsedList) {
    if (!parsedEntry) {
      continue;
    }

    const existing = parsedClustersById.get(parsedEntry.id);
    if (existing) {
      existing.push(parsedEntry);
    } else {
      parsedClustersById.set(parsedEntry.id, [parsedEntry]);
    }
  }
}

const clusterFallbackTemplates = [
  { target: 'HEPA Filter Monitoring', template: 'Resource Monitoring Clusters' },
  { target: 'Activated Carbon Filter Monitoring', template: 'Resource Monitoring Clusters' },
  { target: 'Water Tank Level Monitoring', template: 'Resource Monitoring Clusters' },
  { target: 'Relative Humidity Measurement', template: 'Water Content Measurement Clusters' },
  { target: 'Carbon Monoxide Concentration Measurement', template: 'Concentration Measurement Clusters' },
  { target: 'Carbon Dioxide Concentration Measurement', template: 'Concentration Measurement Clusters' },
  { target: 'Nitrogen Dioxide Concentration Measurement', template: 'Concentration Measurement Clusters' },
  { target: 'Ozone Concentration Measurement', template: 'Concentration Measurement Clusters' },
  { target: 'PM2.5 Concentration Measurement', template: 'Concentration Measurement Clusters' },
  { target: 'Formaldehyde Concentration Measurement', template: 'Concentration Measurement Clusters' },
  { target: 'PM1 Concentration Measurement', template: 'Concentration Measurement Clusters' },
  { target: 'PM10 Concentration Measurement', template: 'Concentration Measurement Clusters' },
  { target: 'Total Volatile Organic Compounds Concentration Measurement', template: 'Concentration Measurement Clusters' },
  { target: 'Radon Concentration Measurement', template: 'Concentration Measurement Clusters' },
];

const clusterFallbackTemplateMap = new Map(clusterFallbackTemplates.map(({ target, template }) => [sanitizeKey(target), template]));

const clustersOutput = {};
for (const { id, name } of clusterIdEntries) {
  const key = sanitizeKey(name);
  const entry = {
    name: normalizeDisplayName(name),
    id,
  };

  if (clustersOutput[key]) {
    console.log(`Warning: Duplicate sanitized cluster name detected for "${name}".`);
  }

  const parsedBuckets = parsedClustersById.get(id);

  if (!parsedBuckets || parsedBuckets.length === 0) {
    console.log(`Warning: No cluster XML found for id ${id} (${name}).`);

    const fallbackTemplate = clusterFallbackTemplateMap.get(key);
    if (fallbackTemplate === 'Concentration Measurement Clusters') {
      console.log('Using default ConcentrationMeasurement metadata.');
    } else if (fallbackTemplate === 'Water Content Measurement Clusters') {
      console.log('Using default WaterContentMeasurement metadata.');
    }
  } else {
    const parsed = parsedBuckets.shift();
    entry.revision = parsed.revision;
    entry.revisionHistory = parsed.revisionHistory;
    entry.classification = parsed.classification;
    if (parsed.features) {
      entry.features = parsed.features;
    }
    if (parsed.dataTypes) {
      entry.dataTypes = parsed.dataTypes;
    }
    if (parsed.attributes) {
      entry.attributes = parsed.attributes;
    }
    if (parsed.commands) {
      entry.commands = parsed.commands;
    }
    if (parsed.events) {
      entry.events = parsed.events;
    }

    if (parsedBuckets.length === 0) {
      parsedClustersById.delete(id);
    } else {
      parsedClustersById.set(id, parsedBuckets);
    }
  }

  clustersOutput[key] = entry;
}

if (parsedClustersById.size > 0) {
  const remainingClusters = [];
  for (const bucket of parsedClustersById.values()) {
    remainingClusters.push(...bucket);
  }

  remainingClusters.sort((left, right) => left.id - right.id || left.definitionName.localeCompare(right.definitionName));

  console.log(`Including ${remainingClusters.length} additional cluster definition(s) not listed in cluster_ids.json.`);
  for (const parsed of remainingClusters) {
    console.log(` - ${parsed.definitionName} (id ${parsed.id})`);
  }

  for (const parsed of remainingClusters) {
    const key = sanitizeKey(parsed.definitionName);

    if (clustersOutput[key]) {
      console.log(`Warning: Duplicate sanitized cluster name detected for additional cluster "${parsed.definitionName}".`);
    }

    clustersOutput[key] = {
      name: normalizeDisplayName(parsed.definitionName),
      id: parsed.id,
      revision: parsed.revision,
      revisionHistory: parsed.revisionHistory,
      classification: parsed.classification,
      ...(parsed.features ? { features: parsed.features } : {}),
      ...(parsed.dataTypes ? { dataTypes: parsed.dataTypes } : {}),
      ...(parsed.attributes ? { attributes: parsed.attributes } : {}),
      ...(parsed.commands ? { commands: parsed.commands } : {}),
      ...(parsed.events ? { events: parsed.events } : {}),
    };
  }
}

for (const { target, template } of clusterFallbackTemplates) {
  const targetKey = sanitizeKey(target);
  const templateKey = sanitizeKey(template);

  const targetEntry = clustersOutput[targetKey];
  const templateEntry = clustersOutput[templateKey];

  if (!targetEntry) {
    console.log(`Warning: Unable to apply fallback for missing cluster "${target}" because it was not found in cluster ids.`);
    continue;
  }

  if (targetEntry.revision) {
    continue;
  }

  if (!templateEntry) {
    console.log(`Warning: Unable to apply fallback for missing cluster "${target}" because template "${template}" is unavailable.`);
    continue;
  }

  console.log(`Applying fallback metadata for cluster "${target}" using template "${template}".`);
  const updatedEntry = {
    ...targetEntry,
    revision: templateEntry.revision,
  };

  if (templateEntry.revisionHistory) {
    updatedEntry.revisionHistory = cloneDeep(templateEntry.revisionHistory);
  }

  if (templateEntry.classification) {
    updatedEntry.classification = cloneDeep(templateEntry.classification);
  }

  if (templateEntry.features) {
    updatedEntry.features = cloneDeep(templateEntry.features);
  }

  if (templateEntry.dataTypes) {
    updatedEntry.dataTypes = cloneDeep(templateEntry.dataTypes);
  }

  if (templateEntry.attributes) {
    updatedEntry.attributes = cloneDeep(templateEntry.attributes);
  }

  if (templateEntry.commands) {
    updatedEntry.commands = cloneDeep(templateEntry.commands);
  }

  if (templateEntry.events) {
    updatedEntry.events = cloneDeep(templateEntry.events);
  }

  clustersOutput[targetKey] = updatedEntry;
}

for (const [clusterKey, clusterEntry] of Object.entries(clustersOutput)) {
  const baseClusterName = clusterEntry?.classification?.baseCluster;

  if (!baseClusterName || typeof baseClusterName !== 'string') {
    continue;
  }

  const baseClusterKey = resolveClusterTemplateKey(clustersOutput, baseClusterName);

  if (!baseClusterKey) {
    console.log(`Warning: Unable to resolve base cluster "${baseClusterName}" for cluster "${clusterEntry.name || clusterKey}".`);
    continue;
  }

  if (baseClusterKey === clusterKey) {
    continue;
  }

  const baseClusterEntry = clustersOutput[baseClusterKey];
  const updatedEntry = { ...clusterEntry };
  let inheritedSections = 0;

  for (const section of ['features', 'dataTypes', 'attributes', 'commands', 'events']) {
    if (!baseClusterEntry?.[section]) {
      continue;
    }

    updatedEntry[section] = mergeClusterSection(baseClusterEntry[section], clusterEntry[section]);
    inheritedSections += 1;
  }

  if (inheritedSections > 0) {
    console.log(`Applying base cluster metadata for cluster "${clusterEntry.name || clusterKey}" using base cluster "${baseClusterName}".`);
    clustersOutput[clusterKey] = updatedEntry;
  }
}

const clustersOutputPath = join(DST_PATH, OUTPUT_CLUSTERS);
const sortedClusters = Object.fromEntries(Object.entries(clustersOutput).sort(([left], [right]) => left.localeCompare(right)));
const serializedClusters = `${JSON.stringify(sortedClusters, null, 2)}\n`;
await writeFile(clustersOutputPath, serializedClusters);
console.log(greenText(`Cluster identifiers JSON written to ${clustersOutputPath} (${Object.keys(sortedClusters).length} entries).`));

const clusterTypesOutputDir = join('packages', 'types', 'src');
await mkdir(clusterTypesOutputDir, { recursive: true });
const legacyClusterTypesOutputPath = join(clusterTypesOutputDir, 'clusterTypes.ts');
const legacyMatterDataModeOutputPath = join(clusterTypesOutputDir, 'matterDataMode.ts');
const clusterTypesOutputPath = join(clusterTypesOutputDir, 'matterDataModel.ts');
const unknownTypeUsages = [];
const converterTypeUsages = [];
const clusterTypesTs = generateClusterTypesTs(sortedClusters, MATTER_DATA_MODEL_VERSION, unknownTypeUsages, converterTypeUsages);
await writeFile(clusterTypesOutputPath, clusterTypesTs);
await unlink(legacyClusterTypesOutputPath).catch((error) => {
  if (error?.code !== 'ENOENT') {
    throw error;
  }
});
await unlink(legacyMatterDataModeOutputPath).catch((error) => {
  if (error?.code !== 'ENOENT') {
    throw error;
  }
});
console.log(greenText(`Cluster types TS written to ${clusterTypesOutputPath} (${Object.keys(sortedClusters).length} clusters).`));

const affectedClusters = new Set(unknownTypeUsages.map((entry) => entry.cluster));
const unknownTypeCounts = unknownTypeUsages.reduce(
  (counts, entry) => {
    if (entry?.kind === 'attribute') counts.attributes += 1;
    if (entry?.kind === 'commandRequest') counts.commandRequests += 1;
    if (entry?.kind === 'eventPayload') counts.eventPayloads += 1;
    return counts;
  },
  { attributes: 0, commandRequests: 0, eventPayloads: 0 },
);
const generatedAt = new Date().toISOString();
const legacyUnknownTypesReportPath = join(DST_PATH, 'clusterTypes.unknown.json');
const unknownTypesReportPath = join(DST_PATH, 'converterUnknown.json');
const converterTypesReportPath = join(DST_PATH, 'converterTypes.json');
const report = {
  version: MATTER_DATA_MODEL_VERSION,
  generatedAt,
  unknownTypes: unknownTypeUsages.length,
  unknownAttributes: unknownTypeCounts.attributes,
  unknownCommandRequests: unknownTypeCounts.commandRequests,
  unknownEventPayloads: unknownTypeCounts.eventPayloads,
  affectedClusters: affectedClusters.size,
  items: unknownTypeUsages,
};
await writeFile(unknownTypesReportPath, `${JSON.stringify(report, null, 2)}\n`);
await unlink(legacyUnknownTypesReportPath).catch((error) => {
  if (error?.code !== 'ENOENT') {
    throw error;
  }
});

const converterTypesReport = {
  version: MATTER_DATA_MODEL_VERSION,
  generatedAt,
  mappingCount: converterTypeUsages.length,
  items: converterTypeUsages,
};
await writeFile(converterTypesReportPath, `${JSON.stringify(converterTypesReport, null, 2)}\n`);

if (unknownTypeUsages.length > 0) {
  console.warn(
    yellowText(
      `Cluster types TS contains ${unknownTypeUsages.length} unknown type(s) across ${affectedClusters.size} cluster(s): ${unknownTypeCounts.attributes} attribute(s), ${unknownTypeCounts.commandRequests} command request field(s), ${unknownTypeCounts.eventPayloads} event payload field(s). Details written to ${unknownTypesReportPath}.`,
    ),
  );
} else {
  console.log(greenText(`Cluster types TS contains no unknown types. Details written to ${unknownTypesReportPath}.`));
}
