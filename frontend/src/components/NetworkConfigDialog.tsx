// React
import { useState } from 'react';

// @mui/material
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Grid from '@mui/material/Grid';

interface NetworkConfigDialogProps {
  open: boolean;
  ip?: string;
  onClose: () => void;
  onSave: (config: { type: "dhcp" | "static"; ip: string; subnet: string; gateway: string; dns: string }) => void;
}

export const NetworkConfigDialog = ({ open, ip, onClose, onSave }: NetworkConfigDialogProps) => {
  const defaultGateway = ip ? ip.split('.').slice(0, 3).join('.') + '.1' : '';
  const [networkType, setNetworkType] = useState<"dhcp" | "static">('dhcp');
  const [staticConfig, setStaticConfig] = useState({
    ip: ip ?? '',
    subnet: '255.255.255.0',
    gateway: defaultGateway,
    dns: defaultGateway,
  });

  const handleFieldChange = (field: keyof typeof staticConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setStaticConfig({
      ...staticConfig,
      [field]: e.target.value,
    });
  };

  const handleCancel = () => {
    onClose();
  };

  const handleSave = () => {
    onSave({ type: networkType, ...staticConfig });
    onClose();
  };

  return (
    <Dialog open={open} onClose={(event, reason) => {
      // Prevent closing the dialog by clicking the backdrop or pressing Escape.
      if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
        return;
      }
      onClose();
    }} maxWidth="sm" style={{ maxWidth: '550px', margin: 'auto' }}>
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
            onChange={(e) => setNetworkType(e.target.value as "dhcp" | "static")}
          >
            <FormControlLabel value="dhcp" control={<Radio />} label="DHCP" />
            <FormControlLabel value="static" control={<Radio />} label="Static" />
          </RadioGroup>
        </FormControl>

        {networkType === 'static' && (
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid size={6}>
              <TextField
                label="IP Address"
                fullWidth
                value={staticConfig.ip}
                onChange={handleFieldChange('ip')}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                label="Subnet Mask"
                fullWidth
                value={staticConfig.subnet}
                onChange={handleFieldChange('subnet')}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                label="Gateway"
                fullWidth
                value={staticConfig.gateway}
                onChange={handleFieldChange('gateway')}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                label="DNS Server"
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
