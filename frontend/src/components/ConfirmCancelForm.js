// @mui/material
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';

// Create a component for confirming or canceling an action
export function ConfirmCancelForm({ open, title, message, onConfirm, onCancel }) {

  const handleConfirm = event => {
    // console.log('Confirmed');
    event.preventDefault();
    onConfirm();
  };

  const handleCancel = event => {
    // console.log('Canceled');
    event.preventDefault();
    onCancel();
  };

  return (
    <Dialog open={open} PaperProps={{style: { border: "2px solid #ddd", backgroundColor: '#c4c2c2', boxShadow: '5px 5px 10px #888'}}}>
      <DialogTitle gap={'20px'}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
          <img src="matterbridge 32x32.png" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
          <h4 style={{ margin: 0 }}>{title}</h4>
        </div>
      </DialogTitle>
      <DialogContent>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: '0', marginBottom: '20px', maxHeight: '350px', maxWidth: '350px' }}>
          <p style={{ flex: 1, color: 'black', margin: '0' }}>{message}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around'}}>
          <Button onClick={handleConfirm} variant="contained" color="primary" size="small" style={{ color: '#ffffff' }}>Confirm</Button>
          <Button onClick={handleCancel} variant="contained" color="primary" size="small" style={{ color: '#ffffff' }}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}  
