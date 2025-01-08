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
import WaterDropIcon from '@mui/icons-material/WaterDrop'; // Humidity
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import OutletIcon from '@mui/icons-material/Outlet';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import BlindsIcon from '@mui/icons-material/Blinds';
import PowerIcon from '@mui/icons-material/Power';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { Connecting } from './Connecting';
import { debug } from '../App';

function Test() {
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

  useEffect(() => {
    const handleWebSocketMessage = (msg) => {
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'refresh_required') {
          if(debug) console.log('Test received refresh_required and sending api requests');
          sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
          sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (msg.method === '/api/settings' && msg.response) {
          if(debug) console.log('Test received settings:', msg.response);
          setSettings(msg.response);
        }
        if (msg.method === '/api/plugins' && msg.response) {
          if(debug) console.log('Test received plugins:', msg.response);
          setPlugins(msg.response);
        }
        if (msg.method === '/api/devices' && msg.response) {
          if(debug) console.log(`Test received ${msg.response.length} devices:`, msg.response);
          setDevices(msg.response);
          for(let device of msg.response) {
            if(debug) console.log('Test sending /api/clusters');
            sendMessage({ method: "/api/clusters", src: "Frontend", dst: "Matterbridge", params: { plugin: device.pluginName, endpoint: device.endpoint } });
          }
        }
        if (msg.method === '/api/clusters' && msg.response) {
          if(debug) console.log(`Test received for device "${msg.deviceName}" serial "${msg.serialNumber}" deviceType ${msg.deviceTypes.join(' ')} clusters (${msg.response.length}):`, msg.response);
          if(msg.response.length === 0) return;
          const serial = msg.serialNumber;
          endpoints[serial] = [];
          deviceTypes[serial] = msg.deviceTypes;
          clusters[serial] = [];
          for(let cluster of msg.response) {
            if(!endpoints[serial].find((e) => e.endpoint === cluster.endpoint)) {
              endpoints[serial].push({ endpoint: cluster.endpoint, id: cluster.id, deviceTypes: cluster.deviceTypes });
            }
            if(['FixedLabel', 'Descriptor', 'Identify', 'Groups', 'PowerTopology', 'ElectricalPowerMeasurement'].includes(cluster.clusterName)) continue;
            clusters[serial].push(cluster);
          }
          setEndpoints({ ...endpoints });
          setdDeviceTypes({ ...deviceTypes });
          setClusters({ ...clusters });
          if(debug) console.log(`Test endpoints for "${serial}":`, endpoints[serial]);
          if(debug) console.log(`Test deviceTypes for "${serial}":`, deviceTypes[serial]);
          if(debug) console.log(`Test clusters for "${serial}":`, clusters[serial]);
        }
      }
    };

    addListener(handleWebSocketMessage);
    if(debug) console.log('Test useEffect webSocket mounted');

    return () => {
      removeListener(handleWebSocketMessage);
      if(debug) console.log('Test useEffect webSocket unmounted');
    };
  }, []);
  
  useEffect(() => {
    if(debug) console.log('Test useEffect online mounting');
    if(online) {
      if(debug) console.log('Test useEffect online sending api requests');
      sendMessage({ method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ method: "/api/plugins", src: "Frontend", dst: "Matterbridge", params: {} });
      sendMessage({ method: "/api/devices", src: "Frontend", dst: "Matterbridge", params: {} });
    }
    if(debug) console.log('Test useEffect online mounted');

    return () => {
      if(debug) console.log('Test useEffect online unmounted');
    };
  }, [online, sendMessage]);
  
  const handleDialogToggle = () => {
    setDialogOpen(!dialogOpen);
  };

  if (!online) {
    return ( <Connecting /> );
  }
  return (
    <div className="MbfPageDiv">

      <Dialog open={dialogOpen} onClose={handleDialogToggle} 
        PaperProps={{style: { 
          color: 'var(--div-text-color)', 
          backgroundColor: 'var(--div-bg-color)', 
          border: "2px solid var(--primary-color)", 
          borderRadius: 'var(--div-border-radius)', 
          boxShadow: '2px 2px 5px var(--div-shadow-color)'}}}>
        <DialogTitle>Configure accessories</DialogTitle>
        <DialogContent>

        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogToggle}>Close</Button>
        </DialogActions>
      </Dialog>

      <div style={{ display: 'flex', flexWrap: 'wrap', paddingBottom: '5px', gap: '20px', width: '100%', overflow: 'auto' }}>
        {/*<Typography>Loading... {devices.length} devices, {Object.keys(endpoints).length} endpoints, {Object.keys(deviceTypes).length} deviceTypes</Typography>*/}
        {devices.map((device) => (
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

    </div>
  );
}

function Device({ device, endpoint, id, deviceType, clusters }) {
  const valueBoxSx = { display: 'flex', gap: '2px', justifyContent: 'space-evenly', width: '100%', height: '40px' };
  const iconSx = { margin: '0', padding: '2px', fontSize: '36px', fontWeight: 'medium', color: 'var(--primary-color)' };
  const valueSx = { margin: '0', padding: '5px', fontSize: '20px', fontWeight: 'medium', color: 'var(--div-text-color)', textAlign: 'center' };
  const unitSx = { margin: '0', padding: '5px', fontSize: '16px', fontWeight: 'medium', color: 'var(--div-text-color)', textAlign: 'center' };
  const detailsSx = { margin: '0', padding: '5px', fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' };
  const nameSx = { margin: '0', padding: '5px', fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' };
  // const endpointSx = { margin: '0', padding: '0px 4px', borderRadius: '5px', textAlign: 'center', fontSize: '10px', fontWeight: 'normal', color: 'white', backgroundColor: 'var(--secondary-color)' };
  const endpointSx = { margin: '0', padding: '0px 4px', borderRadius: '5px', textAlign: 'center', fontSize: '10px', fontWeight: 'normal', color: 'var(--secondary-color)' };
  
  const lightDeviceTypes = [0x0100, 0x0101, 0x010c];
  const outletDeviceTypes = [0x010a, 0x010b];
  const switchDeviceTypes = [0x0103, 0x0104, 0x0105];
  const onOffDeviceTypes = [0x0100, 0x0101, 0x010c, 0x010a, 0x010b, 0x0103, 0x0104, 0x0105];

  let details = '';
  console.log(`Device "${device.name}" endpoint "${endpoint}" deviceType "0x${deviceType.toString(16).padStart(4, '0')}" clusters (${clusters?.length}):`, clusters);

  onOffDeviceTypes.includes(deviceType) && clusters.filter(cluster => cluster.clusterName === 'LevelControl' && cluster.attributeName === 'currentLevel').map(cluster => details = `Level ${cluster.attributeValue}`);
  deviceType===0x0202 && clusters.filter(cluster => cluster.clusterName === 'WindowCovering' && cluster.attributeName === 'currentPositionLiftPercent100ths').map(cluster => details = `Position ${cluster.attributeValue/100}%`);

  const RenderValue = ({ cluster, value }) => {
    return (
      <Typography key={`${cluster.clusterId}-${cluster.attributeId}-value`} sx={valueSx}>
        {value}
      </Typography>
    );
  };

  const RenderValueUnit = ({ cluster, value, unit }) => {
    return (
      <Box sx={{...valueBoxSx, alignContent: 'center', alignItems: 'end', justifyContent: 'center'}}>
        <Typography key={`${cluster.clusterId}-${cluster.attributeId}-value`} sx={valueSx}>
          {value}
        </Typography>
        <Typography key={`${cluster.clusterId}-${cluster.attributeId}-unit`} sx={unitSx}>
          {unit}
        </Typography>
      </Box>
    );
  };
/*
*/
  return (
    <div className='MbfWindowDiv' style={{ margin: '0px', padding: '5px', width: '150px', height: '150px', justifyContent: 'space-between' }}>
      {deviceType===0x0013 && clusters.filter(cluster => cluster.clusterName === 'BridgedDeviceBasicInformation' && cluster.attributeName === 'reachable').map(cluster => (
        <Box sx={valueBoxSx}>
          {cluster.attributeValue ? <WifiIcon sx={{...iconSx, color: 'green'}} /> : <WifiOffIcon sx={{...iconSx, color: 'red'}} />}
          <Typography key={`${cluster.clusterId}-${cluster.attributeId}`} sx={valueSx}>
            {cluster.attributeValue ? 'Online' : 'Offline'}
          </Typography>
        </Box>
      ))}
      {deviceType===0x0011 && clusters.filter(cluster => cluster.clusterName === 'PowerSource' && cluster.attributeName === 'batPercentRemaining').map(cluster => (
        <Box sx={valueBoxSx}>
          <Battery4BarIcon sx={iconSx} />
          <RenderValueUnit cluster={cluster} value={cluster.attributeValue/2} unit='%' />
        </Box>
      ))}
      {deviceType===0x0011 && clusters.filter(cluster => cluster.clusterName === 'PowerSource' && cluster.attributeName === 'wiredCurrentType').map(cluster => (
        <Box sx={valueBoxSx}>
          <ElectricalServicesIcon sx={iconSx} />
          <RenderValue cluster={cluster} value={cluster.attributeValue===0 ? 'AC' : 'DC'} />
        </Box>
      ))}
      {onOffDeviceTypes.includes(deviceType) && clusters.filter(cluster => cluster.clusterName === 'OnOff' && cluster.attributeName === 'onOff').map(cluster => (
        <Box sx={valueBoxSx}>
          {lightDeviceTypes.includes(deviceType) && <LightbulbIcon sx={iconSx} />}
          {outletDeviceTypes.includes(deviceType) && <OutletIcon sx={iconSx} />}
          {switchDeviceTypes.includes(deviceType) && <ToggleOnIcon sx={iconSx} />}
          <RenderValue cluster={cluster} value={cluster.attributeValue==='true' ? 'On' : 'Off'} />
        </Box>
      ))}
      {deviceType===0x0202 && clusters.filter(cluster => cluster.clusterName === 'WindowCovering' && cluster.attributeName === 'currentPositionLiftPercent100ths').map(cluster => (
        <Box sx={valueBoxSx}>
          <BlindsIcon sx={iconSx} />
          <RenderValueUnit cluster={cluster} value={cluster.attributeValue/100} unit={'%'}/>
        </Box>
      ))}
      {deviceType===0x0302 && clusters.filter(cluster => cluster.clusterName === 'TemperatureMeasurement' && cluster.attributeName === 'measuredValue').map(cluster => (
        <Box sx={valueBoxSx}>
          <ThermostatIcon sx={iconSx} />
          <RenderValueUnit cluster={cluster} value={cluster.attributeValue/100} unit='°C' />
        </Box>
      ))}
      {deviceType===0x0307 && clusters.filter(cluster => cluster.clusterName === 'RelativeHumidityMeasurement' && cluster.attributeName === 'measuredValue').map(cluster => (
        <Box sx={valueBoxSx}>
          <WaterDropIcon sx={iconSx} />
          <RenderValueUnit cluster={cluster} value={cluster.attributeValue/100} unit='%' />
      </Box>
      ))}
      {deviceType===0x0305 && clusters.filter(cluster => cluster.clusterName === 'PressureMeasurement' && cluster.attributeName === 'measuredValue').map(cluster => (
        <Box sx={valueBoxSx}>
          <FilterDramaIcon sx={iconSx} />
          <RenderValueUnit cluster={cluster} value={cluster.attributeValue} unit='hPa' />
        </Box>
      ))}
      {deviceType===0x0015 && clusters.filter(cluster => cluster.clusterName === 'BooleanState' && cluster.attributeName === 'stateValue').map(cluster => (
        <Box sx={valueBoxSx}>
          {cluster.attributeValue==='true' ? <DoorFrontIcon sx={iconSx} /> : <MeetingRoomIcon sx={iconSx} />}
          <RenderValue cluster={cluster} value={cluster.attributeValue==='true' ? 'Closed' : 'Opened'} />
        </Box>
      ))}
      {deviceType===0x0107 && clusters.filter(cluster => cluster.clusterName === 'OccupancySensing' && cluster.attributeName === 'occupancy').map(cluster => (
        <Box sx={valueBoxSx}>
          {cluster.attributeValue === '{ occupied: true }' ? <SensorOccupiedIcon sx={iconSx} /> : <SensorsOffIcon sx={iconSx} />}
          <RenderValue cluster={cluster} value={cluster.attributeValue === '{ occupied: true }' ? 'Occupied' : 'Unocc.'} />
        </Box>
      ))}
      {deviceType===0x0106 && clusters.filter(cluster => cluster.clusterName === 'IlluminanceMeasurement' && cluster.attributeName === 'measuredValue').map(cluster => (
        <Box sx={valueBoxSx}>
          <LightModeIcon sx={iconSx} />
          <RenderValueUnit cluster={cluster} value={Math.round(Math.pow(10, cluster.attributeValue / 10000))} unit='lx' />
        </Box>
      ))}
      {deviceType===0x0510 && clusters.filter(cluster => cluster.clusterName === 'ElectricalEnergyMeasurement' && cluster.attributeName === 'cumulativeEnergyImported').map(cluster => (
        <Box sx={valueBoxSx}>
          <PowerIcon sx={iconSx} />
          <RenderValueUnit cluster={cluster} value={Math.round(cluster.attributeLocalValue?.energy / 1000000)} unit='kwh' />
        </Box>
      ))}
      <Box sx={{ display: 'flex', gap: '2px', justifyContent: 'center', width: '100%', height: '18px' }}>
        <Typography sx={detailsSx}>{details}</Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', height: '52px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal' }}>
        <Typography sx={nameSx}>{device.name}</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: '4px', justifyContent: 'center', width: '100%', height: '15px' }}>
        {debug && <Typography sx={endpointSx}>{endpoint}</Typography>}
        <Typography sx={endpointSx}>{id}</Typography>
        {debug && <Typography sx={endpointSx}>0x{deviceType.toString(16).padStart(4, '0')}</Typography>}
      </Box>
      </div>
  );
}
export default Test;