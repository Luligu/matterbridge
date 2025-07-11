// QRCode
import { QRCodeSVG } from 'qrcode.react';

// Frontend
import { debug } from '../App';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';

export const QRDivDevice = ({ open, onClose, data }) => {
  if (debug) console.log('QRDivDevice:', data);
  // Return null if no data is available, fabricInformations and sessionInformations if commissioned or qrPairingCode and manualPairingCode if not commissioned
  if (!data) {
    return null;
  } else if (data.commissioned === true && data.fabricInformations && data.sessionInformations) {
    return (
      <Dialog open={open} maxWidth="sm" style={{ maxWidth: '550px', margin: 'auto' }} onClose={onClose}>
        <DialogTitle gap={'20px'}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
            <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
            <h4 style={{ margin: 0 }}>Paired fabrics</h4>
          </div>
        </DialogTitle>
        <DialogContent dividers>
          {data.fabricInformations.map((fabric, index) => (
            <div key={index} style={{ margin: '0px', padding: '0px', gap: '0px', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)', textAlign: 'left', fontSize: '14px' }}>
              <p className="status-blue" style={{ margin: '0px 10px 10px 10px', fontSize: '14px', padding: 0, color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)' }}>Fabric: {fabric.fabricIndex}</p>
              <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Vendor: {fabric.rootVendorId} {fabric.rootVendorName}</p>
              {fabric.label !== '' && <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Label: {fabric.label}</p>}
              <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>
                Sessions: {data.sessionInformations ? 
                  data.sessionInformations.filter(session => session.fabric.fabricIndex === fabric.fabricIndex && session.isPeerActive === true).length :
                  '0'}
                {' '}
                subscriptions: {data.sessionInformations ? 
                  data.sessionInformations.filter(session => session.fabric.fabricIndex === fabric.fabricIndex && session.isPeerActive === true && session.numberOfActiveSubscriptions > 0).length :
                  '0'}
              </p>
            </div>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  } else if (data.commissioned === false && data.qrPairingCode && data.manualPairingCode) {
    return (
      <Dialog open={open} maxWidth="sm" style={{ maxWidth: '550px', margin: 'auto' }} onClose={onClose}>
        <DialogTitle gap={'20px'}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
            <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
            <h4 style={{ margin: 0 }}>QR pairing code</h4>
          </div>
        </DialogTitle>
        <DialogContent dividers>
          <QRCodeSVG value={data.qrPairingCode} size={256} level='M' fgColor={'var(--div-text-color)'} bgColor={'var(--div-bg-color)'} style={{ margin: '20px' }} />
          <p className="MbfWindowFooterText" style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' }}>Manual pairing code: {data.manualPairingCode}</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }
};
