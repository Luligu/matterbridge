// React
import { useRef, useEffect } from 'react';

// @mui/material
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

// Frontend
import { debug } from '../App';
// const debug = true;

interface InstallProgressDialogProps {
  open: boolean;
  packageName: string;
  output: string;
  onInstall?: () => void;
  onClose: () => void;
}

export const InstallProgressDialog = ({ open, output, packageName, onInstall, onClose }: InstallProgressDialogProps) => {
  // Ref to access the log <ul> element for auto-scrolling.
  const endOfMessagesRef = useRef<HTMLLIElement>(null);

  // Scroll to the bottom whenever the output updates.
  useEffect(() => {
    if (debug) console.log(`InstallProgressDialog output effect mounted, scrolling to bottom: ${endOfMessagesRef.current}`);
    setTimeout(() => {
      if (debug) console.log('Scrolling to bottom:', endOfMessagesRef.current);
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
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
      slotProps={{
        paper: { sx: { width: '70vw', maxWidth: '70vw', height: '70vw', maxHeight: '70vh', overflow: 'hidden' } }
      }}
    >
      <DialogTitle>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
          <img
            src="matterbridge.svg"
            alt="Matterbridge Logo"
            style={{ height: '32px', width: '32px' }}
          />
          <h4 style={{ margin: 0 }}>Install{onInstall ? '' : 'ing'} package {packageName}</h4>
        </div>
      </DialogTitle>
      <DialogContent
        dividers
        style={{
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: 400,
          paddingBottom: 0
        }}
      >
        <label style={{ display: 'block', marginBottom: '10px', fontSize: '16px', fontWeight: 'bold', color: 'var(--primary-color)' }}>Install log</label>
          <ul
            style={{
              width: '100%',
              height: '100%',
              fontFamily: 'monospace',
              fontSize: '14px',
              padding: '10px',
              margin: 0,
              marginBottom: '10px',
              color: 'var(--div-text-color)',
              background: 'var(--div-bg-color)',
              overflow: 'auto',
              listStyle: 'none',
              boxSizing: 'border-box',
              borderRadius: 4,
              border: '4px solid var(--primary-color)',
              whiteSpace: 'pre-wrap',
              display: 'block',
            }}
          >
            {output.split('\n').map((line, idx) => (
              <li key={idx} style={{ padding: 0, margin: 0, wordBreak: 'break-all' }}>{line}</li>
            ))}
            <li ref={endOfMessagesRef} style={{ padding: 0, margin: 0 }} />
          </ul>
      </DialogContent>
      <DialogActions>
        {onInstall && <Button variant="contained" onClick={onInstall}>Install</Button>}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
