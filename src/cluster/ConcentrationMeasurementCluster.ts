/* eslint-disable @typescript-eslint/no-namespace */
/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/** * THIS FILE IS GENERATED, DO NOT EDIT ***/

import { FixedAttribute, MutableCluster, OptionalAttribute } from '@project-chip/matter-node.js/cluster';
import { Attribute } from '@project-chip/matter-node.js/cluster';
import { BitFlag } from '@project-chip/matter-node.js/schema';
import { TlvEnum, TlvNullable, TlvFloat, TlvUInt32 } from '@project-chip/matter-node.js/tlv';
import { Identity } from '@project-chip/matter-node.js/util';

export namespace ConcentrationMeasurement {
  /**
   * Where mentioned, Billion refers to 10, Trillion refers to 1012 (short scale).
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.10.5.1
   */
  export enum MeasurementUnit {
    /**
     * Parts per Million (10)
     */
    Ppm = 0,

    /**
     * Parts per Billion (10)
     */
    Ppb = 1,

    /**
     * Parts per Trillion (1012)
     */
    Ppt = 2,

    /**
     * Milligram per m
     */
    Mgm3 = 3,

    /**
     * Microgram per m
     */
    Ugm3 = 4,

    /**
     * Nanogram per m
     */
    Ngm3 = 5,

    /**
     * Particles per m
     */
    Pm3 = 6,

    /**
     * Becquerel per m
     */
    Bqm3 = 7,
  }

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 2.10.5.3
   */
  export enum LevelValue {
    /**
     * The level is Unknown
     */
    Unknown = 0,

    /**
     * The level is considered Low
     */
    Low = 1,

    /**
     * The level is considered Medium
     */
    Medium = 2,

    /**
     * The level is considered High
     */
    High = 3,

    /**
     * The level is considered Critical
     */
    Critical = 4,
  }

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 2.10.5.2
   */
  export enum MeasurementMedium {
    /**
     * The measurement is being made in Air
     */
    Air = 0,

    /**
     * The measurement is being made in Water
     */
    Water = 1,

    /**
     * The measurement is being made in Soil
     */
    Soil = 2,
  }

  /**
   * A ConcentrationMeasurementCluster supports these elements if it supports feature NumericMeasurement.
   */
  export const NumericMeasurementComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates the most recent measurement as a single-precision floating-point number. MeasuredValue’s unit
       * is represented by MeasurementUnit.
       *
       * A value of null indicates that the measurement is unknown or outside the valid range. MinMeasuredValue
       * and MaxMeasuredValue define the valid range for MeasuredValue.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.10.6.1
       */
      measuredValue: Attribute(0x0, TlvNullable(TlvFloat), { default: null }),

      /**
       * Indicates the minimum value of MeasuredValue that is capable of being measured. A MinMeasuredValue of
       * null indicates that the MinMeasuredValue is not defined.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.10.6.2
       */
      minMeasuredValue: Attribute(0x1, TlvNullable(TlvFloat), { default: null }),

      /**
       * Indicates the maximum value of MeasuredValue that is capable of being measured. A MaxMeasuredValue of
       * null indicates that the MaxMeasuredValue is not defined.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.10.6.3
       */
      maxMeasuredValue: Attribute(0x2, TlvNullable(TlvFloat), { default: null }),

      /**
       * Indicates the range of error or deviation that can be found in MeasuredValue and PeakMeasuredValue. This
       * is considered a +/- value and should be considered to be in MeasurementUnit.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.10.6.8
       */
      uncertainty: OptionalAttribute(0x7, TlvFloat),

      /**
       * Indicates the unit of MeasuredValue. See MeasurementUnitEnum.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.10.6.9
       */
      measurementUnit: FixedAttribute(0x8, TlvEnum<MeasurementUnit>()),
    },
  });

  /**
   * A ConcentrationMeasurementCluster supports these elements if it supports feature PeakMeasurement.
   */
  export const PeakMeasurementComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates the maximum value of MeasuredValue that has been measured during the PeakMeasuredValueWindow.
       * If this attribute is provided, the PeakMeasuredValueWindow attribute shall also be provided.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.10.6.4
       */
      peakMeasuredValue: Attribute(0x3, TlvNullable(TlvFloat), { default: null }),

      /**
       * Indicates the window of time used for determining the PeakMeasuredValue. The value is in seconds.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.10.6.5
       */
      peakMeasuredValueWindow: Attribute(0x4, TlvUInt32.bound({ max: 604800 }), { default: 1 }),
    },
  });

  /**
   * A ConcentrationMeasurementCluster supports these elements if it supports feature AverageMeasurement.
   */
  export const AverageMeasurementComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates the average value of MeasuredValue that has been measured during the
       * AverageMeasuredValueWindow. If this attribute is provided, the AverageMeasuredValueWindow attribute
       * shall also be provided.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.10.6.6
       */
      averageMeasuredValue: Attribute(0x5, TlvNullable(TlvFloat), { default: null }),

      /**
       * Indicates the window of time used for determining the AverageMeasuredValue. The value is in seconds.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.10.6.7
       */
      averageMeasuredValueWindow: Attribute(0x6, TlvUInt32.bound({ max: 604800 }), { default: 1 }),
    },
  });

  /**
   * A ConcentrationMeasurementCluster supports these elements if it supports feature LevelIndication.
   */
  export const LevelIndicationComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates the level of the substance detected. See LevelValueEnum.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.10.6.11
       */
      levelValue: Attribute(0xa, TlvEnum<LevelValue>(), { default: LevelValue.Unknown }),
    },
  });

  /**
   * ConcentrationMeasurement is a derived cluster, not to be used directly. These elements are present in all
   * clusters derived from ConcentrationMeasurement.
   */
  export const Base = MutableCluster.Component({
    features: {
      /**
       * NumericMeasurement
       *
       * Cluster supports numeric measurement of substance
       */
      numericMeasurement: BitFlag(0),

      /**
       * LevelIndication
       *
       * Cluster supports basic level indication for substance using the ConcentrationLevel enum
       */
      levelIndication: BitFlag(1),

      /**
       * MediumLevel
       *
       * Cluster supports the Medium Concentration Level
       */
      mediumLevel: BitFlag(2),

      /**
       * CriticalLevel
       *
       * Cluster supports the Critical Concentration Level
       */
      criticalLevel: BitFlag(3),

      /**
       * PeakMeasurement
       *
       * Cluster supports peak numeric measurement of substance
       */
      peakMeasurement: BitFlag(4),

      /**
       * AverageMeasurement
       *
       * Cluster supports average numeric measurement of substance
       */
      averageMeasurement: BitFlag(5),
    },

    name: 'ConcentrationMeasurement',
    revision: 3,

    attributes: {
      /**
       * Indicates the medium in which MeasuredValue is being measured. See MeasurementMediumEnum.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.10.6.10
       */
      measurementMedium: FixedAttribute(0x9, TlvEnum<MeasurementMedium>()),
    },

    /**
     * This metadata controls which ConcentrationMeasurementCluster elements matter.js activates for specific
     * feature combinations.
     */
    extensions: MutableCluster.Extensions(
      { flags: { numericMeasurement: true }, component: NumericMeasurementComponent },
      { flags: { peakMeasurement: true }, component: PeakMeasurementComponent },
      { flags: { averageMeasurement: true }, component: AverageMeasurementComponent },
      { flags: { levelIndication: true }, component: LevelIndicationComponent },
      { flags: { mediumLevel: true, levelIndication: false }, component: false },
      { flags: { criticalLevel: true, levelIndication: false }, component: false },
      { flags: { peakMeasurement: true, numericMeasurement: false }, component: false },
      { flags: { averageMeasurement: true, numericMeasurement: false }, component: false },
      { flags: { numericMeasurement: false, levelIndication: false }, component: false },
    ),
  });

  const MEA = { numericMeasurement: true };
  const PEA = { peakMeasurement: true };
  const AVG = { averageMeasurement: true };
  const LEV = { levelIndication: true };

  /**
   * @see {@link Complete}
   */
  export const CompleteInstance = MutableCluster.Component({
    name: Base.name,
    revision: Base.revision,
    features: Base.features,

    attributes: {
      ...Base.attributes,
      measuredValue: MutableCluster.AsConditional(NumericMeasurementComponent.attributes.measuredValue, { mandatoryIf: [MEA] }),
      minMeasuredValue: MutableCluster.AsConditional(NumericMeasurementComponent.attributes.minMeasuredValue, { mandatoryIf: [MEA] }),
      maxMeasuredValue: MutableCluster.AsConditional(NumericMeasurementComponent.attributes.maxMeasuredValue, { mandatoryIf: [MEA] }),
      peakMeasuredValue: MutableCluster.AsConditional(PeakMeasurementComponent.attributes.peakMeasuredValue, { mandatoryIf: [PEA] }),
      peakMeasuredValueWindow: MutableCluster.AsConditional(PeakMeasurementComponent.attributes.peakMeasuredValueWindow, { mandatoryIf: [PEA] }),
      averageMeasuredValue: MutableCluster.AsConditional(AverageMeasurementComponent.attributes.averageMeasuredValue, { mandatoryIf: [AVG] }),
      averageMeasuredValueWindow: MutableCluster.AsConditional(AverageMeasurementComponent.attributes.averageMeasuredValueWindow, { mandatoryIf: [AVG] }),
      uncertainty: MutableCluster.AsConditional(NumericMeasurementComponent.attributes.uncertainty, { optionalIf: [MEA] }),
      measurementUnit: MutableCluster.AsConditional(NumericMeasurementComponent.attributes.measurementUnit, { mandatoryIf: [MEA] }),
      levelValue: MutableCluster.AsConditional(LevelIndicationComponent.attributes.levelValue, { mandatoryIf: [LEV] }),
    },
  });

  /**
   * This cluster supports all ConcentrationMeasurement features. It may support illegal feature combinations.
   *
   * If you use this cluster you must manually specify which features are active and ensure the set of active
   * features is legal per the Matter specification.
   */
  export type Complete = Identity<typeof CompleteInstance>;

  export const Complete: Complete = CompleteInstance;
}
