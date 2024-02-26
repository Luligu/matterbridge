/**
 * @license
 * Copyright 2022-2023 Project CHIP Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { NotImplementedError } from '@project-chip/matter.js/common';
import { WrapCommandHandler } from '@project-chip/matter-node.js/device';
import { NamedHandler } from '@project-chip/matter-node.js/util';
import { ColorControl, ColorControlCluster } from '@project-chip/matter-node.js/cluster';
import { ClusterServer } from '@project-chip/matter-node.js/cluster';
import { AttributeInitialValues, ClusterServerHandlers } from '@project-chip/matter-node.js/cluster';

export const ColorControlDefaultClusterHandler: () => ClusterServerHandlers<typeof ColorControl.Complete> = () => ({
  // Hue and Saturation { hueSaturation: true }
  moveToHue: async () => {
    throw new NotImplementedError('Not implemented');
  },
  moveHue: async () => {
    throw new NotImplementedError('Not implemented');
  },
  stepHue: async () => {
    throw new NotImplementedError('Not implemented');
  },
  moveToSaturation: async () => {
    throw new NotImplementedError('Not implemented');
  },
  moveSaturation: async () => {
    throw new NotImplementedError('Not implemented');
  },
  stepSaturation: async () => {
    throw new NotImplementedError('Not implemented');
  },
  moveToHueAndSaturation: async () => {
    throw new NotImplementedError('Not implemented');
  },

  // X Y color { xy: true }
  moveToColor: async () => {
    throw new NotImplementedError('Not implemented');
  },
  moveColor: async () => {
    throw new NotImplementedError('Not implemented');
  },
  stepColor: async () => {
    throw new NotImplementedError('Not implemented');
  },

  // Color temeperature { colorTemperature: true }
  moveToColorTemperature: async () => {
    throw new NotImplementedError('Not implemented');
  },

  // Enhanced Hue { enhancedHue: true }
  enhancedMoveToHue: async () => {
    throw new NotImplementedError('Not implemented');
  },
  enhancedMoveHue: async () => {
    throw new NotImplementedError('Not implemented');
  },
  enhancedStepHue: async () => {
    throw new NotImplementedError('Not implemented');
  },
  enhancedMoveToHueAndSaturation: async () => {
    throw new NotImplementedError('Not implemented');
  },

  // Color loop { colorLoop: true }
  colorLoopSet: async () => {
    throw new NotImplementedError('Not implemented');
  },
  stopMoveStep: async () => {
    throw new NotImplementedError('Not implemented');
  },
  moveColorTemperature: async () => {
    throw new NotImplementedError('Not implemented');
  },
  stepColorTemperature: async () => {
    throw new NotImplementedError('Not implemented');
  },
});

export const createDefaultColorControlClusterServer = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  commandHandler: NamedHandler<any>,
  attributeInitialValues?: AttributeInitialValues<typeof ColorControl.Cluster.attributes>,
) =>
  ClusterServer(
    ColorControlCluster,
    attributeInitialValues ?? {
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      options: {
        executeIfOff: false,
      },
      numberOfPrimaries: null,
      enhancedColorMode: ColorControl.EnhancedColorMode.CurrentHueAndCurrentSaturation,
      colorCapabilities: { xy: false, hs: false, cl: false, ehue: false, ct: false },
    },
    WrapCommandHandler(ColorControlDefaultClusterHandler(), commandHandler),
  );
