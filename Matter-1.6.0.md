# Matter 1.6.0

This file summarizes the Matter 1.6.0 deltas captured for Matterbridge, compared with Matter 1.5.1.

IDs below are hexadecimal, matching the official Matter specs.

## Changed Device Types

| Device Type                  | ID     | 1.5.1 | 1.6.0 | Difference                                                |
| ---------------------------- | ------ | ----- | ----- | --------------------------------------------------------- |
| RainSensor                   | 0x0044 | 1     | 2     | Added BooleanState ChangeEvent feature as mandatory       |
| Refrigerator                 | 0x0070 | 2     | 3     | Added optional Activated Carbon Filter Monitoring cluster |
| TemperatureControlledCabinet | 0x0071 | 5     | 6     | Added optional Temperature Alarm cluster                  |
| Thermostat                   | 0x0301 | 5     | 6     | Added optional Ambient Context Sensing client cluster     |
| WaterFreezeDetector          | 0x0041 | 1     | 2     | Added BooleanState ChangeEvent feature as mandatory       |
| WaterLeakDetector            | 0x0043 | 1     | 2     | Added BooleanState ChangeEvent feature as mandatory       |

## New Device Types

No new device types were added in Matter 1.6.0.

## Changed Cluster Types

| Cluster Type                                          | ID     | 1.5.1 | 1.6.0 | Difference                                                                                                          |
| ----------------------------------------------------- | ------ | ----- | ----- | ------------------------------------------------------------------------------------------------------------------- |
| AccessControl                                         | 0x001F | 2     | 3     | Added Auxiliary feature and AuxiliaryACL attribute                                                                  |
| BasicInformation                                      | 0x0028 | 5     | 6     | Added extended information fields to CapabilityMinimaStruct and removed provisional status for ConfigurationVersion |
| BooleanState                                          | 0x0045 | 2     | 3     | Introduced ChangeEvent feature                                                                                      |
| BooleanStateConfiguration                             | 0x0080 | 1     | 2     | Added FaultEvents feature                                                                                           |
| BridgedDeviceBasicInformation                         | 0x0039 | 5     | 6     | Adopt latest version of base cluster (Basic Information)                                                            |
| CameraAVStreamManagement                              | 0x0551 | 1     | 2     | Add attribute ImageRotationDiscreteAngles                                                                           |
| CarbonDioxideConcentrationMeasurement                 | 0x040D | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue and Uncertainty attributes                                    |
| CarbonMonoxideConcentrationMeasurement                | 0x040C | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue and Uncertainty attributes                                    |
| ConcentrationMeasurementClusters                      | 0x0000 | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue and Uncertainty attributes                                    |
| FlowMeasurement                                       | 0x0404 | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue and Tolerance attributes                                      |
| FormaldehydeConcentrationMeasurement                  | 0x042B | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue and Uncertainty attributes                                    |
| GeneralDiagnostics                                    | 0x0033 | 2     | 3     | Added DeviceLoadStatus attribute                                                                                    |
| GroupKeyManagement                                    | 0x003F | 2     | 3     | Refocus on pure key management; introduce Groupcast feature associated with Groupcast cluster                       |
| IlluminanceMeasurement                                | 0x0400 | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue, Tolerance and LightSensorType attributes                     |
| NitrogenDioxideConcentrationMeasurement               | 0x0413 | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue and Uncertainty attributes                                    |
| OccupancySensing                                      | 0x0406 | 6     | 7     | Added OccupancyEvent feature                                                                                        |
| OzoneConcentrationMeasurement                         | 0x0415 | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue and Uncertainty attributes                                    |
| PM10ConcentrationMeasurement                          | 0x042D | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue and Uncertainty attributes                                    |
| PM1ConcentrationMeasurement                           | 0x042C | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue and Uncertainty attributes                                    |
| PM2.5ConcentrationMeasurement                         | 0x042A | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue and Uncertainty attributes                                    |
| PressureMeasurement                                   | 0x0403 | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue, Tolerance and Scaled attributes                              |
| RadonConcentrationMeasurement                         | 0x042F | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue and Uncertainty attributes                                    |
| RelativeHumidityMeasurement                           | 0x0405 | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue and Tolerance attributes                                      |
| SmokeCOAlarm                                          | 0x005C | 1     | 2     | Added Inoperative to ExpressedStateEnum and added Unmounted attribute                                               |
| TemperatureMeasurement                                | 0x0402 | 5     | 6     | Added F quality to MinMeasuredValue, MaxMeasuredValue and Tolerance attributes                                      |
| Thermostat                                            | 0x0201 | 10    | 11    | Added support for Thermostat suggestions; added events                                                              |
| TotalVolatileOrganicCompoundsConcentrationMeasurement | 0x042E | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue and Uncertainty attributes                                    |
| WaterContentMeasurementClusters (1)                   | 0x0000 | 4     | 5     | Added F quality to MinMeasuredValue, MaxMeasuredValue and Tolerance attributes                                      |

### Remarks

Quality F = Fixed: the attribute has fixed persistence and is not expected to change during normal operation.

(1) In matter.js, this family maps to the concrete `RelativeHumidityMeasurement` cluster export rather than a separate `WaterContentMeasurementClusters` module.

## New Cluster Types

| Cluster Type          | ID     | Revision | Summary                                                                                                                                                              |
| --------------------- | ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AmbientContextSensing | 0x0431 | 1        | Initial revision                                                                                                                                                     |
| Groupcast             | 0x0065 | 1        | Initial release, replacing functionality previously in Groups and Group Key Management clusters and addressing issues with application of those clusters (TCR 11433) |
| TemperatureAlarm      | 0x0064 | 1        | Initial revision                                                                                                                                                     |

## New Semantic Tag Namespaces

No new semantic tag namespaces were added in Matter 1.6.0.
