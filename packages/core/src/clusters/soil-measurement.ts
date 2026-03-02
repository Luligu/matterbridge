/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-namespace */
/**
 * Soil Measurement Cluster Matter 1.5.0 - 2.15. Soil Measurement Cluster
 */

import { Identity } from '@matter/general';
import { Attribute, ClusterRegistry, FixedAttribute, MutableCluster } from '@matter/types/cluster';
import { TlvMeasurementAccuracy } from '@matter/types/globals';
import { TlvNullable, TlvPercent } from '@matter/types/tlv';

export namespace SoilMeasurement {
  export const ClusterInstance = MutableCluster({
    id: 0x0430,
    name: 'SoilMeasurement',
    revision: 1,

    attributes: {
      soilMoistureMeasurementLimits: FixedAttribute(0x0, TlvMeasurementAccuracy),
      soilMoistureMeasuredValue: Attribute(0x1, TlvNullable(TlvPercent)),
    },
  });

  export interface Cluster extends Identity<typeof ClusterInstance> {}

  export const Cluster: Cluster = ClusterInstance;
  export const Complete = Cluster;
}

export type SoilMeasurementCluster = SoilMeasurement.Cluster;
export const SoilMeasurementCluster = SoilMeasurement.Cluster;

ClusterRegistry.register(SoilMeasurement.Complete);
