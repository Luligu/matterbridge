import React from 'react';
import { useState, useEffect } from 'react';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import { sendCommandToMatterbridge } from './Header';

function DebugLevel() {
  // Define a state variable for the selected value
  const [selectedValue, setSelectedValue] = useState(localStorage.getItem('debugLevel') || 'Info'); // Set the initial value to 'Debug'

  // Update localStorage whenever the state value changes
  useEffect(() => {
    localStorage.setItem('debugLevel', selectedValue);
  }, [selectedValue]);

  // Define a function to handle changes to the selected value
  const handleChange = (event) => {
    console.log('handleChange called with value:', event.target.value);
    setSelectedValue(event.target.value);
    sendCommandToMatterbridge('setloglevel', event.target.value);
  };

  return (
    <FormControl>
      <FormLabel id="demo-row-radio-buttons-group-label">Logger level</FormLabel>
      <RadioGroup
        row
        aria-labelledby="demo-row-radio-buttons-group-label"
        name="row-radio-buttons-group"
        value={selectedValue} // Use the selectedValue state variable
        onChange={handleChange} // Handle changes with the handleChange function
      >
        <FormControlLabel value="Debug" control={<Radio />} label="Debug" />
        <FormControlLabel value="Info" control={<Radio />} label="Info" />
        <FormControlLabel value="Warn" control={<Radio />} label="Warn" />
      </RadioGroup>
    </FormControl>
  );
}

function Settings() {

  return (
    <div style={{ display: 'flex', flex: 1, flexBasis: 'auto', flexDirection: 'column', height: 'calc(100vh - 60px - 40px)', width: 'calc(100vw - 40px)', gap: '10px' , margin: '0', padding: '0' }}>
      <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
        <h4>Matterbridge settings:</h4>
      </div>  
      <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
        <DebugLevel />
      </div>  
    </div>
  );
}

export default Settings;
