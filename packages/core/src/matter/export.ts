/**
 * @description Matter module entrypoint re-exports.
 * @file src/matter/export.ts
 * @author Luca Liguori
 * @created 2026-03-04
 * @version 1.0.0
 * @license Apache-2.0
 */

// @matter
export * from '@matter/main';
export { AttributeElement, ClusterElement, ClusterModel, CommandElement, EventElement, FieldElement, MatterDefinition } from '@matter/main/model';
export { MdnsService, Val } from '@matter/main/protocol';
