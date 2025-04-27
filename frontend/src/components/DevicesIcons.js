/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-console */
// React
import React, { useContext, useEffect, useState } from 'react';

// @mui/material
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// @mui/icons-material
import Battery4BarIcon from '@mui/icons-material/Battery4Bar';
import ElectricalServicesIcon from '@mui/icons-material/ElectricalServices';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import DoorFrontIcon from '@mui/icons-material/DoorFront';
import SensorOccupiedIcon from '@mui/icons-material/SensorOccupied';
import SensorsOffIcon from '@mui/icons-material/SensorsOff';
import LightModeIcon from '@mui/icons-material/LightMode';
import FilterDramaIcon from '@mui/icons-material/FilterDrama'; // Cloud for weather
import ThermostatIcon from '@mui/icons-material/Thermostat'; // Temperature
import GasMeterIcon from '@mui/icons-material/GasMeter'; // Flow
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import BlindsIcon from '@mui/icons-material/Blinds'; // WindowCovering
import PowerIcon from '@mui/icons-material/Power';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import CycloneIcon from '@mui/icons-material/Cyclone'; // Pump
import AirIcon from '@mui/icons-material/Air'; // Fan
import HvacIcon from '@mui/icons-material/Hvac'; // AirConditioner AirPurifier
import AcUnitIcon from '@mui/icons-material/AcUnit'; // Freeze detector
import ThunderstormIcon from '@mui/icons-material/Thunderstorm'; // Rain sensor
import WaterIcon from '@mui/icons-material/Water'; // Water leak detector
import OpacityIcon from '@mui/icons-material/Opacity'; // WaterValve
import MasksIcon from '@mui/icons-material/Masks'; // AirQualitySensor
import ChecklistIcon from '@mui/icons-material/Checklist'; // ModeSelect
import MicrowaveIcon from '@mui/icons-material/Microwave';
import KitchenIcon from '@mui/icons-material/Kitchen';

// @mdi/js use: <Icon path={mdiSortDescending} size='15px'/>
import Icon from '@mdi/react';
import { mdiPowerSocketEu, mdiLightSwitch, mdiThermostat, mdiGestureTapButton, mdiWaterPercent, mdiSmokeDetectorVariant, mdiAirPurifier, mdiAirFilter, mdiWashingMachine, mdiTumbleDryer, mdiDishwasher, mdiStove, mdiThermostatBox, mdiRobotVacuum } from '@mdi/js';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { debug } from '../App';

const valueBoxSx = { display: 'flex', gap: '2px', justifyContent: 'space-evenly', width: '100%', height: '40px' };
const iconSx = { margin: '0', padding: '0', fontSize: '36px', fontWeight: 'medium', color: 'var(--primary-color)' };
const valueSx = { margin: '0', padding: '0', fontSize: '20px', fontWeight: 'medium', color: 'var(--div-text-color)', textAlign: 'center' };
const unitSx = { margin: '0', padding: '0', paddingBottom: '2px', fontSize: '16px', fontWeight: 'medium', color: 'var(--div-text-color)', textAlign: 'center' };

const detailsBoxSx = { display: 'flex', gap: '2px', justifyContent: 'center', width: '100%', height: '18px', margin: '0', padding: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal' }
const detailsSx = { margin: '0', padding: '0', fontSize: '12px', fontWeight: 'normal', color: 'var(--div-text-color)' };

const nameBoxSx = { display: 'flex', justifyContent: 'center', width: '100%', height: '52px', margin: '0', padding: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal' };
const nameSx = { margin: '0', padding: '0', fontSize: '14px', fontWeight: 'bold', color: 'var(--div-text-color)' };

const endpointBoxSx = { display: 'flex', gap: '4px', justifyContent: 'center', width: '100%', height: '15px', margin: '0', padding: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal' }
// const endpointSx = { margin: '0', padding: '0px 4px', borderRadius: '5px', textAlign: 'center', fontSize: '10px', fontWeight: 'normal', color: 'white', backgroundColor: 'var(--secondary-color)' };
const endpointSx = { margin: '0', padding: '0px 4px', borderRadius: '5px', textAlign: 'center', fontSize: '12px', fontWeight: 'normal', color: 'var(--secondary-color)' };

const lightDeviceTypes = [0x0100, 0x0101, 0x010c, 0x010d];
const outletDeviceTypes = [0x010a, 0x010b];
const switchDeviceTypes = [0x0103, 0x0104, 0x0105, 0x010f, 0x0110];
const onOffDeviceTypes = [0x0100, 0x0101, 0x010c, 0x010d, 0x010a, 0x010b, 0x0103, 0x0104, 0x0105];
const laundryDeviceTypes = [0x73, 0x75, 0x7c];

function Render({ icon, iconColor, cluster, value, unit, prefix }) {
  if(debug) console.log(`Render cluster "${cluster.clusterName}.${cluster.attributeName}" value(${typeof(value)}-${isNaN(value)}) "${value}" unit "${unit}"`);
  prefix = prefix ?? false;
  return (
    <Box key={`${cluster.clusterId}-${cluster.attributeId}-box`} sx={valueBoxSx}>
      {icon && React.cloneElement(icon, { key: `${cluster.clusterId}-${cluster.attributeId}-icon`, sx: {...iconSx, color: iconColor ?? 'var(--primary-color)'} })}
      <Box key={`${cluster.clusterId}-${cluster.attributeId}-valueunitbox`} sx={{...valueBoxSx, gap: '4px', alignContent: 'center', alignItems: 'end', justifyContent: 'center'}}>
        {unit && prefix===true &&
          <Typography key={`${cluster.clusterId}-${cluster.attributeId}-unit`} sx={unitSx}>
            {unit}
          </Typography>
        }
        <Typography key={`${cluster.clusterId}-${cluster.attributeId}-value`} sx={valueSx}>
          {(value===null || value===undefined || (typeof(value)==='number' && isNaN(value)) ||  value==='NaN') ?
            '---' : value
          }
        </Typography> 
        {unit && prefix===false &&
          <Typography key={`${cluster.clusterId}-${cluster.attributeId}-unit`} sx={unitSx}>
            {unit}
          </Typography>
        }
      </Box>
    </Box>
  );
};

function Device({ device, endpoint, id, deviceType, clusters }) {
  const airQualityLookup = ['Unknown', 'Good', 'Fair', 'Moderate', 'Poor', 'VeryPoor', 'Ext.Poor'];
  let details = '';

  if(debug) console.log(`Device "${device.name}" endpoint "${endpoint}" id "${id}" deviceType "0x${deviceType.toString(16).padStart(4, '0')}" clusters (${clusters?.length}):`, clusters);

  // PowerSource
  deviceType===0x0011 && clusters.filter(cluster => cluster.clusterName === 'PowerSource' && cluster.attributeName === 'batVoltage').map(cluster => details = `${cluster.attributeLocalValue} mV`);
  
  // LevelControl
  onOffDeviceTypes.includes(deviceType) && clusters.filter(cluster => cluster.clusterName === 'LevelControl' && cluster.attributeName === 'currentLevel').map(cluster => details = `Level ${cluster.attributeValue}`);

  // WindowCovering
  deviceType===0x0202 && clusters.filter(cluster => cluster.clusterName === 'WindowCovering' && cluster.attributeName === 'currentPositionLiftPercent100ths').map(cluster => details = `Position ${cluster.attributeValue/100}%`);

  // Thermostat
  deviceType===0x0301 && clusters.filter(cluster => cluster.clusterName === 'Thermostat' && cluster.attributeName === 'occupiedHeatingSetpoint').map(cluster => details = `Heat ${cluster.attributeValue/100}°C `);
  deviceType===0x0301 && clusters.filter(cluster => cluster.clusterName === 'Thermostat' && cluster.attributeName === 'occupiedCoolingSetpoint').map(cluster => details = details + `Cool ${cluster.attributeValue/100}°C`);

  // SmokeCoAlarm
  deviceType===0x0076 && clusters.filter(cluster => cluster.clusterName === 'SmokeCoAlarm' && cluster.attributeName === 'coState').map(cluster => details = `${cluster.attributeLocalValue===0?'No CO detected':'CO alarm!'}`);

  // ElectricalPowerMeasurement
  deviceType===0x0510 && clusters.filter(cluster => cluster.clusterName === 'ElectricalPowerMeasurement' && cluster.attributeName === 'voltage').map(cluster => details = `${cluster.attributeLocalValue/1000} V, `);
  deviceType===0x0510 && clusters.filter(cluster => cluster.clusterName === 'ElectricalPowerMeasurement' && cluster.attributeName === 'activeCurrent').map(cluster => details = details +`${cluster.attributeLocalValue/1000} A, `);
  deviceType===0x0510 && clusters.filter(cluster => cluster.clusterName === 'ElectricalPowerMeasurement' && cluster.attributeName === 'activePower').map(cluster => details = details +`${cluster.attributeLocalValue/1000} W`);

  return (
    <div className='MbfWindowDiv' style={{ margin: '0px', padding: '5px', width: '150px', height: '150px', borderColor: 'var(--div-bg-color)', borderRadius: '5px', justifyContent: 'space-between' }}>
      {deviceType===0x0013 && clusters.filter(cluster => cluster.clusterName === 'BridgedDeviceBasicInformation' && cluster.attributeName === 'reachable').map(cluster => (
        <Render icon={cluster.attributeLocalValue===true ? <WifiIcon/> : <WifiOffIcon/>} iconColor={cluster.attributeLocalValue===true ?'green':'red'} cluster={cluster} value={cluster.attributeLocalValue===true ? 'Online' : 'Offline'} />
      ))}
      {deviceType===0x0011 && clusters.filter(cluster => cluster.clusterName === 'PowerSource' && cluster.attributeName === 'batPercentRemaining').map(cluster => (
        <Render icon={<Battery4BarIcon/>} cluster={cluster} value={cluster.attributeValue/2} unit='%' />
      ))}
      {deviceType===0x0011 && clusters.filter(cluster => cluster.clusterName === 'PowerSource' && cluster.attributeName === 'wiredCurrentType').map(cluster => (
        <Render icon={<ElectricalServicesIcon/>} cluster={cluster} value={cluster.attributeLocalValue===0 ? 'AC' : 'DC'} />
      ))}

      {lightDeviceTypes.includes(deviceType) && clusters.filter(cluster => cluster.clusterName === 'OnOff' && cluster.attributeName === 'onOff').map(cluster => (
        <Render icon={<LightbulbIcon/>} cluster={cluster} value={cluster.attributeLocalValue===true ? 'On' : 'Off'} />
      ))}
      {outletDeviceTypes.includes(deviceType) && clusters.filter(cluster => cluster.clusterName === 'OnOff' && cluster.attributeName === 'onOff').map(cluster => (
        <Render icon={<Icon path={mdiPowerSocketEu} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===true ? 'On' : 'Off'} />
      ))}
      {switchDeviceTypes.includes(deviceType) && clusters.filter(cluster => cluster.clusterName === 'OnOff' && cluster.attributeName === 'onOff').map(cluster => (
        <Render icon={<Icon path={mdiLightSwitch} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===true ? 'On' : 'Off'} />
      ))}

      {deviceType===0x73 && clusters.filter(cluster => cluster.clusterName === 'OperationalState' && cluster.attributeName === 'operationalState').map(cluster => (
        <Render icon={<Icon path={mdiWashingMachine} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===0 ? 'Normal' : 'Error'} />
      ))}
      {deviceType===0x7c && clusters.filter(cluster => cluster.clusterName === 'OperationalState' && cluster.attributeName === 'operationalState').map(cluster => (
        <Render icon={<Icon path={mdiTumbleDryer} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===0 ? 'Normal' : 'Error'} />
      ))}
      {deviceType===0x75 && clusters.filter(cluster => cluster.clusterName === 'OperationalState' && cluster.attributeName === 'operationalState').map(cluster => (
        <Render icon={<Icon path={mdiDishwasher} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===0 ? 'Normal' : 'Error'} />
      ))}
      {deviceType===0x7b && clusters.filter(cluster => cluster.clusterName === 'BridgedDeviceBasicInformation' && cluster.attributeName === 'reachable').map(cluster => (
        <Render icon={<MicrowaveIcon/>} cluster={cluster} value='Oven' />
      ))}
      {deviceType===0x70 && clusters.filter(cluster => cluster.clusterName === 'BridgedDeviceBasicInformation' && cluster.attributeName === 'reachable').map(cluster => (
        <Render icon={<KitchenIcon/>} cluster={cluster} value='Fridge' />
      ))}
      {deviceType===0x71 && clusters.filter(cluster => cluster.clusterName === 'TemperatureControl' && cluster.attributeName === 'selectedTemperatureLevel').map(cluster => (
        <Render icon={<Icon path={mdiThermostatBox} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue} unit='mode' prefix={true} />
      ))}
      {deviceType===0x79 && clusters.filter(cluster => cluster.clusterName === 'OperationalState' && cluster.attributeName === 'operationalState').map(cluster => (
        <Render icon={<MicrowaveIcon/>} cluster={cluster} value={cluster.attributeLocalValue===0 ? 'Normal' : 'Error'} />
      ))}
      {deviceType===0x7a && clusters.filter(cluster => cluster.clusterName === 'FanControl' && cluster.attributeName === 'fanMode').map(cluster => (
        <Render icon={<Icon path={mdiAirFilter} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue} unit='mode' prefix={true} />
      ))}
      {deviceType===0x78 && clusters.filter(cluster => cluster.clusterName === 'BridgedDeviceBasicInformation' && cluster.attributeName === 'reachable').map(cluster => (
        <Render icon={<Icon path={mdiStove} size='40px' color='var(--primary-color)' />} cluster={cluster} value='Cooktop' />
      ))}
      {deviceType===0x77 && clusters.filter(cluster => cluster.clusterName === 'TemperatureControl' && cluster.attributeName === 'selectedTemperatureLevel').map(cluster => (
        <Render icon={<Icon path={mdiStove} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue} unit='mode' prefix={true} />
      ))}
      {deviceType===0x74 && clusters.filter(cluster => cluster.clusterName === 'BridgedDeviceBasicInformation' && cluster.attributeName === 'reachable').map(cluster => (
        <Render icon={<Icon path={mdiRobotVacuum} size='40px' color='var(--primary-color)' />} cluster={cluster} value='Robot' />
      ))}

      {deviceType===0x0202 && clusters.filter(cluster => cluster.clusterName === 'WindowCovering' && cluster.attributeName === 'currentPositionLiftPercent100ths').map(cluster => (
        <Render icon={<BlindsIcon/>} cluster={cluster} value={cluster.attributeLocalValue/100} unit='%' />
      ))}
      {deviceType===0x0301 && clusters.filter(cluster => cluster.clusterName === 'Thermostat' && cluster.attributeName === 'localTemperature').map(cluster => (
        <Render icon={<Icon path={mdiThermostat} size='40px' color='var(--primary-color)' />} cluster={cluster} value={(cluster.attributeLocalValue ?? 0)/100} unit='°C' />
      ))}
      {deviceType===0x000a && clusters.filter(cluster => cluster.clusterName === 'DoorLock' && cluster.attributeName === 'lockState').map(cluster => (
        <Render icon={cluster.attributeValue==='1' ? <LockIcon/> : <LockOpenIcon/>} cluster={cluster} value={cluster.attributeValue==='1' ? 'Locked' : 'Unlocked'} />
      ))}
      {deviceType===0x002b && clusters.filter(cluster => cluster.clusterName === 'FanControl' && cluster.attributeName === 'percentCurrent').map(cluster => (
        <Render icon={<AirIcon/>} cluster={cluster} value={cluster.attributeValue} unit='%'/>
      ))}
      {/* GenericSwitch */}
      {deviceType===0x000f && clusters.filter(cluster => cluster.clusterName === 'Switch' && cluster.attributeName === 'currentPosition').map(cluster => (
        <Render icon={<Icon path={mdiGestureTapButton} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeValue} unit='pos' prefix={true}/>
      ))}
      {/* ModeSelect */}
      {deviceType===0x0027 && clusters.filter(cluster => cluster.clusterName === 'ModeSelect' && cluster.attributeName === 'currentMode').map(cluster => (
        <Render icon={<ChecklistIcon/>} cluster={cluster} value={cluster.attributeValue} unit='mode' prefix={true}/>
      ))}
      {/* Pump */}
      {deviceType===0x0303 && clusters.filter(cluster => cluster.clusterName === 'OnOff' && cluster.attributeName === 'onOff').map(cluster => (
        <Render icon={<CycloneIcon/>} cluster={cluster} value={cluster.attributeLocalValue===true ? 'On' : 'Off'}/>
      ))}
      {/* Air purifier */}
      {deviceType===0x002d && clusters.filter(cluster => cluster.clusterName === 'FanControl' && cluster.attributeName === 'percentCurrent').map(cluster => (
        <Render icon={<HvacIcon/>} cluster={cluster} value={cluster.attributeValue} unit='%'/>
      ))}
      {/* Air conditioner */}
      {deviceType===0x0072 && clusters.filter(cluster => cluster.clusterName === 'Thermostat' && cluster.attributeName === 'localTemperature').map(cluster => (
        <Render icon={<HvacIcon/>} cluster={cluster} value={(cluster.attributeLocalValue ?? 0)/100} unit='°C'/>
      ))}
      {/* Water leak detector */}
      {deviceType===0x0043 && clusters.filter(cluster => cluster.clusterName === 'BooleanState' && cluster.attributeName === 'stateValue').map(cluster => (
        <Render icon={<WaterIcon/>} cluster={cluster} value={cluster.attributeLocalValue===true ?'Leak':'No leak'}/>
      ))}
      {/* Water freeze detector */}
      {deviceType===0x0041 && clusters.filter(cluster => cluster.clusterName === 'BooleanState' && cluster.attributeName === 'stateValue').map(cluster => (
        <Render icon={<AcUnitIcon/>} cluster={cluster} value={cluster.attributeLocalValue===true ?'Freeze':'No freeze'}/>
      ))}
      {/* Rain sensor */}
      {deviceType===0x0044 && clusters.filter(cluster => cluster.clusterName === 'BooleanState' && cluster.attributeName === 'stateValue').map(cluster => (
        <Render icon={<ThunderstormIcon/>} cluster={cluster} value={cluster.attributeLocalValue===true ?'Rain':'No rain'}/>
      ))}

      {/* SmokeCoAlarm */}
      {deviceType===0x0076 && 
        clusters.find(cluster => cluster.clusterName === 'SmokeCoAlarm' && cluster.attributeName === 'featureMap' && cluster.attributeLocalValue.smokeAlarm===true) &&
        clusters.filter(cluster => cluster.clusterName === 'SmokeCoAlarm' && cluster.attributeName === 'smokeState').map(cluster => (
          <Render icon={<Icon path={mdiSmokeDetectorVariant} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===0 ?'No smoke':'Smoke!'}/>
      ))}
      {deviceType===0x0076 && 
        clusters.find(cluster => cluster.clusterName === 'SmokeCoAlarm' && cluster.attributeName === 'featureMap' && cluster.attributeLocalValue.smokeAlarm===false) &&
        clusters.filter(cluster => cluster.clusterName === 'SmokeCoAlarm' && cluster.attributeName === 'coState').map(cluster => (
          <Render icon={<Icon path={mdiSmokeDetectorVariant} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===0 ?'No Co':'Co!'}/>
      ))}

      {/* WaterValve */}
      {deviceType===0x0042 && clusters.filter(cluster => cluster.clusterName === 'ValveConfigurationAndControl' && cluster.attributeName === 'currentState').map(cluster => (
        <Render icon={<OpacityIcon/>} cluster={cluster} value={cluster.attributeLocalValue===0 ?'Closed':'Opened'}/>
      ))}
      {/* AirQuality */}
      {deviceType===0x002c && clusters.filter(cluster => cluster.clusterName === 'AirQuality' && cluster.attributeName === 'airQuality').map(cluster => (
        <Render icon={<Icon path={mdiAirPurifier} size='40px' color='var(--primary-color)' />} cluster={cluster} value={airQualityLookup[cluster.attributeLocalValue ?? 0]}/>
      ))}
      {deviceType===0x0302 && clusters.filter(cluster => cluster.clusterName === 'TemperatureMeasurement' && cluster.attributeName === 'measuredValue').map(cluster => (
        <Render icon={<ThermostatIcon/>} cluster={cluster} value={cluster.attributeLocalValue/100} unit='°C' />
      ))}
      {deviceType===0x0307 && clusters.filter(cluster => cluster.clusterName === 'RelativeHumidityMeasurement' && cluster.attributeName === 'measuredValue').map(cluster => (
        <Render icon={<Icon path={mdiWaterPercent} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue/100} unit='%' />
      ))}
      {deviceType===0x0306 && clusters.filter(cluster => cluster.clusterName === 'FlowMeasurement' && cluster.attributeName === 'measuredValue').map(cluster => (
        <Render icon={<GasMeterIcon/>} cluster={cluster} value={cluster.attributeLocalValue} unit='l/h' />
      ))}
      {deviceType===0x0305 && clusters.filter(cluster => cluster.clusterName === 'PressureMeasurement' && cluster.attributeName === 'measuredValue').map(cluster => (
        <Render icon={<FilterDramaIcon/>} cluster={cluster} value={cluster.attributeLocalValue} unit='hPa' />
      ))}
      {deviceType===0x0015 && clusters.filter(cluster => cluster.clusterName === 'BooleanState' && cluster.attributeName === 'stateValue').map(cluster => (
        <Render icon={cluster.attributeValue==='true' ? <DoorFrontIcon/> : <MeetingRoomIcon/>} cluster={cluster} value={cluster.attributeValue==='true' ? 'Closed' : 'Opened'} />
      ))}
      {deviceType===0x0107 && clusters.filter(cluster => cluster.clusterName === 'OccupancySensing' && cluster.attributeName === 'occupancy').map(cluster => (
        <Render icon={cluster.attributeValue === '{ occupied: true }' ? <SensorOccupiedIcon/> : <SensorsOffIcon/>} cluster={cluster} value={cluster.attributeValue === '{ occupied: true }' ? 'Occupied' : 'Unocc.'} />
      ))}
      {deviceType===0x0106 && clusters.filter(cluster => cluster.clusterName === 'IlluminanceMeasurement' && cluster.attributeName === 'measuredValue').map(cluster => (
        <Render icon={<LightModeIcon/>} cluster={cluster} value={Math.round(Math.pow(10, cluster.attributeValue / 10000))} unit='lx' />
      ))}
      {deviceType===0x0510 && clusters.filter(cluster => cluster.clusterName === 'ElectricalEnergyMeasurement' && cluster.attributeName === 'cumulativeEnergyImported').map(cluster => (
        <Render icon={<PowerIcon/>} cluster={cluster} value={Math.round(cluster.attributeLocalValue?.energy / 1000000)} unit='kwh' />
      ))}
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
      </div>
  );
}
/*
      {deviceType===0x0076 && clusters.filter(cluster => cluster.clusterName === 'SmokeCoAlarm' && cluster.attributeName === 'smokeState').map(cluster => (
        <Render icon={<Icon path={mdiSmokeDetectorVariant} size='40px' color='var(--primary-color)' />} cluster={cluster} value={cluster.attributeLocalValue===0 ?'No smoke':'Smoke'}/>
      ))}

*/
export function DevicesIcons({filter}) {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener } = useContext(WebSocketContext);

  // Local states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settings, setSettings] = useState({});
  const [plugins, setPlugins] = useState([]);
  const [devices, setDevices] = useState([]);
  const [endpoints, setEndpoints] = useState({}); // { serial: [ { endpoint, id, deviceTypes[] } ] }
  const [deviceTypes, setdDeviceTypes] = useState({}); // { serial: [ deviceTypes array ] }
  const [clusters, setClusters] = useState({}); // { serial: [ { endpoint, id, clusterName, clusterId, attributeName, attributeId, attributeValue } ] }
  const [filteredDevices, setFilteredDevices] = useState(devices);

  const handleDialogToggle = () => {
    setDialogOpen(!dialogOpen);
  };

  useEffect(() => {
    const handleWebSocketMessage = (msg) => {
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'refresh_required') {
          if(debug) console.log('DevicesIcons received refresh_required and sending api requests');
          sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (msg.method === '/api/settings' && msg.response) {
          if(debug) console.log('DevicesIcons received settings:', msg.response);
          setSettings(msg.response);
        }
        if (msg.method === '/api/plugins' && msg.response) {
          if(debug) console.log('DevicesIcons received plugins:', msg.response);
          setPlugins(msg.response);
        }
        if (msg.method === '/api/devices' && msg.response) {
          if(debug) console.log(`DevicesIcons received ${msg.response.length} devices:`, msg.response);
          setDevices(msg.response);
          for(let device of msg.response) {
            if(debug) console.log('DevicesIcons sending /api/clusters');
            sendMessage({ method: "/api/clusters", src: "Frontend", dst: "Matterbridge", params: { plugin: device.pluginName, endpoint: device.endpoint } });
          }
        }
        if (msg.method === '/api/clusters' && msg.response) {
          if(debug) console.log(`DevicesIcons received for device "${msg.deviceName}" serial "${msg.serialNumber}" deviceType ${msg.deviceTypes.join(' ')} clusters (${msg.response.length}):`, msg.response);
          if(msg.response.length === 0) return;
          const serial = msg.serialNumber;
          endpoints[serial] = [];
          deviceTypes[serial] = msg.deviceTypes;
          clusters[serial] = [];
          for(let cluster of msg.response) {
            if(!endpoints[serial].find((e) => e.endpoint === cluster.endpoint)) {
              endpoints[serial].push({ endpoint: cluster.endpoint, id: cluster.id, deviceTypes: cluster.deviceTypes });
            }
            if(['FixedLabel', 'Descriptor', 'Identify', 'Groups', 'PowerTopology'].includes(cluster.clusterName)) continue;
            clusters[serial].push(cluster);
          }
          setEndpoints({ ...endpoints });
          setdDeviceTypes({ ...deviceTypes });
          setClusters({ ...clusters });
          if(debug) console.log(`DevicesIcons endpoints for "${serial}":`, endpoints[serial]);
          if(debug) console.log(`DevicesIcons deviceTypes for "${serial}":`, deviceTypes[serial]);
          if(debug) console.log(`DevicesIcons clusters for "${serial}":`, clusters[serial]);
        }
      }
    };

    addListener(handleWebSocketMessage);
    if(debug) console.log('DevicesIcons useEffect webSocket mounted');

    return () => {
      removeListener(handleWebSocketMessage);
      if(debug) console.log('DevicesIcons useEffect webSocket unmounted');
    };
  }, [addListener, removeListener, sendMessage]);
  
  useEffect(() => {
    if(debug) console.log('DevicesIcons useEffect online mounting');
    if(online) {
      if(debug) console.log('DevicesIcons useEffect online sending api requests');
      sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
    }
    if(debug) console.log('DevicesIcons useEffect online mounted');

    return () => {
      if(debug) console.log('DevicesIcons useEffect online unmounted');
    };
  }, [online, sendMessage]);
  
  useEffect(() => {
    if(filter === '') {
      setFilteredDevices(devices);
      return;
    }
    const filteredDevices = devices.filter((device) => device.name.toLowerCase().includes(filter) || device.serial.toLowerCase().includes(filter) );
    setFilteredDevices(filteredDevices);
  }, [devices, filter]);
  
  if(debug) console.log('DevicesIcons rendering...');
  return (
    <>
      <Dialog open={dialogOpen} onClose={handleDialogToggle}
        PaperProps={{
            style: {
                color: 'var(--div-text-color)',
                backgroundColor: 'var(--div-bg-color)',
                border: "2px solid var(--primary-color)",
                borderRadius: 'var(--div-border-radius)',
                boxShadow: '2px 2px 5px var(--div-shadow-color)'
            }
        }}>
        <DialogTitle>Configure accessories</DialogTitle>
        <DialogContent>

        </DialogContent>
        <DialogActions>
            <Button onClick={handleDialogToggle}>Close</Button>
        </DialogActions>
      </Dialog>

      <div style={{ display: 'flex', flexWrap: 'wrap', paddingBottom: '5px', gap: '20px', width: '100%', overflow: 'auto' }}>
        {/* <Typography>Loading... {devices.length} devices, {Object.keys(endpoints).length} endpoints, {Object.keys(deviceTypes).length} deviceTypes</Typography> */}
        {filteredDevices.map((device) => (
          endpoints[device.serial] && endpoints[device.serial].map((endpoint) => (
            endpoint.deviceTypes.map((deviceType) => (
              <Device
                device={device}
                endpoint={endpoint.endpoint}
                id={endpoint.id}
                deviceType={deviceType}
                clusters={clusters[device.serial].filter((c) => c.endpoint === endpoint.endpoint)} />
            ))
          ))
        ))}
      </div>
    </>  

  );
}

