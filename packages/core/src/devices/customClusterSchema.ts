/**
 * @description Helpers to supply Matter.js model schema for custom clusters.
 *
 * Matter.js `ClusterBehavior.for(cluster)` looks up a `ClusterModel` schema in the
 * standard Matter data model (Matter.children). Custom clusters are not present
 * there, so device-local behaviors must pass a schema explicitly.
 */

import { AttributeElement, ClusterModel, CommandElement, EventElement, FieldElement } from '../matter/export.js';

type AnyCluster = {
  id: number;
  name: string;
  revision?: number;
  supportedFeatures?: Record<string, boolean>;
  attributes?: Record<string, { id: number; default?: unknown; optional?: boolean }>;
  commands?: Record<string, { requestId: number; optional?: boolean }>;
  events?: Record<string, { id: number; optional?: boolean }>;
};

/**
 * Create a minimal `ClusterModel` schema for a custom cluster type.
 *
 * This schema is used by matter.js for behavior state validation and feature
 * synchronization (FeatureMap). It does not attempt to model full datatypes.
 *
 * @param {AnyCluster} cluster Custom cluster definition (ClusterType-like object).
 * @returns {ClusterModel} ClusterModel schema suitable for `ClusterBehavior.for(..., schema)`.
 */
export function createClusterSchema(cluster: AnyCluster): ClusterModel {
  const children: Array<ReturnType<typeof AttributeElement> | ReturnType<typeof CommandElement> | ReturnType<typeof EventElement>> = [];

  // Define FeatureMap fields so matter.js can sync schema.supportedFeatures.
  const featureNames = Object.keys(cluster.supportedFeatures ?? {});
  if (featureNames.length > 0) {
    children.push(
      AttributeElement(
        {
          // Global FeatureMap attribute id (same across all clusters)
          id: 0xfffc,
          name: 'FeatureMap',
          type: 'FeatureMap',

          // Mark as mandatory so it participates in feature synchronization.
          conformance: 'M',
        },
        ...featureNames.map((name, index) =>
          FieldElement({
            name,
            id: index,
            type: 'bool',
            constraint: index,
          }),
        ),
      ),
    );
  }

  for (const [name, attribute] of Object.entries(cluster.attributes ?? {})) {
    children.push(
      AttributeElement({
        id: attribute.id,
        name,
        type: 'any',
        conformance: 'O',
      }),
    );
  }

  for (const [name, command] of Object.entries(cluster.commands ?? {})) {
    const element = CommandElement({
      id: command.requestId,
      name,
      type: 'any',
      direction: 'request',
      conformance: 'O',
    });
    (element as unknown as { operationalIsSupported?: boolean }).operationalIsSupported = true;
    children.push(element);
  }

  for (const [name, event] of Object.entries(cluster.events ?? {})) {
    const element = EventElement({
      id: event.id,
      name,
      type: 'any',
      priority: name === 'operationalError' ? 'critical' : 'info',
      conformance: 'O',
    });
    (element as unknown as { operationalIsSupported?: boolean }).operationalIsSupported = true;
    children.push(element);
  }

  return new ClusterModel(
    {
      id: cluster.id,
      name: cluster.name,
      revision: cluster.revision ?? 1,
    },
    ...children,
  );
}
