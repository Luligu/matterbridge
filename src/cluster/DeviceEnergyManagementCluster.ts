/* eslint-disable @typescript-eslint/no-namespace */
/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/** * THIS FILE IS GENERATED, DO NOT EDIT ***/

import { ClusterRegistry, Command, EventPriority, FixedAttribute, MutableCluster, TlvNoResponse } from '@project-chip/matter-node.js/cluster';
import { Attribute, Event } from '@project-chip/matter-node.js/cluster';
import { BitFlag } from '@project-chip/matter-node.js/schema';
import { TlvObject, TlvField, TlvEpochS, TypeFromSchema, TlvEnum, TlvBoolean, TlvNoArguments, TlvInt64, TlvUInt32, TlvInt32, TlvUInt8, TlvOptionalField, TlvUInt16, TlvArray, TlvNullable, TlvInt8 } from '@project-chip/matter-node.js/tlv';
import { Identity } from '@project-chip/matter-node.js/util';

export namespace DeviceEnergyManagement {
  /**
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.9
   */
  export const TlvPowerAdjust = TlvObject({
    /**
     * This field shall indicate the minimum power that the ESA can have its power adjusted to.
     *
     * Note that this is a signed value. Negative values indicate power flows away from loads (e.g. charging a
     * battery inverter).
     *
     * MinPower shall be less than MaxPower.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.9.1
     */
    minPower: TlvField(0, TlvInt64),

    /**
     * This field shall indicate the maximum power that the ESA can have its power adjusted to.
     *
     * Note that this is a signed value. Negative values indicate power flows away from loads (e.g. charging a
     * battery inverter).
     *
     * MinPower shall be less than MaxPower.
     *
     * For example, if the charging current of an EVSE can be adjusted within the range of 6A to 32A on a 230V
     * supply, then the power adjustment range is between 1380W and 7360W. Here the MinPower would be 1380W, and
     * MaxPower would be 7360W.
     *
     * For example, if a battery storage inverter can discharge between 0 to 3000W towards a load, then its
     * MinPower would be 0W and its MaxPower would be 3000W.
     *
     * In another example, if a battery storage inverter can charge its internal battery, between 0W and 2000W.
     * Here power is flowing away from the home loads, so the power values need to be negative. As such the
     * MinPower becomes -2000W and MaxPower becomes 0W.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.9.2
     */
    maxPower: TlvField(1, TlvInt64),

    /**
     * This field shall indicate the minimum duration, in seconds, that a controller may invoke an ESA power
     * adjustment. Manufacturers may use this to as an anti-cycling capability to avoid controllers from rapidly
     * making power adjustments.
     *
     * Note that MinDuration shall be less than MaxDuration.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.9.3
     */
    minDuration: TlvField(2, TlvUInt32),

    /**
     * This field shall indicate the maximum duration, in seconds, that a controller may invoke an ESA power
     * adjustment. Manufacturers may use this to protect the user experience, to avoid over heating of the ESA,
     * ensuring that there is sufficient headroom to use or store energy in the ESA or for any other reason.
     *
     * Note that MinDuration shall be less than MaxDuration.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.9.4
     */
    maxDuration: TlvField(3, TlvUInt32),
  });

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.9
   */
  export type PowerAdjust = TypeFromSchema<typeof TlvPowerAdjust>;

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.6
   */
  export enum AdjustmentCause {
    /**
     * The adjustment is to optimize the local energy usage
     */
    LocalOptimization = 0,

    /**
     * The adjustment is to optimize the grid energy usage
     */
    GridOptimization = 1,
  }

  /**
   * Input to the DeviceEnergyManagement powerAdjustRequest command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.1
   */
  export const TlvPowerAdjustRequest = TlvObject({
    /**
     * This field shall indicate the power that the ESA shall use during the adjustment period.
     *
     * This value shall be between the MinPower and MaxPower fields of the PowerAdjustStruct in the
     * PowerAdjustmentCapability attribute.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.1.1
     */
    power: TlvField(0, TlvInt64),

    /**
     * This field shall indicate the duration that the ESA shall maintain the requested power for.
     *
     * This value shall be between the MinDuration and MaxDuration fields of the PowerAdjustStruct in the
     * PowerAdjustmentCapability attribute.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.1.2
     */
    duration: TlvField(1, TlvUInt32),

    /**
     * This field shall indicate the cause of the request from the EMS.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.1.3
     */
    cause: TlvField(2, TlvEnum<AdjustmentCause>()),
  });

  /**
   * Input to the DeviceEnergyManagement powerAdjustRequest command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.1
   */
  export type PowerAdjustRequest = TypeFromSchema<typeof TlvPowerAdjustRequest>;

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.5
   */
  export enum Cause {
    /**
     * The ESA completed the power adjustment as requested
     */
    NormalCompletion = 0,

    /**
     * The ESA was set to offline
     */
    Offline = 1,

    /**
     * The ESA has developed a fault could not complete the adjustment
     */
    Fault = 2,

    /**
     * The user has disabled the ESA’s flexibility capability
     */
    UserOptOut = 3,

    /**
     * The adjustment was cancelled by a client
     */
    Cancelled = 4,
  }

  /**
   * Body of the DeviceEnergyManagement powerAdjustEnd event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.10.2
   */
  export const TlvPowerAdjustEndEvent = TlvObject({
    /**
     * This field shall indicate the reason why the power adjustment session ended.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.10.2.1
     */
    cause: TlvField(0, TlvEnum<Cause>()),

    /**
     * This field shall indicate the number of seconds that the power adjustment session lasted before ending.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.10.2.2
     */
    duration: TlvField(1, TlvUInt32),

    /**
     * This field shall indicate the approximate energy used by the ESA during the session.
     *
     * For example, if the ESA was on and was adjusted to be switched off, then this shall be 0W. If this was a
     * battery inverter that was requested to charge it would have a negative energy use. If this was a normal load
     * that was turned on, then it will have positive value.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.10.2.3
     */
    energyUse: TlvField(2, TlvInt64),
  });

  /**
   * Body of the DeviceEnergyManagement powerAdjustEnd event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.10.2
   */
  export type PowerAdjustEndEvent = TypeFromSchema<typeof TlvPowerAdjustEndEvent>;

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.1
   */
  export enum CostType {
    /**
     * Financial cost
     *
     * This value shall indicate that the cost is related to the financial cost to provide the energy.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.1.1
     */
    Financial = 0,

    /**
     * Grid CO2e grams cost
     *
     * This value shall indicate that the cost is related to greenhouse gas emissions (in grams of CO2e).
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.1.2
     */
    GhgEmissions = 1,

    /**
     * Consumer comfort impact cost
     *
     * This value shall indicate that the cost is related to some abstract sense of comfort expressed by the
     * consumer; a higher value indicates more discomfort. For example, a consumer may be more comfortable knowing
     * that their EV is charged earlier in the day in case there is a sudden need to depart and drive to the
     * hospital. Or the consumer may feel inconvenienced by the fact that they need to wait for the washing machine
     * to finish its load so that they can use it again.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.1.3
     */
    Comfort = 2,

    /**
     * Temperature impact cost
     *
     * This value shall indicate that the cost is related to the temperature of the home or water being at its
     * setpoint. Some consumers may be more sensitive to being too hot or too cold.
     *
     * This is expressed in degrees Celsius.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.1.4
     */
    Temperature = 3,
  }

  /**
   * This indicates a generic mechanism for expressing cost to run an appliance, in terms of financial, GHG
   * emissions, comfort value etc.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.8
   */
  export const TlvCost = TlvObject({
    /**
     * This field shall indicate the type of cost being represented (see CostTypeEnum).
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.8.1
     */
    costType: TlvField(0, TlvEnum<CostType>()),

    /**
     * This field shall indicate the value of the cost. This may be negative (indicating that it is not a cost, but
     * a free benefit).
     *
     * For example, if the Value was -302 and DecimalPoints was 2, then this would represent a benefit of 3.02.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.8.2
     */
    value: TlvField(1, TlvInt32),

    /**
     * This field shall indicate the number of digits to the right of the decimal point in the Value field. For
     * example, if the Value was 102 and DecimalPoints was 2, then this would represent a cost of 1.02.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.8.3
     */
    decimalPoints: TlvField(2, TlvUInt8),

    /**
     * Indicates the currency for the value in the Value field. The value of the currency field shall match the
     * values defined by [ISO 4217].
     *
     * This is an optional field. It shall be included if CostType is Financial.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.8.4
     */
    currency: TlvOptionalField(3, TlvUInt16.bound({ max: 999 })),
  });

  /**
   * This indicates a generic mechanism for expressing cost to run an appliance, in terms of financial, GHG
   * emissions, comfort value etc.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.8
   */
  export type Cost = TypeFromSchema<typeof TlvCost>;

  /**
   * This indicates a specific stage of an ESA’s operation.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11
   */
  export const TlvSlot = TlvObject({
    /**
     * This field shall indicate the minimum time (in seconds) that the appliance expects to be in this slot for.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.1
     */
    minDuration: TlvField(0, TlvUInt32),

    /**
     * This field shall indicate the maximum time (in seconds) that the appliance expects to be in this slot for.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.2
     */
    maxDuration: TlvField(1, TlvUInt32),

    /**
     * This field shall indicate the expected time (in seconds) that the appliance expects to be in this slot for.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.3
     */
    defaultDuration: TlvField(2, TlvUInt32),

    /**
     * This field shall indicate the time (in seconds) that has already elapsed whilst in this slot. If the slot
     * has not yet been started, then it shall be 0. Once the slot has been completed, then this reflects how much
     * time was spent in this slot.
     *
     * When subscribed to, a change in this field value shall NOT cause the Forecast attribute to be updated since
     * this value may change every 1 second.
     *
     * When the Forecast attribute is read, then this value shall be the most recent value.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.4
     */
    elapsedSlotTime: TlvField(3, TlvUInt32),

    /**
     * This field shall indicate the time (in seconds) that is estimated to be remaining.
     *
     * Note that it may not align to the DefaultDuration - ElapsedSlotTime since an appliance may have revised its
     * planned operation based on conditions.
     *
     * When subscribed to, a change in this field value shall NOT cause the Forecast attribute to be updated, since
     * this value may change every 1 second.
     *
     * Note that if the ESA is currently paused, then this value shall not change.
     *
     * When the Forecast attribute is read, then this value shall be the most recent value.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.5
     */
    remainingSlotTime: TlvField(4, TlvUInt32),

    slotIsPauseable: TlvOptionalField(5, TlvBoolean),

    /**
     * This field shall indicate the shortest period that the slot can be paused for. This can be set to avoid
     * controllers trying to pause ESAs for short periods and then resuming operation in a cyclic fashion which may
     * damage or cause excess energy to be consumed with restarting of an operation.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.7
     */
    minPauseDuration: TlvOptionalField(6, TlvUInt32),

    /**
     * This field shall indicate the longest period that the slot can be paused for.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.8
     */
    maxPauseDuration: TlvOptionalField(7, TlvUInt32),

    /**
     * This field shall indicate a manufacturer defined value indicating the state of the ESA.
     *
     * This may be used by an observing EMS which also has access to the metering data to ascertain the typical
     * power drawn when the ESA is in a manufacturer defined state.
     *
     * Some appliances, such as smart thermostats, may not know how much power is being drawn by the HVAC system,
     * but do know what they have asked the HVAC system to do.
     *
     * Manufacturers can use this value to indicate a variety of states in an unspecified way. For example, they
     * may choose to use values between 0-100 as a percentage of compressor modulation, or could use these values
     * as Enum states meaning heating with fan, heating without fan etc.
     *
     * NOTE An ESA shall always use the same value to represent the same operating state.
     *
     * By providing this information a smart EMS may be able to learn the observed power draw when the ESA is put
     * into a specific state. It can potentially then use the information in the PowerForecastReporting data to
     * predict the power draw from the appliance and potentially ask it to modify its timing via one of the
     * adjustment request commands, or adjust other ESAs power to compensate.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.9
     */
    manufacturerEsaState: TlvOptionalField(8, TlvUInt16),

    /**
     * This field shall indicate the expected power that the appliance will use during this slot. It may be
     * considered the average value over the slot, and some variation from this would be expected (for example, as
     * it is ramping up).
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.10
     */
    nominalPower: TlvOptionalField(9, TlvInt64),

    /**
     * This field shall indicate the lowest power that the appliance expects to use during this slot. (e.g. during
     * a ramp up it may be 0W).
     *
     * Some appliances (e.g. battery inverters which can charge and discharge) may have a negative power.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.11
     */
    minPower: TlvOptionalField(10, TlvInt64),

    /**
     * This field shall indicate the maximum power that the appliance expects to use during this slot. (e.g. during
     * a ramp up it may be 0W). This field ignores the effects of short-lived inrush currents.
     *
     * Some appliances (e.g. battery inverters which can charge and discharge) may have a negative power.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.12
     */
    maxPower: TlvOptionalField(11, TlvInt64),

    /**
     * This field shall indicate the expected energy that the appliance expects to use or produce during this slot.
     *
     * Some appliances (e.g. battery inverters which can charge and discharge) may have a negative energy.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.13
     */
    nominalEnergy: TlvOptionalField(12, TlvInt64),

    /**
     * This field shall indicate the current estimated cost for operating.
     *
     * For example, if the device has access to an Energy pricing server it may be able to use the tariff to
     * estimate the cost of energy for this slot in the power forecast.
     *
     * When an Energy Management System requests a change in the schedule, then the device may suggest a change in
     * the cost as a result of shifting its energy. This can allow a demand side response service to be informed of
     * the relative cost to use energy at a different time.
     *
     * The Costs field is a list of CostStruct structures which allows multiple CostTypeEnum and Values to be
     * shared by the energy appliance. These could be based on GHG emissions, comfort value for the consumer etc.
     *
     * For example, comfort could be expressed in abstract units or in currency. A water heater that is heated
     * earlier in the day is likely to lose some of its heat before it is needed, which could require a top-up
     * heating event to occur later in the day (which may incur additional cost).
     *
     * If the ESA cannot calculate its cost for any reason (such as losing its connection to a Price server) it may
     * omit this field. This is treated as extra meta data that an EMS may use to optimize a system.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.14
     */
    costs: TlvOptionalField(13, TlvArray(TlvCost, { maxLength: 5 })),

    /**
     * This field shall indicate the minimum power that the appliance can be requested to use.
     *
     * For example, some EVSEs cannot be switched on to charge below 6A which may equate to ~1.3kW in EU markets.
     * If the slot indicates a NominalPower of 0W (indicating it is expecting to be off), this allows an ESA to
     * indicate it could be switched on to charge, but this would be the minimum power limit it can be set to.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.15
     */
    minPowerAdjustment: TlvOptionalField(14, TlvInt64),

    /**
     * This field shall indicate the maximum power that the appliance can be requested to use.
     *
     * For example, an EVSE may be limited by its electrical supply to 32A which would be ~7.6kW in EU markets. If
     * the slot indicates a NominalPower of 0W (indicating it is expecting to be off), this allows an ESA to
     * indicate it could be switched on to charge, but this would be the maximum power limit it can be set to.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.16
     */
    maxPowerAdjustment: TlvOptionalField(15, TlvInt64),

    /**
     * This field shall indicate the minimum time, in seconds, that the slot can be requested to shortened to.
     *
     * For example, if the slot indicates a NominalPower of 0W (indicating it is expecting to be off), this would
     * allow an ESA to specify the minimum time it could be switched on for. This is to help protect the appliance
     * from being damaged by short cycling times.
     *
     * For example, a heat pump compressor may have a minimum cycle time of order a few minutes.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.17
     */
    minDurationAdjustment: TlvOptionalField(16, TlvUInt32),

    /**
     * This field shall indicate the maximum time, in seconds, that the slot can be requested to extended to.
     *
     * For example, if the slot indicates a NominalPower of 0W (indicating it is expecting to be off), this allows
     * an ESA to specify the maximum time it could be switched on for. This may allow a battery or water heater to
     * indicate the maximum duration that it can charge for before becoming full. In the case of a battery inverter
     * which can be discharged, it may equally indicate the maximum time the battery could be discharged for (at
     * the MaxPowerAdjustment power level).
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11.18
     */
    maxDurationAdjustment: TlvOptionalField(17, TlvUInt32),
  });

  /**
   * This indicates a specific stage of an ESA’s operation.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.11
   */
  export type Slot = TypeFromSchema<typeof TlvSlot>;

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.7
   */
  export enum ForecastUpdateReason {
    /**
     * The update was due to internal ESA device optimization
     */
    InternalOptimization = 0,

    /**
     * The update was due to local EMS optimization
     */
    LocalOptimization = 1,

    /**
     * The update was due to grid optimization
     */
    GridOptimization = 2,
  }

  /**
   * This indicates a list of 'slots' describing the overall timing of the ESA’s planned energy and power use, with
   * different power and energy demands per slot. For example, slots might be used to describe the distinct stages of
   * a washing machine cycle.
   *
   * Where an ESA does not know the actual power and energy use of the system, it may support the SFR
   *
   * feature and instead report its internal state.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.10
   */
  export const TlvForecast = TlvObject({
    /**
     * This field shall indicate the sequence number for the current forecast. If the ESA updates a forecast, it
     * shall monotonically increase this value.
     *
     * The ESA does not need to persist this value across reboots, since the EMS SHOULD be able to detect that any
     * previous subscriptions are lost if a device reboots. The loss of a subscription and subsequent
     * re-subscription allows the EMS to learn about any new forecasts.
     *
     * The value of ForecastId is allowed to wrap.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.10.1
     */
    forecastId: TlvField(0, TlvUInt16),

    /**
     * This field shall indicate which element of the Slots list is currently active in the Forecast sequence. A
     * null value indicates that the sequence has not yet started.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.10.2
     */
    activeSlotNumber: TlvField(1, TlvNullable(TlvUInt16)),

    /**
     * This field shall indicate the planned start time, in UTC, for the entire Forecast.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.10.3
     */
    startTime: TlvField(2, TlvEpochS),

    /**
     * This field shall indicate the planned end time, in UTC, for the entire Forecast.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.10.4
     */
    endTime: TlvField(3, TlvEpochS),

    /**
     * This field shall indicate the earliest start time, in UTC, that the entire Forecast can be shifted to.
     *
     * A null value indicates that it can be started immediately.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.10.5
     */
    earliestStartTime: TlvOptionalField(4, TlvNullable(TlvEpochS)),

    /**
     * This field shall indicate the latest end time, in UTC, for the entire Forecast.
     *
     * e.g. for an EVSE charging session, this may indicate the departure time for the vehicle, by which time the
     * charging session must end.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.10.6
     */
    latestEndTime: TlvOptionalField(5, TlvEpochS),

    /**
     * This field shall indicate that some part of the Forecast can be paused. It aims to allow a client to read
     * this flag and if it is false, then none of the slots contain SlotIsPausable set to true. This can save a
     * client from having to check each slot in the list.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.10.7
     */
    isPauseable: TlvField(6, TlvBoolean),

    /**
     * This field shall contain a list of SlotStructs.
     *
     * It shall contain at least 1 entry, and a maximum of 10.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.10.8
     */
    slots: TlvField(7, TlvArray(TlvSlot, { maxLength: 10 })),

    /**
     * This field shall contain the reason the current Forecast was generated.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.10.9
     */
    forecastUpdateReason: TlvField(8, TlvEnum<ForecastUpdateReason>()),
  });

  /**
   * This indicates a list of 'slots' describing the overall timing of the ESA’s planned energy and power use, with
   * different power and energy demands per slot. For example, slots might be used to describe the distinct stages of
   * a washing machine cycle.
   *
   * Where an ESA does not know the actual power and energy use of the system, it may support the SFR
   *
   * feature and instead report its internal state.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.10
   */
  export type Forecast = TypeFromSchema<typeof TlvForecast>;

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.4
   */
  export enum OptOutState {
    /**
     * The user has not opted out of either local or grid optimizations
     */
    NoOptOut = 0,

    /**
     * The user has opted out of local EMS optimizations only
     */
    LocalOptOut = 1,

    /**
     * The user has opted out of grid EMS optimizations only
     */
    GridOptOut = 2,

    /**
     * The user has opted out of all external optimizations
     */
    OptOut = 3,
  }

  /**
   * Input to the DeviceEnergyManagement pauseRequest command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.4
   */
  export const TlvPauseRequest = TlvObject({
    /**
     * This field shall indicate the duration that the ESA shall be paused for. This value shall be between the
     * MinPauseDuration and MaxPauseDuration indicated in the ActiveSlotNumber index in the Slots list in the
     * Forecast.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.4.1
     */
    duration: TlvField(0, TlvUInt32),

    /**
     * This field shall indicate the cause of the request from the EMS.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.4.2
     */
    cause: TlvField(1, TlvEnum<AdjustmentCause>()),
  });

  /**
   * Input to the DeviceEnergyManagement pauseRequest command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.4
   */
  export type PauseRequest = TypeFromSchema<typeof TlvPauseRequest>;

  /**
   * Body of the DeviceEnergyManagement resumed event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.10.4
   */
  export const TlvResumedEvent = TlvObject({
    /**
     * This field shall indicate the reason why the pause ended.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.10.4.1
     */
    cause: TlvField(0, TlvEnum<Cause>()),
  });

  /**
   * Body of the DeviceEnergyManagement resumed event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.10.4
   */
  export type ResumedEvent = TypeFromSchema<typeof TlvResumedEvent>;

  /**
   * Input to the DeviceEnergyManagement startTimeAdjustRequest command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.3
   */
  export const TlvStartTimeAdjustRequest = TlvObject({
    /**
     * This field shall indicate the requested start time, in UTC, that the client would like the appliance to
     * shift its Forecast to. This value MUST be in the future.
     *
     * A client can estimate the entire Forecast sequence duration by computing the EndTime - StartTime fields from
     * the Forecast attribute, and therefore avoid scheduling the start time too late.
     *
     * This value shall be after the EarliestStartTime in the Forecast attribute. The new EndTime, that can be
     * computed from the RequestedStartTime and the Forecast sequence duration, shall be before the LatestEndTime.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.3.1
     */
    requestedStartTime: TlvField(0, TlvEpochS),

    /**
     * This field shall indicate the cause of the request from the EMS.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.3.2
     */
    cause: TlvField(1, TlvEnum<AdjustmentCause>()),
  });

  /**
   * Input to the DeviceEnergyManagement startTimeAdjustRequest command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.3
   */
  export type StartTimeAdjustRequest = TypeFromSchema<typeof TlvStartTimeAdjustRequest>;

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.12
   */
  export const TlvSlotAdjustment = TlvObject({
    /**
     * This field shall indicate the index into the Slots list within the Forecast that is to be modified. It shall
     * be less than the actual length of the Slots list (implicitly it must be in the range 0 to 9 based on the
     * maximum length of the Slots list constraint).
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.12.1
     */
    slotIndex: TlvField(0, TlvUInt8),

    /**
     * This field shall indicate the new requested power that the ESA shall operate at. It MUST be between the
     * MinPowerAdjustment and MaxPowerAdjustment for the slot as advertised by the ESA.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.12.2
     */
    nominalPower: TlvField(1, TlvInt64),

    /**
     * This field shall indicate the new requested duration, in seconds, that the ESA shall extend or shorten the
     * slot duration to. It MUST be between the MinDurationAdjustment and MaxDurationAdjustment for the slot as
     * advertised by the ESA.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.12.3
     */
    duration: TlvField(2, TlvUInt32),
  });

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.12
   */
  export type SlotAdjustment = TypeFromSchema<typeof TlvSlotAdjustment>;

  /**
   * Input to the DeviceEnergyManagement modifyForecastRequest command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.6
   */
  export const TlvModifyForecastRequest = TlvObject({
    /**
     * This field shall indicate the ForecastId that is to be modified.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.6.1
     */
    forecastId: TlvField(0, TlvUInt32),

    /**
     * This field shall contain a list of SlotAdjustment parameters that should be modified in the corresponding
     * Forecast with matching ForecastId.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.6.2
     */
    slotAdjustments: TlvField(1, TlvArray(TlvSlotAdjustment, { maxLength: 10 })),

    /**
     * This field shall indicate the cause of the request from the EMS.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.6.3
     */
    cause: TlvField(2, TlvEnum<AdjustmentCause>()),
  });

  /**
   * Input to the DeviceEnergyManagement modifyForecastRequest command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.6
   */
  export type ModifyForecastRequest = TypeFromSchema<typeof TlvModifyForecastRequest>;

  /**
   * The ConstraintsStruct allows a client to inform an ESA about a constraint period (such as a grid event, or
   * perhaps excess solar PV). The format allows the client to suggest that the ESA can either turn up its energy
   * consumption, or turn down its energy consumption during this period.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.13
   */
  export const TlvConstraints = TlvObject({
    /**
     * This field shall indicate the start time of the constraint period that the client wishes the ESA to compute
     * a new Forecast.
     *
     * This value is in UTC and MUST be in the future.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.13.1
     */
    startTime: TlvField(0, TlvEpochS),

    /**
     * This field shall indicate the duration of the constraint in seconds.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.13.2
     */
    duration: TlvField(1, TlvUInt32.bound({ min: 0, max: 86400 })),

    /**
     * This field shall indicate the nominal power that client wishes the ESA to operate at during the constrained
     * period. It MUST be between the AbsMinPower and AbsMaxPower attributes as advertised by the ESA if it
     * supports PFR.
     *
     * This is a signed value and can be used to indicate charging or discharging. If the ESA does NOT support PFR
     * this value shall be ignored by the ESA.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.13.3
     */
    nominalPower: TlvOptionalField(2, TlvInt64),

    /**
     * This field shall indicate the maximum energy that can be transferred to or from the ESA during the
     * constraint period.
     *
     * This is a signed value and can be used to indicate charging or discharging. If the ESA does NOT support PFR
     * this value may be ignored by the ESA.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.13.4
     */
    maximumEnergy: TlvOptionalField(3, TlvInt64),

    /**
     * This field shall indicate the turn up or turn down nature that the grid wants as the outcome by the ESA
     * during the constraint period.
     *
     * This is expressed as a signed value between -100 to +100. A value of 0 would indicate no bias to using more
     * or less energy. A negative value indicates a request to use less energy. A positive value indicates a
     * request to use more energy.
     *
     * Note that the mapping between values and operation is manufacturer specific.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.13.5
     */
    loadControl: TlvOptionalField(4, TlvInt8),
  });

  /**
   * The ConstraintsStruct allows a client to inform an ESA about a constraint period (such as a grid event, or
   * perhaps excess solar PV). The format allows the client to suggest that the ESA can either turn up its energy
   * consumption, or turn down its energy consumption during this period.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.13
   */
  export type Constraints = TypeFromSchema<typeof TlvConstraints>;

  /**
   * Input to the DeviceEnergyManagement requestConstraintBasedForecast command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.7
   */
  export const TlvRequestConstraintBasedForecastRequest = TlvObject({
    /**
     * This field shall indicate the series of turn up or turn down power requests that the ESA is being asked to
     * constrain its operation within.
     *
     * For example, a grid event which requires devices to reduce power (turn down) between 4pm and 6pm and due to
     * excess power on the grid overnight, may request ESAs to increase their power demand (turn up) between
     * midnight and 6am.
     *
     * If this ESA supports PFR this would have 2 entries in the list as follows:
     *
     * If this ESA supports SFR where it does not know the actual power, but has an understanding of the functions
     * that use more energy, it could be requested to use more or less energy using the LoadControl field as
     * follows:
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.7.1
     */
    constraints: TlvField(0, TlvArray(TlvConstraints, { maxLength: 10 })),

    /**
     * This field shall indicate the cause of the request from the EMS.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.7.2
     */
    cause: TlvField(1, TlvEnum<AdjustmentCause>()),
  });

  /**
   * Input to the DeviceEnergyManagement requestConstraintBasedForecast command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.7
   */
  export type RequestConstraintBasedForecastRequest = TypeFromSchema<typeof TlvRequestConstraintBasedForecastRequest>;

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.2
   */
  export enum EsaType {
    /**
     * EV Supply Equipment
     */
    Evse = 0,

    /**
     * Space heating appliance
     */
    SpaceHeating = 1,

    /**
     * Water heating appliance
     */
    WaterHeating = 2,

    /**
     * Space cooling appliance
     */
    SpaceCooling = 3,

    /**
     * Space heating and cooling appliance
     */
    SpaceHeatingCooling = 4,

    /**
     * Battery Electric Storage System
     */
    BatteryStorage = 5,

    /**
     * Solar PV inverter
     */
    SolarPv = 6,

    /**
     * Fridge / Freezer
     */
    FridgeFreezer = 7,

    /**
     * Washing Machine
     */
    WashingMachine = 8,

    /**
     * Dishwasher
     */
    Dishwasher = 9,

    /**
     * Cooking appliance
     */
    Cooking = 10,

    /**
     * Home water pump (e.g. drinking well)
     */
    HomeWaterPump = 11,

    /**
     * Irrigation water pump
     */
    IrrigationWaterPump = 12,

    /**
     * Pool pump
     */
    PoolPump = 13,

    /**
     * Other appliance type
     */
    Other = 255,
  }

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.7.3
   */
  export enum EsaState {
    /**
     * The ESA is not available to the EMS (e.g. start- up, maintenance mode)
     */
    Offline = 0,

    /**
     * The ESA is working normally and can be controlled by the EMS
     */
    Online = 1,

    /**
     * The ESA has developed a fault and cannot provide service
     */
    Fault = 2,

    /**
     * The ESA is in the middle of a power adjustment event
     */
    PowerAdjustActive = 3,

    /**
     * The ESA is currently paused by a client using the PauseRequest command
     */
    Paused = 4,
  }

  /**
   * A DeviceEnergyManagementCluster supports these elements if it supports feature PowerAdjustment.
   */
  export const PowerAdjustmentComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates how the ESA can be adjusted at the current time. This attribute SHOULD be updated regularly by
       * ESAs.
       *
       * For example, a battery storage inverter may need to regulate its internal temperature, or the charging
       * rate of the battery may be limited due to cold temperatures, or a change in the state of charge of the
       * battery may mean that the maximum charging or discharging rate is limited.
       *
       * An empty list shall indicate that no power adjustment is currently possible.
       *
       * Multiple entries in the list allow to indicate that permutations of scenarios may be possible.
       *
       * For example, a 10kWh battery could be at 80% state of charge. If charging at 2kW, then it would be full
       * in 1 hour. However, it could be discharged at 2kW for 4 hours.
       *
       * In this example the list of PowerAdjustStructs allows multiple scenarios to be offered as follows:
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.8.6
       */
      powerAdjustmentCapability: Attribute(0x5, TlvNullable(TlvArray(TlvPowerAdjust, { maxLength: 8 })), { default: null }),
    },

    commands: {
      /**
       * Allows a client to request an adjustment in the power consumption of an ESA for a specified duration.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.1
       */
      powerAdjustRequest: Command(0x0, TlvPowerAdjustRequest, 0x0, TlvNoResponse),

      /**
       * Allows a client to cancel an ongoing PowerAdjustmentRequest operation.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.2
       */
      cancelPowerAdjustRequest: Command(0x1, TlvNoArguments, 0x1, TlvNoResponse),
    },

    events: {
      /**
       * This event shall be generated when the Power Adjustment session is started.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.10.1
       */
      powerAdjustStart: Event(0x0, EventPriority.Info, TlvNoArguments),

      /**
       * This event shall be generated when the Power Adjustment session ends.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.10.2
       */
      powerAdjustEnd: Event(0x1, EventPriority.Info, TlvPowerAdjustEndEvent),
    },
  });

  /**
   * A DeviceEnergyManagementCluster supports these elements if it supports features PowerForecastReporting or
   * StateForecastReporting.
   */
  export const PowerForecastReportingOrStateForecastReportingComponent = MutableCluster.Component({
    attributes: {
      /**
       * This attribute allows an ESA to share its intended forecast with a client (such as an Energy Management
       * System).
       *
       * A null value indicates that there is no forecast currently available
       *
       * yet been selected by the user).
       *
       * A server may reset this value attribute to null on a reboot, and it does not need to persist any
       * previous forecasts.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.8.7
       */
      forecast: Attribute(0x6, TlvNullable(TlvForecast), { default: null }),
    },
  });

  /**
   * A DeviceEnergyManagementCluster supports these elements if it supports features PowerAdjustment,
   * StartTimeAdjustment, Pausable, ForecastAdjustment or ConstraintBasedAdjustment.
   */
  export const PowerAdjustmentOrStartTimeAdjustmentOrPausableOrForecastAdjustmentOrConstraintBasedAdjustmentComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates the current Opt-Out state of the ESA. The ESA may have a local user interface to allow the
       * user to control this OptOutState. An EMS may subscribe to the OptOutState to get notified about changes
       * in operational state.
       *
       * If the ESA is in the LocalOptOut or OptOut states, so it cannot be controlled by an EMS for local
       * optimization reasons, it shall reject any commands which have the AdjustmentCauseEnum value
       * LocalOptimization. If the ESA is in the GridOptOut or OptOut states, so it cannot be controlled by an
       * EMS for grid optimization reasons, it shall reject any commands which have the AdjustmentCauseEnum value
       * GridOptimization. If the ESA is in the LocalOptOut, GridOptOut, or NoOptOut states, the device is still
       * permitted to optimize its own energy usage, for example, using tariff information it may obtain.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.8.8
       */
      optOutState: Attribute(0x7, TlvEnum<OptOutState>(), { default: OptOutState.NoOptOut }),
    },
  });

  /**
   * A DeviceEnergyManagementCluster supports these elements if it supports feature Pausable.
   */
  export const PausableComponent = MutableCluster.Component({
    commands: {
      /**
       * Allows a client to temporarily pause an operation and reduce the ESAs energy demand.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.4
       */
      pauseRequest: Command(0x3, TlvPauseRequest, 0x3, TlvNoResponse),

      /**
       * Allows a client to cancel the PauseRequest command and enable earlier resumption of operation.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.5
       */
      resumeRequest: Command(0x4, TlvNoArguments, 0x4, TlvNoResponse),
    },

    events: {
      /**
       * This event shall be generated when the ESA enters the Paused state. There is no data for this event.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.10.3
       */
      paused: Event(0x2, EventPriority.Info, TlvNoArguments),

      /**
       * This event shall be generated when the ESA leaves the Paused state and resumes operation.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.10.4
       */
      resumed: Event(0x3, EventPriority.Info, TlvResumedEvent),
    },
  });

  /**
   * A DeviceEnergyManagementCluster supports these elements if it supports feature StartTimeAdjustment.
   */
  export const StartTimeAdjustmentComponent = MutableCluster.Component({
    commands: {
      /**
       * Allows a client to adjust the start time of a Forecast sequence that has not yet started operation (i.e.
       * where the current Forecast StartTime is in the future).
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.3
       */
      startTimeAdjustRequest: Command(0x2, TlvStartTimeAdjustRequest, 0x2, TlvNoResponse),
    },
  });

  /**
   * A DeviceEnergyManagementCluster supports these elements if it supports feature ForecastAdjustment.
   */
  export const ForecastAdjustmentComponent = MutableCluster.Component({
    commands: {
      /**
       * Allows a client to modify a Forecast within the limits allowed by the ESA.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.6
       */
      modifyForecastRequest: Command(0x5, TlvModifyForecastRequest, 0x5, TlvNoResponse),
    },
  });

  /**
   * A DeviceEnergyManagementCluster supports these elements if it supports feature ConstraintBasedAdjustment.
   */
  export const ConstraintBasedAdjustmentComponent = MutableCluster.Component({
    commands: {
      /**
       * Allows a client to ask the ESA to recompute its Forecast based on power and time constraints.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.7
       */
      requestConstraintBasedForecast: Command(0x6, TlvRequestConstraintBasedForecastRequest, 0x6, TlvNoResponse),
    },
  });

  /**
   * A DeviceEnergyManagementCluster supports these elements if it supports features StartTimeAdjustment,
   * ForecastAdjustment or ConstraintBasedAdjustment.
   */
  export const StartTimeAdjustmentOrForecastAdjustmentOrConstraintBasedAdjustmentComponent = MutableCluster.Component({
    commands: {
      /**
       * Allows a client to request cancellation of a previous adjustment request in a StartTimeAdjustRequest,
       * ModifyForecastRequest or RequestConstraintBasedForecast command.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.9.8
       */
      cancelRequest: Command(0x7, TlvNoArguments, 0x7, TlvNoResponse),
    },
  });

  /**
   * These are optional features supported by DeviceEnergyManagementCluster.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2.4
   */
  export enum Feature {
    /**
     * PowerAdjustment (PA)
     *
     * For Energy Smart Appliances (ESA) the definition of being 'smart' mandates that they can report their
     * current power adjustment capability and have an EMS request a temporary adjustment. This may typically be to
     * curtail power requirements during peak periods, but can also be used to turn on an ESA if there is excess
     * renewable or local generation (Solar PV).
     *
     * For example, a home may have solar PV which often produces more power than the home requires,
     *
     * resulting in the excess power flowing into the grid. This excess power naturally fluctuates when clouds pass
     * overhead and other loads in the home are switched on and off.
     *
     * EVSE Example: An EMS may therefore be able to turn on the EVSE (if the vehicle is plugged in) and can start
     * charging the vehicle, and periodically modify the charging power depending on PV generation and other home
     * loads, so as to minimize import and export to the grid.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.4.1
     */
    PowerAdjustment = 'PowerAdjustment',

    /**
     * PowerForecastReporting (PFR)
     *
     * For Energy Smart Appliances (ESA) the definition of being 'smart' implies that they can report their
     * indicative forecast power demands or generation, to a greater or lesser extent. For some ESAs this is highly
     * predictable (in terms of both power and time), in other appliances this is more challenging and only a basic
     * level of forecast is possible.
     *
     * Forecasts are defined from a current time, using a slot format, where the slot is akin to a relatively
     * constant operating mode.
     *
     * Washing machine example: a washing machine may have stages of a washing cycle: heating, tumbling, rinse and
     * spin stages. At each stage, the approximate minimum and maximum power consumption may be known, as well as
     * the duration of that stage.
     *
     * In some circumstances the ESA may allow the stage to be delayed or paused (subject to safety and
     * manufacturer’s discretion and user preferences).
     *
     * Typically, appliances with a heating element cannot have their power consumption adjusted and can only be
     * paused or delayed.
     *
     * Some ESAs may not be flexible other than a delayed cycle start (for example, once the washing cycle has been
     * started then they run continuously until the cycle completes).
     *
     * Appliances that only support the PowerForecastReporting and not any of the adjustment features may indicate
     * that they are not flexible in the forecast slot format.
     *
     * The PowerForecastReporting and the adjustment features aim to align to the [SAREF4ENER] ontology.
     *
     * Inverter driven ESAs: some inverter driven ESAs can consume or generate a variable amount of power.
     *
     * For example, a single phase EVSE can be adjusted in the range of 6-32Amps in 0.6 Amp steps in EU or on a
     * hardwired 120V supply in the range of 6-15 Amps in US.
     *
     * For example, a home battery may be adjusted to charge or discharge in steps of 1W.
     *
     * For example, a heat pump may be able to modulate its compressor inverter between 20-100% of its rated power.
     *
     * The ESA indicates its power adjustment range and its nominal power consumption as part of its Forecast.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.4.2
     */
    PowerForecastReporting = 'PowerForecastReporting',

    /**
     * StateForecastReporting (SFR)
     *
     * Some ESAs do not know their actual power consumption, but do know the state of operation. Like the
     * PowerForecastingReporting feature, this uses the same slot structure mechanism to indicate a change in state
     * vs time.
     *
     * An external observing EMS may have access to real-time meter readings, and could learn the typical power
     * consumption based on the advertised internal state of the ESA.
     *
     * To enable this capability, the ESA shall report its internal operational state using an manufacturer
     * specific value.
     *
     * Once the EMS has built a model of the state vs observed power consumption, it may request a forecast
     * adjustment for particular times of the day, encouraging the ESA to use power at alternative times.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.4.3
     */
    StateForecastReporting = 'StateForecastReporting',

    /**
     * StartTimeAdjustment (STA)
     *
     * ESAs which support the Start Time Adjustment feature, allow an EMS to recommend a change to the start time
     * of the energy transfer that the ESA has previously suggested it would use.
     *
     * Washing machine example: A Washing Machine may have been set to start a wash cycle at 9pm when the variable
     * tariff normally reduces.
     *
     * However, the EMS is aware that a grid event has occurred, making it cheaper to run the cycle at a later
     * time, but the washing machine is not aware of this.
     *
     * The EMS first requests the Forecast data from each of its registered ESAs. It determines that the washing
     * machine has a power profile suggesting it will start the wash cycle at 9pm, but the EMS now knows that the
     * grid event means it will be cheaper to delay the start until 11pm.
     *
     * The EMS can then optimize the cost by asking the washing machine to delay starting the wash cycle until 11pm.
     *
     * It does this by sending a StartTimeAdjustRequest to the washing machine to request delaying the start of the
     * washing cycle.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.4.4
     */
    StartTimeAdjustment = 'StartTimeAdjustment',

    /**
     * Pausable (PAU)
     *
     * ESAs which support the Pausable feature, allow an EMS to recommend a pause in the middle of a forecast power
     * profile that the ESA is currently using.
     *
     * Washing machine example: A Washing Machine is in operation, and starting its water heating step.
     *
     * However, the EMS becomes aware from the smart meter that the total home load on the grid is close to
     * exceeding its allowed total grid load.
     *
     * The EMS first requests the Forecast data from each of its registered ESAs. It determines that the washing
     * machine has a power profile suggesting its current step in the wash cycle is using power to heat the water,
     * but that this step can be paused.
     *
     * The EMS can then reduce the grid load by asking the washing machine to pause the wash cycle for a short
     * duration.
     *
     * It does this by sending a PauseRequest to the washing machine to request pausing the current step of the
     * forecast power usage for a period to allow other home loads to finish before resuming the washing cycle.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.4.5
     */
    Pausable = 'Pausable',

    /**
     * ForecastAdjustment (FA)
     *
     * ESAs which support the Forecast adjustment feature, allow an EMS to recommend a change to the start,
     * duration and/or power level limits of the steps of the power profile that the ESA has previously suggested
     * it would use.
     *
     * Heat pump and Solar PV example: A heat pump may have the ability to heat hot water as well as heating the
     * home. The heat pump scheduling system may have determined that the home will be unoccupied during the day,
     * or that the indoor temperature is above the set-point and so it knows that it will not need to heat the home.
     *
     * However, the hot water tank is likely to need to be reheated before the homeowner comes home in the evening.
     * The heat pump is not aware that the property also has a solar PV inverter which is also an ESA that is
     * communicating with the EMS.
     *
     * The EMS first requests the Forecast data from each of its registered ESAs. It determines that the heat pump
     * has a power profile suggesting it needs to heat hot water around 6pm. The solar PV inverter has forecast
     * that it will generate 3.6kW of power during the middle of the day and into the afternoon before the sun goes
     * down.
     *
     * The EMS can then optimize the home considering other non-ESA loads and can ask the heat pump to heat the hot
     * water around 3pm when it has forecast that excess solar power will be available.
     *
     * It does this by sending a ModifyForecastRequest to the heat pump and asks the heat pump to expect to run at
     * a lower power consumption (within the solar excess power) which requires the heat pump to run for a longer
     * duration to achieve its required energy demand.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.4.6
     */
    ForecastAdjustment = 'ForecastAdjustment',

    /**
     * ConstraintBasedAdjustment (CON)
     *
     * ESAs which support the Constraint-Based Adjustment feature allow an EMS to inform the ESA of periods during
     * which power usage should be modified (for example when the EMS has been made aware that the grid supplier
     * has requested reduced energy usage due to overall peak grid demand) and may cause the ESA to modify the
     * intended power profile has previously suggested it would use.
     *
     * EVSE example: An EVSE scheduling system may have determined that the vehicle would be charged starting at a
     * moderate rate at 1am, so that it has enough charge by the time it is needed later that morning.
     *
     * However, the DSR service provider has informed the EMS that due to high forecast winds it is now forecast
     * that there will be very cheap energy available from wind generation between 2am and 3am.
     *
     * The EMS first requests the Forecast data from each of its registered ESAs. It determines that the
     *
     * EVSE has a power profile suggesting it plans to start charging the vehicle at 1am.
     *
     * The EMS can then try to reduce the cost of charging the EV by informing the EVSE of the desire to increase
     * the charging between scheduled times.
     *
     * It does this by sending a RequestConstraintBasedForecast to the EVSE and asks it to run at a higher
     * NominalPower consumption during the constraint period, which may require it to decrease its charge rate
     * outside the constraint period to achieve its required energy demand.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.2.4.7
     */
    ConstraintBasedAdjustment = 'ConstraintBasedAdjustment',
  }

  /**
   * These elements and properties are present in all DeviceEnergyManagement clusters.
   */
  export const Base = MutableCluster.Component({
    id: 0x98,
    name: 'DeviceEnergyManagement',
    revision: 3,

    features: {
      /**
       * PowerAdjustment
       *
       * For Energy Smart Appliances (ESA) the definition of being 'smart' mandates that they can report their
       * current power adjustment capability and have an EMS request a temporary adjustment. This may typically
       * be to curtail power requirements during peak periods, but can also be used to turn on an ESA if there is
       * excess renewable or local generation (Solar PV).
       *
       * For example, a home may have solar PV which often produces more power than the home requires,
       *
       * resulting in the excess power flowing into the grid. This excess power naturally fluctuates when clouds
       * pass overhead and other loads in the home are switched on and off.
       *
       * EVSE Example: An EMS may therefore be able to turn on the EVSE (if the vehicle is plugged in) and can
       * start charging the vehicle, and periodically modify the charging power depending on PV generation and
       * other home loads, so as to minimize import and export to the grid.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.4.1
       */
      powerAdjustment: BitFlag(0),

      /**
       * PowerForecastReporting
       *
       * For Energy Smart Appliances (ESA) the definition of being 'smart' implies that they can report their
       * indicative forecast power demands or generation, to a greater or lesser extent. For some ESAs this is
       * highly predictable (in terms of both power and time), in other appliances this is more challenging and
       * only a basic level of forecast is possible.
       *
       * Forecasts are defined from a current time, using a slot format, where the slot is akin to a relatively
       * constant operating mode.
       *
       * Washing machine example: a washing machine may have stages of a washing cycle: heating, tumbling, rinse
       * and spin stages. At each stage, the approximate minimum and maximum power consumption may be known, as
       * well as the duration of that stage.
       *
       * In some circumstances the ESA may allow the stage to be delayed or paused (subject to safety and
       * manufacturer’s discretion and user preferences).
       *
       * Typically, appliances with a heating element cannot have their power consumption adjusted and can only
       * be paused or delayed.
       *
       * Some ESAs may not be flexible other than a delayed cycle start (for example, once the washing cycle has
       * been started then they run continuously until the cycle completes).
       *
       * Appliances that only support the PowerForecastReporting and not any of the adjustment features may
       * indicate that they are not flexible in the forecast slot format.
       *
       * The PowerForecastReporting and the adjustment features aim to align to the [SAREF4ENER] ontology.
       *
       * Inverter driven ESAs: some inverter driven ESAs can consume or generate a variable amount of power.
       *
       * For example, a single phase EVSE can be adjusted in the range of 6-32Amps in 0.6 Amp steps in EU or on a
       * hardwired 120V supply in the range of 6-15 Amps in US.
       *
       * For example, a home battery may be adjusted to charge or discharge in steps of 1W.
       *
       * For example, a heat pump may be able to modulate its compressor inverter between 20-100% of its rated
       * power.
       *
       * The ESA indicates its power adjustment range and its nominal power consumption as part of its Forecast.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.4.2
       */
      powerForecastReporting: BitFlag(1),

      /**
       * StateForecastReporting
       *
       * Some ESAs do not know their actual power consumption, but do know the state of operation. Like the
       * PowerForecastingReporting feature, this uses the same slot structure mechanism to indicate a change in
       * state vs time.
       *
       * An external observing EMS may have access to real-time meter readings, and could learn the typical power
       * consumption based on the advertised internal state of the ESA.
       *
       * To enable this capability, the ESA shall report its internal operational state using an manufacturer
       * specific value.
       *
       * Once the EMS has built a model of the state vs observed power consumption, it may request a forecast
       * adjustment for particular times of the day, encouraging the ESA to use power at alternative times.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.4.3
       */
      stateForecastReporting: BitFlag(2),

      /**
       * StartTimeAdjustment
       *
       * ESAs which support the Start Time Adjustment feature, allow an EMS to recommend a change to the start
       * time of the energy transfer that the ESA has previously suggested it would use.
       *
       * Washing machine example: A Washing Machine may have been set to start a wash cycle at 9pm when the
       * variable tariff normally reduces.
       *
       * However, the EMS is aware that a grid event has occurred, making it cheaper to run the cycle at a later
       * time, but the washing machine is not aware of this.
       *
       * The EMS first requests the Forecast data from each of its registered ESAs. It determines that the
       * washing machine has a power profile suggesting it will start the wash cycle at 9pm, but the EMS now
       * knows that the grid event means it will be cheaper to delay the start until 11pm.
       *
       * The EMS can then optimize the cost by asking the washing machine to delay starting the wash cycle until
       * 11pm.
       *
       * It does this by sending a StartTimeAdjustRequest to the washing machine to request delaying the start of
       * the washing cycle.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.4.4
       */
      startTimeAdjustment: BitFlag(3),

      /**
       * Pausable
       *
       * ESAs which support the Pausable feature, allow an EMS to recommend a pause in the middle of a forecast
       * power profile that the ESA is currently using.
       *
       * Washing machine example: A Washing Machine is in operation, and starting its water heating step.
       *
       * However, the EMS becomes aware from the smart meter that the total home load on the grid is close to
       * exceeding its allowed total grid load.
       *
       * The EMS first requests the Forecast data from each of its registered ESAs. It determines that the
       * washing machine has a power profile suggesting its current step in the wash cycle is using power to heat
       * the water, but that this step can be paused.
       *
       * The EMS can then reduce the grid load by asking the washing machine to pause the wash cycle for a short
       * duration.
       *
       * It does this by sending a PauseRequest to the washing machine to request pausing the current step of the
       * forecast power usage for a period to allow other home loads to finish before resuming the washing cycle.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.4.5
       */
      pausable: BitFlag(4),

      /**
       * ForecastAdjustment
       *
       * ESAs which support the Forecast adjustment feature, allow an EMS to recommend a change to the start,
       * duration and/or power level limits of the steps of the power profile that the ESA has previously
       * suggested it would use.
       *
       * Heat pump and Solar PV example: A heat pump may have the ability to heat hot water as well as heating
       * the home. The heat pump scheduling system may have determined that the home will be unoccupied during
       * the day, or that the indoor temperature is above the set-point and so it knows that it will not need to
       * heat the home.
       *
       * However, the hot water tank is likely to need to be reheated before the homeowner comes home in the
       * evening. The heat pump is not aware that the property also has a solar PV inverter which is also an ESA
       * that is communicating with the EMS.
       *
       * The EMS first requests the Forecast data from each of its registered ESAs. It determines that the heat
       * pump has a power profile suggesting it needs to heat hot water around 6pm. The solar PV inverter has
       * forecast that it will generate 3.6kW of power during the middle of the day and into the afternoon before
       * the sun goes down.
       *
       * The EMS can then optimize the home considering other non-ESA loads and can ask the heat pump to heat the
       * hot water around 3pm when it has forecast that excess solar power will be available.
       *
       * It does this by sending a ModifyForecastRequest to the heat pump and asks the heat pump to expect to run
       * at a lower power consumption (within the solar excess power) which requires the heat pump to run for a
       * longer duration to achieve its required energy demand.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.4.6
       */
      forecastAdjustment: BitFlag(5),

      /**
       * ConstraintBasedAdjustment
       *
       * ESAs which support the Constraint-Based Adjustment feature allow an EMS to inform the ESA of periods
       * during which power usage should be modified (for example when the EMS has been made aware that the grid
       * supplier has requested reduced energy usage due to overall peak grid demand) and may cause the ESA to
       * modify the intended power profile has previously suggested it would use.
       *
       * EVSE example: An EVSE scheduling system may have determined that the vehicle would be charged starting
       * at a moderate rate at 1am, so that it has enough charge by the time it is needed later that morning.
       *
       * However, the DSR service provider has informed the EMS that due to high forecast winds it is now
       * forecast that there will be very cheap energy available from wind generation between 2am and 3am.
       *
       * The EMS first requests the Forecast data from each of its registered ESAs. It determines that the
       *
       * EVSE has a power profile suggesting it plans to start charging the vehicle at 1am.
       *
       * The EMS can then try to reduce the cost of charging the EV by informing the EVSE of the desire to
       * increase the charging between scheduled times.
       *
       * It does this by sending a RequestConstraintBasedForecast to the EVSE and asks it to run at a higher
       * NominalPower consumption during the constraint period, which may require it to decrease its charge rate
       * outside the constraint period to achieve its required energy demand.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.4.7
       */
      constraintBasedAdjustment: BitFlag(6),
    },

    attributes: {
      /**
       * Indicates the type of ESA.
       *
       * This attribute enables an EMS to understand some of the basic properties about how the energy may be
       * consumed, generated, and stored by the ESA.
       *
       * For example, the heat energy converted by a heat pump will naturally be lost through the building to the
       * outdoor environment relatively quickly, compared to storing heat in a well-insulated hot water tank.
       * Similarly, battery storage and EVs can store electrical energy for much longer durations.
       *
       * This attribute can also help the EMS display information to a user and to make basic assumptions about
       * typical best use of energy. For example, an EVSE may not always have an EV plugged in, so knowing the
       * type of ESA that is being controlled can allow advanced energy management strategies.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.8.1
       */
      esaType: FixedAttribute(0x0, TlvEnum<EsaType>(), { default: EsaType.Other }),

      /**
       * Indicates whether the ESA is classed as a generator or load. This allows an EMS to understand whether
       * the power values reported by the ESA need to have their sign inverted when dealing with forecasts and
       * adjustments.
       *
       * For example, a solar PV inverter (being a generator) may produce positive values to indicate generation,
       * however an EMS when predicting the total home load would need to subtract these positive values from the
       * loads to compute a net import at the grid meter.
       *
       * For example, a home battery storage system (BESS) which needs to charge the battery and then discharge
       * to the home loads, would be classed as a generator. These types of devices shall have this field set to
       * true. When generating its forecast or advertising its PowerAdjustmentCapability, the power values shall
       * be positive to indicate discharging to the loads in the home, and negative to indicate when it is
       * charging its battery.
       *
       * GRID meter = Σ LoadPowers - Σ GeneratorPowers
       *
       * Example:
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.8.2
       */
      esaCanGenerate: FixedAttribute(0x1, TlvBoolean, { default: true }),

      /**
       * Indicates the current state of the ESA.
       *
       * If the ESA is in the Offline or Fault state it cannot be controlled by an EMS, and may not be able to
       * report its Forecast information. An EMS may subscribe to the ESAState to get notified about changes in
       * operational state.
       *
       * The ESA may have a local user interface to allow a service technician to put the ESA into Offline mode,
       * for example to avoid the EMS accidentally starting or stopping the appliance when it is being serviced
       * or tested.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.8.3
       */
      esaState: Attribute(0x2, TlvEnum<EsaState>(), { default: EsaState.Offline }),

      /**
       * Indicates the minimum electrical power that the ESA can consume when switched on. This does not include
       * when in power save or standby modes.
       *
       * Note that for Generator ESAs that can charge an internal battery (such as a battery storage inverter),
       * the AbsMinPower will be a negative number representing the maximum power that the ESA can charge its
       * internal battery.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.8.4
       */
      absMinPower: Attribute(0x3, TlvInt64, { default: 0 }),

      /**
       * Indicates the maximum electrical power that the ESA can consume when switched on.
       *
       * The value of the AbsMaxPower attribute shall be limited
       *
       * AbsMaxPower >= AbsMinPower
       *
       * Note that for Generator ESAs that can discharge a battery to loads in the home (such as a battery
       * storage inverter), the AbsMaxPower will be a positive number representing the maximum power at which the
       * ESA can discharge its internal battery.
       *
       * For example, a battery storage inverter that can charge its battery at a maximum power of 2000W and can
       * discharge the battery at a maximum power of 3000W, would have a AbsMinPower: -2000, AbsMaxPower: 3000W.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 9.2.8.5
       */
      absMaxPower: Attribute(0x4, TlvInt64, { default: 0 }),
    },

    /**
     * This metadata controls which DeviceEnergyManagementCluster elements matter.js activates for specific feature
     * combinations.
     */
    extensions: MutableCluster.Extensions(
      { flags: { powerAdjustment: true }, component: PowerAdjustmentComponent },
      {
        flags: { powerForecastReporting: true },
        component: PowerForecastReportingOrStateForecastReportingComponent,
      },
      {
        flags: { stateForecastReporting: true },
        component: PowerForecastReportingOrStateForecastReportingComponent,
      },
      {
        flags: { powerAdjustment: true },
        component: PowerAdjustmentOrStartTimeAdjustmentOrPausableOrForecastAdjustmentOrConstraintBasedAdjustmentComponent,
      },
      {
        flags: { startTimeAdjustment: true },
        component: PowerAdjustmentOrStartTimeAdjustmentOrPausableOrForecastAdjustmentOrConstraintBasedAdjustmentComponent,
      },
      {
        flags: { pausable: true },
        component: PowerAdjustmentOrStartTimeAdjustmentOrPausableOrForecastAdjustmentOrConstraintBasedAdjustmentComponent,
      },
      {
        flags: { forecastAdjustment: true },
        component: PowerAdjustmentOrStartTimeAdjustmentOrPausableOrForecastAdjustmentOrConstraintBasedAdjustmentComponent,
      },
      {
        flags: { constraintBasedAdjustment: true },
        component: PowerAdjustmentOrStartTimeAdjustmentOrPausableOrForecastAdjustmentOrConstraintBasedAdjustmentComponent,
      },
      { flags: { pausable: true }, component: PausableComponent },
      { flags: { startTimeAdjustment: true }, component: StartTimeAdjustmentComponent },
      { flags: { forecastAdjustment: true }, component: ForecastAdjustmentComponent },
      { flags: { constraintBasedAdjustment: true }, component: ConstraintBasedAdjustmentComponent },
      {
        flags: { startTimeAdjustment: true },
        component: StartTimeAdjustmentOrForecastAdjustmentOrConstraintBasedAdjustmentComponent,
      },
      {
        flags: { forecastAdjustment: true },
        component: StartTimeAdjustmentOrForecastAdjustmentOrConstraintBasedAdjustmentComponent,
      },
      {
        flags: { constraintBasedAdjustment: true },
        component: StartTimeAdjustmentOrForecastAdjustmentOrConstraintBasedAdjustmentComponent,
      },
      { flags: { feature: false, startTimeAdjustment: true, stateForecastReporting: false }, component: false },
      { flags: { feature: false, pausable: true, stateForecastReporting: false }, component: false },
      { flags: { feature: false, forecastAdjustment: true, stateForecastReporting: false }, component: false },
      {
        flags: { feature: false, constraintBasedAdjustment: true, stateForecastReporting: false },
        component: false,
      },
      { flags: { feature: false, startTimeAdjustment: true, powerForecastReporting: false }, component: false },
      { flags: { feature: false, pausable: true, powerForecastReporting: false }, component: false },
      { flags: { feature: false, forecastAdjustment: true, powerForecastReporting: false }, component: false },
      {
        flags: { feature: false, constraintBasedAdjustment: true, powerForecastReporting: false },
        component: false,
      },

      {
        flags: {
          powerAdjustment: false,
          powerForecastReporting: false,
          stateForecastReporting: false,
          startTimeAdjustment: false,
          pausable: false,
          forecastAdjustment: false,
          constraintBasedAdjustment: false,
        },

        component: false,
      },
    ),
  });

  /**
   * @see {@link Cluster}
   */
  export const ClusterInstance = MutableCluster.ExtensibleOnly(Base);

  /**
   * This cluster allows a client to manage the power draw of a device. An example of such a client could be an
   * Energy Management System (EMS) which controls an Energy Smart Appliance (ESA).
   *
   * In most deployments the EMS will be the client, and the ESA will host the Energy Management Cluster server.
   *
   * Figure 15. Example of the how an EMS is a client of multiple ESAs Energy Management clusters.
   *
   * This cluster is intended to be generic in nature and could apply to any electrical load or generator (e.g. a
   * Battery Electric Storage System - BESS, solar PV inverter, EVSE, HVAC, heat pump, hot water heater, white goods
   * appliances etc).
   *
   * It consists of the following areas which shall be supported by all devices implementing this cluster:
   *
   *   • Description of ESA and its capabilities & power limits (sometimes referred to as a nameplate)
   *
   *   • Current state of operation (including user opt-out, safety limitations / alarms) There are some optional
   *     capabilities that some ESAs may be able to offer:
   *
   *   • Ability to control the load or generation
   *
   *   • Forecast data, including when it can be flexible (i.e. modify the power or time period)
   *
   *   • The ability to have their power profile adjusted by an EMS, and to provide an updated Forecast back to the
   *     EMS.
   *
   * This allows the EMS to manage multiple home loads and where ESAs can be flexible, continuously optimizing the
   * home energy to minimize cost, reduce CO2 impact, maximize self-consumption of solar PV and provide Demand Side
   * Response (DSR) Grid services.
   *
   * It is likely that the ESA may also use the Pricing Cluster to obtain incentive signals such as 'grid carbon
   * intensity', 'time of use' or 'type of use' tariffs to schedule its operation to run at the cheapest and greenest
   * times.
   *
   * Figure 16. Example of the how an HVAC may use multiple clusters
   *
   * NOTE
   *
   * Grid Services are market dependent and will use other protocols ([OpenADR] / [IEEE2030.5]) to communicate grid
   * events to the EMS. These are outside the scope of Matter.
   *
   * NOTE
   *
   * Different markets may follow different approaches, but the UK [PAS1878] and [EUCodeOfConduct] give examples of
   * how ESAs may be mandated to support these features in the future.
   *
   * NOTE Support of Device Energy Management Cluster is provisional.
   *
   * Per the Matter specification you cannot use {@link DeviceEnergyManagementCluster} without enabling certain
   * feature combinations. You must use the {@link with} factory method to obtain a working cluster.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.2
   */
  export type Cluster = Identity<typeof ClusterInstance>;

  export const Cluster: Cluster = ClusterInstance;
  const PA = { powerAdjustment: true };
  const PFR = { powerForecastReporting: true };
  const SFR = { stateForecastReporting: true };
  const STA = { startTimeAdjustment: true };
  const PAU = { pausable: true };
  const FA = { forecastAdjustment: true };
  const CON = { constraintBasedAdjustment: true };

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
      powerAdjustmentCapability: MutableCluster.AsConditional(PowerAdjustmentComponent.attributes.powerAdjustmentCapability, { mandatoryIf: [PA] }),
      forecast: MutableCluster.AsConditional(PowerForecastReportingOrStateForecastReportingComponent.attributes.forecast, { mandatoryIf: [PFR, SFR] }),
      optOutState: MutableCluster.AsConditional(PowerAdjustmentOrStartTimeAdjustmentOrPausableOrForecastAdjustmentOrConstraintBasedAdjustmentComponent.attributes.optOutState, { mandatoryIf: [PA, STA, PAU, FA, CON] }),
    },

    commands: {
      powerAdjustRequest: MutableCluster.AsConditional(PowerAdjustmentComponent.commands.powerAdjustRequest, { mandatoryIf: [PA] }),
      cancelPowerAdjustRequest: MutableCluster.AsConditional(PowerAdjustmentComponent.commands.cancelPowerAdjustRequest, { mandatoryIf: [PA] }),
      startTimeAdjustRequest: MutableCluster.AsConditional(StartTimeAdjustmentComponent.commands.startTimeAdjustRequest, { mandatoryIf: [STA] }),
      pauseRequest: MutableCluster.AsConditional(PausableComponent.commands.pauseRequest, { mandatoryIf: [PAU] }),
      resumeRequest: MutableCluster.AsConditional(PausableComponent.commands.resumeRequest, { mandatoryIf: [PAU] }),
      modifyForecastRequest: MutableCluster.AsConditional(ForecastAdjustmentComponent.commands.modifyForecastRequest, { mandatoryIf: [FA] }),
      requestConstraintBasedForecast: MutableCluster.AsConditional(ConstraintBasedAdjustmentComponent.commands.requestConstraintBasedForecast, { mandatoryIf: [CON] }),
      cancelRequest: MutableCluster.AsConditional(StartTimeAdjustmentOrForecastAdjustmentOrConstraintBasedAdjustmentComponent.commands.cancelRequest, { mandatoryIf: [STA, FA, CON] }),
    },

    events: {
      powerAdjustStart: MutableCluster.AsConditional(PowerAdjustmentComponent.events.powerAdjustStart, { mandatoryIf: [PA] }),
      powerAdjustEnd: MutableCluster.AsConditional(PowerAdjustmentComponent.events.powerAdjustEnd, { mandatoryIf: [PA] }),
      paused: MutableCluster.AsConditional(PausableComponent.events.paused, { mandatoryIf: [PAU] }),
      resumed: MutableCluster.AsConditional(PausableComponent.events.resumed, { mandatoryIf: [PAU] }),
    },
  });

  /**
   * This cluster supports all DeviceEnergyManagement features. It may support illegal feature combinations.
   *
   * If you use this cluster you must manually specify which features are active and ensure the set of active
   * features is legal per the Matter specification.
   */
  export type Complete = Identity<typeof CompleteInstance>;

  export const Complete: Complete = CompleteInstance;
}

export type DeviceEnergyManagementCluster = DeviceEnergyManagement.Cluster;
export const DeviceEnergyManagementCluster = DeviceEnergyManagement.Cluster;
ClusterRegistry.register(DeviceEnergyManagement.Complete);
