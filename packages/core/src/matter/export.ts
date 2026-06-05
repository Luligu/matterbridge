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

// Fix the export of the Common*NamespaceTag to *NamespaceTag
export { CommonAreaNamespaceTag as AreaNamespaceTag } from '@matter/main/node';
export { CommonClosureTag as ClosureTag } from '@matter/main/node';
export { CommonCompassDirectionTag as CompassDirectionTag } from '@matter/main/node';
export { CommonCompassLocationTag as CompassLocationTag } from '@matter/main/node';
export { CommonDirectionTag as DirectionTag } from '@matter/main/node';
export { CommonLandmarkNamespaceTag as LandmarkNamespaceTag } from '@matter/main/node';
export { CommonLevelTag as LevelTag } from '@matter/main/node';
export { CommonLocationTag as LocationTag } from '@matter/main/node';
export { CommonNumberTag as NumberTag } from '@matter/main/node';
export { CommonPositionTag as PositionTag } from '@matter/main/node';
export { CommonRelativePositionTag as RelativePositionTag } from '@matter/main/node';
