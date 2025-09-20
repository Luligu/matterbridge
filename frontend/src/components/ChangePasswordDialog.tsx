// React
import { useState } from 'react';

// @mui/material
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (password: string) => void;
}

export const ChangePasswordDialog = ({ open, onClose, onSave }: ChangePasswordDialogProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPassword(e.target.value);
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
  };

  // Ensure the new password is non-empty and both fields match.
  const isValid = newPassword.length > 0 && newPassword === confirmPassword;

  const handleCancel = () => {
    onClose();
  };

  const handleSave = () => {
    if (isValid) {
      onSave(newPassword);
      onClose();
    }
  };

  const handleReset = () => {
    onSave('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        // Prevent closing the dialog by clicking the backdrop or pressing Escape.
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
          return;
        }
        onClose();
      }}
      maxWidth="sm"
      style={{ maxWidth: '500px', margin: 'auto' }}
      disableEscapeKeyDown
    >
      <DialogTitle>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
          <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
          <h4 style={{ margin: 0 }}>Change Password</h4>
        </div>
      </DialogTitle>
      <DialogContent dividers>
        <FormControl component="fieldset" fullWidth sx={{ margin: 0, padding: 0, gap: '20px' }}>
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid size={12}>
              <TextField
                type="password"
                autoComplete='new-password'
                label="New Password"
                size="small" 
                variant="outlined" 
                fullWidth
                value={newPassword}
                onChange={handleNewPasswordChange}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                type="password"
                autoComplete='new-password'
                label="Confirm Password"
                size="small" 
                variant="outlined" 
                fullWidth
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                error={confirmPassword !== '' && newPassword !== confirmPassword}
                helperText={
                  confirmPassword !== '' && newPassword !== confirmPassword
                    ? 'Passwords do not match'
                    : ''
                }
              />
            </Grid>
          </Grid>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!isValid}>Change</Button>
        <Button variant="contained" onClick={handleReset}>Reset</Button>
      </DialogActions>
    </Dialog>
  );
};
