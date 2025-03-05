import React, { useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';

export const InstallProgressDialog = ({ open, output, onInstall, onClose }) => {
  // Ref to access the underlying textarea element for auto-scrolling.
  const logRef = useRef(null);

  // Scroll to the bottom whenever the output updates.
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [output]);

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
      style={{ maxWidth: '550px', margin: 'auto' }}
    >
      <DialogTitle>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
          <img
            src="matterbridge.svg"
            alt="Matterbridge Logo"
            style={{ height: '32px', width: '32px' }}
          />
          <h4 style={{ margin: 0 }}>Installation Progress</h4>
        </div>
      </DialogTitle>
      <DialogContent dividers>
        <TextField
          label="Installation Log"
          multiline
          fullWidth
          rows={10}
          variant="outlined"
          value={output}
          InputProps={{
            readOnly: true,
            // Attach the ref to the underlying textarea element for scrolling.
            inputRef: logRef,
          }}
          inputProps={{
            style: { fontFamily: 'monospace', whiteSpace: 'pre-wrap' },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onInstall}>
          Install
        </Button>
      </DialogActions>
    </Dialog>
  );
};
