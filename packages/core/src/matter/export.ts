/**
 * @file packages/core/src/matter/export.ts
 * @description Matter module entrypoint re-exports.
 * @author Luca Liguori
 * @created 2026-03-04
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
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
