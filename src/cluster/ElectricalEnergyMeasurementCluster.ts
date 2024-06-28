/* eslint-disable @typescript-eslint/no-namespace */
/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClusterRegistry, EventPriority, MutableCluster, OptionalAttribute } from '@project-chip/matter-node.js/cluster';
import { FixedAttribute, Attribute, Event } from '@project-chip/matter-node.js/cluster';
import { BitFlag } from '@project-chip/matter-node.js/schema';
import { TlvObject, TlvField, TlvInt64, TlvOptionalField, TlvEpochS, TlvSysTimeMS, TlvNullable, TypeFromSchema } from '@project-chip/matter-node.js/tlv';
import { Identity } from '@project-chip/matter-node.js/util';
import { TlvMeasurementAccuracy } from './MeasurementAccuracy.js';

export namespace ElectricalEnergyMeasurement {
  /**
   * This struct shall indicate the amount of energy measured during a given measurement period.
   *
   * A server which does not have the ability to determine the time in UTC, or has not yet done so, shall use the
   * system time fields to specify the measurement period and observation times.
   *
   * A server which has determined the time in UTC shall use the timestamp fields to specify the measurement period.
   * Such a server may also include the systime fields to indicate how many seconds had passed since boot for a given
   * timestamp; this allows for client-side resolution of UTC time for previous reports that only included systime.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.12.5.1
   */
  export const TlvEnergyMeasurement = TlvObject({
    /**
     * This field shall be the reported energy.
     *
     * If the EnergyMeasurementStruct represents cumulative energy, then this shall represent the cumulative energy
     * recorded at either the value of the EndTimestamp field or the value of the EndSystime field, or both.
     *
     * If the EnergyMeasurementStruct represents periodic energy, then this shall represent the energy recorded
     * during the period specified by either the StartTimestamp and EndTimestamp fields, the period specified by
     * the StartSystime and EndSystime fields, or both.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.5.1.1
     */
    energy: TlvField(0, TlvInt64.bound({ min: 0, max: 2 ** 62 })),

    /**
     * This field shall indicate the timestamp in UTC of the beginning of the period during which the value of the
     * Energy field was measured.
     *
     * If this EnergyMeasurementStruct represents cumulative energy, this field shall be omitted.
     *
     * Otherwise, if the server had determined the time in UTC at or before the beginning of the measurement
     * period, this field shall be indicated.
     *
     * Otherwise, if the server had not yet determined the time in UTC at or before the beginning of the
     * measurement period, or does not have the capability of determining the time in UTC, this field shall be
     * omitted.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.5.1.2
     */
    startTimestamp: TlvOptionalField(1, TlvEpochS),

    /**
     * This field shall indicate the timestamp in UTC of the end of the period during which the value of the Energy
     * field was measured.
     *
     * If the server had determined the time in UTC by the end of the measurement period, this field shall be
     * indicated.
     *
     * Otherwise, if the server had not yet determined the time in UTC by the end of the measurement period, or
     * does not have the capability of determining the time in UTC, this field shall be omitted.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.5.1.3
     */
    endTimestamp: TlvOptionalField(2, TlvEpochS),

    /**
     * This field shall indicate the seconds since boot at the beginning of the period during which the value of
     * the Energy field was measured.
     *
     * If this EnergyMeasurementStruct represents cumulative energy, this field shall be omitted.
     *
     * Otherwise, if the server had not yet determined the time in UTC at the start of the measurement period, or
     * does not have the capability of determining the time in UTC, this field shall be indicated.
     *
     * Otherwise, if the server had determined the time in UTC at or before the beginning of the measurement
     * period, this field may be omitted; if it is indicated, its value shall be the seconds since boot at the UTC
     * time indicated in StartTimestamp.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.5.1.4
     */
    startSystime: TlvOptionalField(3, TlvSysTimeMS),

    /**
     * This field shall indicate the seconds since boot at the end of the period during which the value of the
     * Energy field was measured.
     *
     * If the server had not yet determined the time in UTC by the end of the measurement period, or does not have
     * the capability of determining the time in UTC, this field shall be indicated.
     *
     * Otherwise, if the server had determined the time in UTC by the end of the measurement period, this field may
     * be omitted; if it is indicated, its value shall be the seconds since boot at the UTC time indicated in
     * EndTimestamp.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.5.1.5
     */
    endSystime: TlvOptionalField(4, TlvSysTimeMS),
  });

  /**
   * This struct shall indicate the amount of energy measured during a given measurement period.
   *
   * A server which does not have the ability to determine the time in UTC, or has not yet done so, shall use the
   * system time fields to specify the measurement period and observation times.
   *
   * A server which has determined the time in UTC shall use the timestamp fields to specify the measurement period.
   * Such a server may also include the systime fields to indicate how many seconds had passed since boot for a given
   * timestamp; this allows for client-side resolution of UTC time for previous reports that only included systime.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.12.5.1
   */
  export type EnergyMeasurement = TypeFromSchema<typeof TlvEnergyMeasurement>;

  /**
   * This struct shall represent the times at which cumulative measurements were last zero, either due to
   * initialization of the device, or an internal reset of the cumulative value.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.12.5.2
   */
  export const TlvCumulativeEnergyReset = TlvObject({
    /**
     * This field shall indicate the timestamp in UTC when the value of the Energy field on the
     * CumulativeEnergyImported attribute was most recently zero.
     *
     * If the server had determined the time in UTC when the value of the Energy field on the
     * CumulativeEnergyImported attribute was most recently zero, this field shall be indicated.
     *
     * Otherwise, if the server had not yet determined the time in UTC when the value of the Energy field on the
     * CumulativeEnergyImported attribute was most recently zero, or does not have the capability of determining
     * the time in UTC, this field shall be omitted.
     *
     * If the timestamp in UTC when the value of the Energy field on the CumulativeEnergyImported attribute was
     * most recently zero cannot currently be determined, a value of null shall be returned.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.5.2.1
     */
    importedResetTimestamp: TlvOptionalField(0, TlvNullable(TlvEpochS)),

    /**
     * This field shall indicate the timestamp in UTC when the value of the Energy field on the
     * CumulativeEnergyExported attribute was most recently zero.
     *
     * If the server had determined the time in UTC when the value of the Energy field on the Cumula
     *
     * tiveEnergyExported attribute was most recently zero, this field shall be indicated.
     *
     * Otherwise, if the server had not yet determined the time in UTC when the value of the Energy field on the
     * CumulativeEnergyExported attribute was most recently zero, or does not have the capability of determining
     * the time in UTC, this field shall be omitted.
     *
     * If the timestamp in UTC when the value of the Energy field on the CumulativeEnergyExported attribute was
     * most recently zero cannot currently be determined, a value of null shall be returned.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.5.2.2
     */
    exportedResetTimestamp: TlvOptionalField(1, TlvNullable(TlvEpochS)),

    /**
     * This field shall indicate the seconds since boot when the value of the Energy field on the
     * CumulativeEnergyImported attribute was most recently zero.
     *
     * If the server had not yet determined the time in UTC when the value of the Energy field on the
     * CumulativeEnergyImported attribute was most recently zero, or does not have the capability of determining
     * the time in UTC, this field shall be indicated.
     *
     * Otherwise, if the server had determined the time in UTC when the value of the Energy field on the
     * CumulativeEnergyImported attribute was most recently zero, this field may be omitted; if it is indicated,
     * its value shall be the seconds since boot at the UTC time indicated in ImportedResetTimestamp.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.5.2.3
     */
    importedResetSystime: TlvOptionalField(2, TlvNullable(TlvSysTimeMS)),

    /**
     * This field shall indicate the seconds since boot when the value of the Energy field on the
     * CumulativeEnergyExported attribute was most recently zero.
     *
     * If the server had not yet determined the time in UTC when the value of the Energy field on the
     * CumulativeEnergyExported attribute was most recently zero, or does not have the capability of determining
     * the time in UTC, this field shall be indicated.
     *
     * Otherwise, if the server had determined the time in UTC when the value of the Energy field on the
     * CumulativeEnergyExported attribute was most recently zero, this field may be omitted; if it is indicated,
     * its value shall be the seconds since boot at the UTC time indicated in ImportedResetTimestamp.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.5.2.4
     */
    exportedResetSystime: TlvOptionalField(3, TlvNullable(TlvSysTimeMS)),
  });

  /**
   * This struct shall represent the times at which cumulative measurements were last zero, either due to
   * initialization of the device, or an internal reset of the cumulative value.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.12.5.2
   */
  export type CumulativeEnergyReset = TypeFromSchema<typeof TlvCumulativeEnergyReset>;

  /**
   * Body of the ElectricalEnergyMeasurement cumulativeEnergyMeasured event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.12.7.1
   */
  export const TlvCumulativeEnergyMeasuredEvent = TlvObject({
    /**
     * This field shall be the value of CumulativeEnergyImported attribute at the timestamp indicated in its
     * EndTimestamp field, EndSystime field, or both.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.7.1.1
     */
    energyImported: TlvOptionalField(0, TlvEnergyMeasurement),

    /**
     * This field shall be the value of CumulativeEnergyExported attribute at the timestamp indicated in its
     * EndTimestamp field, EndSystime field, or both.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.7.1.2
     */
    energyExported: TlvOptionalField(1, TlvEnergyMeasurement),
  });

  /**
   * Body of the ElectricalEnergyMeasurement cumulativeEnergyMeasured event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.12.7.1
   */
  export type CumulativeEnergyMeasuredEvent = TypeFromSchema<typeof TlvCumulativeEnergyMeasuredEvent>;

  /**
   * Body of the ElectricalEnergyMeasurement periodicEnergyMeasured event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.12.7.2
   */
  export const TlvPeriodicEnergyMeasuredEvent = TlvObject({
    /**
     * This field shall be the value of PeriodicEnergyImported attribute at the timestamp indicated in its
     * EndTimestamp field, EndSystime field, or both.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.7.2.1
     */
    energyImported: TlvOptionalField(0, TlvEnergyMeasurement),

    /**
     * This field shall be the value of PeriodicEnergyExported attribute at the timestamp indicated in its
     * EndTimestamp field, EndSystime field, or both.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.7.2.2
     */
    energyExported: TlvOptionalField(1, TlvEnergyMeasurement),
  });

  /**
   * Body of the ElectricalEnergyMeasurement periodicEnergyMeasured event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.12.7.2
   */
  export type PeriodicEnergyMeasuredEvent = TypeFromSchema<typeof TlvPeriodicEnergyMeasuredEvent>;

  /**
   * A ElectricalEnergyMeasurementCluster supports these elements if it supports features ImportedEnergy and
   * CumulativeEnergy.
   */
  export const ImportedEnergyAndCumulativeEnergyComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates the most recent measurement of cumulative energy imported by the server over the lifetime of
       * the device, and the timestamp of when the measurement was recorded.
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
       * If the cumulative energy imported cannot currently be determined, a value of null shall be returned.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.12.6.2
       */
      cumulativeEnergyImported: Attribute(0x1, TlvNullable(TlvEnergyMeasurement), { default: null }),
    },
  });

  /**
   * A ElectricalEnergyMeasurementCluster supports these elements if it supports features ExportedEnergy and
   * CumulativeEnergy.
   */
  export const ExportedEnergyAndCumulativeEnergyComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates the most recent measurement of cumulative energy exported by the server over the lifetime of
       * the device, and the timestamp of when the measurement was recorded.
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
       * If the cumulative energy exported cannot currently be determined, a value of null shall be returned.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.12.6.3
       */
      cumulativeEnergyExported: Attribute(0x2, TlvNullable(TlvEnergyMeasurement), { default: null }),
    },
  });

  /**
   * A ElectricalEnergyMeasurementCluster supports these elements if it supports features ImportedEnergy and
   * PeriodicEnergy.
   */
  export const ImportedEnergyAndPeriodicEnergyComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates the most recent measurement of energy imported by the server and the period during which it
       * was measured.
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
       * If the periodic energy imported cannot currently be determined, a value of null shall be returned.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.12.6.4
       */
      periodicEnergyImported: Attribute(0x3, TlvNullable(TlvEnergyMeasurement), { default: null }),
    },
  });

  /**
   * A ElectricalEnergyMeasurementCluster supports these elements if it supports features ExportedEnergy and
   * PeriodicEnergy.
   */
  export const ExportedEnergyAndPeriodicEnergyComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates the most recent measurement of energy exported by the server and the period during which it
       * was measured.
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
       * If the periodic energy exported cannot currently be determined, a value of null shall be returned.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.12.6.5
       */
      periodicEnergyExported: Attribute(0x4, TlvNullable(TlvEnergyMeasurement), { default: null }),
    },
  });

  /**
   * A ElectricalEnergyMeasurementCluster supports these elements if it supports feature CumulativeEnergy.
   */
  export const CumulativeEnergyComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates when cumulative measurements were most recently zero.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.12.6.6
       */
      cumulativeEnergyReset: OptionalAttribute(0x5, TlvNullable(TlvCumulativeEnergyReset), { default: null }),
    },

    events: {
      /**
       * This event shall be generated when the server takes a snapshot of the cumulative energy imported by the
       * server, exported from the server, or both, but not more frequently than the rate mentioned in the
       * description above of the related attribute.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.12.7.1
       */
      cumulativeEnergyMeasured: Event(0x0, EventPriority.Info, TlvCumulativeEnergyMeasuredEvent),
    },
  });

  /**
   * A ElectricalEnergyMeasurementCluster supports these elements if it supports feature PeriodicEnergy.
   */
  export const PeriodicEnergyComponent = MutableCluster.Component({
    events: {
      /**
       * This event shall be generated when the server reaches the end of a reporting period for imported energy,
       * exported energy, or both.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.12.7.2
       */
      periodicEnergyMeasured: Event(0x1, EventPriority.Info, TlvPeriodicEnergyMeasuredEvent),
    },
  });

  /**
   * These are optional features supported by ElectricalEnergyMeasurementCluster.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.12.4
   */
  export enum Feature {
    /**
     * ImportedEnergy
     *
     * The feature indicates the server is capable of measuring how much energy is imported by the server.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.4.1
     */
    ImportedEnergy = 'ImportedEnergy',

    /**
     * ExportedEnergy
     *
     * The feature indicates the server is capable of measuring how much energy is exported by the server.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.4.2
     */
    ExportedEnergy = 'ExportedEnergy',

    /**
     * CumulativeEnergy
     *
     * The feature indicates the server is capable of measuring how much energy has been imported or exported by
     * the server over the device’s lifetime. This measurement may start from when a device’s firmware is updated
     * to include this feature, when a device’s firmware is updated to correct measurement errors, or when a device
     * is factory reset.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.4.3
     */
    CumulativeEnergy = 'CumulativeEnergy',

    /**
     * PeriodicEnergy
     *
     * The feature indicates the server is capable of measuring how much energy has been imported or exported by
     * the server during a certain period of time. The start and end times for measurement periods shall be
     * determined by the server, and may represent overlapping periods.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.12.4.4
     */
    PeriodicEnergy = 'PeriodicEnergy',
  }

  /**
   * These elements and properties are present in all ElectricalEnergyMeasurement clusters.
   */
  export const Base = MutableCluster.Component({
    id: 0x91,
    name: 'ElectricalEnergyMeasurement',
    revision: 1,

    features: {
      /**
       * ImportedEnergy
       *
       * The feature indicates the server is capable of measuring how much energy is imported by the server.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.12.4.1
       */
      importedEnergy: BitFlag(0),

      /**
       * ExportedEnergy
       *
       * The feature indicates the server is capable of measuring how much energy is exported by the server.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.12.4.2
       */
      exportedEnergy: BitFlag(1),

      /**
       * CumulativeEnergy
       *
       * The feature indicates the server is capable of measuring how much energy has been imported or exported
       * by the server over the device’s lifetime. This measurement may start from when a device’s firmware is
       * updated to include this feature, when a device’s firmware is updated to correct measurement errors, or
       * when a device is factory reset.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.12.4.3
       */
      cumulativeEnergy: BitFlag(2),

      /**
       * PeriodicEnergy
       *
       * The feature indicates the server is capable of measuring how much energy has been imported or exported
       * by the server during a certain period of time. The start and end times for measurement periods shall be
       * determined by the server, and may represent overlapping periods.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.12.4.4
       */
      periodicEnergy: BitFlag(3),
    },

    attributes: {
      /**
       * Indicates the accuracy of energy measurement by this server. The value of the MeasurementType field on
       * this MeasurementAccuracyStruct shall be ElectricalEnergy.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.12.6.1
       */
      accuracy: FixedAttribute(0x0, TlvMeasurementAccuracy),
    },

    /**
     * This metadata controls which ElectricalEnergyMeasurementCluster elements matter.js activates for specific
     * feature combinations.
     */
    extensions: MutableCluster.Extensions(
      {
        flags: { importedEnergy: true, cumulativeEnergy: true },
        component: ImportedEnergyAndCumulativeEnergyComponent,
      },
      {
        flags: { exportedEnergy: true, cumulativeEnergy: true },
        component: ExportedEnergyAndCumulativeEnergyComponent,
      },
      {
        flags: { importedEnergy: true, periodicEnergy: true },
        component: ImportedEnergyAndPeriodicEnergyComponent,
      },
      {
        flags: { exportedEnergy: true, periodicEnergy: true },
        component: ExportedEnergyAndPeriodicEnergyComponent,
      },
      { flags: { cumulativeEnergy: true }, component: CumulativeEnergyComponent },
      { flags: { periodicEnergy: true }, component: PeriodicEnergyComponent },
      { flags: { importedEnergy: false, exportedEnergy: false }, component: false },
      { flags: { cumulativeEnergy: false, periodicEnergy: false }, component: false },
    ),
  });

  /**
   * @see {@link Cluster}
   */
  export const ClusterInstance = MutableCluster.ExtensibleOnly(Base);

  /**
   * This cluster provides a mechanism for querying data about the electrical energy imported or provided by the
   * server.
   *
   * Per the Matter specification you cannot use {@link ElectricalEnergyMeasurementCluster} without enabling certain
   * feature combinations. You must use the {@link with} factory method to obtain a working cluster.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.12
   */
  export type Cluster = Identity<typeof ClusterInstance>;

  export const Cluster: Cluster = ClusterInstance;
  const IMPE_CUME = { importedEnergy: true, cumulativeEnergy: true };
  const EXPE_CUME = { exportedEnergy: true, cumulativeEnergy: true };
  const IMPE_PERE = { importedEnergy: true, periodicEnergy: true };
  const EXPE_PERE = { exportedEnergy: true, periodicEnergy: true };
  const CUME = { cumulativeEnergy: true };
  const PERE = { periodicEnergy: true };

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
      cumulativeEnergyImported: MutableCluster.AsConditional(ImportedEnergyAndCumulativeEnergyComponent.attributes.cumulativeEnergyImported, { mandatoryIf: [IMPE_CUME] }),
      cumulativeEnergyExported: MutableCluster.AsConditional(ExportedEnergyAndCumulativeEnergyComponent.attributes.cumulativeEnergyExported, { mandatoryIf: [EXPE_CUME] }),
      periodicEnergyImported: MutableCluster.AsConditional(ImportedEnergyAndPeriodicEnergyComponent.attributes.periodicEnergyImported, { mandatoryIf: [IMPE_PERE] }),
      periodicEnergyExported: MutableCluster.AsConditional(ExportedEnergyAndPeriodicEnergyComponent.attributes.periodicEnergyExported, { mandatoryIf: [EXPE_PERE] }),
      cumulativeEnergyReset: MutableCluster.AsConditional(CumulativeEnergyComponent.attributes.cumulativeEnergyReset, { optionalIf: [CUME] }),
    },

    events: {
      cumulativeEnergyMeasured: MutableCluster.AsConditional(CumulativeEnergyComponent.events.cumulativeEnergyMeasured, { mandatoryIf: [CUME] }),
      periodicEnergyMeasured: MutableCluster.AsConditional(PeriodicEnergyComponent.events.periodicEnergyMeasured, { mandatoryIf: [PERE] }),
    },
  });

  /**
   * This cluster supports all ElectricalEnergyMeasurement features. It may support illegal feature combinations.
   *
   * If you use this cluster you must manually specify which features are active and ensure the set of active
   * features is legal per the Matter specification.
   */
  export type Complete = Identity<typeof CompleteInstance>;

  export const Complete: Complete = CompleteInstance;
}

export type ElectricalEnergyMeasurementCluster = ElectricalEnergyMeasurement.Cluster;
export const ElectricalEnergyMeasurementCluster = ElectricalEnergyMeasurement.Cluster;
ClusterRegistry.register(ElectricalEnergyMeasurement.Complete);
