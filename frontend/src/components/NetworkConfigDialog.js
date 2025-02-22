import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  FormControl,
  FormLabel,
} from '@mui/material';
import Grid from '@mui/material/Grid'; // Using standard Grid import

export const NetworkConfigDialog = ({ open, ip, onClose, onSave }) => {
  const defaultGateway = ip ? ip.split('.').slice(0, 3).join('.') + '.1' : '';
  const [networkType, setNetworkType] = useState('dhcp');
  const [staticConfig, setStaticConfig] = useState({
    ip: ip ?? '',
    subnet: '255.255.255.0',
    gateway: defaultGateway,
    dns: defaultGateway,
  });

  const handleFieldChange = (field) => (e) => {
    setStaticConfig({
      ...staticConfig,
      [field]: e.target.value,
    });
  };

  const handleCancel = () => {
    onClose();
  };

  const handleSave = () => {
    const config =
      networkType === 'static'
        ? { type: networkType, ...staticConfig }
        : { type: networkType };
    onSave(config);
    onClose();
  };

  return (
    <Dialog open={open} onClose={(event, reason) => {
      // Prevent closing the dialog by clicking the backdrop or pressing Escape.
      if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
        return;
      }
      onClose();
    }} maxWidth="sm" style={{ maxWidth: '500px', margin: 'auto' }}>
      <DialogTitle gap={'20px'}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
          <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
          <h4 style={{ margin: 0 }}>Network Configuration</h4>
        </div>
      </DialogTitle>
      <DialogContent dividers>
        <FormControl component="fieldset" fullWidth>
          <FormLabel component="legend">Select IP Configuration</FormLabel>
          <RadioGroup
            row
            value={networkType}
            onChange={(e) => setNetworkType(e.target.value)}
          >
            <FormControlLabel value="dhcp" control={<Radio />} label="DHCP" />
            <FormControlLabel value="static" control={<Radio />} label="Static" />
          </RadioGroup>
        </FormControl>

        {networkType === 'static' && (
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="IP Address"
                fullWidth
                value={staticConfig.ip}
                onChange={handleFieldChange('ip')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Subnet Mask"
                fullWidth
                value={staticConfig.subnet}
                onChange={handleFieldChange('subnet')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Gateway"
                fullWidth
                value={staticConfig.gateway}
                onChange={handleFieldChange('gateway')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="DNS Servers"
                fullWidth
                value={staticConfig.dns}
                onChange={handleFieldChange('dns')}
              />
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
