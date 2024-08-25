/* eslint-disable no-console */
import { Dialog, DialogTitle, DialogContent, Button } from '@mui/material';

// Create a component for confirming or canceling an action
export function ConfirmCancelForm({ open, title, message, onConfirm, onCancel }) {

  const handleConfirm = event => {
    console.log('Confirmed');
    event.preventDefault();
    onConfirm();
  };

  const handleCancel = event => {
    console.log('Canceled');
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
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: '0', marginBottom: '20px', maxHeight: '80px', maxWidth: '250px' }}>
          {message && <p style={{ color: 'black', margin: '0' }}>{message}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around'}}>
          <Button onClick={handleConfirm} variant="contained" color="primary" size="small">Confirm</Button>
          <Button onClick={handleCancel} variant="contained" color="primary" size="small">Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}  
/*
    <div style={containerStyle}>
      <form onSubmit={handleConfirm} style={formStyle}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
          <img src="matterbridge 32x32.png" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
          <h3>{title}</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 0, maxHeight: '50px', maxWidth: '250px' }}>
          {message && <p style={{ color: 'black' }}>{message}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: '20px' }}>
          <button type="submit">Confirm</button>
          <button type="button" onClick={handleCancel} style={buttonStyle}>Cancel</button>
        </div>
      </form>
    </div>

*/