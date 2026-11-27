/**
 * @file scripts/profile-matterjs-memory.mjs
 * @description Profile standalone matter.js memory with an aggregator and extended color lights
 * @author Luca Liguori
 * @created 2026
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026 Luca Liguori.
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

import { mkdtemp, rm } from 'node:fs/promises';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

const endpointCounts = [0, 10, 100, 200];
const onlineDurationMs = readPositiveInteger('MATTER_PROFILE_STAGE_MS', 120_000);
const offlineSettleMs = readPositiveInteger('MATTER_PROFILE_OFFLINE_MS', 5_000);
const sampleIntervalMs = readPositiveInteger('MATTER_PROFILE_SAMPLE_MS', 500);
const importsOnly = process.env.MATTER_PROFILE_IMPORTS_ONLY === 'true';
const requiredLightBehaviors = ['identify', 'groups', 'onOff', 'levelControl', 'scenesManagement', 'colorControl'];
const samples = [];
const fixedSamples = {};
const startedAt = performance.now();
const storageRoot = await mkdtemp(join(tmpdir(), 'matterjs-memory-profile-'));
let phase = 'bare-node';
let sampler;
let server;

function readPositiveInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, received "${raw}"`);
  }
  return value;
}

function toMiB(bytes) {
  return Math.round((bytes / 1024 / 1024) * 1000) / 1000;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function sample(label, fixed = false) {
  const memory = process.memoryUsage();
  const item = {
    label,
    phase,
    elapsedMs: Math.round(performance.now() - startedAt),
    rssMiB: toMiB(memory.rss),
    heapUsedMiB: toMiB(memory.heapUsed),
    heapTotalMiB: toMiB(memory.heapTotal),
    externalMiB: toMiB(memory.external),
    arrayBuffersMiB: toMiB(memory.arrayBuffers),
    maxRssMiB: toMiB(process.resourceUsage().maxRSS * 1024),
  };
  samples.push(item);
  if (fixed) fixedSamples[label] = item;
  return item;
}

function statistics(items) {
  const metrics = ['rssMiB', 'heapUsedMiB', 'heapTotalMiB', 'externalMiB', 'arrayBuffersMiB', 'maxRssMiB'];
  return Object.fromEntries(
    metrics.map((metric) => {
      const values = items.map((item) => item[metric]);
      return [
        metric,
        {
          min: Math.min(...values),
          average: round(values.reduce((sum, value) => sum + value, 0) / values.length),
          max: Math.max(...values),
        },
      ];
    }),
  );
}

function delta(value, baseline) {
  return round(value - baseline);
}

function linearSlope(points, metric) {
  const meanCount = points.reduce((sum, point) => sum + point.endpointCount, 0) / points.length;
  const meanMetric = points.reduce((sum, point) => sum + point[metric], 0) / points.length;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    const countDelta = point.endpointCount - meanCount;
    numerator += countDelta * (point[metric] - meanMetric);
    denominator += countDelta * countDelta;
  }
  return round(numerator / denominator);
}

function weightBreakdown(stages, metric, source) {
  const values = stages.map((stage) => ({ endpointCount: stage.endpointCount, ...stage[source][metric] }));
  const baseline = values[0];
  return {
    perEndpointLinearMiB: linearSlope(values, 'average'),
    perEndpointAt200MiB: round((values.at(-1).average - baseline.average) / 200),
    marginalMiB: values.slice(1).map((value, index) => ({
      from: baseline.endpointCount,
      to: value.endpointCount,
      perEndpointMiB: round((value.average - baseline.average) / value.endpointCount),
      previousCount: values[index].endpointCount,
      previousMarginalPerEndpointMiB: round(
        (value.average - values[index].average) / (value.endpointCount - values[index].endpointCount),
      ),
    })),
  };
}

function forceGc() {
  if (globalThis.gc === undefined) {
    throw new Error('Run with --expose-gc to collect retained-memory measurements');
  }
  globalThis.gc();
}

function externalInterfaces() {
  return Object.fromEntries(
    Object.entries(networkInterfaces()).flatMap(([name, addresses]) => {
      const external = addresses
        ?.filter((address) => !address.internal)
        .map((address) => ({ family: address.family, address: address.address }));
      return external?.length ? [[name, external]] : [];
    }),
  );
}

async function wait(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function profileStage(endpointCount) {
  phase = `online-${endpointCount}`;
  const start = sample(`online-${endpointCount}-start`, true);
  await wait(onlineDurationMs);
  const end = sample(`online-${endpointCount}-end`, true);
  const stageSamples = samples.filter(
    (item) =>
      item.phase === `online-${endpointCount}` && item.elapsedMs >= start.elapsedMs && item.elapsedMs <= end.elapsedMs,
  );
  forceGc();
  await wait(100);
  const retained = sample(`online-${endpointCount}-after-gc`, true);
  return {
    endpointCount,
    durationMs: onlineDurationMs,
    samples: stageSamples.length,
    statistics: statistics(stageSamples),
    retained,
  };
}

async function addExtendedColorLights(aggregator, lightType, Endpoint, DescriptorServer, VendorId, count) {
  for (let index = 0; index < count; index++) {
    const sequence = String(aggregator.parts.size + 1).padStart(4, '0');
    const light = new Endpoint(lightType, {
      id: `ExtendedColorLight-${sequence}`,
      bridgedDeviceBasicInformation: {
        vendorId: VendorId(0xfff1),
        vendorName: 'matter.js',
        productId: 0x8001,
        productName: 'Extended Color Light',
        productLabel: 'Profile Extended Color Light',
        nodeLabel: `Extended Light ${sequence}`,
        serialNumber: `LIGHT-SN-${sequence}`,
        uniqueId: `LIGHT-UI-${sequence}`,
        softwareVersion: 1,
        softwareVersionString: '1.0.0',
        hardwareVersion: 1,
        hardwareVersionString: '1',
        configurationVersion: 1,
        reachable: true,
      },
      colorControl: {
        colorMode: 1,
        enhancedColorMode: 1,
        colorCapabilities: {
          xy: true,
          hueSaturation: false,
          colorLoop: false,
          enhancedHue: false,
          colorTemperature: true,
        },
        options: {
          executeIfOff: false,
        },
        numberOfPrimaries: null,
        currentX: 0,
        currentY: 0,
        colorTemperatureMireds: 250,
        colorTempPhysicalMinMireds: 147,
        colorTempPhysicalMaxMireds: 500,
        coupleColorTempToLevelMinMireds: 147,
        startUpColorTemperatureMireds: null,
        remainingTime: 0,
      },
    });
    await aggregator.add(light);
    await light.act(async (agent) => {
      const descriptor = await agent.load(DescriptorServer);
      descriptor.addDeviceTypes('BridgedNode');
    });
  }
}

const baseline = sample('bare-node-before-matter-import', true);

try {
  phase = 'imports';
  const { config } = await import('@matter/nodejs/config');
  config.defaultStoragePath = join(storageRoot, 'storage');
  config.loadConfigFile = false;
  config.loadProcessArgv = false;
  config.loadProcessEnv = false;
  config.trapProcessSignals = false;
  config.trapUnhandledErrors = false;
  config.setProcessExitCodeOnError = false;
  sample('nodejs-config-imported', true);

  await import('@matter/nodejs');
  sample('nodejs-platform-imported', true);
  const { Environment } = await import('@matter/general');
  sample('general-imported', true);
  const { DeviceTypeId, VendorId } = await import('@matter/types/datatype');
  sample('types-datatype-imported', true);
  const { Endpoint, ServerNode } = await import('@matter/node');
  sample('node-core-imported', true);
  const { AggregatorEndpoint } = await import('@matter/node/endpoints/aggregator');
  sample('aggregator-imported', true);
  const { ExtendedColorLightDevice } = await import('@matter/node/devices/extended-color-light');
  sample('extended-color-light-imported', true);
  const { BridgedDeviceBasicInformationServer } = await import(
    '@matter/node/behaviors/bridged-device-basic-information'
  );
  sample('bridged-information-imported', true);
  const { DescriptorServer } = await import('@matter/node/behaviors/descriptor');
  sample('descriptor-imported', true);
  const lightType = ExtendedColorLightDevice.with(BridgedDeviceBasicInformationServer);
  sample('all-required-imports-complete', true);

  if (importsOnly) {
    forceGc();
    sample('imports-after-gc', true);
    console.log(
      `MATTERJS_IMPORT_PROFILE=${JSON.stringify({
        runtime: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          exposedGc: globalThis.gc !== undefined,
          importsOnly: true,
        },
        fixedSamples,
        baselineDeltas: Object.fromEntries(
          Object.entries(fixedSamples).map(([name, item]) => [
            name,
            {
              rssMiB: delta(item.rssMiB, baseline.rssMiB),
              heapUsedMiB: delta(item.heapUsedMiB, baseline.heapUsedMiB),
            },
          ]),
        ),
      })}`,
    );
    await rm(storageRoot, { recursive: true, force: true });
    process.exit();
  }

  phase = 'created-offline';
  Environment.default.vars.set('log.level', 'fatal');
  server = await ServerNode.create({
    id: 'MatterJsMemoryProfile',
    environment: Environment.default,
    productDescription: {
      name: 'Matter.js Memory Profile',
      deviceType: DeviceTypeId(0x000e),
      vendorId: VendorId(0xfff1),
      productId: 0x8000,
    },
    basicInformation: {
      vendorId: VendorId(0xfff1),
      vendorName: 'matter.js',
      productId: 0x8000,
      productName: 'Matter.js Memory Profile',
      productLabel: 'Matter.js Memory Profile',
      nodeLabel: 'Matter.js Profile Node',
      hardwareVersion: 1,
      softwareVersion: 1,
      productUrl: 'https://github.com/matter-js/matter.js',
      configurationVersion: 1,
      reachable: true,
      serialNumber: 'PROFILE-SN-0001',
      uniqueId: 'PROFILE-UI-0001',
    },
    network: {
      listeningAddressIpv4: undefined,
      listeningAddressIpv6: undefined,
      ipv4: true,
      port: 0,
      tcp: true,
      transportPreference: 'udp',
    },
    operationalCredentials: {
      certification: undefined,
    },
  });
  const aggregator = new Endpoint(AggregatorEndpoint, { id: 'MatterJsMemoryProfileAggregator' });
  await server.add(aggregator);
  sample('server-and-aggregator-created-offline', true);

  await server.start();
  sampler = setInterval(() => sample('periodic'), sampleIntervalMs);
  const stages = [];
  let endpointCount = 0;
  for (const targetCount of endpointCounts) {
    if (targetCount > endpointCount) {
      phase = `adding-${targetCount - endpointCount}`;
      sample(`adding-${targetCount - endpointCount}-start`, true);
      await addExtendedColorLights(
        aggregator,
        lightType,
        Endpoint,
        DescriptorServer,
        VendorId,
        targetCount - endpointCount,
      );
      endpointCount = targetCount;
      sample(`adding-${targetCount}-complete`, true);
    }
    stages.push(await profileStage(endpointCount));
  }

  const representativeLight = aggregator.parts[Symbol.iterator]().next().value;
  const supportedLightBehaviors = Object.keys(representativeLight.behaviors.supported);
  const missingLightBehaviors = requiredLightBehaviors.filter(
    (behavior) => !supportedLightBehaviors.includes(behavior),
  );
  if (!representativeLight.behaviors.has(BridgedDeviceBasicInformationServer)) {
    missingLightBehaviors.push('bridgedDeviceBasicInformation');
  }
  if (missingLightBehaviors.length) {
    throw new Error(`Extended color light is missing required behaviors: ${missingLightBehaviors.join(', ')}`);
  }

  clearInterval(sampler);
  sampler = undefined;
  phase = 'closing';
  await server.close();
  server = undefined;
  phase = 'offline';
  sample('offline-immediately', true);
  await wait(offlineSettleMs);
  forceGc();
  sample('offline-after-settle-and-gc', true);

  const zeroStage = stages[0];
  const endpointMemory = {
    rawAverage: {
      rssMiB: weightBreakdown(stages, 'rssMiB', 'statistics'),
      heapUsedMiB: weightBreakdown(stages, 'heapUsedMiB', 'statistics'),
    },
    retainedAfterGc: {
      rssMiB: weightBreakdown(
        stages.map((stage) => ({ ...stage, retained: { rssMiB: { average: stage.retained.rssMiB } } })),
        'rssMiB',
        'retained',
      ),
      heapUsedMiB: weightBreakdown(
        stages.map((stage) => ({ ...stage, retained: { heapUsedMiB: { average: stage.retained.heapUsedMiB } } })),
        'heapUsedMiB',
        'retained',
      ),
    },
  };

  console.log(
    `MATTERJS_MEMORY_PROFILE=${JSON.stringify({
      runtime: {
        matterJs: '0.18.1',
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        exposedGc: globalThis.gc !== undefined,
        sampleIntervalMs,
        onlineDurationPerStageMs: onlineDurationMs,
        offlineSettleMs,
      },
      topology: {
        serverNodes: 1,
        aggregators: 1,
        endpointCounts,
        endpointType: 'ExtendedColorLight',
        requiredServerClusters: requiredLightBehaviors,
        additionalBridgedServerClusters: ['bridgedDeviceBasicInformation'],
        bridgedDeviceType: true,
        ipv4: true,
        ipv6: true,
        tcp: true,
        udp: true,
        commissioned: false,
        interfaces: externalInterfaces(),
      },
      fixedSamples,
      baselineDeltas: Object.fromEntries(
        Object.entries(fixedSamples).map(([name, item]) => [
          name,
          {
            rssMiB: delta(item.rssMiB, baseline.rssMiB),
            heapUsedMiB: delta(item.heapUsedMiB, baseline.heapUsedMiB),
          },
        ]),
      ),
      stages: stages.map(({ retained, ...stage }) => ({
        ...stage,
        retained: {
          rssMiB: retained.rssMiB,
          heapUsedMiB: retained.heapUsedMiB,
          heapTotalMiB: retained.heapTotalMiB,
          externalMiB: retained.externalMiB,
        },
      })),
      endpointMemory,
      zeroTo200Retained: {
        rssMiB: delta(stages.at(-1).retained.rssMiB, zeroStage.retained.rssMiB),
        heapUsedMiB: delta(stages.at(-1).retained.heapUsedMiB, zeroStage.retained.heapUsedMiB),
      },
    })}`,
  );
} finally {
  if (sampler) clearInterval(sampler);
  if (server) await server.close();
  await rm(storageRoot, { recursive: true, force: true });
}
