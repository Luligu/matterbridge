// React
import { useState, useEffect, useContext, useRef, memo } from 'react';

// @mui/material
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import TextField from '@mui/material/TextField';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

// Frontend
import { Connecting } from './Connecting';
import { WebSocketContext } from './WebSocketProvider';
import { NetworkConfigDialog } from './NetworkConfigDialog';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { debug } from '../App';
import { WsMessageApiResponse } from '../../../src/frontendTypes';
import { MatterbridgeInformation, SystemInformation } from '../../../src/matterbridgeTypes';
// const debug = true;

function Settings() {
  // WebSocket context
  const { online, addListener, removeListener, sendMessage, getUniqueId } = useContext(WebSocketContext);

  // State variables
  const [matterbridgeInfo, setMatterbridgeInfo] = useState<MatterbridgeInformation | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInformation | null>(null);

  // Refs
  const uniqueId = useRef(getUniqueId());

  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessageApiResponse) => {
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'refresh_required' && msg.response.changed === 'settings') {
          if(debug) console.log(`Settings received refresh_required: changed=${msg.response.changed} and sending /api/settings request`);
          sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
        }
        if (msg.method === '/api/settings') {
          if(debug) console.log('Settings received /api/settings:', msg.response);
          setMatterbridgeInfo(msg.response.matterbridgeInformation);
          setSystemInfo(msg.response.systemInformation);
        }
      }
    };

    addListener(handleWebSocketMessage, uniqueId.current);
    if(debug) console.log('Settings added WebSocket listener');
    return () => {
      removeListener(handleWebSocketMessage);
      if(debug) console.log('Settings removed WebSocket listener');
    };
  }, [addListener, removeListener, sendMessage]);

  useEffect(() => {
    if(online) {
      if(debug) console.log('Settings received online');
      sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/settings", src: "Frontend", dst: "Matterbridge", params: {} });
    }
  }, [online, sendMessage]);

  if(!matterbridgeInfo) return null;
  
  if(debug) console.log('Settings rendering...');
  if (!online) {
    return ( <Connecting /> );
  }
  return (
    <div className="MbfPageDiv">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', width: '100%' }}>
        <MatterbridgeSettings matterbridgeInfo={matterbridgeInfo} systemInfo={systemInfo}/>
        <MatterSettings matterbridgeInfo={matterbridgeInfo}/>
        <MatterbridgeInfo matterbridgeInfo={matterbridgeInfo}/>
      </div>  
    </div>
  );
}

function MatterbridgeSettings({ matterbridgeInfo, systemInfo }: { matterbridgeInfo: MatterbridgeInformation | null; systemInfo: SystemInformation | null }) {
  // WebSocket context
  const { sendMessage, getUniqueId } = useContext(WebSocketContext);

  // State variables
  const [selectedBridgeMode, setSelectedBridgeMode] = useState('bridge'); 
  const [selectedMbLoggerLevel, setSelectedMbLoggerLevel] = useState('Info'); 
  const [logOnFileMb, setLogOnFileMb] = useState(false);
  const [frontendTheme, setFrontendTheme] = useState('dark');
  const [homePagePlugins, setHomePagePlugins] = useState(localStorage.getItem('homePagePlugins')==='false' ? false : true); // default true
  const [homePageMode, setHomePageMode] = useState(localStorage.getItem('homePageMode')??'devices'); // default devices
  const [virtualMode, setVirtualMode] = useState(localStorage.getItem('virtualMode')??'outlet'); // default outlet

  // Refs
  const uniqueId = useRef(getUniqueId());

  // Network config dialog
  const [openNetConfig, setOpenNetConfig] = useState(false);
  const handleCloseNetConfig = () => setOpenNetConfig(false);
  const handleSaveNetConfig = (config: { type: "static" | "dhcp"; ip: string; subnet: string; gateway: string; dns: string; }) => {
    if(debug) console.log('handleSaveNetConfig called with config:', config);
    sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/shellynetconfig", src: "Frontend", dst: "Matterbridge", params: config });
  };

  // Change password dialog
  const [openChangePassword, setOpenChangePassword] = useState(false);
  const handleCloseChangePassword = () => setOpenChangePassword(false);
  const handleSaveChangePassword = (password: string) => {
    if(debug) console.log('handleSaveChangePassword called with password:', password);
    sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/config", src: "Frontend", dst: "Matterbridge", params: { name: 'setpassword', value: password } });
  };

  useEffect(() => {
    if (!matterbridgeInfo) return;
    setSelectedBridgeMode(matterbridgeInfo.bridgeMode==='bridge'?'bridge':'childbridge'); 
    setSelectedMbLoggerLevel(matterbridgeInfo.loggerLevel.charAt(0).toUpperCase() + matterbridgeInfo.loggerLevel.slice(1));
    setLogOnFileMb(matterbridgeInfo.fileLogger);
    setVirtualMode(matterbridgeInfo.virtualMode);
  }, [matterbridgeInfo]);

  // Retrieve the saved theme value from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('frontendTheme');
    if (savedTheme) {
      setFrontendTheme(savedTheme);
    }
  }, []);

  // Define a function to handle change bridge mode 
  const handleChangeBridgeMode = (event: React.ChangeEvent<HTMLInputElement>) => {
    if(debug) console.log('handleChangeBridgeMode called with value:', event.target.value);
    setSelectedBridgeMode(event.target.value);
    sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/config", src: "Frontend", dst: "Matterbridge", params: { name: 'setbridgemode', value: event.target.value } });
  };

  // Define a function to handle change debug level
  const handleChangeMbLoggerLevel = (event: SelectChangeEvent) => {
    if(debug) console.log('handleChangeMbLoggerLevel called with value:', event.target.value);
    setSelectedMbLoggerLevel(event.target.value);
    sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/config", src: "Frontend", dst: "Matterbridge", params: { name: 'setmbloglevel', value: event.target.value } });
  };

  // Define a function to handle change matterbridge log file
  const handleLogOnFileMbChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if(debug) console.log('handleLogOnFileMbChange called with value:', event.target.checked);
    setLogOnFileMb(event.target.checked);
    sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/config", src: "Frontend", dst: "Matterbridge", params: { name: 'setmblogfile', value: event.target.checked } });
  };

  // Define a function to handle change theme
  const handleChangeTheme = (event: SelectChangeEvent) => {
    const newTheme = event.target.value;
    if(debug) console.log('handleChangeTheme called with value:', newTheme);
    setFrontendTheme(newTheme);
    localStorage.setItem('frontendTheme', newTheme);
    document.body.setAttribute("frontend-theme", newTheme);
  };

  // Define a function to handle change home page setup
  const handleChangeHomePagePlugins = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    if(debug) console.log('handleChangeHomePagePlugins called with value:', newValue);
    setHomePagePlugins(newValue);
    localStorage.setItem('homePagePlugins', newValue ? 'true' : 'false');
  };

  // Define a function to handle change home page setup
  const handleChangeHomePageMode = (event: SelectChangeEvent) => {
    const newValue = event.target.value;
    if(debug) console.log('handleChangeHomePageMode called with value:', newValue);
    setHomePageMode(newValue);
    localStorage.setItem('homePageMode', newValue);
  };

  // Define a function to handle change virtual mode
  const handleChangeVirtualMode = (event: SelectChangeEvent) => {
    const newValue = event.target.value;
    if(debug) console.log('handleChangeVirtualMode called with value:', newValue);
    setVirtualMode(newValue);
    localStorage.setItem('virtualMode', newValue);
    sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/config", src: "Frontend", dst: "Matterbridge", params: { name: 'setvirtualmode', value: newValue } });
  };

  if(!matterbridgeInfo || !systemInfo) return null;
  return (
    <div className="MbfWindowDiv" style={{ flex: '0 0 auto' }}>
      <div className="MbfWindowHeader">
        <p className="MbfWindowHeaderText">Matterbridge settings</p>
      </div>
      <NetworkConfigDialog open={openNetConfig} ip={systemInfo.ipv4Address} onClose={handleCloseNetConfig} onSave={handleSaveNetConfig}/>
      <ChangePasswordDialog open={openChangePassword} onClose={handleCloseChangePassword} onSave={handleSaveChangePassword}/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '0 0 auto' }}>
        <Box sx={{ gap: '10px', margin: '0px', padding: '10px', width: '400px', backgroundColor: 'var(--div-bg-color)', color: 'var(--div-text-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}} id="matterbridgeInfo-mode">Matterbridge mode:</FormLabel>
            <RadioGroup row name="mode-buttons-group" value={selectedBridgeMode} onChange={handleChangeBridgeMode}>
              <FormControlLabel value="bridge" control={<Radio />} label="Bridge" disabled={matterbridgeInfo.readOnly===true}/>
              <FormControlLabel value="childbridge" control={<Radio />} label="Childbridge" disabled={matterbridgeInfo.readOnly===true}/>
            </RadioGroup>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}} id="mblogger-level-label">Logger level:</FormLabel>
            <Select style={{ height: '30px' }} labelId="mblogger-level-label" id="mblogger-level" value={selectedMbLoggerLevel} onChange={handleChangeMbLoggerLevel}>
              <MenuItem value='Debug'>Debug</MenuItem>
              <MenuItem value='Info'>Info</MenuItem>
              <MenuItem value='Notice'>Notice</MenuItem>
              <MenuItem value='Warn'>Warn</MenuItem>
              <MenuItem value='Error'>Error</MenuItem>
              <MenuItem value='Fatal'>Fatal</MenuItem>
            </Select>
            <FormControlLabel style={{padding: '0px', margin: '0px'}} control={<Checkbox checked={logOnFileMb} onChange={handleLogOnFileMbChange} name="logOnFileMb" />} label="Log on file:" labelPlacement="start"/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '5px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}} id="frontend-theme-label">Frontend theme:</FormLabel>
            <Select style={{ height: '30px' }} labelId="frontend-theme-label" id="frontend-theme" value={frontendTheme} onChange={handleChangeTheme}>
              <MenuItem value='classic'>Classic</MenuItem>
              <MenuItem value='light'>Light</MenuItem>
              <MenuItem value='dark'>Dark</MenuItem>
            </Select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '5px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}} id="frontend-home-plugin-label">Home page plugins:</FormLabel>
            <Checkbox checked={homePagePlugins} onChange={handleChangeHomePagePlugins} name="showPlugins" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '5px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}} id="frontend-home-label">Home page bottom panel:</FormLabel>
            <Select style={{ height: '30px' }} labelId="frontend-home-label" id="frontend-home" value={homePageMode} onChange={handleChangeHomePageMode}>
              <MenuItem value='logs'>Logs</MenuItem>
              <MenuItem value='devices'>Devices</MenuItem>
            </Select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '10px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}} id="frontend-virtual-label">Virtual devices:</FormLabel>
            <Select style={{ height: '30px' }} labelId="frontend-virtual-label" id="frontend-virtual" value={virtualMode} onChange={handleChangeVirtualMode}>
              <MenuItem value='disabled'>Disabled</MenuItem>
              <MenuItem value='outlet'>Outlet</MenuItem>
              <MenuItem value='light'>Light</MenuItem>
              <MenuItem value='switch'>Switch</MenuItem>
              <MenuItem value='mounted_switch'>Mounted Switch</MenuItem>
            </Select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '20px' }}>
            <Button variant="contained" color="primary" onClick={() => setOpenChangePassword(true)}>
              Change password
            </Button>
          </div>
          {matterbridgeInfo.shellyBoard && 
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '20px' }}>
              <Button variant="contained" color="primary" onClick={() => setOpenNetConfig(true)}>
                Configure IP
              </Button>
            </div>
          } 

        </Box>
      </div>
    </div>
  );
}

function MatterSettings({ matterbridgeInfo }: { matterbridgeInfo: MatterbridgeInformation | null }) {
  // WebSocket context
  const { sendMessage, getUniqueId } = useContext(WebSocketContext);

  // State variables
  const [selectedMjLoggerLevel, setSelectedMjLoggerLevel] = useState('Info'); 
  const [logOnFileMj, setLogOnFileMj] = useState(false);  
  const [mdnsInterface, setmdnsInterface] = useState('');  
  const [ipv4Address, setIpv4Address] = useState('');  
  const [ipv6Address, setIpv6Address] = useState('');  
  const [matterPort, setMatterPort] = useState('');  
  const [matterDiscriminator, setMatterDiscriminator] = useState('');  
  const [matterPasscode, setMatterPasscode] = useState('');  

  // Refs
  const uniqueId = useRef(getUniqueId());

  useEffect(() => {
    if (!matterbridgeInfo) return;
    setSelectedMjLoggerLevel(['Debug', 'Info', 'Notice', 'Warn', 'Error', 'Fatal'][matterbridgeInfo.matterLoggerLevel]);
    setLogOnFileMj(matterbridgeInfo.matterFileLogger);
    setmdnsInterface(matterbridgeInfo.matterMdnsInterface || '');
    setIpv4Address(matterbridgeInfo.matterIpv4Address || '');
    setIpv6Address(matterbridgeInfo.matterIpv6Address || '');
    setMatterPort(matterbridgeInfo.matterPort ? matterbridgeInfo.matterPort.toString() : '');
    setMatterDiscriminator(matterbridgeInfo.matterDiscriminator ? matterbridgeInfo.matterDiscriminator.toString() : '');
    setMatterPasscode(matterbridgeInfo.matterPasscode ? matterbridgeInfo.matterPasscode.toString() : '');
  }, [matterbridgeInfo]);

  // Define a function to handle change debug level
  const handleChangeMjLoggerLevel = (event: SelectChangeEvent) => {
    if(debug) console.log('handleChangeMjLoggerLevel called with value:', event.target.value);
    setSelectedMjLoggerLevel(event.target.value);
    sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/config", src: "Frontend", dst: "Matterbridge", params: { name: 'setmjloglevel', value: event.target.value } });
  };

  // Define a function to handle change matter log file
  const handleLogOnFileMjChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if(debug) console.log('handleLogOnFileMjChange called with value:', event.target.checked);
    setLogOnFileMj(event.target.checked);
    sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/config", src: "Frontend", dst: "Matterbridge", params: { name: 'setmjlogfile', value: event.target.checked } });
  };

  // Define a function to handle change mdnsInterface
  const handleChangeMdnsInterface = (event: React.ChangeEvent<HTMLInputElement>) => {
    if(debug) console.log('handleChangeMdnsInterface called with value:', event.target.value);
    setmdnsInterface(event.target.value);
    sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/config", src: "Frontend", dst: "Matterbridge", params: { name: 'setmdnsinterface', value: event.target.value } });
  };

  // Define a function to handle change mdnsInterface
  const handleChangeIpv4Address = (event: React.ChangeEvent<HTMLInputElement>) => {
    if(debug) console.log('handleChangeIpv4Address called with value:', event.target.value);
    setIpv4Address(event.target.value);
    sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/config", src: "Frontend", dst: "Matterbridge", params: { name: 'setipv4address', value: event.target.value } });
  };

  // Define a function to handle change mdnsInterface
  const handleChangeIpv6Address = (event: React.ChangeEvent<HTMLInputElement>) => {
    if(debug) console.log('handleChangeIpv6Address called with value:', event.target.value);
    setIpv6Address(event.target.value);
    sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/config", src: "Frontend", dst: "Matterbridge", params: { name: 'setipv6address', value: event.target.value } });
  };

  // Define a function to handle change matterPort
  const handleChangeMatterPort = (event: React.ChangeEvent<HTMLInputElement>) => {
    if(debug) console.log('handleChangeMatterPort called with value:', event.target.value);
    setMatterPort(event.target.value);
    sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/config", src: "Frontend", dst: "Matterbridge", params: { name: 'setmatterport', value: event.target.value } });
  };

  // Define a function to handle change matterDiscriminator
  const handleChangeMatterDiscriminator = (event: React.ChangeEvent<HTMLInputElement>) => {
    if(debug) console.log('handleChangeMatterDiscriminator called with value:', event.target.value);
    setMatterDiscriminator(event.target.value);
    sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/config", src: "Frontend", dst: "Matterbridge", params: { name: 'setmatterdiscriminator', value: event.target.value } });
  };

  // Define a function to handle change matterPasscode
  const handleChangemMatterPasscode = (event: React.ChangeEvent<HTMLInputElement>) => {
    if(debug) console.log('handleChangemMatterPasscode called with value:', event.target.value);
    setMatterPasscode(event.target.value);
    sendMessage({ id: uniqueId.current, sender: 'Settings', method: "/api/config", src: "Frontend", dst: "Matterbridge", params: { name: 'setmatterpasscode', value: event.target.value } });
  };

  if(!matterbridgeInfo) return null;
  return (
    <div className="MbfWindowDiv" style={{ flex: '0 0 auto' }}>
      <div className="MbfWindowHeader">
        <p className="MbfWindowHeaderText">Matter settings</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '0 0 auto' }}>
        <Box sx={{ gap: '10px', margin: '0px', padding: '10px', width: '400px', backgroundColor: 'var(--div-bg-color)', color: 'var(--div-text-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}} id="mjdebug-info">Logger level:</FormLabel>
            <Select style={{ height: '30px' }} labelId="select-mjlevel" id="mjdebug-level" value={selectedMjLoggerLevel} onChange={handleChangeMjLoggerLevel}>
              <MenuItem value='Debug'>Debug</MenuItem>
              <MenuItem value='Info'>Info</MenuItem>
              <MenuItem value='Notice'>Notice</MenuItem>
              <MenuItem value='Warn'>Warn</MenuItem>
              <MenuItem value='Error'>Error</MenuItem>
              <MenuItem value='Fatal'>Fatal</MenuItem>
            </Select>
            <FormControlLabel style={{padding: '0px', margin: '0px'}} control={<Checkbox checked={logOnFileMj} onChange={handleLogOnFileMjChange} name="logOnFileMj" />} label="Log on file:" labelPlacement="start"/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}}>Mdns interface:</FormLabel>
            <TextField value={mdnsInterface} onChange={handleChangeMdnsInterface} size="small" variant="outlined" 
              style={{ height: '30px', flexGrow: 1 }} InputProps={{
                readOnly: matterbridgeInfo.readOnly===true, 
                style: {
                  height: '30px',
                  padding: '0',
                },
              }}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}}>Ipv4 address:</FormLabel>
            <TextField value={ipv4Address} onChange={handleChangeIpv4Address} size="small" variant="outlined" 
              style={{ height: '30px', flexGrow: 1  }} InputProps={{
                readOnly: matterbridgeInfo.readOnly===true, 
                style: {
                  height: '30px',
                  padding: '0',
                },
              }}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}}>Ipv6 address:</FormLabel>
            <TextField value={ipv6Address} onChange={handleChangeIpv6Address} size="small" variant="outlined"
              style={{ height: '30px', flexGrow: 1 }} InputProps={{
                readOnly: matterbridgeInfo.readOnly===true, 
                style: {
                  height: '30px',
                  padding: '0',
                },
              }}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}}>Commissioning port:</FormLabel>
            <TextField value={matterPort} onChange={handleChangeMatterPort} size="small" variant="outlined"
              style={{ height: '30px', flexGrow: 1 }} InputProps={{
                readOnly: matterbridgeInfo.readOnly===true, 
                style: {
                  height: '30px',
                  padding: '0',
                },
              }}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}}>Commissioning discriminator:</FormLabel>
            <TextField value={matterDiscriminator} onChange={handleChangeMatterDiscriminator} size="small" variant="outlined"
              style={{ height: '30px', flexGrow: 1 }} InputProps={{
                readOnly: matterbridgeInfo.readOnly===true, 
                style: {
                  height: '30px',
                  padding: '0',
                },
              }}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}}>Commissioning passcode:</FormLabel>
            <TextField value={matterPasscode} onChange={handleChangemMatterPasscode} size="small" variant="outlined"
              style={{ height: '30px', flexGrow: 1 }} InputProps={{
                readOnly: matterbridgeInfo.readOnly===true, 
                style: {
                  height: '30px',
                  padding: '0',
                },
              }}/>
          </div>
        </Box>
      </div>
    </div>
  );
}

// Define the MatterbridgeInfo component
function MatterbridgeInfo({ matterbridgeInfo }: { matterbridgeInfo: MatterbridgeInformation | null }) {
  if(!matterbridgeInfo) return null;
  return (
    <div className="MbfWindowDiv" style={{ flex: '0 0 auto' }}>
      <div className="MbfWindowHeader">
        <p className="MbfWindowHeaderText">Matterbridge info</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '0 0 auto' }}>
        <Box sx={{ gap: '10px', margin: '0px', padding: '10px', width: '400px', backgroundColor: 'var(--div-bg-color)', color: 'var(--div-text-color)' }}>          <ReadOnlyTextField value={matterbridgeInfo.matterbridgeVersion} label="Current Version" />
          <ReadOnlyTextField value={matterbridgeInfo.matterbridgeLatestVersion} label="Latest Version" />
          <ReadOnlyTextField value={matterbridgeInfo.homeDirectory} label="Home Directory" />
          <ReadOnlyTextField value={matterbridgeInfo.rootDirectory} label="Root Directory" />
          <ReadOnlyTextField value={matterbridgeInfo.matterbridgeDirectory} label="Matterbridge Storage Directory" />
          <ReadOnlyTextField value={matterbridgeInfo.matterbridgePluginDirectory} label="Matterbridge Plugin Directory" />
          <ReadOnlyTextField value={matterbridgeInfo.globalModulesDirectory} label="Global Module Directory" />
        </Box>
      </div>
    </div>
  );
};

// Define the ReadOnlyTextField component
function ReadOnlyTextField({ value, label }: { value: string; label: string }) {
  return (
    <TextField
      focused
      value={value}
      size="small"
      label={label}
      variant="standard"
      sx={{ width: '400px' }}
      InputProps={{
        readOnly: true,
        sx: {
          color: 'var(--div-text-color)',
          '&:before': { borderBottomColor: 'var(--main-label-color)' },
          '&:after': { borderBottomColor: 'var(--main-label-color)' }
        }
      }} 
      InputLabelProps={{
        sx: {
          marginTop: '3px',
          color: 'var(--main-label-color)',
          '&.Mui-focused': {
            color: 'var(--main-label-color)',
          },
        },
      }}
    />
  );
};

export default memo(Settings);
