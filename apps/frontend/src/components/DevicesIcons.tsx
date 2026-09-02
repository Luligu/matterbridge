// oxlint-disable unicorn/prefer-set-has
// oxlint-disable no-unused-expressions
// oxlint-disable complexity

// TODO: verify each rule
// oxlint-disable typescript/no-unsafe-type-assertion
// oxlint-disable react/no-clone-element

// @mdi
import {
  mdiPowerSocketEu,
  mdiTransmissionTower,
  mdiEvStation,
  mdiWaterBoiler,
  mdiHeatPump,
  mdiSolarPanel,
  mdiHomeBattery,
  mdiLightSwitch,
  mdiThermostat,
  mdiGestureTapButton,
  mdiWaterPercent,
  mdiSmokeDetectorVariant,
  mdiAirPurifier,
  mdiAirFilter,
  mdiWashingMachine,
  mdiTumbleDryer,
  mdiDishwasher,
  mdiStove,
  mdiThermostatBox,
  mdiRobotVacuum,
  mdiMeterElectricOutline,
  mdiSprinklerVariant,
  mdiValve,
  mdiTelevision,
  mdiVolumeHigh,
  mdiLan,
} from '@mdi/js';
import { Icon } from '@mdi/react';
// @mui/icons-material
import AcUnitIcon from '@mui/icons-material/AcUnit'; // Freeze detector
import AirIcon from '@mui/icons-material/Air'; // Fan
import Battery4BarIcon from '@mui/icons-material/Battery4Bar';
import BlindsIcon from '@mui/icons-material/Blinds'; // WindowCovering
import ChecklistIcon from '@mui/icons-material/Checklist'; // ModeSelect
import CycloneIcon from '@mui/icons-material/Cyclone'; // Pump
import DoorFrontIcon from '@mui/icons-material/DoorFront';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import FilterDramaIcon from '@mui/icons-material/FilterDrama'; // Cloud for weather
import GasMeterIcon from '@mui/icons-material/GasMeter'; // Flow
import HvacIcon from '@mui/icons-material/Hvac'; // AirConditioner AirPurifier
import KitchenIcon from '@mui/icons-material/Kitchen';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import LightModeIcon from '@mui/icons-material/LightMode';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import MicrowaveIcon from '@mui/icons-material/Microwave';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'; // Chime, Doorbell, AudioDoorbell
import SensorOccupiedIcon from '@mui/icons-material/SensorOccupied';
import SensorsOffIcon from '@mui/icons-material/SensorsOff';
import ThermostatIcon from '@mui/icons-material/Thermostat'; // Temperature
import ThunderstormIcon from '@mui/icons-material/Thunderstorm'; // Rain sensor
import VideocamIcon from '@mui/icons-material/Videocam'; // Camera device types
import WaterIcon from '@mui/icons-material/Water'; // Water leak detector
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
// @mui/material
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
// React
import { useContext, useEffect, useState, useRef, memo, cloneElement, useCallback } from 'react';

import { debug } from '../appState';
import { type WsMessageApiClustersResponse, type WsMessageApiResponse, type WsMessageApiStateUpdate, type ApiDevice, type Cluster } from '../utils/backendShared';
import { MbfWindow } from './MbfWindow';
import { WebSocketContext } from './WebSocketProvider';

const debugUpdate = false; // Set to true to enable debug logs for updates in DevicesIcons component
const localDebug = false; // Set to true to enable debug logs only in DevicesIcons component

// Lookup tables for enum values
const FanModeLookup = ['Off', 'Low', 'Medium', 'High', 'On', 'Auto', 'Smart'];

// Icon, value, unit sx
const renderBoxSx = { display: 'flex', gap: '2px', justifyContent: 'space-evenly', width: '100%', height: '40px' };
const iconSx = { margin: '0', padding: '0', fontSize: '36px', fontWeight: 'medium', color: 'var(--primary-color)' };
const valueSx = { margin: '0', padding: '0', fontSize: '20px', fontWeight: 'medium', color: 'var(--div-text-color)', textAlign: 'center' };
const unitSx = { margin: '0', padding: '0', paddingBottom: '2px', fontSize: '16px', fontWeight: 'medium', color: 'var(--div-text-color)', textAlign: 'center' };

// Details sx
const detailsBoxSx = {
  display: 'flex',
  gap: '2px',
  justifyContent: 'center',
  width: '100%',
  height: '18px',
  margin: '0',
  padding: '0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'normal',
};
const detailsSx = { margin: '0', padding: '0', fontSize: '12px', fontWeight: 'normal', color: 'var(--div-text-color)' };

// Name sx
const nameBoxSx = {
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  height: '52px',
  margin: '0',
  padding: '0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'normal',
};
const nameSx = { margin: '0', padding: '0', fontSize: '14px', fontWeight: 'bold', color: 'var(--div-text-color)' };

// Endpoint sx
const endpointBoxSx = {
  display: 'flex',
  gap: '4px',
  justifyContent: 'center',
  width: '100%',
  height: '15px',
  margin: '0',
  padding: '0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'normal',
};
const endpointSx = { margin: '0', padding: '0px 4px', borderRadius: '5px', textAlign: 'center', fontSize: '12px', fontWeight: 'normal', color: 'var(--secondary-color)' };

const lightDeviceTypes = [0x0100, 0x0101, 0x010c, 0x010d];
const outletDeviceTypes = [0x010a, 0x010b];
const switchDeviceTypes = [0x010f, 0x0110];
const currentLevelDeviceTypes = [0x0100, 0x0101, 0x010c, 0x010d, 0x010a, 0x010b, 0x0110];
const fanControlDeviceTypes = [0x002b, 0x002d]; // Fan, AirPurifier
const closurePositionNames = ['Closed', 'Open', 'Partial', 'Pedestrian', 'Ventilation', 'Signature'] as const;

/**
 * Gets the ClosureControl current position name from an OverallCurrentState value.
 *
 * @param {unknown} value ClosureControl OverallCurrentState attribute value.
 * @returns {string} The current position name, or N/A when unavailable or invalid.
 */
function getClosurePositionName(value: unknown): string {
  if (typeof value !== 'object' || value === null || !('position' in value)) return 'N/A';
  const position = value.position;
  if (typeof position !== 'number' || !Number.isInteger(position) || position < 0 || position >= closurePositionNames.length) return 'N/A';
  return closurePositionNames[position];
}

/**
 * Gets the WindowCovering current position name from a percentage in hundredths.
 *
 * @param {unknown} value WindowCovering currentPositionLiftPercent100ths attribute value.
 * @returns {string} The current position name, or N/A when unavailable or invalid.
 */
function getWindowCoveringPositionName(value: unknown): string {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10_000) return 'N/A';
  if (value === 0) return closurePositionNames[0]; // Closed
  if (value === 10_000) return closurePositionNames[1]; // Open
  return closurePositionNames[2]; // Partial
}

/**
 * Gets the ClosureDimension current position name from a CurrentState value.
 *
 * @param {unknown} value ClosureDimension CurrentState attribute value.
 * @returns {string} The current position name, or N/A when unavailable or invalid.
 */
function getClosureDimensionPositionName(value: unknown): string {
  if (typeof value !== 'object' || value === null || !('position' in value)) return 'N/A';
  return getWindowCoveringPositionName(value.position);
}

interface RenderProps {
  icon: React.JSX.Element;
  iconColor?: string;
  cluster: Cluster;
  value: string | number | boolean | null | undefined;
  unit?: string;
  prefix?: boolean;
}

function Render({ icon, iconColor, cluster, value, unit, prefix }: RenderProps): React.JSX.Element {
  if (debug) console.log(`Render cluster "${cluster.clusterName}.${cluster.attributeName}" value(${typeof value}-${Number.isNaN(value)}) "${value}" unit "${unit}"`);
  // oxlint-disable-next-line no-param-reassign
  prefix = prefix ?? false;
  return (
    <Box key={`${cluster.clusterId}-${cluster.attributeId}-box`} sx={renderBoxSx}>
      {icon && cloneElement(icon, { key: `${cluster.clusterId}-${cluster.attributeId}-icon`, sx: { ...iconSx, color: iconColor ?? 'var(--primary-color)' } })}
      <Box
        key={`${cluster.clusterId}-${cluster.attributeId}-valueunitbox`}
        sx={{ ...renderBoxSx, gap: '4px', alignContent: 'center', alignItems: 'end', justifyContent: 'center' }}
      >
        {unit && prefix && (
          <Typography key={`${cluster.clusterId}-${cluster.attributeId}-unit-prefix`} sx={unitSx}>
            {unit}
          </Typography>
        )}
        <Typography key={`${cluster.clusterId}-${cluster.attributeId}-value`} sx={valueSx}>
          {value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value)) || value === 'NaN' ? '---' : value}
        </Typography>
        {unit && !prefix && (
          <Typography key={`${cluster.clusterId}-${cluster.attributeId}-unit-suffix`} sx={unitSx}>
            {unit}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

interface DeviceProps {
  device: ApiDevice;
  endpoint: string;
  id: string;
  deviceType: number;
  clusters: Cluster[];
}

function Device({ device, endpoint, id, deviceType, clusters }: DeviceProps): React.JSX.Element {
  const airQualityLookup = ['Unknown', 'Good', 'Fair', 'Moderate', 'Poor', 'VeryPoor', 'Ext.Poor'];
  let details = '';
  const getEnergy = (cluster: Cluster | undefined): number | null => {
    if (!cluster) return null;
    const value = cluster.attributeLocalValue;
    if (!value || typeof value !== 'object' || !('energy' in value)) return null;
    const energy = value.energy;
    if (typeof energy !== 'number' && typeof energy !== 'bigint') return null;
    return Math.round(Number(energy) / 1_000_000);
  };
  const energyImportedCluster = clusters.find((cluster) => cluster.clusterName === 'ElectricalEnergyMeasurement' && cluster.attributeName === 'cumulativeEnergyImported');
  const energyExportedCluster = clusters.find((cluster) => cluster.clusterName === 'ElectricalEnergyMeasurement' && cluster.attributeName === 'cumulativeEnergyExported');
  const energyImported = getEnergy(energyImportedCluster);
  const energyExported = getEnergy(energyExportedCluster);
  const energyCluster = energyImportedCluster ?? energyExportedCluster;
  const energyValue = energyImported ?? (energyExported !== null ? `+ ${energyExported}` : null);

  if (debug) console.log(`Device "${device.name}" endpoint "${endpoint}" id "${id}" deviceType "0x${deviceType.toString(16).padStart(4, '0')}" clusters (${clusters?.length})`);

  // Descriptor tagList details
  const tagList = clusters.find((cluster) => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'tagList')?.attributeLocalValue as
    | Array<{ namespaceId: number; tag: number; label: string }>
    | undefined;
  if (tagList) {
    let tagListLabels = '';
    tagList.map((t) => {
      if (t.label) tagListLabels += t.label + ' ';
    });
    details = tagListLabels.trim();
  }

  // PowerSource details
  deviceType === 0x0011 &&
    clusters
      .filter((cluster) => cluster.clusterName === 'PowerSource' && cluster.attributeName === 'batVoltage')
      .map((cluster) => (details = `${(cluster.attributeLocalValue ?? 0) as number} mV`));

  // LevelControl details
  currentLevelDeviceTypes.includes(deviceType) &&
    clusters
      .filter((cluster) => cluster.clusterName === 'LevelControl' && cluster.attributeName === 'currentLevel')
      .map((cluster) => (details = `Level ${cluster.attributeValue}`));

  // WindowCovering details
  deviceType === 0x0202 &&
    clusters
      .filter((cluster) => cluster.clusterName === 'WindowCovering' && cluster.attributeName === 'currentPositionLiftPercent100ths')
      .map((cluster) => (details = `Position ${(cluster.attributeLocalValue as number) / 100}%`));

  // Thermostat details
  deviceType === 0x0301 &&
    clusters
      .filter((cluster) => cluster.clusterName === 'Thermostat' && cluster.attributeName === 'occupiedHeatingSetpoint')
      .map((cluster) => (details = `Heat ${(cluster.attributeLocalValue as number) / 100}°C `));
  deviceType === 0x0301 &&
    clusters
      .filter((cluster) => cluster.clusterName === 'Thermostat' && cluster.attributeName === 'occupiedCoolingSetpoint')
      .map((cluster) => (details = details + `Cool ${(cluster.attributeLocalValue as number) / 100}°C`));

  // Fan, AirPurifier details
  fanControlDeviceTypes.includes(deviceType) &&
    clusters
      .filter((cluster) => cluster.clusterName === 'FanControl' && cluster.attributeName === 'percentCurrent')
      .map((cluster) => (details = `Speed ${cluster.attributeValue}%`));

  // SmokeCoAlarm details
  deviceType === 0x0076 &&
    clusters
      .filter((cluster) => cluster.clusterName === 'SmokeCoAlarm' && cluster.attributeName === 'coState')
      .map((cluster) => (details = cluster.attributeLocalValue === 0 ? 'No CO detected' : 'CO alarm!'));

  // ElectricalPowerMeasurement details
  deviceType === 0x0510 &&
    clusters
      .filter((cluster) => cluster.clusterName === 'ElectricalPowerMeasurement' && cluster.attributeName === 'voltage')
      .map((cluster) => (details = `${(cluster.attributeLocalValue as number) / 1000} V, `));
  deviceType === 0x0510 &&
    clusters
      .filter((cluster) => cluster.clusterName === 'ElectricalPowerMeasurement' && cluster.attributeName === 'activeCurrent')
      .map((cluster) => (details = details + `${(cluster.attributeLocalValue as number) / 1000} A, `));
  deviceType === 0x0510 &&
    clusters
      .filter((cluster) => cluster.clusterName === 'ElectricalPowerMeasurement' && cluster.attributeName === 'activePower')
      .map((cluster) => (details = details + `${(cluster.attributeLocalValue as number) / 1_000_000} kW`));

  // ModeSelect details
  if (deviceType === 0x0027) {
    const mode = clusters.find((cluster) => cluster.clusterName === 'ModeSelect' && cluster.attributeName === 'currentMode')?.attributeLocalValue as number | undefined;
    const supportedModes = clusters.find((cluster) => cluster.clusterName === 'ModeSelect' && cluster.attributeName === 'supportedModes')?.attributeLocalValue as
      | Array<{ mode: number; label: string }>
      | undefined;
    details = supportedModes?.find((m) => m.mode === mode)?.label || 'Unknown';
  }

  // RvcRunMode details
  if (deviceType === 0x0074) {
    const runMode = clusters.find((cluster) => cluster.clusterName === 'RvcRunMode' && cluster.attributeName === 'currentMode')?.attributeLocalValue as number | undefined;
    const runSupportedModes = clusters.find((cluster) => cluster.clusterName === 'RvcRunMode' && cluster.attributeName === 'supportedModes')?.attributeLocalValue as
      | Array<{ mode: number; label: string }>
      | undefined;
    details = runSupportedModes?.find((m) => m.mode === runMode)?.label || 'Unknown';
  }

  // oxfmt-ignore
  return (
    <MbfWindow style={{ margin: '0px', padding: '5px', width: '150px', height: '150px', borderColor: 'var(--div-bg-color)', borderRadius: '5px', justifyContent: 'space-between' }}>
      {/* BridgedDeviceBasicInformation.reachable */}
      {deviceType===0x0013 && clusters.filter(cluster => cluster.clusterName === 'BridgedDeviceBasicInformation' && cluster.attributeName === 'reachable').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={cluster.attributeLocalValue===true ? <WifiIcon/> : <WifiOffIcon/>} iconColor={cluster.attributeLocalValue===true ?'green':'red'} cluster={cluster} value={cluster.attributeLocalValue===true ? 'Online' : 'Offline'} />
      ))}
      {/* PowerSource */}
      {deviceType===0x0011 && clusters.filter(cluster => cluster.clusterName === 'PowerSource' && cluster.attributeName === 'batPercentRemaining').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Battery4BarIcon/>} cluster={cluster} value={cluster.attributeLocalValue as number/2} unit='%' />
      ))}
      {deviceType===0x0011 && clusters.filter(cluster => cluster.clusterName === 'PowerSource' && cluster.attributeName === 'wiredCurrentType').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<ElectricalServicesIcon/>} cluster={cluster} value={cluster.attributeLocalValue===0 ? 'AC' : 'DC'} />
      ))}

      {/* DeviceEnergyManagement */}
      {deviceType===0x050d && clusters.filter(cluster => cluster.clusterName === 'DeviceEnergyManagement' && cluster.attributeName === 'esaState').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiTransmissionTower} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===0 ? 'Offline' : 'Online'} />
      ))}

      {/* OnOff */}
      {lightDeviceTypes.includes(deviceType) && clusters.filter(cluster => cluster.clusterName === 'OnOff' && cluster.attributeName === 'onOff').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<LightbulbIcon/>} cluster={cluster} value={cluster.attributeLocalValue===true ? 'On' : 'Off'} />
      ))}
      {outletDeviceTypes.includes(deviceType) && clusters.filter(cluster => cluster.clusterName === 'OnOff' && cluster.attributeName === 'onOff').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiPowerSocketEu} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===true ? 'On' : 'Off'} />
      ))}
      {switchDeviceTypes.includes(deviceType) && clusters.filter(cluster => cluster.clusterName === 'OnOff' && cluster.attributeName === 'onOff').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiLightSwitch} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===true ? 'On' : 'Off'} />
      ))}
      {/* OnOffLightSwitch */}
      {deviceType===0x0103 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiLightSwitch} size='40px' color='var(--primary-color)' />} cluster={cluster} value='Controller' />
      ))}
      {/* DimmerSwitch */}
      {deviceType===0x0104 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<LightbulbIcon/>} cluster={cluster} value='Controller' />
      ))}
      {/* ColorDimmerSwitch */}
      {deviceType===0x0105 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<LightbulbIcon/>} cluster={cluster} value='Controller' />
      ))}
      {/* ControlBridge */}
      {deviceType===0x0840 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<LightbulbIcon/>} cluster={cluster} value='Controller' />
      ))}

      {/* LaundryWasher */}
      {deviceType===0x73 && clusters.filter(cluster => cluster.clusterName === 'OperationalState' && cluster.attributeName === 'operationalState').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiWashingMachine} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===0 ? 'Normal' : 'Error'} />
      ))}
      {/* LaundryDryer */}
      {deviceType===0x7c && clusters.filter(cluster => cluster.clusterName === 'OperationalState' && cluster.attributeName === 'operationalState').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiTumbleDryer} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===0 ? 'Normal' : 'Error'} />
      ))}
      {/* Dishwasher */}
      {deviceType===0x75 && clusters.filter(cluster => cluster.clusterName === 'OperationalState' && cluster.attributeName === 'operationalState').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiDishwasher} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===0 ? 'Normal' : 'Error'} />
      ))}
      {/* Oven */}
      {deviceType===0x7b && clusters.filter(cluster => cluster.clusterName === 'BridgedDeviceBasicInformation' && cluster.attributeName === 'reachable').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<MicrowaveIcon/>} cluster={cluster} value='Oven' />
      ))}
      {/* Refrigerator */}
      {deviceType===0x70 && clusters.filter(cluster => cluster.clusterName === 'BridgedDeviceBasicInformation' && cluster.attributeName === 'reachable').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<KitchenIcon/>} cluster={cluster} value='Fridge' />
      ))}
      {/* TemperatureControlledCabinet TemperatureNumber */}
      {deviceType===0x71 && clusters.filter(cluster => cluster.clusterName === 'TemperatureControl' && cluster.attributeName === 'temperatureSetpoint').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiThermostatBox} size='40px' color='var(--primary-color)' />} cluster={cluster} value={(cluster.attributeLocalValue as number ?? 0)/100} unit='°C' />
      ))}
      {/* TemperatureControlledCabinet TemperatureLevel */}
      {deviceType===0x71 && clusters.filter(cluster => cluster.clusterName === 'TemperatureControl' && cluster.attributeName === 'selectedTemperatureLevel').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiThermostatBox} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue as number} unit='mode' prefix={true} />
      ))}
      {/* MicrowaveOven */}
      {deviceType===0x79 && clusters.filter(cluster => cluster.clusterName === 'OperationalState' && cluster.attributeName === 'operationalState').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<MicrowaveIcon/>} cluster={cluster} value={cluster.attributeLocalValue===0 ? 'Normal' : 'Error'} />
      ))}
      {/* ExtractorHood */}
      {deviceType===0x7a && clusters.filter(cluster => cluster.clusterName === 'FanControl' && cluster.attributeName === 'fanMode').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiAirFilter} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue as number} unit='mode' prefix={true} />
      ))}
      {/* CookSurface */}
      {deviceType===0x78 && clusters.filter(cluster => cluster.clusterName === 'BridgedDeviceBasicInformation' && cluster.attributeName === 'reachable').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiStove} size='40px' color='var(--primary-color)' />} cluster={cluster} value='Cooktop' />
      ))}
      {/* Cooktop */}
      {deviceType===0x77 && clusters.filter(cluster => cluster.clusterName === 'TemperatureControl' && cluster.attributeName === 'selectedTemperatureLevel').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiStove} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue as number} unit='mode' prefix={true} />
      ))}

      {/* WindowCovering */}
      {deviceType===0x0202 && clusters.filter(cluster => cluster.clusterName === 'WindowCovering' && cluster.attributeName === 'currentPositionLiftPercent100ths').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<BlindsIcon/>} cluster={cluster} value={getWindowCoveringPositionName(cluster.attributeLocalValue)} />
      ))}
      {/* WindowCoveringController */}
      {deviceType===0x0203 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<BlindsIcon/>} cluster={cluster} value='Controller' />
      ))}
      {/* Closure */}
      {deviceType===0x0230 && clusters.filter(cluster => cluster.clusterName === 'ClosureControl' && cluster.attributeName === 'overallCurrentState').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<BlindsIcon/>} cluster={cluster} value={getClosurePositionName(cluster.attributeLocalValue)} />
      ))}
      {/* ClosureController */}
      {deviceType===0x023e && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<BlindsIcon/>} cluster={cluster} value='Controller' />
      ))}
      {/* ClosurePanel */}
      {deviceType===0x0231 && clusters.filter(cluster => cluster.clusterName === 'ClosureDimension' && cluster.attributeName === 'currentState').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<BlindsIcon/>} cluster={cluster} value={getClosureDimensionPositionName(cluster.attributeLocalValue)} />
      ))}
      {/* Thermostat */}
      {deviceType===0x0301 && clusters.filter(cluster => cluster.clusterName === 'Thermostat' && cluster.attributeName === 'localTemperature').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiThermostat} size='40px' color='var(--primary-color)' />} cluster={cluster} value={(cluster.attributeLocalValue as number ?? 0)/100} unit='°C' />
      ))}
      {/* ThermostatController */}
      {deviceType===0x030a && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiThermostat} size='40px' color='var(--primary-color)' />} cluster={cluster} value='Controller' />
      ))}
      {/* DoorLock */}
      {deviceType===0x000a && clusters.filter(cluster => cluster.clusterName === 'DoorLock' && cluster.attributeName === 'lockState').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={cluster.attributeValue==='1' ? <LockIcon/> : <LockOpenIcon/>} cluster={cluster} value={cluster.attributeValue==='1' ? 'Locked' : 'Unlocked'} />
      ))}
      {/* DoorLockController */}
      {deviceType===0x000b && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<LockIcon/>} cluster={cluster} value='Controller' />
      ))}
      {/* Fan */}
      {deviceType===0x002b && clusters.filter(cluster => cluster.clusterName === 'FanControl' && cluster.attributeName === 'fanMode').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<AirIcon/>} cluster={cluster} value={FanModeLookup[cluster.attributeLocalValue as number] ?? 'Unknown'} />
      ))}
      {/* GenericSwitch */}
      {deviceType===0x000f && clusters.filter(cluster => cluster.clusterName === 'Switch' && cluster.attributeName === 'currentPosition').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiGestureTapButton} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeValue} unit='pos' prefix={true}/>
      ))}
      {/* ModeSelect */}
      {deviceType===0x0027 && clusters.filter(cluster => cluster.clusterName === 'ModeSelect' && cluster.attributeName === 'currentMode').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<ChecklistIcon/>} cluster={cluster} value={cluster.attributeValue} unit='Mode' prefix={true}/>
      ))}
      {/* Pump */}
      {deviceType===0x0303 && clusters.filter(cluster => cluster.clusterName === 'OnOff' && cluster.attributeName === 'onOff').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<CycloneIcon/>} cluster={cluster} value={cluster.attributeLocalValue===true ? 'On' : 'Off'}/>
      ))}
      {/* PumpController */}
      {deviceType===0x0304 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<CycloneIcon/>} cluster={cluster} value='Controller'/>
      ))}
      {/* Air purifier */}
      {deviceType===0x002d && clusters.filter(cluster => cluster.clusterName === 'FanControl' && cluster.attributeName === 'fanMode').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<HvacIcon/>} cluster={cluster} value={FanModeLookup[cluster.attributeLocalValue as number] ?? 'Unknown'} />
      ))}
      {/* Air conditioner */}
      {deviceType===0x0072 && clusters.filter(cluster => cluster.clusterName === 'Thermostat' && cluster.attributeName === 'localTemperature').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<HvacIcon/>} cluster={cluster} value={(cluster.attributeLocalValue as number ?? 0)/100} unit='°C'/>
      ))}
      {/* Water leak detector */}
      {deviceType===0x0043 && clusters.filter(cluster => cluster.clusterName === 'BooleanState' && cluster.attributeName === 'stateValue').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<WaterIcon/>} cluster={cluster} value={cluster.attributeLocalValue===true ?'Leak':'No leak'}/>
      ))}
      {/* Water freeze detector */}
      {deviceType===0x0041 && clusters.filter(cluster => cluster.clusterName === 'BooleanState' && cluster.attributeName === 'stateValue').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<AcUnitIcon/>} cluster={cluster} value={cluster.attributeLocalValue===true ?'Freeze':'No freeze'}/>
      ))}
      {/* Rain sensor */}
      {deviceType===0x0044 && clusters.filter(cluster => cluster.clusterName === 'BooleanState' && cluster.attributeName === 'stateValue').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<ThunderstormIcon/>} cluster={cluster} value={cluster.attributeLocalValue===true ?'Rain':'No rain'}/>
      ))}

      {/* Rvc */}
      {deviceType===0x0074 && clusters.filter(cluster => cluster.clusterName === 'RvcRunMode' && cluster.attributeName === 'currentMode').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiRobotVacuum} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeValue} unit='Run mode' prefix={true}/>
      ))}

      {/* Evse */}
      {deviceType===0x050c && clusters.filter(cluster => cluster.clusterName === 'EnergyEvse' && cluster.attributeName === 'state').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiEvStation} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===0 ?'Free':'In use'}/>
      ))}
      {/* Water Heater */}
      {deviceType===0x050f && clusters.filter(cluster => cluster.clusterName === 'WaterHeaterManagement' && cluster.attributeName === 'tankPercentage').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiWaterBoiler} size='40px' color='var(--primary-color)' />} cluster={cluster} value={'Tank ' + ((cluster.attributeLocalValue ?? 0) as number) + '%'}/>
      ))}
      {/* Electrical Utility Meter */}
      {deviceType===0x0511 && clusters.filter(cluster => cluster.clusterName === 'MeterIdentification' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiMeterElectricOutline} size='40px' color='var(--primary-color)' />} cluster={cluster} value='Utility' />
      ))}
      {/* Meter Reference Point */}
      {deviceType===0x0512 && clusters.filter(cluster => cluster.clusterName === 'MeterIdentification' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiMeterElectricOutline} size='40px' color='var(--primary-color)' />} cluster={cluster} value='Reference' />
      ))}
      {/* Electrical Energy Tariff */}
      {deviceType===0x0513 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiMeterElectricOutline} size='40px' color='var(--primary-color)' />} cluster={cluster} value='Tariff' />
      ))}
      {/* Electrical Meter */}
      {deviceType===0x0514 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiMeterElectricOutline} size='40px' color='var(--primary-color)' />} cluster={cluster} value='Meter' />
      ))}
      {/* Heat Pump */}
      {deviceType===0x0309 && clusters.filter(cluster => cluster.clusterName === 'PowerSource' && cluster.attributeName === 'featureMap').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiHeatPump} size='40px' color='var(--primary-color)' />} cluster={cluster} value={'HeatPump'}/>
      ))}
      {/* Solar Power */}
      {deviceType===0x0017 && clusters.filter(cluster => cluster.clusterName === 'PowerSource' && cluster.attributeName === 'featureMap').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiSolarPanel} size='40px' color='var(--primary-color)' />} cluster={cluster} value={'Solar'}/>
      ))}
      {/* Battery Storage */}
      {deviceType===0x0018 && clusters.filter(cluster => cluster.clusterName === 'ElectricalPowerMeasurement' && cluster.attributeName === 'featureMap').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiHomeBattery} size='40px' color='var(--primary-color)' />} cluster={cluster} value={'Inverter'}/>
      ))}

      {/* BasicVideoPlayer */}
      {deviceType===0x0028 && clusters.filter(cluster => cluster.clusterName === 'OnOff' && cluster.attributeName === 'onOff').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiTelevision} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===true ? 'On' : 'Off'} />
      ))}
      {/* CastingVideoPlayer */}
      {deviceType===0x0023 && clusters.filter(cluster => cluster.clusterName === 'OnOff' && cluster.attributeName === 'onOff').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiTelevision} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===true ? 'On' : 'Off'} />
      ))}
      {/* Speaker */}
      {deviceType===0x0022 && clusters.filter(cluster => cluster.clusterName === 'OnOff' && cluster.attributeName === 'onOff').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiVolumeHigh} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===true ? 'On' : 'Off'} />
      ))}
      {/* CastingVideoClient */}
      {deviceType===0x0029 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiTelevision} size='40px' color='var(--primary-color)' />} cluster={cluster} value='Controller' />
      ))}
      {/* VideoRemoteControl */}
      {deviceType===0x002a && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiTelevision} size='40px' color='var(--primary-color)' />} cluster={cluster} value='Controller' />
      ))}
      {/* ContentApp */}
      {deviceType===0x0024 && clusters.filter(cluster => cluster.clusterName === 'ApplicationBasic' && cluster.attributeName === 'applicationName').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiTelevision} size='40px' color='var(--primary-color)' />} cluster={cluster} value={`App`} />
      ))}

      {/* Aggregator */}
      {deviceType===0x000e && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiLan} size='40px' color='var(--primary-color)' />} cluster={cluster} value='Aggregator' />
      ))}

      {/* Camera */}
      {deviceType===0x0142 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<VideocamIcon/>} cluster={cluster} value={'Camera'}/>
      ))}
      {/* FloodlightCamera */}
      {deviceType===0x0144 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<VideocamIcon/>} cluster={cluster} value={'Floodlight'}/>
      ))}
      {/* VideoDoorbell */}
      {deviceType===0x0143 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<VideocamIcon/>} cluster={cluster} value={'Video bell'}/>
      ))}
      {/* Intercom */}
      {deviceType===0x0140 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<VideocamIcon/>} cluster={cluster} value={'Intercom'}/>
      ))}
      {/* SnapshotCamera */}
      {deviceType===0x0145 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<VideocamIcon/>} cluster={cluster} value={'Snapshot'}/>
      ))}
      {/* CameraController */}
      {deviceType===0x0147 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<VideocamIcon/>} cluster={cluster} value={'Cam ctrl'}/>
      ))}
      {/* Chime */}
      {deviceType===0x0146 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<NotificationsActiveIcon/>} cluster={cluster} value={'Chime'}/>
      ))}
      {/* Doorbell */}
      {deviceType===0x0148 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<NotificationsActiveIcon/>} cluster={cluster} value={'Doorbell'}/>
      ))}
      {/* AudioDoorbell */}
      {deviceType===0x0141 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<NotificationsActiveIcon/>} cluster={cluster} value={'Audio bell'}/>
      ))}

      {/* SmokeCoAlarm */}
      {deviceType===0x0076 &&
        // oxlint-disable-next-line typescript/no-explicit-any
        clusters.find(cluster => cluster.clusterName === 'SmokeCoAlarm' && cluster.attributeName === 'featureMap' && (cluster as any).attributeLocalValue.smokeAlarm===true) &&
        clusters.filter(cluster => cluster.clusterName === 'SmokeCoAlarm' && cluster.attributeName === 'smokeState').map(cluster => (
          <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiSmokeDetectorVariant} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===0 ?'No smoke':'Smoke!'}/>
      ))}
      {deviceType===0x0076 &&
        // oxlint-disable-next-line typescript/no-explicit-any
        clusters.find(cluster => cluster.clusterName === 'SmokeCoAlarm' && cluster.attributeName === 'featureMap' && (cluster as any).attributeLocalValue.smokeAlarm===false) &&
        clusters.filter(cluster => cluster.clusterName === 'SmokeCoAlarm' && cluster.attributeName === 'coState').map(cluster => (
          <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiSmokeDetectorVariant} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===0 ?'No Co':'Co!'}/>
      ))}

      {/* WaterValve */}
      {deviceType===0x0042 && clusters.filter(cluster => cluster.clusterName === 'ValveConfigurationAndControl' && cluster.attributeName === 'currentState').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiValve} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===0 ?'Closed':'Opened'}/>
      ))}
      {/* IrrigationSystem */}
      {deviceType===0x0040 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiSprinklerVariant} size='40px' color='var(--primary-color)' />} cluster={cluster} value='Irrigation'/>
      ))}
      {/* AirQuality */}
      {deviceType===0x002c && clusters.filter(cluster => cluster.clusterName === 'AirQuality' && cluster.attributeName === 'airQuality').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiAirPurifier} size='40px' color='var(--primary-color)' />} cluster={cluster} value={airQualityLookup[cluster.attributeLocalValue as number ?? 0]}/>
      ))}
      {/* TemperatureMeasurement */}
      {deviceType===0x0302 && clusters.filter(cluster => cluster.clusterName === 'TemperatureMeasurement' && cluster.attributeName === 'measuredValue').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<ThermostatIcon/>} cluster={cluster} value={cluster.attributeLocalValue as number/100} unit='°C' />
      ))}
      {/* RelativeHumidityMeasurement */}
      {deviceType===0x0307 && clusters.filter(cluster => cluster.clusterName === 'RelativeHumidityMeasurement' && cluster.attributeName === 'measuredValue').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiWaterPercent} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue as number/100} unit='%' />
      ))}
      {/* SoilSensor */}
      {deviceType===0x0045 && clusters.filter(cluster => cluster.clusterName === 'SoilMeasurement' && cluster.attributeName === 'soilMoistureMeasuredValue').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiWaterPercent} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue as number} unit='%' />
      ))}
      {/* FlowMeasurement */}
      {deviceType===0x0306 && clusters.filter(cluster => cluster.clusterName === 'FlowMeasurement' && cluster.attributeName === 'measuredValue').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<GasMeterIcon/>} cluster={cluster} value={cluster.attributeLocalValue as number/10} unit='m³/h' />
      ))}
      {/* PressureMeasurement */}
      {deviceType===0x0305 && clusters.filter(cluster => cluster.clusterName === 'PressureMeasurement' && cluster.attributeName === 'measuredValue').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<FilterDramaIcon/>} cluster={cluster} value={cluster.attributeLocalValue as number} unit='hPa' />
      ))}
      {/* ContactSensor */}
      {deviceType===0x0015 && clusters.filter(cluster => cluster.clusterName === 'BooleanState' && cluster.attributeName === 'stateValue').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={cluster.attributeValue==='true' ? <DoorFrontIcon/> : <MeetingRoomIcon/>} cluster={cluster} value={cluster.attributeValue==='true' ? 'Closed' : 'Opened'} />
      ))}
      {/* OccupancySensor */}
      {deviceType===0x0107 && clusters.filter(cluster => cluster.clusterName === 'OccupancySensing' && cluster.attributeName === 'occupancy').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={cluster.attributeValue === '{ occupied: true }' ? <SensorOccupiedIcon/> : <SensorsOffIcon/>} cluster={cluster} value={cluster.attributeValue === '{ occupied: true }' ? 'Occupied' : 'Unocc.'} />
      ))}
      {/* LightSensor */}
      {deviceType===0x0106 && clusters.filter(cluster => cluster.clusterName === 'IlluminanceMeasurement' && cluster.attributeName === 'measuredValue').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<LightModeIcon/>} cluster={cluster} value={Math.round(Math.pow(10, cluster.attributeLocalValue as number / 10000))} unit='lx' />
      ))}
      {/* OnOffSensor */}
      {deviceType===0x0850 && clusters.filter(cluster => cluster.clusterName === 'Descriptor' && cluster.attributeName === 'clusterRevision').map(cluster => (
        <Render key={`${cluster.clusterId}-${cluster.attributeId}`} icon={<Icon path={mdiLightSwitch} size='40px' color='var(--primary-color)' />} cluster={cluster} value='---' />
      ))}
      {/* ElectricalEnergyMeasurement */}
      {deviceType===0x0510 && energyCluster && (
        <Render key={`${energyCluster.clusterId}-${energyCluster.attributeId}`} icon={<Icon path={mdiMeterElectricOutline} size='40px' color='var(--primary-color)' />} cluster={energyCluster} value={energyValue} unit='kWh' />
      )}
      <Box sx={detailsBoxSx}>
        <Typography sx={detailsSx}>{details}</Typography>
      </Box>
      <Box sx={nameBoxSx}>
        <Typography sx={nameSx}>{device.name}</Typography>
      </Box>
      <Box sx={endpointBoxSx}>
        {debug && <Typography sx={endpointSx}>{endpoint}</Typography>}
        <Typography sx={endpointSx}>{id}</Typography>
        {debug && <Typography sx={endpointSx}>0x{deviceType.toString(16).padStart(4, '0')}</Typography>}
      </Box>
    </MbfWindow>
  );
}

const MemoizedDevice = memo(Device);

interface DevicesIconsProps {
  filterPlugins: string;
  filterDevices: string;
}

function DevicesIcons({ filterPlugins, filterDevices }: DevicesIconsProps): React.JSX.Element {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);

  // Local states
  const [devices, setDevices] = useState<ApiDevice[]>([]);
  const [endpoints, setEndpoints] = useState<{ [serial: string]: { endpoint: string; id: string; deviceTypes: number[] }[] }>({});
  const [clusters, setClusters] = useState<{ [serial: string]: Cluster[] }>({});

  // Refs
  const uniqueId = useRef(getUniqueId());

  // Refs mirroring the latest devices/clusters state, so stateUpdate can read current values
  // without depending on them, keeping its identity stable across state updates.
  const devicesRef = useRef(devices);
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  const clustersRef = useRef(clusters);
  useEffect(() => {
    clustersRef.current = clusters;
  }, [clusters]);

  const stateUpdate = useCallback((msg: WsMessageApiStateUpdate) => {
    /* v8 ignore next */
    if (debug || debugUpdate || localDebug) {
      console.log(
        `DevicesIcons received state_update "${msg.response.cluster}.${msg.response.attribute}" for "${msg.response.id}:${msg.response.number}": "${msg.response.value}"`,
        msg.response,
      );
    }
    const devices = devicesRef.current;
    const clusters = clustersRef.current;
    const updateDevice = devices.find((d) => d.pluginName === msg.response.plugin && d.serial === msg.response.serialNumber);
    if (!updateDevice) {
      /* v8 ignore next */
      if (debug || debugUpdate || localDebug)
        console.warn(
          `DevicesIcons updater device of plugin "${msg.response.plugin}" serial "${msg.response.serialNumber}" number "${msg.response.number}" id "${msg.response.id}" not found in devices(${devices.length})`,
        );
      return;
    }
    const updatedCluster = clusters[updateDevice.serial]?.find(
      (c) => c.endpoint === msg.response.number.toString() && c.clusterName === msg.response.cluster && c.attributeName === msg.response.attribute,
    );
    if (!updatedCluster) {
      /* v8 ignore next */
      if (debug || debugUpdate || localDebug)
        console.warn(
          `DevicesIcons updater device "${updateDevice.name}" serial "${updateDevice.serial}" cluster "${msg.response.cluster}" attribute "${msg.response.attribute}" not found in clusters(${clusters[updateDevice.serial]?.length})`,
        );
      return;
    }
    updatedCluster.attributeValue = String(msg.response.value);
    updatedCluster.attributeLocalValue = msg.response.value;
    setClusters((prev) => ({ ...prev }));
    /* v8 ignore next */
    if (debug || debugUpdate || localDebug)
      console.log(
        `DevicesIcons updated "${updatedCluster.clusterName}.${updatedCluster.attributeName}" for device "${updateDevice.name}" serial "${updateDevice.serial}" to "${updatedCluster.attributeValue}"`,
      );
  }, []);

  const clusterUpdate = useCallback((msg: WsMessageApiClustersResponse) => {
    /* v8 ignore next */
    if (debug || localDebug) {
      console.log(
        `DevicesIcons received for device "${msg.response.deviceName}" serial "${msg.response.serialNumber}" deviceTypes (${msg.response.deviceTypes.length}) "${msg.response.deviceTypes.join(',')}" clusters (${msg.response.clusters.length}):`,
        msg.response,
      );
    }
    if (msg.response.clusters.length === 0) return;
    const serial = msg.response.serialNumber;
    const newEndpoints: { endpoint: string; id: string; deviceTypes: number[] }[] = [];
    const newClusters: Cluster[] = [];
    for (const cluster of msg.response.clusters) {
      if (!newEndpoints.find((e) => e.endpoint === cluster.endpoint)) {
        newEndpoints.push({ endpoint: cluster.endpoint, id: cluster.id, deviceTypes: cluster.deviceTypes });
      }
      if (['FixedLabel', 'Identify', 'Groups', 'ScenesManagement', 'PowerTopology'].includes(cluster.clusterName)) continue;
      newClusters.push(cluster);
    }
    setEndpoints((prev) => ({ ...prev, [serial]: newEndpoints }));
    setClusters((prev) => ({ ...prev, [serial]: newClusters }));
    if (debug || localDebug) console.log(`DevicesIcons endpoints for "${serial}":`, newEndpoints);
    if (debug || localDebug) console.log(`DevicesIcons deviceTypes for "${serial}":`, msg.response.deviceTypes);
    if (debug || localDebug) console.log(`DevicesIcons clusters for "${serial}":`, newClusters);
  }, []);

  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessageApiResponse) => {
      // if (debug || localDebug) console.log('DevicesIcons received WebSocket Message:', msg);
      if (msg.method === 'refresh_required') {
        if (debug || localDebug) console.log(`DevicesIcons received refresh_required: changed=${msg.response.changed} and sending api requests`);
        sendMessage({ id: uniqueId.current, sender: 'DevicesIcons', method: '/api/devices', src: 'Frontend', dst: 'Matterbridge', params: {} });
      } else if (msg.method === 'state_update' && msg.response) {
        stateUpdate(msg);
      } else if (msg.method === '/api/devices' && msg.response) {
        if (debug || localDebug) console.log(`DevicesIcons received ${msg.response.length} devices:`, msg.response);
        setDevices(msg.response);
        setEndpoints({});
        setClusters({});
        // Request clusters for all devices
        for (const device of msg.response) {
          if (debug || localDebug) console.log('DevicesIcons sending /api/clusters');
          sendMessage({
            id: uniqueId.current,
            sender: 'DevicesIcons',
            method: '/api/clusters',
            src: 'Frontend',
            dst: 'Matterbridge',
            params: { plugin: device.pluginName, endpoint: device.endpoint || 0, serialNumber: device.serial },
          });
        }
      } else if (msg.method === '/api/clusters' && msg.response) {
        clusterUpdate(msg);
      }
    };

    addListener(handleWebSocketMessage, uniqueId.current);
    if (debug || localDebug) console.log('DevicesIcons WebSocket effect mounted');

    return () => {
      removeListener(handleWebSocketMessage);
      if (debug || localDebug) console.log('DevicesIcons WebSocket effect unmounted');
    };
  }, [addListener, clusterUpdate, removeListener, sendMessage, stateUpdate]);

  useEffect(() => {
    if (debug || localDebug) console.log('DevicesIcons useEffect online mounting');
    if (online) {
      if (debug || localDebug) console.log('DevicesIcons useEffect online sending api requests');
      sendMessage({ id: uniqueId.current, sender: 'DevicesIcons', method: '/api/devices', src: 'Frontend', dst: 'Matterbridge', params: {} });
    }
    if (debug || localDebug) console.log('DevicesIcons useEffect online mounted');

    return () => {
      if (debug || localDebug) console.log('DevicesIcons useEffect online unmounted');
    };
  }, [online, sendMessage]);

  const normalizedPlugin = filterPlugins?.trim().toLowerCase();
  const filterByPlugin = normalizedPlugin && normalizedPlugin !== 'all plugins';

  if (debug || localDebug) console.log('DevicesIcons rendering...');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', paddingBottom: '5px', gap: '20px', width: '100%', overflow: 'auto' }}>
      {devices
        .filter((device) => {
          if (filterByPlugin && device.pluginName.toLowerCase() !== normalizedPlugin) return false;
          if (filterDevices === '') return true;
          return device.name.toLowerCase().includes(filterDevices.toLowerCase()) || device.serial.toLowerCase().includes(filterDevices.toLowerCase());
        })
        .map(
          (device) =>
            endpoints[device.serial] &&
            endpoints[device.serial].map((endpoint) =>
              endpoint.deviceTypes.map((deviceType) => (
                <MemoizedDevice
                  key={`${device.pluginName}-${device.uniqueId}-${endpoint.endpoint}-${endpoint.id}-${deviceType.toString()}`}
                  device={device}
                  endpoint={endpoint.endpoint}
                  id={endpoint.id}
                  deviceType={deviceType}
                  clusters={(clusters[device.serial] ?? []).filter((c) => c.endpoint === endpoint.endpoint)}
                />
              )),
            ),
        )}
    </div>
  );
}

export default memo(DevicesIcons);
