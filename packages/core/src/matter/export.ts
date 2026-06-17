/**
 * @description Matter module entrypoint re-exports.
 * @file src/matter/export.ts
 * @author Luca Liguori
 * @created 2026-03-04
 * @version 1.0.0
 * @license Apache-2.0
 */

// oxlint-disable-next-line oxc/no-barrel-file
export * from '@matter/main';
export { AttributeElement, ClusterElement, ClusterModel, CommandElement, EventElement, FieldElement, MatterDefinition } from '@matter/main/model';
export { MdnsService, Val } from '@matter/main/protocol';

// Fix the export of the Common*NamespaceTag to *NamespaceTag
/** @deprecated Use CommonAreaNamespaceTag instead. */
export { CommonAreaNamespaceTag as AreaNamespaceTag } from '@matter/main/node';
/** @deprecated Use CommonClosureTag instead. */
export { CommonClosureTag as ClosureTag } from '@matter/main/node';
/** @deprecated Use CommonCompassDirectionTag instead. */
export { CommonCompassDirectionTag as CompassDirectionTag } from '@matter/main/node';
/** @deprecated Use CommonCompassLocationTag instead. */
export { CommonCompassLocationTag as CompassLocationTag } from '@matter/main/node';
/** @deprecated Use CommonDirectionTag instead. */
export { CommonDirectionTag as DirectionTag } from '@matter/main/node';
/** @deprecated Use CommonLandmarkNamespaceTag instead. */
export { CommonLandmarkNamespaceTag as LandmarkNamespaceTag } from '@matter/main/node';
/** @deprecated Use CommonLevelTag instead. */
export { CommonLevelTag as LevelTag } from '@matter/main/node';
/** @deprecated Use CommonLocationTag instead. */
export { CommonLocationTag as LocationTag } from '@matter/main/node';
/** @deprecated Use CommonNumberTag instead. */
export { CommonNumberTag as NumberTag } from '@matter/main/node';
/** @deprecated Use CommonPositionTag instead. */
export { CommonPositionTag as PositionTag } from '@matter/main/node';
/** @deprecated Use CommonRelativePositionTag instead. */
export { CommonRelativePositionTag as RelativePositionTag } from '@matter/main/node';
