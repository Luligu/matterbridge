// React
import { useRef, useEffect, useContext } from 'react';

// @mui/material
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

// Frontend
import { debug } from '../App';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import { MbfLsk } from '../utils/localStorage';
import { UiContext } from './UiProvider';
// const debug = true;

interface InstallProgressDialogProps {
  open: boolean;
  title: string;
  output: string;
  _command: string;
  _packageName: string;
  onInstall?: () => void;
  onClose: () => void;
}

export const InstallProgressDialog = ({ open, output, title, _command, _packageName, onInstall, onClose }: InstallProgressDialogProps) => {
  const { installAutoExit, setInstallAutoExit } = useContext(UiContext);
  // Ref to access the log <ul> element for auto-scrolling.
  const endOfMessagesRef = useRef<HTMLLIElement>(null);

  const handleInstallAutoExitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInstallAutoExit(event.target.checked);
    localStorage.setItem(MbfLsk.installAutoExit, event.target.checked ? 'true' : 'false');
    if (debug) console.log('handleInstallAutoExitChange called with value:', event.target.checked);
  };

  // Scroll to the bottom whenever the output updates.
  useEffect(() => {
    if (debug) console.log(`InstallProgressDialog output effect mounted, scrolling to bottom: ${endOfMessagesRef.current}`);
    setTimeout(() => {
      if (debug) console.log('Scrolling to bottom:', endOfMessagesRef.current);
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
        paper: { sx: { width: '70vw', maxWidth: '70vw', height: '70vw', maxHeight: '70vh', overflow: 'hidden' } },
      }}
    >
      <DialogTitle>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
          <img src='matterbridge.svg' alt='Matterbridge Logo' style={{ height: '32px', width: '32px' }} />
          <h4 style={{ margin: 0 }}>{title}</h4>
        </div>
      </DialogTitle>
      <DialogContent
        dividers
        style={{
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: 400,
          paddingBottom: 0,
        }}
      >
        <label style={{ display: 'block', marginBottom: '10px', fontSize: '16px', fontWeight: 'bold', color: 'var(--primary-color)' }}>Process log</label>
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
            <li key={idx} style={{ padding: 0, margin: 0, wordBreak: 'break-all' }}>
              {line}
            </li>
          ))}
          <li ref={endOfMessagesRef} style={{ padding: 0, margin: 0 }} />
        </ul>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-evenly' }}>
        {onInstall && (
          <Button variant='contained' onClick={onInstall}>
            Install
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
        <FormControlLabel control={<Checkbox checked={installAutoExit} onChange={(e) => handleInstallAutoExitChange(e)} />} label='Close on success' style={{ color: 'var(--div-text-color)' }} />
      </DialogActions>
    </Dialog>
  );
};
