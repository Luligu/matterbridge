/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/*** THIS FILE IS GENERATED, DO NOT EDIT ***/

import { TlvObject, TlvField, TlvInt64, TlvOptionalField, TypeFromSchema, TlvPercent100ths, TlvUInt64 } from '@project-chip/matter-node.js/tlv';


/**
 * This struct represents the accuracy of a measurement for a range of measurement values. Accuracy shall be expressed
 * as a maximum +/- percentage of the true value, a maximum +/- fixed value of the true value, or both.
 *
 *   • If both PercentMax and FixedMax are indicated, then for a given true value in the range between RangeMin and
 *     RangeMax,
 *
 *     ◦ the reported value shall be less than or equal to the sum of the true value, FixedMax and PercentMax percent
 *       of the true value.
 *
 *     ◦ the reported value shall be greater than or equal to the true value minus the sum of FixedMax and PercentMax
 *       percent of the true value.
 *
 *   • If only PercentMax is indicated, then for a given true value in the range between RangeMin and RangeMax,
 *
 *     ◦ the reported value shall be less than or equal to the sum of the true value and PercentMax percent of the true
 *       value.
 *
 *     ◦ the reported value shall be greater than or equal to the true value minus PercentMax per
 *
 * cent of the true value.
 *
 *   • If only FixedMax is indicated, then for a given true value in the range between RangeMin and RangeMax,
 *
 *     ◦ the reported value shall be less than or equal to the sum of the true value and FixedMax.
 *
 *     ◦ the reported value shall be greater than or equal to the true value minus FixedMax.
 *
 * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.3
 */
export const TlvMeasurementAccuracyRange = TlvObject({
    /**
     * This field shall indicate the minimum measurement value for the specified level of accuracy.
     *
     * The value of this field shall be greater than or equal to the value of the MinMeasuredValue field on the
     * encompassing MeasurementAccuracyStruct.
     *
     * The value of this field shall be less than or equal to the value of the MaxMeasuredValue field on the
     * encompassing MeasurementAccuracyStruct.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.3.1
     */
    rangeMin: TlvField(0, TlvInt64.bound({ min: -(2 ** 62), max: 2 ** 62 })),

    /**
     * This field shall indicate the maximum measurement value for the specified level of accuracy. The value of this
     * field shall be greater than the value of the RangeMin field.
     *
     * The value of this field shall be greater than or equal to the value of the MinMeasuredValue field on the
     * encompassing MeasurementAccuracyStruct.
     *
     * The value of this field shall be less than or equal to the value of the MaxMeasuredValue field on the
     * encompassing MeasurementAccuracyStruct.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.3.2
     */
    rangeMax: TlvField(1, TlvInt64.bound({ min: -(2 ** 62), max: 2 ** 62 })),

    /**
     * This field shall indicate the maximum +/- percentage accuracy for the associated measurement.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.3.3
     */
    percentMax: TlvOptionalField(2, TlvPercent100ths),

    /**
     * This field shall indicate the minimum +/- percentage accuracy for the associated measurement.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.3.4
     */
    percentMin: TlvOptionalField(3, TlvPercent100ths),

    /**
     * This field shall indicate the typical +/- percentage accuracy for the associated measurement.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.3.5
     */
    percentTypical: TlvOptionalField(4, TlvPercent100ths),

    /**
     * This field shall indicate the maximum +/- fixed accuracy for the associated measurement, in the unit indicated
     * by MeasurementType.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.3.6
     */
    fixedMax: TlvOptionalField(5, TlvUInt64),

    /**
     * This field shall indicate the minimum +/- fixed accuracy for the associated measurement, in the unit indicated
     * by MeasurementType.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.3.7
     */
    fixedMin: TlvOptionalField(6, TlvUInt64),

    /**
     * This field shall indicate the typical +/- fixed accuracy for the associated measurement, in the unit indicated
     * by MeasurementType.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.3.8
     */
    fixedTypical: TlvOptionalField(7, TlvUInt64)
});

/**
 * This struct represents the accuracy of a measurement for a range of measurement values. Accuracy shall be expressed
 * as a maximum +/- percentage of the true value, a maximum +/- fixed value of the true value, or both.
 *
 *   • If both PercentMax and FixedMax are indicated, then for a given true value in the range between RangeMin and
 *     RangeMax,
 *
 *     ◦ the reported value shall be less than or equal to the sum of the true value, FixedMax and PercentMax percent
 *       of the true value.
 *
 *     ◦ the reported value shall be greater than or equal to the true value minus the sum of FixedMax and PercentMax
 *       percent of the true value.
 *
 *   • If only PercentMax is indicated, then for a given true value in the range between RangeMin and RangeMax,
 *
 *     ◦ the reported value shall be less than or equal to the sum of the true value and PercentMax percent of the true
 *       value.
 *
 *     ◦ the reported value shall be greater than or equal to the true value minus PercentMax per
 *
 * cent of the true value.
 *
 *   • If only FixedMax is indicated, then for a given true value in the range between RangeMin and RangeMax,
 *
 *     ◦ the reported value shall be less than or equal to the sum of the true value and FixedMax.
 *
 *     ◦ the reported value shall be greater than or equal to the true value minus FixedMax.
 *
 * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.3
 */
export interface MeasurementAccuracyRange extends TypeFromSchema<typeof TlvMeasurementAccuracyRange> { }
