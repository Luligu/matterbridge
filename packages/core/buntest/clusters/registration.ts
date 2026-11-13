/**
 * @file packages/core/buntest/clusters/registration.ts
 * @description Shared bun test helper for the registration of the custom cluster definitions and models.
 * @author Luca Liguori
 */

import { expect } from 'bun:test';

import { Matter, MatterDefinition } from '@matter/main/model';

/**
 * Finds the index of the cluster definition with the id in MatterDefinition, skipping the device types with the same id.
 *
 * @param {number} id - The cluster id.
 * @returns {number} The index, or -1 when the cluster definition is not registered.
 */
function clusterDefinitionIndex(id: number): number {
  return MatterDefinition.children.findIndex((child) => 'tag' in child && child.tag === 'cluster' && child.id === id);
}

/**
 * Removes the cluster from MatterDefinition and Matter, loads a fresh instance of its module and checks that the module
 * registers its definition and model, then restores the original registrations.
 * matter.js already ships these clusters, so the registration only runs when they are missing.
 *
 * @param {number} id - The cluster id.
 * @param {() => Promise<Record<string, unknown>>} load - Imports a fresh instance of the cluster module (unique query string).
 * @param {string} name - The cluster name, prefix of the exported `<name>Definition` and `<name>Model`.
 * @returns {Promise<void>} Resolves once the original registrations are restored.
 */
export async function expectClusterRegistration(id: number, load: () => Promise<Record<string, unknown>>, name: string): Promise<void> {
  const definitionIndex = clusterDefinitionIndex(id);
  const originalDefinition = MatterDefinition.children[definitionIndex];
  const originalModel = Matter.clusters(id);
  if (definitionIndex < 0 || originalDefinition === undefined || originalModel === undefined) throw new Error(`Cluster ${id} is not registered`);
  const modelIndex = Matter.children.indexOf(originalModel);

  MatterDefinition.children.splice(definitionIndex, 1);
  Matter.children.splice(modelIndex, 1);
  try {
    expect(clusterDefinitionIndex(id)).toBe(-1);
    expect(Matter.clusters(id)).toBeUndefined();
    const module = await load();
    expect(MatterDefinition.children.some((child) => child === module[`${name}Definition`])).toBe(true);
    expect(Matter.clusters(id) === module[`${name}Model`]).toBe(true);
  } finally {
    // Remove the fresh registrations and put back the originals at their places
    const freshDefinitionIndex = clusterDefinitionIndex(id);
    if (freshDefinitionIndex >= 0) MatterDefinition.children.splice(freshDefinitionIndex, 1);
    const freshModel = Matter.clusters(id);
    if (freshModel) Matter.children.splice(Matter.children.indexOf(freshModel), 1);
    MatterDefinition.children.splice(definitionIndex, 0, originalDefinition);
    Matter.children.splice(modelIndex, 0, originalModel);
  }
  expect(MatterDefinition.children[definitionIndex]).toBe(originalDefinition);
  expect(Matter.clusters(id)).toBe(originalModel);
}
