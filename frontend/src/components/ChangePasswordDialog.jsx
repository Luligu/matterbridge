import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
} from '@mui/material';
import Grid from '@mui/material/Grid';

export const ChangePasswordDialog = ({ open, onClose, onSave }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleNewPasswordChange = (e) => {
    setNewPassword(e.target.value);
  };

  const handleConfirmPasswordChange = (e) => {
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
            <Grid item xs={12}>
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
            <Grid item xs={12}>
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
