/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/*** THIS FILE IS GENERATED, DO NOT EDIT ***/

/**
 * @see {@link MatterSpecification.v13.Cluster} § 2.1.4.2
 */
export enum MeasurementType {
    Unspecified = 0,

    /**
     * Voltage in millivolts (mV)
     */
    Voltage = 1,

    /**
     * Active current in milliamps (mA)
     */
    ActiveCurrent = 2,

    /**
     * Reactive current in milliamps (mA)
     */
    ReactiveCurrent = 3,

    /**
     * Apparent current in milliamps (mA)
     */
    ApparentCurrent = 4,

    /**
     * Active power in milliwatts (mW)
     */
    ActivePower = 5,

    /**
     * Reactive power in millivolt-amps reactive (mVAR)
     */
    ReactivePower = 6,

    /**
     * Apparent power in millivolt-amps (mVA)
     */
    ApparentPower = 7,

    /**
     * Root mean squared voltage in millivolts (mV)
     */
    RmsVoltage = 8,

    /**
     * Root mean squared current in milliamps (mA)
     */
    RmsCurrent = 9,

    /**
     * Root mean squared power in milliwatts (mW)
     */
    RmsPower = 10,

    /**
     * AC frequency in millihertz (mHz)
     */
    Frequency = 11,

    /**
     * Power Factor ratio in+/- 1/100ths of a percent.
     */
    PowerFactor = 12,

    /**
     * AC neutral current in milliamps (mA)
     */
    NeutralCurrent = 13,

    /**
     * Electrical energy in milliwatt-hours (mWh)
     */
    ElectricalEnergy = 14
}
