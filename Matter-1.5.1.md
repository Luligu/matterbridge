# Matter 1.5.1

This file summarizes the Matter 1.5.1 deltas captured for Matterbridge, compared with Matter 1.4.2.

IDs below are hexadecimal, matching the official Matter specs.

The official HTML specs under `chip/1.5.1/specs/` remain the primary reference.

## Changed Device Types

| Device Type            | ID     | 1.4.2 | 1.5.1 | Difference                                                                                |
| ---------------------- | ------ | ----- | ----- | ----------------------------------------------------------------------------------------- |
| BaseDeviceType         | 0x0000 | 2     | 3     | Removed certification program conditions                                                  |
| BatteryStorage         | 0x0018 | 1     | 2     | Added mandate of two Power Source and Electrical Sensor composed device types             |
| DeviceEnergyManagement | 0x050D | 2     | 3     | Updated to include Electrical Grid Conditions                                             |
| DoorLock               | 0x000A | 3     | 4     | Removed Zigbee related elements                                                           |
| Fan                    | 0x002B | 3     | 4     | Moved FanModeSequence element requirement to Fan Control cluster                          |
| FlowSensor             | 0x0306 | 2     | 3     | Removed Zigbee related elements                                                           |
| HumiditySensor         | 0x0307 | 2     | 3     | Removed Zigbee related elements                                                           |
| LightSensor            | 0x0106 | 3     | 4     | Removed Zigbee related elements                                                           |
| PressureSensor         | 0x0305 | 2     | 3     | Removed Zigbee related elements                                                           |
| RoomAirConditioner     | 0x0072 | 2     | 3     | Added filter monitoring clusters                                                          |
| RootNode               | 0x0016 | 3     | 4     | Added conditions and cluster requirements for Time Sync, TLS, and Power Source clusters   |
| TemperatureSensor      | 0x0302 | 2     | 3     | Added Thermostat User Interface Configuration cluster and removed Zigbee related elements |
| Thermostat             | 0x0301 | 4     | 5     | Moved disallowed element conformance to Thermostat cluster                                |
| WindowCovering         | 0x0202 | 4     | 6     | Introduced conditions on Closure clusters; removed Zigbee related elements                |

## New Device Types

| Device Type            | ID     | Revision | Difference                                  |
| ---------------------- | ------ | -------- | ------------------------------------------- |
| AudioDoorbell          | 0x0141 | 1        | Initial release                             |
| Camera                 | 0x0142 | 1        | Initial release                             |
| CameraController       | 0x0147 | 1        | Initial release                             |
| Chime                  | 0x0146 | 1        | Initial release                             |
| Closure                | 0x0230 | 1        | Initial revision                            |
| ClosureController      | 0x023E | 1        | Initial revision                            |
| ClosurePanel           | 0x0231 | 1        | Initial revision                            |
| Doorbell               | 0x0148 | 1        | Initial release                             |
| ElectricalEnergyTariff | 0x0513 | 1        | Initial revision                            |
| ElectricalMeter        | 0x0514 | 1        | Initial revision                            |
| ElectricalUtilityMeter | 0x0511 | 1        | Initial release                             |
| FloodlightCamera       | 0x0144 | 1        | Initial release                             |
| Intercom               | 0x0140 | 2        | Initial release; Addition of Generic Switch |
| IrrigationSystem       | 0x0040 | 1        | Initial revision                            |
| MeterReferencePoint    | 0x0512 | 1        | Initial release                             |
| SnapshotCamera         | 0x0145 | 1        | Initial release                             |
| SoilSensor             | 0x0045 | 1        | Initial revision                            |
| VideoDoorbell          | 0x0143 | 1        | Initial release                             |

## Changed Cluster Types

| Cluster Type                                          | ID     | 1.4.2 | 1.5.1 | Difference                                                                                                                     |
| ----------------------------------------------------- | ------ | ----- | ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| BooleanState                                          | 0x0045 | 1     | 2     | Removed P quality                                                                                                              |
| CarbonDioxideConcentrationMeasurement                 | 0x040D | 3     | 4     | Removed P quality                                                                                                              |
| CarbonMonoxideConcentrationMeasurement                | 0x040C | 3     | 4     | Removed P quality                                                                                                              |
| ColorControl                                          | 0x0300 | 7     | 9     | Change WhitePoint* and ColorPoint* attributes from RW to R (CCB 2490, TCR 11893); Removed P quality                            |
| ConcentrationMeasurementClusters                      | 0x0000 | 3     | 4     | Removed P quality                                                                                                              |
| DoorLock                                              | 0x0101 | 9     | 10    | Removed Zigbee related elements and P quality                                                                                  |
| ElectricalEnergyMeasurement                           | 0x0091 | 1     | 2     | Added support for apparent and reactive energy measurement                                                                     |
| EnergyEVSE                                            | 0x0099 | 3     | 4     | Sync with SDK revision number                                                                                                  |
| FanControl                                            | 0x0202 | 5     | 6     | Removed Zigbee related elements, removed P quality                                                                             |
| FlowMeasurement                                       | 0x0404 | 3     | 4     | Removed P quality                                                                                                              |
| FormaldehydeConcentrationMeasurement                  | 0x042B | 3     | 4     | Removed P quality                                                                                                              |
| IlluminanceMeasurement                                | 0x0400 | 3     | 4     | Removed P quality                                                                                                              |
| LevelControl                                          | 0x0008 | 6     | 7     | Simplify constraint, added F quality and changed the conformance to mandatory for MinLevel and MaxLevel, and removed P quality |
| NitrogenDioxideConcentrationMeasurement               | 0x0413 | 3     | 4     | Removed P quality                                                                                                              |
| OccupancySensing                                      | 0x0406 | 5     | 6     | Removed P quality                                                                                                              |
| OzoneConcentrationMeasurement                         | 0x0415 | 3     | 4     | Removed P quality                                                                                                              |
| PM10ConcentrationMeasurement                          | 0x042D | 3     | 4     | Removed P quality                                                                                                              |
| PM1ConcentrationMeasurement                           | 0x042C | 3     | 4     | Removed P quality                                                                                                              |
| PM2.5ConcentrationMeasurement                         | 0x042A | 3     | 4     | Removed P quality                                                                                                              |
| PressureMeasurement                                   | 0x0403 | 3     | 4     | Removed P quality                                                                                                              |
| PumpConfigurationandControl                           | 0x0200 | 4     | 5     | Removed P quality                                                                                                              |
| RVCCleanMode                                          | 0x0055 | 4     | 5     | DirectModeChange made non-provisional                                                                                          |
| RVCRunMode                                            | 0x0054 | 3     | 4     | DirectModeChange made non-provisional                                                                                          |
| RadonConcentrationMeasurement                         | 0x042F | 3     | 4     | Removed P quality                                                                                                              |
| RelativeHumidityMeasurement                           | 0x0405 | 3     | 4     | Removed P quality                                                                                                              |
| TemperatureMeasurement                                | 0x0402 | 4     | 5     | Removed P quality                                                                                                              |
| TotalVolatileOrganicCompoundsConcentrationMeasurement | 0x042E | 3     | 4     | Removed P quality                                                                                                              |
| WaterContentMeasurementClusters                       | 0x0000 | 3     | 4     | Removed P quality                                                                                                              |
| WindowCovering                                        | 0x0102 | 6     | 8     | Removed ABS feature and all associated elements from the cluster; Removed P quality                                            |

### Remarks

Quality P is the old persistence marker for attribute data. This means that is even more important to set the correct value in onConfigure() if it is available from the real device.

## New Cluster Types

| Cluster Type                        | ID     | Revision | Summary                                                                                                                                                        |
| ----------------------------------- | ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CameraAVSettingsUserLevelManagement | 0x0552 | 1        | Initial release                                                                                                                                                |
| CameraAVStreamManagement            | 0x0551 | 1        | Initial release                                                                                                                                                |
| Chime                               | 0x0556 | 1        | Initial release                                                                                                                                                |
| ClosureControl                      | 0x0104 | 1        | Initial revision                                                                                                                                               |
| ClosureDimension                    | 0x0105 | 1        | Initial revision                                                                                                                                               |
| CommodityMetering                   | 0x0B07 | 1        | Initial Release                                                                                                                                                |
| CommodityPrice                      | 0x0095 | 4        | Mandatory global ClusterRevision attribute added; Updated from SE1.4 version; CCB 1447 2964 2965; CCBs 2043 2706 2810 2912 3566; Initial Matter revision       |
| CommodityTariff                     | 0x0700 | 1        | Initial Matter revision                                                                                                                                        |
| ElectricalGridConditions            | 0x00A0 | 1        | Initial Matter revision                                                                                                                                        |
| MeterIdentification                 | 0x0B06 | 1        | Initial version                                                                                                                                                |
| PushAVStreamTransport               | 0x0555 | 2        | Initial Release; Add DoorbellPressed to TriggerActivationReason. Augment PushTransport events with Session numbers and Event context. Add multi-stream support |
| SoilMeasurement                     | 0x0430 | 1        | Initial revision                                                                                                                                               |
| TLSCertificateManagement            | 0x0801 | 1        | Initial Release                                                                                                                                                |
| TLSClientManagement                 | 0x0802 | 1        | Initial Release                                                                                                                                                |
| WebRTCTransportProvider             | 0x0553 | 2        | Initial version of the WebRTC Transport Provider Cluster; Add multi stream support                                                                             |
| WebRTCTransportRequestor            | 0x0554 | 2        | Initial version of the WebRTC Transport Requestor Cluster; Add multi stream support                                                                            |
| ZoneManagement                      | 0x0550 | 1        | Initial version of the Zone Management cluster                                                                                                                 |
