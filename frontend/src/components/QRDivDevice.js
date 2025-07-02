import React from 'react';
// QRCode
import { QRCodeSVG } from 'qrcode.react';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';

export const QRDivDevice = ({ open, onClose, data }) => {
  if (!data || !data.qrPairingCode || !data.manualPairingCode) {
    return null; // Return null if no data or qrPairingCode is not available
  }
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
};
