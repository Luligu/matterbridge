/* eslint-disable no-console */
import React, { useState, useEffect, useContext } from 'react';
import { Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, TextField, Select, MenuItem, Checkbox, ThemeProvider, createTheme } from '@mui/material';

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

  if (!online) {
    return ( <Connecting /> );
  }
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
  const [selectedBridgeMode, setSelectedBridgeMode] = useState('bridge'); 
  const [selectedMbLoggerLevel, setSelectedMbLoggerLevel] = useState('Info'); 
  const [selectedMjLoggerLevel, setSelectedMjLoggerLevel] = useState('Info'); 
  const [logOnFileMb, setLogOnFileMb] = useState(false);
  const [logOnFileMj, setLogOnFileMj] = useState(false);  
  const [matterbridgeInfo, setMatterbridgeInfo] = useState({});
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Fetch System Info
    fetch('/api/settings')
      .then(response => response.json())
      .then(data => { 
        setMatterbridgeInfo(data.matterbridgeInformation); 
        setSelectedBridgeMode(data.matterbridgeInformation.bridgeMode==='bridge'?'bridge':'childbridge'); 

        if(data.matterbridgeInformation.loggerLevel === 'debug') setSelectedMbLoggerLevel('Debug');
        if(data.matterbridgeInformation.loggerLevel === 'info') setSelectedMbLoggerLevel('Info');
        if(data.matterbridgeInformation.loggerLevel === 'notice') setSelectedMbLoggerLevel('Notice');
        if(data.matterbridgeInformation.loggerLevel === 'warn') setSelectedMbLoggerLevel('Warn');
        if(data.matterbridgeInformation.loggerLevel === 'error') setSelectedMbLoggerLevel('Error');
        if(data.matterbridgeInformation.loggerLevel === 'fatal') setSelectedMbLoggerLevel('Fatal');
        setLogOnFileMb(data.matterbridgeInformation.fileLogger);

        if(data.matterbridgeInformation.matterLoggerLevel === 0) setSelectedMjLoggerLevel('Debug');
        if(data.matterbridgeInformation.matterLoggerLevel === 1) setSelectedMjLoggerLevel('Info');
        if(data.matterbridgeInformation.matterLoggerLevel === 2) setSelectedMjLoggerLevel('Notice');
        if(data.matterbridgeInformation.matterLoggerLevel === 3) setSelectedMjLoggerLevel('Warn');
        if(data.matterbridgeInformation.matterLoggerLevel === 4) setSelectedMjLoggerLevel('Error');
        if(data.matterbridgeInformation.matterLoggerLevel === 5) setSelectedMjLoggerLevel('Fatal');
        setLogOnFileMj(data.matterbridgeInformation.matterFileLogger);

        // info = data.matterbridgeInformation; 
        console.log('/api/settings:', data.matterbridgeInformation) })
      .catch(error => console.error('Error fetching settings:', error));
  }, []); // The empty array causes this effect to run only once

  // Define a function to handle change bridge mode 
  const handleChangeBridgeMode = (event) => {
    console.log('handleChangeBridgeMode called with value:', event.target.value);
    setSelectedBridgeMode(event.target.value);
    sendCommandToMatterbridge('setbridgemode', event.target.value);
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
    <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', marginTop: '10px', width: '100%'}}>
      <ThemeProvider theme={theme}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '50%' }}>
        <FormControl style={{ gap: '10px', border: '1px solid #9e9e9e', padding: '10px', borderRadius: '4px', maxWidth: '510px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <FormLabel color='readonly' style={{padding: '0px', margin: '0px'}} id="matterbridgeInfo-mode">Matterbridge mode (restart required):</FormLabel>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '50%' }}>
        <FormControl style={{ gap: '10px', border: '1px solid #9e9e9e', padding: '10px', borderRadius: '4px', maxWidth: '510px' }}>
          <TextField focused color='readonly' value={matterbridgeInfo.matterbridgeVersion} size="small" id="matterbridgeVersion" label="Current Version" variant="standard" fullWidth InputProps={{readOnly: true, sx: {'&:before': {borderBottomColor: '#9e9e9e' }, '&:after': {borderBottomColor: '#9e9e9e'}} }}/>
          <TextField focused color='readonly' value={matterbridgeInfo.matterbridgeLatestVersion} size="small" id="matterbridgeLatestVersion" label="Latest Version" variant="standard" fullWidth InputProps={{readOnly: true, sx: {'&:before': {borderBottomColor: '#9e9e9e' }, '&:after': {borderBottomColor: '#9e9e9e'}} }}/>
          <TextField focused color='readonly' value={matterbridgeInfo.homeDirectory} size="small" id="homeDirectory" label="Home Directory" variant="standard" fullWidth InputProps={{readOnly: true, sx: {'&:before': {borderBottomColor: '#9e9e9e' }, '&:after': {borderBottomColor: '#9e9e9e'}} }}/>
          <TextField focused color='readonly' value={matterbridgeInfo.rootDirectory} size="small" id="rootDirectory" label="Root Directory" variant="standard" fullWidth InputProps={{readOnly: true, sx: {'&:before': {borderBottomColor: '#9e9e9e' }, '&:after': {borderBottomColor: '#9e9e9e'}} }}/>
          <TextField focused color='readonly' value={matterbridgeInfo.matterbridgeDirectory} size="small" id="matterbridgeDirectory" label="Matterbridge Storage Directory" variant="standard" fullWidth InputProps={{readOnly: true, sx: {'&:before': {borderBottomColor: '#9e9e9e' }, '&:after': {borderBottomColor: '#9e9e9e'}} }}/>
          <TextField focused color='readonly' value={matterbridgeInfo.matterbridgePluginDirectory} size="small" id="matterbridgePluginDirectory" label="Matterbridge Plugin Directory" variant="standard" fullWidth InputProps={{readOnly: true, sx: {'&:before': {borderBottomColor: '#9e9e9e' }, '&:after': {borderBottomColor: '#9e9e9e'}} }}/>
          <TextField focused color='readonly' value={matterbridgeInfo.globalModulesDirectory} size="small" id="globalModulesDirectory" label="Global Module Directory" variant="standard" fullWidth InputProps={{readOnly: true, sx: {'&:before': {borderBottomColor: '#9e9e9e' }, '&:after': {borderBottomColor: '#9e9e9e'}} }}/>
        </FormControl>
      </div>
      </ThemeProvider>  
    </div>
  );
}

/*
*/
export default Settings;
