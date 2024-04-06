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

export var info = {};

function Settings() {

  return (
    <div style={{ display: 'flex', flex: 1, flexBasis: 'auto', flexDirection: 'column', height: 'calc(100vh - 60px - 40px)', width: 'calc(100vw - 40px)', gap: '10px' , margin: '0', padding: '0' }}>
      <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
        <h4>Matterbridge settings:</h4>
      </div>  
      <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
        <MatterbridgeInfo />
      </div>  
    </div>
  );
}

function MatterbridgeInfo() {
  // Define a state variable for the selected value
  const [selectedModeValue, setSelectedModeValue] = useState('bridge'); 
  const [selectedDebugValue, setSelectedDebugValue] = useState('Info'); 
  const [matterbridgeInfo, setMatterbridgeInfo] = useState({});
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Fetch System Info
    fetch('/api/matterbridge-info')
      .then(response => response.json())
      .then(data => { 
        setMatterbridgeInfo(data); 
        setSelectedModeValue(data.bridgeMode==='bridge'?'bridge':'childbridge'); 
        setSelectedDebugValue(data.debugEnabled?'Debug':'Info'); 
        info = data; 
        console.log('/api/matterbridge-info:', info) })
      .catch(error => console.error('Error fetching matterbridge info:', error));
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
    <FormControl>
      <MatterbridgeInfoContext.Provider value={matterbridgeInfo}>
      <FormLabel id="matterbridgeInfo">Matterbridge Mode</FormLabel>
      <RadioGroup
          row
          aria-labelledby="demo-row-radio-buttons-group-label"
          name="mode-buttons-group"
          value={selectedModeValue} // Use the selectedValue state variable
          onChange={handleChangeMode} // Handle changes with the handleChange function
      >
        <FormControlLabel value="bridge" disabled control={<Radio />} label="Bridge" />
        <FormControlLabel value="childbridge" disabled control={<Radio />} label="Childbridge" />
      </RadioGroup>
      <FormLabel id="matterbridgeInfo">Logger level</FormLabel>
      <RadioGroup
          row
          aria-labelledby="demo-row-radio-buttons-group-label"
          name="debug-buttons-group"
          value={selectedDebugValue} // Use the selectedValue state variable
          onChange={handleChangeDebug} // Handle changes with the handleChange function
      >
        <FormControlLabel value="Debug" control={<Radio />} label="Debug" />
        <FormControlLabel value="Info" control={<Radio />} label="Info" />
        <FormControlLabel value="Warn" control={<Radio />} label="Warn" />
      </RadioGroup>
      <FormLabel style={{ marginBottom: '10px', marginTop: '5px' }}>Password
        <TextField style={{ marginTop: '10px' }} value={password} onChange={handleChangePassword} size="small" id="standard-password-input" label="Matterbridge password" type="password" autoComplete="current-password" variant="outlined" fullWidth/>
      </FormLabel>
      <FormLabel>Current Version
        <div className="field-color-selected">{matterbridgeInfo.matterbridgeVersion}</div>
      </FormLabel>
      <FormLabel>Latest Version
        <div className="field-color-selected">{matterbridgeInfo.matterbridgeLatestVersion}</div>
      </FormLabel>
      <FormLabel>Home Directory
        <div className="field-color-selected">{matterbridgeInfo.homeDirectory}</div>
      </FormLabel>
      <FormLabel>Root Directory: 
        <div className="field-color-selected">{matterbridgeInfo.rootDirectory}</div>
      </FormLabel>
      <FormLabel>Matterbridge Directory
        <div className="field-color-selected">{matterbridgeInfo.matterbridgeDirectory}</div>
      </FormLabel>
      <FormLabel>Matterbridge Plugin Directory
        <div className="field-color-selected">{matterbridgeInfo.matterbridgePluginDirectory}</div>
      </FormLabel>
      <FormLabel>Global Module Directory
        <div className="field-color-selected">{matterbridgeInfo.globalModulesDirectory}</div>
      </FormLabel>
      </MatterbridgeInfoContext.Provider>
    </FormControl>
  );
}

export default Settings;
