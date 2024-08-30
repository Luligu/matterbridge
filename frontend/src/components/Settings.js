/* eslint-disable no-console */
import React, { useState, useEffect, useContext } from 'react';
import { Snackbar, Alert, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, TextField, Select, MenuItem, Checkbox, ThemeProvider, createTheme } from '@mui/material';

import { sendCommandToMatterbridge } from '../App';
import Connecting from './Connecting';
import { OnlineContext } from './OnlineContext';

const theme = createTheme({
  components: {
    MuiTooltip: {
      defaultProps: {
        placement: 'bottom', 
        arrow: true,
      },
    },
  },
  palette: {
    readonly: {
      main: '#616161', 
    },
  },
});

function Settings() {
  const { online } = useContext(OnlineContext);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [matterbridgeInfo, setMatterbridgeInfo] = useState({});

  const handleSnackbarClose = () => {
    setShowSnackbar(false);
  };

  const showSnackbarMessage = (message, timeout) => {
    setSnackbarMessage(message);
    if(showSnackbar) setShowSnackbar(false);
    setShowSnackbar(true);
    setTimeout(() => {
      setShowSnackbar(false);
    }, timeout * 1000);
  };

  useEffect(() => {
    fetch('/api/settings')
      .then(response => response.json())
      .then(data => { 
        setMatterbridgeInfo(data.matterbridgeInformation); 
      })
      .catch(error => console.error('Error fetching settings:', error));
  }, []);

  if (!online) {
    return ( <Connecting /> );
  }
  return (
    <div className="MbfPageDiv">
      <ThemeProvider theme={theme}>
      <Snackbar anchorOrigin={{vertical: 'bottom', horizontal: 'right'}} open={showSnackbar} onClose={handleSnackbarClose} autoHideDuration={10000}>
          <Alert onClose={handleSnackbarClose} severity="info" variant="filled" sx={{ width: '100%', bgcolor: '#4CAF50' }}>{snackbarMessage}</Alert>
      </Snackbar>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', height: '100%' }}>
        <h3>Matterbridge settings:</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoFlow: 'row', gap: '20px', width: '100%', }}>
          <MatterbridgeSettings matterbridgeInfo={matterbridgeInfo} showSnackbarMessage={showSnackbarMessage}/>
          {/* <MatterSettings matterbridgeInfo={matterbridgeInfo} showSnackbarMessage={showSnackbarMessage}/>*/}
          <MatterbridgeInfo matterbridgeInfo={matterbridgeInfo}/>
        </div>  
      </div>  
      </ThemeProvider>
    </div>
  );
}

function MatterbridgeSettings({ matterbridgeInfo, showSnackbarMessage }) {
  const [selectedBridgeMode, setSelectedBridgeMode] = useState('bridge'); 
  const [selectedMbLoggerLevel, setSelectedMbLoggerLevel] = useState('Info'); 
  const [selectedMjLoggerLevel, setSelectedMjLoggerLevel] = useState('Info'); 
  const [logOnFileMb, setLogOnFileMb] = useState(false);
  const [logOnFileMj, setLogOnFileMj] = useState(false);  
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (matterbridgeInfo.bridgeMode === undefined) return;
    
    setSelectedBridgeMode(matterbridgeInfo.bridgeMode==='bridge'?'bridge':'childbridge'); 

    setSelectedMbLoggerLevel(matterbridgeInfo.loggerLevel.charAt(0).toUpperCase() + matterbridgeInfo.loggerLevel.slice(1));

    setLogOnFileMb(matterbridgeInfo.fileLogger);

    setSelectedMjLoggerLevel(['Debug', 'Info', 'Notice', 'Warn', 'Error', 'Fatal'][matterbridgeInfo.matterLoggerLevel]);

    setLogOnFileMj(matterbridgeInfo.matterFileLogger);
  }, [matterbridgeInfo]);

  // Define a function to handle change bridge mode 
  const handleChangeBridgeMode = (event) => {
    console.log('handleChangeBridgeMode called with value:', event.target.value);
    setSelectedBridgeMode(event.target.value);
    sendCommandToMatterbridge('setbridgemode', event.target.value);
    showSnackbarMessage('Restart Matterbridge to apply changes', 5);
  };

  // Define a function to handle change debug level
  const handleChangeMbLoggerLevel = (event) => {
    console.log('handleChangeMbLoggerLevel called with value:', event.target.value);
    setSelectedMbLoggerLevel(event.target.value);
    sendCommandToMatterbridge('setmbloglevel', event.target.value);
  };

  // Define a function to handle change matterbridge log file
  const handleLogOnFileMbChange = (event) => {
    console.log('handleLogOnFileMbChange called with value:', event.target.checked);
    setLogOnFileMb(event.target.checked);
    sendCommandToMatterbridge('setmblogfile', event.target.checked ? 'true' : 'false');
  };

  // Define a function to handle change debug level
  const handleChangeMjLoggerLevel = (event) => {
    console.log('handleChangeMjLoggerLevel called with value:', event.target.value);
    setSelectedMjLoggerLevel(event.target.value);
    sendCommandToMatterbridge('setmjloglevel', event.target.value);
  };

  // Define a function to handle change matter log file
  const handleLogOnFileMjChange = (event) => {
    console.log('handleLogOnFileMjChange called with value:', event.target.checked);
    setLogOnFileMj(event.target.checked);
    sendCommandToMatterbridge('setmjlogfile', event.target.checked ? 'true' : 'false');
  };

  // Define a function to handle change password
  const handleChangePassword = (event) => {
    console.log('handleChangePassword called with value:', event.target.value);
    setPassword(event.target.value);
    sendCommandToMatterbridge('setpassword', '*'+event.target.value+'*');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '500px' }}>
      <FormControl style={{ gap: '10px', border: '1px solid #9e9e9e', boxShadow: '5px 5px 10px #888', padding: '10px', borderRadius: '4px', maxWidth: '500px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <FormLabel color='readonly' style={{padding: '0px', margin: '0px'}} id="matterbridgeInfo-mode">Matterbridge mode:</FormLabel>
          <RadioGroup focused row name="mode-buttons-group" value={selectedBridgeMode} onChange={handleChangeBridgeMode}>
            <FormControlLabel value="bridge" control={<Radio />} label="Bridge" />
            <FormControlLabel value="childbridge" control={<Radio />} label="Childbridge" />
          </RadioGroup>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <FormLabel color='readonly' style={{padding: '0px', margin: '0px'}} id="mbdebug-info">Matterbridge logger level:</FormLabel>
          <Select style={{ height: '30px' }} labelId="select-mblevel" id="mbdebug-level" value={selectedMbLoggerLevel} onChange={handleChangeMbLoggerLevel}>
            <MenuItem value='Debug'>Debug</MenuItem>
            <MenuItem value='Info'>Info</MenuItem>
            <MenuItem value='Notice'>Notice</MenuItem>
            <MenuItem value='Warn'>Warn</MenuItem>
            <MenuItem value='Error'>Error</MenuItem>
            <MenuItem value='Fatal'>Fatal</MenuItem>
          </Select>
          <FormControlLabel style={{padding: '0px', margin: '0px', color: 'rgba(0, 0, 0, 0.87)'}} control={<Checkbox checked={logOnFileMb} onChange={handleLogOnFileMbChange} name="logOnFileMb" />} label="Log on file:" labelPlacement="start"/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <FormLabel color='readonly' style={{padding: '0px', margin: '0px'}} id="mjdebug-info">Matter logger level:</FormLabel>
          <Select style={{ height: '30px' }} labelId="select-mjlevel" id="mjdebug-level" value={selectedMjLoggerLevel} onChange={handleChangeMjLoggerLevel}>
            <MenuItem value='Debug'>Debug</MenuItem>
            <MenuItem value='Info'>Info</MenuItem>
            <MenuItem value='Notice'>Notice</MenuItem>
            <MenuItem value='Warn'>Warn</MenuItem>
            <MenuItem value='Error'>Error</MenuItem>
            <MenuItem value='Fatal'>Fatal</MenuItem>
          </Select>
          <FormControlLabel style={{padding: '0px', margin: '0px', color: 'rgba(0, 0, 0, 0.87)'}} control={<Checkbox checked={logOnFileMj} onChange={handleLogOnFileMjChange} name="logOnFileMj" />} label="Log on file:" labelPlacement="start"/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <FormLabel color='readonly' style={{padding: '0px', margin: '0px'}} id="mjdebug-info">Frontend password:</FormLabel>
          <TextField value={password} onChange={handleChangePassword} size="small" id="matterbridgePassword" type="password" autoComplete="current-password" variant="outlined" 
            style={{ height: '30px', marginTop: '5px' }} InputProps={{
              style: {
                height: '30px',
                padding: '0',
              },
            }}/>
        </div>
      </FormControl>
    </div>
  );
}

/*
function MatterSettings({ matterbridgeInfo, showSnackbarMessage }) {
  const [selectedMjLoggerLevel, setSelectedMjLoggerLevel] = useState('Info'); 
  const [logOnFileMj, setLogOnFileMj] = useState(false);  
  const [mdnsInterface, setmdnsInterface] = useState('');  
  const [ipv4Address, setIpv4Address] = useState('');  
  const [ipv6Address, setIpv6Address] = useState('');  

  useEffect(() => {
    if (matterbridgeInfo.bridgeMode === undefined) return;
    
    setSelectedMjLoggerLevel(['Debug', 'Info', 'Notice', 'Warn', 'Error', 'Fatal'][matterbridgeInfo.matterLoggerLevel]);

    setLogOnFileMj(matterbridgeInfo.matterFileLogger);
  }, [matterbridgeInfo]);

  // Define a function to handle change debug level
  const handleChangeMjLoggerLevel = (event) => {
    console.log('handleChangeMjLoggerLevel called with value:', event.target.value);
    setSelectedMjLoggerLevel(event.target.value);
    sendCommandToMatterbridge('setmjloglevel', event.target.value);
  };

  // Define a function to handle change matter log file
  const handleLogOnFileMjChange = (event) => {
    console.log('handleLogOnFileMjChange called with value:', event.target.checked);
    setLogOnFileMj(event.target.checked);
    sendCommandToMatterbridge('setmjlogfile', event.target.checked ? 'true' : 'false');
  };

  // Define a function to handle change mdnsInterface
  const handleChangeMdnsInterface = (event) => {
    console.log('handleChangeMdnsInterface called with value:', event.target.value);
    setmdnsInterface(event.target.value);
    sendCommandToMatterbridge('setmdnsinterface', '*'+event.target.value+'*');
    showSnackbarMessage('Restart Matterbridge to apply changes', 5);
  };

  // Define a function to handle change mdnsInterface
  const handleChangeIpv4Address = (event) => {
    console.log('handleChangeIpv4Address called with value:', event.target.value);
    setIpv4Address(event.target.value);
    sendCommandToMatterbridge('setipv4address', '*'+event.target.value+'*');
    showSnackbarMessage('Restart Matterbridge to apply changes', 5);
  };

  // Define a function to handle change mdnsInterface
  const handleChangeIpv6Address = (event) => {
    console.log('handleChangeIpv6Address called with value:', event.target.value);
    setIpv6Address(event.target.value);
    sendCommandToMatterbridge('setipv6address', '*'+event.target.value+'*');
    showSnackbarMessage('Restart Matterbridge to apply changes', 5);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '500px' }}>
      <FormControl style={{ gap: '10px', border: '1px solid #9e9e9e', boxShadow: '5px 5px 10px #888', padding: '10px', borderRadius: '4px', maxWidth: '500px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <FormLabel color='readonly' style={{padding: '0px', margin: '0px'}} id="mjdebug-info">Matter logger level:</FormLabel>
          <Select style={{ height: '30px' }} labelId="select-mjlevel" id="mjdebug-level" value={selectedMjLoggerLevel} onChange={handleChangeMjLoggerLevel}>
            <MenuItem value='Debug'>Debug</MenuItem>
            <MenuItem value='Info'>Info</MenuItem>
            <MenuItem value='Notice'>Notice</MenuItem>
            <MenuItem value='Warn'>Warn</MenuItem>
            <MenuItem value='Error'>Error</MenuItem>
            <MenuItem value='Fatal'>Fatal</MenuItem>
          </Select>
          <FormControlLabel style={{padding: '0px', margin: '0px', color: 'rgba(0, 0, 0, 0.87)'}} control={<Checkbox checked={logOnFileMj} onChange={handleLogOnFileMjChange} name="logOnFileMj" />} label="Log on file:" labelPlacement="start"/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <FormLabel color='readonly' style={{padding: '0px', margin: '0px'}}>Mdns interface:</FormLabel>
          <TextField value={mdnsInterface} onChange={handleChangeMdnsInterface} size="small" variant="outlined" 
            style={{ height: '30px', marginTop: '5px' }} InputProps={{
              style: {
                height: '30px',
                padding: '0',
              },
            }}/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <FormLabel color='readonly' style={{padding: '0px', margin: '0px'}}>Ipv4 address:</FormLabel>
          <TextField value={mdnsInterface} onChange={handleChangeIpv4Address} size="small" variant="outlined" 
            style={{ height: '30px', marginTop: '5px' }} InputProps={{
              style: {
                height: '30px',
                padding: '0',
              },
            }}/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <FormLabel color='readonly' style={{padding: '0px', margin: '0px'}}>Ipv6 address:</FormLabel>
          <TextField value={mdnsInterface} onChange={handleChangeIpv6Address} size="small" variant="outlined" 
            style={{ height: '30px', marginTop: '5px' }} InputProps={{
              style: {
                height: '30px',
                padding: '0',
              },
            }}/>
        </div>
      </FormControl>
    </div>
  );
}
*/

function MatterbridgeInfo({ matterbridgeInfo }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '500px' }}>
      <FormControl style={{ gap: '10px', border: '1px solid #9e9e9e', boxShadow: '5px 5px 10px #888', padding: '10px', borderRadius: '4px', maxWidth: '500px' }}>
        <ReadOnlyTextField value={matterbridgeInfo.matterbridgeVersion} label="Current Version" />
        <ReadOnlyTextField value={matterbridgeInfo.matterbridgeLatestVersion} label="Latest Version" />
        <ReadOnlyTextField value={matterbridgeInfo.homeDirectory} label="Home Directory" />
        <ReadOnlyTextField value={matterbridgeInfo.rootDirectory} label="Root Directory" />
        <ReadOnlyTextField value={matterbridgeInfo.matterbridgeDirectory} label="Matterbridge Storage Directory" />
        <ReadOnlyTextField value={matterbridgeInfo.matterbridgePluginDirectory} label="Matterbridge Plugin Directory" />
        <ReadOnlyTextField value={matterbridgeInfo.globalModulesDirectory} label="Global Module Directory" />
      </FormControl>
    </div>
  );
};

function ReadOnlyTextField({ value, label }) {
  return (
    <TextField
      focused
      color='readonly'
      value={value}
      size="small"
      label={label}
      variant="standard"
      fullWidth
      InputProps={{
        readOnly: true,
        sx: {
          '&:before': { borderBottomColor: '#9e9e9e' },
          '&:after': { borderBottomColor: '#9e9e9e' }
        }
      }}
    />
  );
};

/*
*/
export default Settings;
