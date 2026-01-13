/**
 * Data model script.
 *
 * This script will fetch from the connectedhomeip GitHub repository the data model files and convert them to JSON.
 *
 * It supports environment variables to customize the version and output paths.
 *
 * MATTER_DATA_MODEL_VERSION - The default version is 1.4.2.
 */

const MATTER_DATA_MODEL_VERSION = process.env.MATTER_DATA_MODEL_VERSION || '1.4.2';
const SRC_PATH = `https://raw.githubusercontent.com/project-chip/connectedhomeip/master/data_model/${MATTER_DATA_MODEL_VERSION}/`;
const DATA_MODEL_PATHS = {
  clusters: `${SRC_PATH}clusters/`,
  clustersIds: `${SRC_PATH}clusters/cluster_ids.json`,
  deviceTypes: `${SRC_PATH}device_types/`,
  deviceTypesIds: `${SRC_PATH}device_types/device_type_ids.json`,
  namespaces: `${SRC_PATH}namespaces/`,
};
const DST_PATH = `chip/${MATTER_DATA_MODEL_VERSION}/`;
const OUTPUT_NAMESPACES = 'namespaces.json';
const OUTPUT_DEVICE_TYPES = 'deviceTypes.json';
const OUTPUT_CLUSTERS = 'clusters.json';
const GITHUB_API_BASE = 'https://api.github.com/repos/project-chip/connectedhomeip/contents';
const DEVICE_TYPES_DIRECTORY_API = `${GITHUB_API_BASE}/data_model/${MATTER_DATA_MODEL_VERSION}/device_types?ref=master`;
const CLUSTERS_DIRECTORY_API = `${GITHUB_API_BASE}/data_model/${MATTER_DATA_MODEL_VERSION}/clusters?ref=master`;
const GITHUB_API_HEADERS = {
  'User-Agent': 'matterbridge-data-model-script',
  Accept: 'application/vnd.github.v3+json',
};

const sanitizeKey = (value) => value.replace(/[\s/]+/g, '');
const normalizeDisplayName = (value) => (typeof value === 'string' ? value.replace(/\s*\/\s*/g, '') : value);

const cloneDeep = (value) => {
  if (value === undefined) {
    return undefined;
  }

  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
};

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { request } from 'node:https';

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
    throw new Error(`Unable to parse JSON from ${description || url}: ${error.message}`);
  }
};

/* eslint-disable no-console */

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
  const regex = /<(enum|bitmap|struct)\b[^>]*>[\s\S]*?<\/\1>/gi;
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

    const typeBody = fullMatch.slice(openingMatch[0].length, fullMatch.length - `</${rawType}>`.length);

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
  const attributeRegex = /<attribute\b[^>]*?(?:\/\s*>|>[\s\S]*?<\/attribute>)/gi;
  let attrMatch;

  while ((attrMatch = attributeRegex.exec(body)) !== null) {
    const fullMatch = attrMatch[0];
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

  if (!id) {
    console.log(`Skipping ${contextLabel} (device type "${name}") because it does not declare an id.`);
    return null;
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
  if (!classificationMatch) {
    throw new Error(`Missing classification block for device type ${name}.`);
  }

  const classificationAttributes = parseAttributes(classificationMatch[0]);
  const classificationClass = classificationAttributes.class;
  const { scope } = classificationAttributes;

  if (!classificationClass || !scope) {
    throw new Error(`Classification attributes are incomplete for device type ${name}.`);
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

  const clusterMatches = [...xmlContent.matchAll(/<cluster\b[^>]*?(?:\/>|>[\s\S]*?<\/cluster>)/gi)];
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

      for (const featureMatch of featureMatches) {
        const fullFeature = featureMatch[0];
        const featureOpeningTagMatch = fullFeature.match(/<feature\b[^>]*>/i);

        if (!featureOpeningTagMatch) {
          throw new Error(`Unable to parse feature definition for cluster ${clusterName} in device type ${name}.`);
        }

        const featureAttributes = parseAttributes(featureOpeningTagMatch[0]);
        const { code = '', name: featureName, summary = '', ...rest } = featureAttributes;

        if (!featureName) {
          throw new Error(`Feature without a name encountered in cluster ${clusterName} for device type ${name}.`);
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
    id: parseHexId(id, `device type ${name}`),
    revision: revisionValue,
    revisionHistory,
    conditions,
    class: classificationClass,
    scope,
    clusters,
  };
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

  const parsedId = id ? parseHexId(id, `cluster ${name}`) : 0;

  if (!id) {
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

  return {
    id: parsedId,
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

for (const filename of namespacesFiles) {
  console.log(`Downloading ${filename}...`);
  const xml = await fetchRemoteText(`${DATA_MODEL_PATHS.namespaces}${filename}`, {
    description: `namespace ${filename}`,
  });
  const { id, name, tags } = parseNamespaceXml(xml);
  const key = sanitizeKey(name);
  namespacesOutput[key] = { id, name, tags };
}

await mkdir(DST_PATH, { recursive: true });

const outputPath = join(DST_PATH, OUTPUT_NAMESPACES);
const sortedNamespaces = Object.fromEntries(Object.entries(namespacesOutput).sort(([left], [right]) => left.localeCompare(right)));
const serializedNamespaces = `${JSON.stringify(sortedNamespaces, null, 2)}\n`;
await writeFile(outputPath, serializedNamespaces);
console.log(`Namespaces JSON written to ${outputPath} (${Object.keys(namespacesOutput).length} entries).`);

/** Fetch all device types */

console.log(`Fetching device type identifiers for Matter data model v${MATTER_DATA_MODEL_VERSION}`);
const deviceTypeIds = await fetchJson(DATA_MODEL_PATHS.deviceTypesIds, {
  description: 'device type ids',
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

for (const { name: filename, download_url: downloadUrl } of deviceTypeFiles) {
  if (!downloadUrl) {
    console.log(`Skipping ${filename} because it does not expose a download URL.`);
    continue;
  }

  console.log(`Downloading ${filename}...`);
  const xml = await fetchRemoteText(downloadUrl, {
    description: `device type ${filename}`,
  });

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
const classScopeSet = new Set();

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
  classScopeSet.add(`${parsed.class}:${parsed.scope}`);
  deviceTypesOutput[key] = {
    name: normalizeDisplayName(name),
    id: parsed.id,
    revision: parsed.revision,
    revisionHistory: parsed.revisionHistory,
    conditions: parsed.conditions,
    class: parsed.class,
    scope: parsed.scope,
    clusters: parsed.clusters,
  };

  parsedDeviceTypes.delete(name);
}

if (parsedDeviceTypes.size > 0) {
  console.log(`Including ${parsedDeviceTypes.size} additional device type definition(s) not listed in device_type_ids.json.`);
  const remainingEntries = [...parsedDeviceTypes.entries()].sort(([leftName], [rightName]) => leftName.localeCompare(rightName));

  for (const [name, parsed] of remainingEntries) {
    const key = sanitizeKey(name);
    classScopeSet.add(`${parsed.class}:${parsed.scope}`);
    deviceTypesOutput[key] = {
      name: normalizeDisplayName(name),
      id: parsed.id,
      revision: parsed.revision,
      revisionHistory: parsed.revisionHistory,
      conditions: parsed.conditions,
      class: parsed.class,
      scope: parsed.scope,
      clusters: parsed.clusters,
    };
  }
}

const deviceTypesOutputPath = join(DST_PATH, OUTPUT_DEVICE_TYPES);
const sortedDeviceTypes = Object.fromEntries(Object.entries(deviceTypesOutput).sort(([left], [right]) => left.localeCompare(right)));
const serializedDeviceTypes = `${JSON.stringify(sortedDeviceTypes, null, 2)}\n`;
await writeFile(deviceTypesOutputPath, serializedDeviceTypes);
console.log(`Device types JSON written to ${deviceTypesOutputPath} (${Object.keys(deviceTypesOutput).length} entries).`);
console.log('Observed class/scope combinations:', [...classScopeSet.values()]);

/** Fetch all clusters */

console.log(`Fetching cluster identifiers for Matter data model v${MATTER_DATA_MODEL_VERSION}`);
const clusterIds = await fetchJson(DATA_MODEL_PATHS.clustersIds, {
  description: 'cluster ids',
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

for (const { name: filename, download_url: downloadUrl } of clusterFiles) {
  if (!downloadUrl) {
    console.log(`Skipping ${filename} because it does not expose a download URL.`);
    continue;
  }

  console.log(`Downloading ${filename}...`);
  const xml = await fetchRemoteText(downloadUrl, {
    description: `cluster ${filename}`,
  });

  const parsed = parseClusterXml(xml, filename);

  if (!parsed) {
    continue;
  }

  const existing = parsedClustersById.get(parsed.id);
  if (existing) {
    existing.push(parsed);
  } else {
    parsedClustersById.set(parsed.id, [parsed]);
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

  if (!templateEntry) {
    console.log(`Warning: Unable to apply fallback for missing cluster "${target}" because template "${template}" is unavailable.`);
    continue;
  }

  if (targetEntry.revision) {
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

const clustersOutputPath = join(DST_PATH, OUTPUT_CLUSTERS);
const sortedClusters = Object.fromEntries(Object.entries(clustersOutput).sort(([left], [right]) => left.localeCompare(right)));
const serializedClusters = `${JSON.stringify(sortedClusters, null, 2)}\n`;
await writeFile(clustersOutputPath, serializedClusters);
console.log(`Cluster identifiers JSON written to ${clustersOutputPath} (${Object.keys(sortedClusters).length} entries).`);
