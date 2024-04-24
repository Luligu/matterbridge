import React from 'react';
import { useState, useEffect } from 'react';

import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import TextField from '@mui/material/TextField';

import { sendCommandToMatterbridge } from './Header';

export const MatterbridgeInfoContext = React.createContext();
// Use with const matterbridgeInfo = useContext(MatterbridgeInfoContext);
// <MatterbridgeInfoContext.Provider value={matterbridgeInfo}>
// </MatterbridgeInfoContext.Provider>

export var info = {};

function Settings() {

  return (
    <div style={{ display: 'flex', flex: 1, flexBasis: 'auto', flexDirection: 'column', height: 'calc(100vh - 60px - 40px)', width: 'calc(100vw - 40px)', gap: '10px' , margin: '0', padding: '0' }}>
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
  // Define a state variable for the selected value
  const [selectedRestartValue, setSelectedRestatValue] = useState(''); 
  const [selectedModeValue, setSelectedModeValue] = useState('bridge'); 
  const [selectedDebugValue, setSelectedDebugValue] = useState('Info'); 
  const [matterbridgeInfo, setMatterbridgeInfo] = useState({});
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Fetch System Info
    fetch('/api/settings')
      .then(response => response.json())
      .then(data => { 
        setMatterbridgeInfo(data.matterbridgeInformation); 
        setSelectedRestatValue(data.matterbridgeInformation.restartMode); 
        setSelectedModeValue(data.matterbridgeInformation.bridgeMode==='bridge'?'bridge':'childbridge'); 
        setSelectedDebugValue(data.matterbridgeInformation.debugEnabled?'Debug':'Info'); 
        info = data.matterbridgeInformation; 
        console.log('/api/settings:', info) })
      .catch(error => console.error('Error fetching settings:', error));
  }, []); // The empty array causes this effect to run only once

  // Define a function to handle change mode 
  const handleChangeMode = (event) => {
    console.log('handleChangeMode called with value:', event.target.value);
    setSelectedModeValue(event.target.value);
    sendCommandToMatterbridge('setbridgemode', event.target.value);
  };

  // Define a function to handle change debug level
  const handleChangeDebug = (event) => {
    console.log('handleChangeDebug called with value:', event.target.value);
    setSelectedDebugValue(event.target.value);
    sendCommandToMatterbridge('setloglevel', event.target.value);
  };

  // Define a function to handle change password
  const handleChangePassword = (event) => {
    console.log('handleChangePassword called with value:', event.target.value);
    setPassword(event.target.value);
    sendCommandToMatterbridge('setpassword', '*'+event.target.value+'*');
  };

  return (
    <FormControl style={{ gap: '10px', width: '600px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <FormLabel style={{padding: '0px', margin: '0px'}} id="matterbridgeInfo-mode">Matterbridge mode:</FormLabel>
        <RadioGroup focused row name="mode-buttons-group" value={selectedModeValue} onChange={handleChangeMode}>
          <FormControlLabel value="bridge" disabled control={<Radio />} label="Bridge" />
          <FormControlLabel value="childbridge" disabled control={<Radio />} label="Childbridge" />
        </RadioGroup>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <FormLabel style={{padding: '0px', margin: '0px'}} id="matterbridgeInfo-restart">Matterbridge restart:</FormLabel>
        <RadioGroup focused row name="mode-buttons-group" value={selectedRestartValue} onChange={handleChangeMode}>
          <FormControlLabel value="" disabled control={<Radio />} label="None" />
          <FormControlLabel value="service" disabled control={<Radio />} label="Service" />
          <FormControlLabel value="docker" disabled control={<Radio />} label="Docker" />
        </RadioGroup>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <FormLabel style={{padding: '0px', margin: '0px'}} id="matterbridgeInfo-debug">Logger level:</FormLabel>
        <RadioGroup focused row name="debug-buttons-group" value={selectedDebugValue} onChange={handleChangeDebug}>
          <FormControlLabel value="Debug" control={<Radio />} label="Debug" />
          <FormControlLabel value="Info" control={<Radio />} label="Info" />
          <FormControlLabel value="Warn" control={<Radio />} label="Warn" />
        </RadioGroup>
      </div>
      <TextField focused value={password} onChange={handleChangePassword} size="small" id="matterbridgePassword" label="Matterbridge Password" type="password" autoComplete="current-password" variant="outlined"/>
      <TextField focused value={matterbridgeInfo.matterbridgeVersion} size="small" id="matterbridgeVersion" label="Current Version" InputProps={{readOnly: true}} variant="standard"/>
      <TextField focused value={matterbridgeInfo.matterbridgeLatestVersion} size="small" id="matterbridgeLatestVersion" label="Latest Version" InputProps={{readOnly: true}} variant="standard"/>
      <TextField focused value={matterbridgeInfo.homeDirectory} size="small" id="homeDirectory" label="Home Directory" InputProps={{readOnly: true}} variant="standard"/>
      <TextField focused value={matterbridgeInfo.rootDirectory} size="small" id="rootDirectory" label="Root Directory" InputProps={{readOnly: true}} variant="standard"/>
      <TextField focused value={matterbridgeInfo.matterbridgeDirectory} size="small" id="matterbridgeDirectory" label="Matterbridge Directory" InputProps={{readOnly: true}} variant="standard"/>
      <TextField focused value={matterbridgeInfo.matterbridgePluginDirectory} size="small" id="matterbridgePluginDirectory" label="Matterbridge Plugin Directory" InputProps={{readOnly: true}} variant="standard"/>
      <TextField focused value={matterbridgeInfo.globalModulesDirectory} size="small" id="globalModulesDirectory" label="Global Module Directory" InputProps={{readOnly: true}} variant="standard"/>
    </FormControl>
  );
}

export default Settings;

/*

*/