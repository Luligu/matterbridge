// React
import { useRef, useEffect } from 'react';

// @mui/material
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

interface InstallProgressDialogProps {
  open: boolean;
  output: string;
  onInstall: () => void;
  onClose: () => void;
}

export const InstallProgressDialog = ({ open, output, onInstall, onClose }: InstallProgressDialogProps) => {
  // Ref to access the underlying textarea element for auto-scrolling.
  const logRef = useRef<HTMLTextAreaElement>(null);

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
          slotProps={{
            input: {
              readOnly: true,
              ref: logRef,
              style: { fontFamily: 'monospace', whiteSpace: 'pre-wrap' },
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onInstall}>Install</Button>
      </DialogActions>
    </Dialog>
  );
};
