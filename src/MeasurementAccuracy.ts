/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/*** THIS FILE IS GENERATED, DO NOT EDIT ***/

import { MeasurementType } from "./MeasurementType.js";
import { TlvMeasurementAccuracyRange } from "./MeasurementAccuracyRange.js";
import { TlvEnum, TlvArray, TlvObject, TlvField, TlvInt64, TypeFromSchema, TlvBoolean } from '@project-chip/matter-node.js/tlv';

/**
 * This struct represents the set of accuracy ranges for a given measurement, the maximum and minimum values for the
 * measurement, and whether the measurement is directly measured or just estimated from other information.
 *
 * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.4
 */
export const TlvMeasurementAccuracy = TlvObject({
    /**
     * This field shall indicate the type of measurement for the accuracy provided.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.4.1
     */
    measurementType: TlvField(0, TlvEnum<MeasurementType>()),

    /**
     * This field shall indicate whether the associated measurement was directly measured. If this field is not set to
     * true, then the associated measurement was estimated.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.4.2
     */
    measured: TlvField(1, TlvBoolean),

    minMeasuredValue: TlvField(2, TlvInt64.bound({ min: -(2 ** 62), max: 2 ** 62 })),
    maxMeasuredValue: TlvField(3, TlvInt64.bound({ min: -(2 ** 62), max: 2 ** 62 })),

    /**
     * This field shall indicate a list of measurement ranges and their associated accuracies.
     *
     * The value of the RangeMin field on the first MeasurementAccuracyRangeStruct in this list shall be equal to the
     * value of the MinMeasuredValue field.
     *
     * The value of the RangeMax field on the last MeasurementAccuracyRangeStruct in this list shall be less than or
     * equal to the value of the MaxMeasuredValue field.
     *
     * The value of the RangeMin field on each MeasurementAccuracyRangeStruct in this list other than the first shall
     * be one more the value of the RangeMax field on the previous MeasurementAccuracyRangeStruct in this list (i.e.
     * there shall be no gaps in the accuracy ranges, and the ranges shall be in increasing order).
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.4.5
     */
    accuracyRanges: TlvField(4, TlvArray(TlvMeasurementAccuracyRange, { minLength: 1 }))
});

/**
 * This struct represents the set of accuracy ranges for a given measurement, the maximum and minimum values for the
 * measurement, and whether the measurement is directly measured or just estimated from other information.
 *
 * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.4
 */
export interface MeasurementAccuracy extends TypeFromSchema<typeof TlvMeasurementAccuracy> { }
