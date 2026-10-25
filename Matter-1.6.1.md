# Matter 1.6.1

This file summarizes the Matter 1.6.1 deltas captured for Matterbridge, compared with Matter 1.6.0.

IDs below are hexadecimal, matching the official Matter specs.

## New Device Types

No new device types were added in Matter 1.6.1.

## Changed Device Types

| Device Type                | ID     | 1.6.0 | 1.6.1 | Difference                                                          |
| -------------------------- | ------ | ----- | ----- | ------------------------------------------------------------------- |
| AirPurifier                | 0x002D | 2     | 3     | Added Groupcast condition requirement                               |
| Chime                      | 0x0146 | 1     | 2     | Introduction of speaker device type requirements for volume control |
| ClosureController          | 0x023E | 1     | 2     | Added Groupcast condition requirement                               |
| ColorDimmerSwitch          | 0x0105 | 3     | 4     | Added Groupcast condition requirement                               |
| ColorTemperatureLight      | 0x010C | 4     | 5     | Added Groupcast condition requirement                               |
| ControlBridge              | 0x0840 | 3     | 4     | Added Groupcast condition requirement                               |
| DimmableLight              | 0x0101 | 3     | 4     | Added Groupcast condition requirement                               |
| DimmablePlugInUnit         | 0x010B | 5     | 6     | Added Groupcast condition requirement                               |
| DimmerSwitch               | 0x0104 | 3     | 4     | Added Groupcast condition requirement                               |
| DoorLockController         | 0x000B | 3     | 4     | Added Groupcast condition requirement                               |
| ExtendedColorLight         | 0x010D | 4     | 5     | Added Groupcast condition requirement                               |
| Fan                        | 0x002B | 4     | 5     | Added Groupcast condition requirement                               |
| MountedDimmableLoadControl | 0x0110 | 2     | 3     | Added Groupcast condition requirement                               |
| MountedOnOffControl        | 0x010F | 2     | 3     | Added Groupcast condition requirement                               |
| OnOffLight                 | 0x0100 | 3     | 4     | Added Groupcast condition requirement                               |
| OnOffLightSwitch           | 0x0103 | 3     | 4     | Added Groupcast condition requirement                               |
| OnOffPluginUnit            | 0x010A | 4     | 5     | Added Groupcast condition requirement                               |
| OnOffSensor                | 0x0850 | 3     | 4     | Added Groupcast condition requirement                               |
| Pump                       | 0x0303 | 3     | 4     | Added Groupcast condition requirement                               |
| PumpController             | 0x0304 | 4     | 5     | Added Groupcast condition requirement                               |
| RoomAirConditioner         | 0x0072 | 3     | 4     | Added Groupcast condition requirement                               |
| RootNode                   | 0x0016 | 4     | 5     | Added conditions and cluster requirements for the Groupcast cluster |
| SmokeCOAlarm               | 0x0076 | 1     | 2     | Added Groupcast condition requirement                               |
| Thermostat                 | 0x0301 | 6     | 7     | Added Groupcast condition requirement                               |
| ThermostatController       | 0x030A | 1     | 2     | Added Groupcast condition requirement                               |
| WindowCovering             | 0x0202 | 6     | 7     | Added Groupcast condition requirement                               |
| WindowCoveringController   | 0x0203 | 4     | 5     | Added Groupcast condition requirement                               |

## New Cluster Types

No new cluster types were added in Matter 1.6.1.

## Changed Cluster Types

| Cluster Type       | ID     | 1.6.0 | 1.6.1 | Difference                               |
| ------------------ | ------ | ----- | ----- | ---------------------------------------- |
| GroupKeyManagement | 0x003F | 3     | 4     | Added C quality to GroupKeyMap attribute |

### Remarks

Quality C = Changes Omitted: changes to the attribute value are not reported to subscribers.

## Clusters No Longer Provisional

| Cluster Type | ID     | 1.6.0 | 1.6.1 | Difference                                                  |
| ------------ | ------ | ----- | ----- | ----------------------------------------------------------- |
| Groupcast    | 0x0065 | 1     | 1     | Provisional status removed, without a cluster revision bump |

### Groupcast remarks

Groupcast was introduced in Matter 1.6.0 (it is not present in Matter 1.5.0 and 1.5.1) as a provisional cluster: the cluster ID, the Listener, Sender and PerGroup features, and all attributes and commands were `provisionalConform`. In Matter 1.6.1 the provisional conformance is removed:

- Features: at least one of Listener (LN) or Sender (SD) is required, PerGroup (PGA) is optional.
- Attributes and commands use their plain mandatory conformance; the ConfigureAuxiliaryACL command is mandatory when Listener is supported.
- The LeaveGroupResponse command is no longer marked fabric scoped.

The RootNode device type (revision 5) adds Groupcast as a singleton server cluster with two new conditions:

- `GroupcastListenerCond`: SHALL be supported if any endpoint implements the Groups cluster server. It makes Groupcast with the Listener feature mandatory, and also the AUX feature of Access Control.
- `GroupcastSenderCond`: SHALL be supported if any endpoint implements the Binding cluster server. It makes Groupcast with the Sender feature mandatory.

Otherwise Groupcast is optional. Either condition also makes the GCAST feature of Group Key Management mandatory.

## New Semantic Tag Namespaces

No new semantic tag namespaces were added in Matter 1.6.1.

## Changed Semantic Tag Namespaces

No semantic tag namespaces were changed in Matter 1.6.1.
