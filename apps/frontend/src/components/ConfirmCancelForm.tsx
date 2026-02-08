// @mui/material
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';

// Frontend
import { debug } from '../App';

export interface ConfirmCancelFormProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Create a component for confirming or canceling an action
export function ConfirmCancelForm({ open, title, message, onConfirm, onCancel }: ConfirmCancelFormProps): React.JSX.Element {
  const handleConfirm = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (debug) console.log('Confirmed');
    event.preventDefault();
    onConfirm();
  };

  const handleCancel = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (debug) console.log('Canceled');
    event.preventDefault();
    onCancel();
  };

  return (
    <Dialog open={open}>
      <DialogTitle gap={'20px'}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
          <img src='matterbridge.svg' alt='Matterbridge Logo' style={{ height: '32px', width: '32px' }} />
          <h4 style={{ margin: 0 }}>{title}</h4>
        </div>
      </DialogTitle>
      <DialogContent>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: '0', marginBottom: '20px', maxHeight: '350px', maxWidth: '350px' }}>
          <p style={{ flex: 1, margin: '0' }}>{message}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
          <Button onClick={handleConfirm} variant='contained' color='primary' size='small'>
            Confirm
          </Button>
          <Button onClick={handleCancel} variant='contained' color='primary' size='small'>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
