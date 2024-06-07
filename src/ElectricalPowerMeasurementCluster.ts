/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/*** THIS FILE IS GENERATED, DO NOT EDIT ***/

import { ClusterRegistry, EventPriority, MutableCluster, OptionalAttribute, OptionalEvent } from '@project-chip/matter-node.js/cluster';
import { FixedAttribute, Attribute } from '@project-chip/matter-node.js/cluster';
import { BitFlag } from '@project-chip/matter-node.js/schema';
import { TlvEnum, TlvArray, TlvObject, TlvField, TlvInt64, TlvOptionalField, TlvEpochS, TlvSysTimeMS, TlvNullable, TypeFromSchema, TlvUInt8 } from '@project-chip/matter-node.js/tlv';
import { Identity } from '@project-chip/matter-node.js/util';
import { TlvMeasurementAccuracy } from './MeasurementAccuracy.js';
import { MeasurementType } from './MeasurementType.js';



export namespace ElectricalPowerMeasurement {
    /**
     * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.3
     */
    export const TlvHarmonicMeasurement = TlvObject({
        /**
         * This field shall be the order of the harmonic being measured. Typically this is an odd number, but servers
         * may choose to report even harmonics.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.3.1
         */
        order: TlvField(0, TlvUInt8.bound({ min: 1 })),

        /**
         * This field shall be the measured value for the given harmonic order.
         *
         * For the Harmonic Currents attribute, this value is the most recently measured harmonic current reading in
         * milliamps (mA). A positive value indicates that the measured harmonic current is positive, and a negative
         * value indicates that the measured harmonic current is negative.
         *
         * For the Harmonic Phases attribute, this value is the most recent phase of the given harmonic order
         *
         * in millidegrees (mDeg). A positive value indicates that the measured phase is leading, and a negative value
         * indicates that the measured phase is lagging.
         *
         * If this measurement is not currently available, a value of null shall be returned.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.3.2
         */
        measurement: TlvField(1, TlvNullable(TlvInt64.bound({ min: -262, max: 262 })))
    });

    /**
     * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.3
     */
    export interface HarmonicMeasurement extends TypeFromSchema<typeof TlvHarmonicMeasurement> { }

    /**
     * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.1
     */
    export enum PowerMode {
        Unknown = 0,

        /**
         * Direct current
         */
        Dc = 1,

        /**
         * Alternating current, either single-phase or polyphase
         */
        Ac = 2
    }

    /**
     * This struct shall indicate the maximum and minimum values of a given measurement type during a measurement
     * period, along with the observation times of these values.
     *
     * A server which does not have the ability to determine the time in UTC, or has not yet done so, shall use the
     * system time fields to specify the measurement period and observation times.
     *
     * A server which has determined the time in UTC shall use the timestamp fields to specify the measurement period
     * and observation times. Such a server may also include the systime fields to indicate how many seconds had passed
     * since boot for a given timestamp; this allows for client-side resolution of UTC time for previous reports that
     * only included systime.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.2
     */
    export const TlvMeasurementRange = TlvObject({
        /**
         * This field shall be the type of measurement for the range provided.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.2.1
         */
        measurementType: TlvField(0, TlvEnum<MeasurementType>()),

        /**
         * This field shall be the smallest measured value for the associated measurement over either the period
         * between StartTimestamp and EndTimestamp, or the period between StartSystime and EndSystime, or both.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.2.2
         */
        min: TlvField(1, TlvInt64.bound({ min: -262, max: 262 })),

        /**
         * This field shall be the largest measured value for the associated measurement over the period between either
         * StartTimestamp and EndTimestamp or the period between StartSystime and EndSystime, or both.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.2.3
         */
        max: TlvField(2, TlvInt64.bound({ min: -262, max: 262 })),

        /**
         * This field shall be the timestamp in UTC of the beginning of the measurement period.
         *
         * If the server had not yet determined the time in UTC at or before the beginning of the measurement period,
         * or does not have the capability of determining the time in UTC, this field shall be omitted.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.2.4
         */
        startTimestamp: TlvOptionalField(3, TlvEpochS),

        /**
         * This field shall be the timestamp in UTC of the end of the measurement period.
         *
         * If the server had not yet determined the time in UTC at or before the beginning of the measurement period,
         * or does not have the capability of determining the time in UTC, this field shall be omitted.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.2.5
         */
        endTimestamp: TlvOptionalField(4, TlvEpochS),

        /**
         * This field shall be the most recent timestamp in UTC that the value in the Min field was measured.
         *
         * This field shall be greater than or equal to the value of the StartTimestamp field. This field shall be less
         * than or equal to the value of the EndTimestamp field.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.2.6
         */
        minTimestamp: TlvOptionalField(5, TlvEpochS),

        /**
         * This field shall be the most recent timestamp in UTC of the value in the Max field. This field shall be
         * greater than or equal to the value of the StartTimestamp field. This field shall be less than or equal to
         * the value of the EndTimestamp field.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.2.7
         */
        maxTimestamp: TlvOptionalField(6, TlvEpochS),

        /**
         * This field shall be the time since boot of the beginning of the measurement period.
         *
         * If the server had determined the time in UTC at or before the start of the measurement period, this field
         * may be omitted along with the EndSystime, MinSystime, and MaxSystime fields.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.2.8
         */
        startSystime: TlvOptionalField(7, TlvSysTimeMS),

        /**
         * This field shall be the time since boot of the end of the measurement period.
         *
         * If the server had determined the time in UTC at the end of the measurement period, this field may be omitted
         * along with the StartSystime field, MinSystime, and MaxSystime fields.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.2.9
         */
        endSystime: TlvOptionalField(8, TlvSysTimeMS),

        /**
         * This field shall be the measurement time since boot of the value in the Min field was measured. This field
         * shall be greater than or equal to the value of the StartSystime field.
         *
         * This field shall be less than or equal to the value of the EndSystime field.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.2.10
         */
        minSystime: TlvOptionalField(9, TlvSysTimeMS),

        /**
         * This field shall be the measurement time since boot of the value in the Max field. This field shall be
         * greater than or equal to the value of the StartSystime field.
         *
         * This field shall be less than or equal to the value of the EndSystime field.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.2.11
         */
        maxSystime: TlvOptionalField(10, TlvSysTimeMS)
    });

    /**
     * This struct shall indicate the maximum and minimum values of a given measurement type during a measurement
     * period, along with the observation times of these values.
     *
     * A server which does not have the ability to determine the time in UTC, or has not yet done so, shall use the
     * system time fields to specify the measurement period and observation times.
     *
     * A server which has determined the time in UTC shall use the timestamp fields to specify the measurement period
     * and observation times. Such a server may also include the systime fields to indicate how many seconds had passed
     * since boot for a given timestamp; this allows for client-side resolution of UTC time for previous reports that
     * only included systime.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.13.5.2
     */
    export interface MeasurementRange extends TypeFromSchema<typeof TlvMeasurementRange> { }

    /**
     * Body of the ElectricalPowerMeasurement measurementPeriodRanges event
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.13.7.1
     */
    export const TlvMeasurementPeriodRangesEvent = TlvObject({
        /**
         * This shall indicate the value of the Ranges attribute at the time of event generation.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.7.1.1
         */
        ranges: TlvField(0, TlvArray(TlvMeasurementRange))
    });

    /**
     * Body of the ElectricalPowerMeasurement measurementPeriodRanges event
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.13.7.1
     */
    export interface MeasurementPeriodRangesEvent extends TypeFromSchema<typeof TlvMeasurementPeriodRangesEvent> { }

    /**
     * A ElectricalPowerMeasurementCluster supports these elements if it supports feature AlternatingCurrent.
     */
    export const AlternatingCurrentComponent = MutableCluster.Component({
        attributes: {
            /**
             * This shall indicate the most recent ReactiveCurrent reading in milliamps (mA).
             *
             * A positive value represents current flowing into the server, while a negative value represents current
             * flowing out of the server.
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * If the current cannot be measured, a value of null shall be returned.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.7
             */
            reactiveCurrent: OptionalAttribute(
                0x6,
                TlvNullable(TlvInt64.bound({ min: -262, max: 262 })),
                { default: null }
            ),

            /**
             * This shall indicate the most recent ApparentCurrent (square root sum of the squares of active and
             * reactive currents) reading in milliamps (mA).
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * If the active or reactive currents cannot be measured, a value of null shall be returned.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.8
             */
            apparentCurrent: OptionalAttribute(
                0x7,
                TlvNullable(TlvInt64.bound({ min: 0, max: 262 })),
                { default: null }
            ),

            /**
             * This shall indicate the most recent ReactivePower reading in millivolt-amps reactive (mVAR). A positive
             * value represents power imported, while a negative value represents power exported.
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * If the reactive power cannot be measured, a value of null shall be returned.
             *
             * If the Polyphase Power feature is supported, this value represents the combined reactive power imported
             * or exported.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.10
             */
            reactivePower: OptionalAttribute(
                0x9,
                TlvNullable(TlvInt64.bound({ min: -262, max: 262 })),
                { default: null }
            ),

            /**
             * This shall indicate the most recent ApparentPower reading in millivolt-amps (mVA).
             *
             * A positive value represents power imported, while a negative value represents power exported.
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * If the apparent power cannot be measured, a value of null shall be returned.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.11
             */
            apparentPower: OptionalAttribute(
                0xa,
                TlvNullable(TlvInt64.bound({ min: -262, max: 262 })),
                { default: null }
            ),

            /**
             * This shall indicate the most recent RMSVoltage reading in millivolts (mV).
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * If the RMS voltage cannot be measured, a value of null shall be returned.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.12
             */
            rmsVoltage: OptionalAttribute(0xb, TlvNullable(TlvInt64.bound({ min: -262, max: 262 })), { default: null }),

            /**
             * This shall indicate the most recent RMSCurrent reading in milliamps (mA).
             *
             * A positive value represents current flowing into the server, while a negative value represents current
             * flowing out of the server.
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * If the RMS current cannot be measured, a value of null shall be returned.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.13
             */
            rmsCurrent: OptionalAttribute(0xc, TlvNullable(TlvInt64.bound({ min: -262, max: 262 })), { default: null }),

            /**
             * This shall indicate the most recent RMSPower reading in milliwatts (mW).
             *
             * A positive value represents power imported, while a negative value represents power exported.
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * If the RMS power cannot be measured, a value of null shall be returned.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.14
             */
            rmsPower: OptionalAttribute(0xd, TlvNullable(TlvInt64.bound({ min: -262, max: 262 })), { default: null }),

            /**
             * This shall indicate the most recent Frequency reading in millihertz (mHz).
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * If the frequency cannot be measured, a value of null shall be returned.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.15
             */
            frequency: OptionalAttribute(0xe, TlvNullable(TlvInt64.bound({ min: 0, max: 1000000 })), { default: null }),

            /**
             * This shall indicate the Power Factor ratio in +/- 1/100ths of a percent.
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.18
             */
            powerFactor: OptionalAttribute(
                0x11,
                TlvNullable(TlvInt64.bound({ min: -10000, max: 10000 })),
                { default: null }
            )
        }
    });

    /**
     * A ElectricalPowerMeasurementCluster supports these elements if it supports feature Harmonics.
     */
    export const HarmonicsComponent = MutableCluster.Component({
        attributes: {
            /**
             * This shall indicate a list of HarmonicMeasurementStruct values, with each HarmonicMeasurementStruct
             * representing the harmonic current reading for the harmonic order specified by Order.
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.16
             */
            harmonicCurrents: Attribute(0xf, TlvNullable(TlvArray(TlvHarmonicMeasurement)), { default: null })
        }
    });

    /**
     * A ElectricalPowerMeasurementCluster supports these elements if it supports feature PowerQuality.
     */
    export const PowerQualityComponent = MutableCluster.Component({
        attributes: {
            /**
             * This shall indicate a list of HarmonicMeasurementStruct values, with each HarmonicMeasurementStruct
             * representing the most recent phase of the harmonic current reading for the harmonic
             *
             * order specified by Order.
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.17
             */
            harmonicPhases: Attribute(0x10, TlvNullable(TlvArray(TlvHarmonicMeasurement)), { default: null })
        }
    });

    /**
     * A ElectricalPowerMeasurementCluster supports these elements if it supports feature PolyphasePower.
     */
    export const PolyphasePowerComponent = MutableCluster.Component({
        attributes: {
            /**
             * This shall indicate the most recent NeutralCurrent reading in milliamps (mA). Typically this is a
             * derived value, taking the magnitude of the vector sum of phase currents.
             *
             * If the neutral current cannot be measured or derived, a value of null shall be returned.
             *
             * A positive value represents an imbalance between the phase currents when power is imported. A negative
             * value represents an imbalance between the phase currents when power is exported.
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.19
             */
            neutralCurrent: OptionalAttribute(
                0x12,
                TlvNullable(TlvInt64.bound({ min: -262, max: 262 })),
                { default: null }
            )
        }
    });

    /**
     * These are optional features supported by ElectricalPowerMeasurementCluster.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.13.4
     */
    export enum Feature {
        /**
         * DirectCurrent
         *
         * This feature indicates the cluster can measure a direct current.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.4.1
         */
        DirectCurrent = "DirectCurrent",

        /**
         * AlternatingCurrent
         *
         * This feature indicates the cluster can measure an alternating current.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.4.2
         */
        AlternatingCurrent = "AlternatingCurrent",

        /**
         * PolyphasePower
         *
         * This feature indicates the cluster represents the collective measurements for a Polyphase power supply.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.4.3
         */
        PolyphasePower = "PolyphasePower",

        /**
         * Harmonics
         *
         * This feature indicates the cluster can measure the harmonics of an alternating current.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.4.4
         */
        Harmonics = "Harmonics",

        /**
         * PowerQuality
         *
         * This feature indicates the cluster can measure the harmonic phases of an alternating current.
         *
         * @see {@link MatterSpecification.v13.Cluster} § 2.13.4.5
         */
        PowerQuality = "PowerQuality"
    }

    /**
     * These elements and properties are present in all ElectricalPowerMeasurement clusters.
     */
    export const Base = MutableCluster.Component({
        id: 0x90,
        name: "ElectricalPowerMeasurement",
        revision: 1,

        features: {
            /**
             * DirectCurrent
             *
             * This feature indicates the cluster can measure a direct current.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.4.1
             */
            directCurrent: BitFlag(0),

            /**
             * AlternatingCurrent
             *
             * This feature indicates the cluster can measure an alternating current.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.4.2
             */
            alternatingCurrent: BitFlag(1),

            /**
             * PolyphasePower
             *
             * This feature indicates the cluster represents the collective measurements for a Polyphase power supply.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.4.3
             */
            polyphasePower: BitFlag(2),

            /**
             * Harmonics
             *
             * This feature indicates the cluster can measure the harmonics of an alternating current.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.4.4
             */
            harmonics: BitFlag(3),

            /**
             * PowerQuality
             *
             * This feature indicates the cluster can measure the harmonic phases of an alternating current.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.4.5
             */
            powerQuality: BitFlag(4)
        },

        attributes: {
            /**
             * This shall indicate the current mode of the server. For some servers, such as an EV, this may change
             * depending on the mode of charging or discharging.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.1
             */
            powerMode: Attribute(0x0, TlvEnum<PowerMode>()),

            /**
             * This shall indicate the maximum number of measurement types the server is capable of reporting.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.2
             */
            numberOfMeasurementTypes: FixedAttribute(0x1, TlvUInt8.bound({ min: 1 })),

            /**
             * This shall indicate a list of accuracy specifications for the measurement types supported by the server.
             * There shall be an entry for ActivePower, as well as any other measurement types implemented by this
             * server.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.3
             */
            accuracy: FixedAttribute(0x2, TlvArray(TlvMeasurementAccuracy, { minLength: 1 })),

            /**
             * This shall indicate a list of measured ranges for different measurement types. Each measurement type
             * shall have at most one entry in this list, representing the range of measurements in the most recent
             * measurement period.
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.4
             */
            ranges: OptionalAttribute(0x3, TlvArray(TlvMeasurementRange, { minLength: 0 }), { default: [] }),

            /**
             * This shall indicate the most recent Voltage reading in millivolts (mV).
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * If the voltage cannot be measured, a value of null shall be returned.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.5
             */
            voltage: OptionalAttribute(0x4, TlvNullable(TlvInt64.bound({ min: -262, max: 262 })), { default: null }),

            /**
             * This shall indicate the most recent ActiveCurrent reading in milliamps (mA).
             *
             * A positive value represents current flowing into the server, while a negative value represents current
             * flowing out of the server.
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * If the current cannot be measured, a value of null shall be returned.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.6
             */
            activeCurrent: OptionalAttribute(
                0x5,
                TlvNullable(TlvInt64.bound({ min: -262, max: 262 })),
                { default: null }
            ),

            /**
             * This shall indicate the most recent ActivePower reading in milliwatts (mW). If the power cannot be
             * measured, a value of null shall be returned.
             *
             * A positive value represents power imported, while a negative value represents power exported.
             *
             * The reporting interval of this attribute shall be manufacturer dependent. The server may choose to omit
             * publication of deltas considered not meaningful.
             *
             * The server shall NOT mark this attribute ready for report if the last time this was done was more
             * recently than 1 second ago.
             *
             * The server may delay marking this attribute ready for report for longer periods if needed, however the
             * server shall NOT delay marking this attribute as ready for report for longer than 60 seconds.
             *
             * If the Polyphase Power feature is set, this value represents the combined active power imported or
             * exported.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.6.9
             */
            activePower: Attribute(0x8, TlvNullable(TlvInt64.bound({ min: -262, max: 262 })), { default: null })
        },

        events: {
            /**
             * If supported, this event shall be generated at the end of a measurement period. The start and end times
             * for measurement periods shall be determined by the server, and may represent overlapping periods.
             *
             * @see {@link MatterSpecification.v13.Cluster} § 2.13.7.1
             */
            measurementPeriodRanges: OptionalEvent(0x0, EventPriority.Info, TlvMeasurementPeriodRangesEvent)
        },

        /**
         * This metadata controls which ElectricalPowerMeasurementCluster elements matter.js activates for specific
         * feature combinations.
         */
        extensions: MutableCluster.Extensions(
            { flags: { alternatingCurrent: true }, component: AlternatingCurrentComponent },
            { flags: { harmonics: true }, component: HarmonicsComponent },
            { flags: { powerQuality: true }, component: PowerQualityComponent },
            { flags: { polyphasePower: true }, component: PolyphasePowerComponent },
            { flags: { polyphasePower: true, alternatingCurrent: false }, component: false },
            { flags: { harmonics: true, alternatingCurrent: false }, component: false },
            { flags: { powerQuality: true, alternatingCurrent: false }, component: false },
            { flags: { directCurrent: false, alternatingCurrent: false }, component: false }
        )
    });

    /**
     * @see {@link Cluster}
     */
    export const ClusterInstance = MutableCluster.ExtensibleOnly(Base);

    /**
     * This cluster provides a mechanism for querying data about electrical power as measured by the server.
     *
     * Per the Matter specification you cannot use {@link ElectricalPowerMeasurementCluster} without enabling certain
     * feature combinations. You must use the {@link with} factory method to obtain a working cluster.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.13
     */
    export interface Cluster extends Identity<typeof ClusterInstance> { }

    export const Cluster: Cluster = ClusterInstance;
    const ALTC = { alternatingCurrent: true };
    const HARM = { harmonics: true };
    const PWRQ = { powerQuality: true };
    const POLY = { polyphasePower: true };

    /**
     * @see {@link Complete}
     */
    export const CompleteInstance = MutableCluster({
        id: Base.id,
        name: Base.name,
        revision: Base.revision,
        features: Base.features,

        attributes: {
            ...Base.attributes,
            reactiveCurrent: MutableCluster.AsConditional(
                AlternatingCurrentComponent.attributes.reactiveCurrent,
                { optionalIf: [ALTC] }
            ),
            apparentCurrent: MutableCluster.AsConditional(
                AlternatingCurrentComponent.attributes.apparentCurrent,
                { optionalIf: [ALTC] }
            ),
            reactivePower: MutableCluster.AsConditional(
                AlternatingCurrentComponent.attributes.reactivePower,
                { optionalIf: [ALTC] }
            ),
            apparentPower: MutableCluster.AsConditional(
                AlternatingCurrentComponent.attributes.apparentPower,
                { optionalIf: [ALTC] }
            ),
            rmsVoltage: MutableCluster.AsConditional(
                AlternatingCurrentComponent.attributes.rmsVoltage,
                { optionalIf: [ALTC] }
            ),
            rmsCurrent: MutableCluster.AsConditional(
                AlternatingCurrentComponent.attributes.rmsCurrent,
                { optionalIf: [ALTC] }
            ),
            rmsPower: MutableCluster.AsConditional(
                AlternatingCurrentComponent.attributes.rmsPower,
                { optionalIf: [ALTC] }
            ),
            frequency: MutableCluster.AsConditional(
                AlternatingCurrentComponent.attributes.frequency,
                { optionalIf: [ALTC] }
            ),
            harmonicCurrents: MutableCluster.AsConditional(
                HarmonicsComponent.attributes.harmonicCurrents,
                { mandatoryIf: [HARM] }
            ),
            harmonicPhases: MutableCluster.AsConditional(
                PowerQualityComponent.attributes.harmonicPhases,
                { mandatoryIf: [PWRQ] }
            ),
            powerFactor: MutableCluster.AsConditional(
                AlternatingCurrentComponent.attributes.powerFactor,
                { optionalIf: [ALTC] }
            ),
            neutralCurrent: MutableCluster.AsConditional(
                PolyphasePowerComponent.attributes.neutralCurrent,
                { optionalIf: [POLY] }
            )
        },

        events: Base.events
    });

    /**
     * This cluster supports all ElectricalPowerMeasurement features. It may support illegal feature combinations.
     *
     * If you use this cluster you must manually specify which features are active and ensure the set of active
     * features is legal per the Matter specification.
     */
    export interface Complete extends Identity<typeof CompleteInstance> { }

    export const Complete: Complete = CompleteInstance;
}

export type ElectricalPowerMeasurementCluster = ElectricalPowerMeasurement.Cluster;
export const ElectricalPowerMeasurementCluster = ElectricalPowerMeasurement.Cluster;
ClusterRegistry.register(ElectricalPowerMeasurement.Complete);
