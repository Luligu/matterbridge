/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import { Radio, RadioGroup, Button, Tooltip, FormControlLabel, FormControl, FormLabel, TextField, Backdrop, CircularProgress } from '@mui/material';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

import { theme, sendCommandToMatterbridge } from './Header';

// export const MatterbridgeInfoContext = React.createContext();
// Use with const matterbridgeInfo = useContext(MatterbridgeInfoContext);
// <MatterbridgeInfoContext.Provider value={matterbridgeInfo}>
// </MatterbridgeInfoContext.Provider>

export var info = {};

function Settings() {

//  <div style={{ display: 'flex', flex: 1, flexBasis: 'auto', flexDirection: 'column', height: 'calc(100vh - 60px - 40px)', width: 'calc(100vw - 40px)', gap: '10px' , margin: '0', padding: '0' }}>
  return (
    <div className="MbfPageDiv">
      <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
        <h3>Matterbridge settings:</h3>
      </div>  
      <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', marginTop: '10px' }}>
        <MatterbridgeInfo />
      </div>  
    </div>
  );
}

function MatterbridgeInfo() {
  const [open, setOpen] = useState(false);
  const [selectedRestartMode, setSelectedRestartMode] = useState(''); 
  const [selectedBridgeMode, setSelectedBridgeMode] = useState('bridge'); 
  const [selectedDebugLevel, setSelectedDebugLevel] = useState('Info'); 
  const [matterbridgeInfo, setMatterbridgeInfo] = useState({});
  const [password, setPassword] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    // Fetch System Info
    fetch('/api/settings')
      .then(response => response.json())
      .then(data => { 
        setMatterbridgeInfo(data.matterbridgeInformation); 
        setSelectedRestartMode(data.matterbridgeInformation.restartMode); 
        setSelectedBridgeMode(data.matterbridgeInformation.bridgeMode==='bridge'?'bridge':'childbridge'); 
        setSelectedDebugLevel(data.matterbridgeInformation.debugEnabled?'Debug':'Info'); 
        info = data.matterbridgeInformation; 
        console.log('/api/settings:', info) })
      .catch(error => console.error('Error fetching settings:', error));
  }, []); // The empty array causes this effect to run only once

  // Define a function to handle change bridge mode 
  const handleChangeBridgeMode = (event) => {
    console.log('handleChangeBridgeMode called with value:', event.target.value);
    setSelectedBridgeMode(event.target.value);
    sendCommandToMatterbridge('setbridgemode', event.target.value);
  };

  // Define a function to handle change restart mode 
  const handleChangeRestartMode = (event) => {
    console.log('handleChangeRestartMode called with value:', event.target.value);
    setSelectedBridgeMode(event.target.value);
    sendCommandToMatterbridge('setrestartmode', event.target.value);
  };

  // Define a function to handle change debug level
  const handleChangeDebugLevel = (event) => {
    console.log('handleChangeDebugLevel called with value:', event.target.value);
    setSelectedDebugLevel(event.target.value);
    sendCommandToMatterbridge('setloglevel', event.target.value);
  };

  // Define a function to handle change password
  const handleChangePassword = (event) => {
    console.log('handleChangePassword called with value:', event.target.value);
    setPassword(event.target.value);
    sendCommandToMatterbridge('setpassword', '*'+event.target.value+'*');
  };

  // Define a function to handle unregister all devices
  const handleUnregister = () => {
    console.log('handleUnregister called');
    sendCommandToMatterbridge('unregister', 'now');
    setOpen(true);
    setTimeout(() => {
      setOpen(false);
      window.location.reload();
    }, 10 * 1000);
  };

  // Define a function to handle reset
  const handleReset = () => {
    console.log('handleReset called');
    sendCommandToMatterbridge('reset', 'now');
    setOpen(true);
    setTimeout(() => {
      setOpen(false);
      window.location.reload();
    }, 10 * 1000);
  };

  // Define a function to handle factory reset
  const handleFactoryReset = () => {
    console.log('handleFactoryReset called');
    sendCommandToMatterbridge('factoryreset', 'now');
    setOpen(true);
    setTimeout(() => {
      setOpen(false);
      window.location.reload();
    }, 10 * 1000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', marginTop: '10px', width: '100%'}}>
      <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={open} onClick={handleClose}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '50%' }}>
        <FormControl style={{ gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}} id="matterbridgeInfo-mode">Matterbridge mode:</FormLabel>
            <RadioGroup focused row name="mode-buttons-group" value={selectedBridgeMode} onChange={handleChangeBridgeMode}>
              <FormControlLabel value="bridge" disabled control={<Radio />} label="Bridge" />
              <FormControlLabel value="childbridge" disabled control={<Radio />} label="Childbridge" />
            </RadioGroup>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}} id="matterbridgeInfo-restart">Matterbridge restart mode:</FormLabel>
            <RadioGroup focused row name="mode-buttons-group" value={selectedRestartMode} onChange={handleChangeRestartMode}>
              <FormControlLabel value="" disabled control={<Radio />} label="None" />
              <FormControlLabel value="service" disabled control={<Radio />} label="Service" />
              <FormControlLabel value="docker" disabled control={<Radio />} label="Docker" />
            </RadioGroup>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <FormLabel style={{padding: '0px', margin: '0px'}} id="matterbridgeInfo-debug">Logger level:</FormLabel>
            <RadioGroup focused row name="debug-buttons-group" value={selectedDebugLevel} onChange={handleChangeDebugLevel}>
              <FormControlLabel value="Debug" control={<Radio />} label="Debug" />
              <FormControlLabel value="Info" control={<Radio />} label="Info" />
              <FormControlLabel value="Notice" control={<Radio />} label="Notice" />
              <FormControlLabel value="Warn" control={<Radio />} label="Warn" />
              <FormControlLabel value="Error" control={<Radio />} label="Error" />
              <FormControlLabel value="Fatal" control={<Radio />} label="Fatal" />
            </RadioGroup>
          </div>
          <TextField focused value={password} onChange={handleChangePassword} size="small" id="matterbridgePassword" label="Matterbridge Password" type="password" autoComplete="current-password" variant="outlined" style={{ marginTop: '20px'}} />
          <Tooltip title="Unregister all bridged devices and shutdown.">
            <Button onClick={handleUnregister} theme={theme} color="primary" variant="contained" endIcon={<PowerSettingsNewIcon />} style={{ color: '#ffffff', marginTop: '20px'}}>Unregister all bridged devices</Button>
          </Tooltip>        
          <Tooltip title="Reset Matterbridge commissioning and shutdown.">
            <Button onClick={handleReset} theme={theme} color="primary" variant="contained" endIcon={<PowerSettingsNewIcon />} style={{ color: '#ffffff', marginTop: '20px'}}>Reset Matterbridge commissioning</Button>
          </Tooltip>        
          <Tooltip title="Factory Reset Matterbridge and shutdown. You will loose all commissioning and settings.">
            <Button onClick={handleFactoryReset} theme={theme} color="primary" variant="contained" endIcon={<PowerSettingsNewIcon />} style={{ color: '#ffffff', marginTop: '20px'}}>Factory Reset Matterbridge</Button>
          </Tooltip>        
        </FormControl>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '50%' }}>
        <TextField focused value={matterbridgeInfo.matterbridgeVersion} size="small" id="matterbridgeVersion" label="Current Version" InputProps={{readOnly: true}} variant="standard" fullWidth/>
        <TextField focused value={matterbridgeInfo.matterbridgeLatestVersion} size="small" id="matterbridgeLatestVersion" label="Latest Version" InputProps={{readOnly: true}} variant="standard" fullWidth/>
        <TextField focused value={matterbridgeInfo.homeDirectory} size="small" id="homeDirectory" label="Home Directory" InputProps={{readOnly: true}} variant="standard"/>
        <TextField focused value={matterbridgeInfo.rootDirectory} size="small" id="rootDirectory" label="Root Directory" InputProps={{readOnly: true}} variant="standard"/>
        <TextField focused value={matterbridgeInfo.matterbridgeDirectory} size="small" id="matterbridgeDirectory" label="Matterbridge Storage Directory" InputProps={{readOnly: true}} variant="standard"/>
        <TextField focused value={matterbridgeInfo.matterbridgePluginDirectory} size="small" id="matterbridgePluginDirectory" label="Matterbridge Plugin Directory" InputProps={{readOnly: true}} variant="standard"/>
        <TextField focused value={matterbridgeInfo.globalModulesDirectory} size="small" id="globalModulesDirectory" label="Global Module Directory" InputProps={{readOnly: true}} variant="standard"/>
      </div>
    </div>
  );
}

export default Settings;
