// QRCode
import { useContext, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// Frontend
// import { debug } from '../App';
import { WebSocketContext } from './WebSocketProvider';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import DeleteForever from '@mui/icons-material/DeleteForever';

const debug = true;
export const QRDivDevice = ({ id, open, onClose }) => {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener } = useContext(WebSocketContext);
  const [storeId, setStoreId] = useState(null);
  const [matter, setMatter] = useState(null);

  const handleCommissionClick = () => {
    if (debug) console.log('QRDivDevice sent matter commission:', matter);
    if (!matter) return;
    sendMessage({ method: "/api/matter", src: "Frontend", dst: "Matterbridge", params: { id: matter.id, plugin: matter.plugin, commission: true } });
  };

  const handleAdvertiseClick = () => {
    if (debug) console.log('QRDivDevice sent matter advertise:', matter);
    if (!matter) return;
    sendMessage({ method: "/api/matter", src: "Frontend", dst: "Matterbridge", params: { id: matter.id, plugin: matter.plugin, advertise: true } });
  };

  const handleRemoveFabric = (fabricIndex) => {
    if (debug) console.log('QRDivDevice sent matterremoveFabric:', matter, fabricIndex);
    if (!matter) return;
    sendMessage({ method: "/api/matter", src: "Frontend", dst: "Matterbridge", params: { id: matter.id, plugin: matter.plugin, removeFabric: fabricIndex } });
  };

  useEffect(() => {
    if (debug) console.log(`QRDivDevice received storeId update ${id}:`);
    if(id && id !== storeId) {
      if (debug) console.log(`QRDivDevice sending data request for storeId ${id}:`);
      setStoreId(id);
      sendMessage({ method: "/api/matter", src: "Frontend", dst: "Matterbridge", params: { id: id, server: true } });
    }
  }, [id, storeId, sendMessage]);

  useEffect(() => {
    const handleWebSocketMessage = (msg) => {
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'refresh_required' && msg.params.changed === 'matter' && msg.params.matter) {
          // if(debug) console.log(`QRDivDevice received refresh_required for storeId ${msg.params.matter.id}`);
          if(storeId === msg.params.matter.id) {
            if(debug) console.log(`QRDivDevice received refresh_required: setting matter data for storeId ${msg.params.matter.id} `);
            setMatter(msg.params.matter);
          }
        }
      }
    };

    addListener(handleWebSocketMessage);
    if(debug) console.log('QRDivDevice useEffect webSocket mounted');

    return () => {
      removeListener(handleWebSocketMessage);
      if(debug) console.log('QRDivDevice useEffect webSocket unmounted');
    };
  }, [storeId, addListener, removeListener]); // Empty dependency array to run only once on mount and unmount
  
  if (!matter || !online) {
    return null;
  } else if (matter.commissioned === true && matter.fabricInformations && matter.sessionInformations) {
    if(debug) console.log('QRDivDevice rendering commissioned state');
    return (
      <Dialog open={open} maxWidth="sm" style={{ maxWidth: '550px', margin: 'auto' }} onClose={onClose}>
        <DialogTitle sx={{ padding: '10px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
            <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
            <h4 style={{ margin: 0 }}>Paired fabrics</h4>
          </div>
        </DialogTitle>
        <DialogContent sx={{ padding: '10px 20px' }} dividers>
          <p style={{ overflowX: 'auto', maxWidth: '230px', padding: '0px', paddingBottom: '10px', margin: '0px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', color: 'var(--secondary-color)' }}>{matter.id}</p>
          {matter.fabricInformations.map((fabric, index) => (
            <div key={index} style={{ margin: '0px', padding: '0px', gap: '0px', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)', textAlign: 'left', fontSize: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', margin: '0 10px 10px 10px', fontSize: '14px', gap: '6px' }}>
                <span className="status-blue" style={{ flex: 1, display: 'inline-block', padding: '3px', margin: 0, fontSize: '14px', color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)' }}>
                  Fabric: {fabric.fabricIndex}
                </span>
                <Tooltip title="Remove the fabric" arrow>
                  <IconButton aria-label="remove fabric" size="small" onClick={() => handleRemoveFabric(fabric.fabricIndex)} sx={{ padding: '2px' }}>
                    <DeleteForever fontSize='24px' />
                  </IconButton>
                </Tooltip>
              </div>
              <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Vendor: {fabric.rootVendorId} {fabric.rootVendorName}</p>
              {fabric.label !== '' && <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Label: {fabric.label}</p>}
              <p style={{ margin: '0px 20px 20px 20px', color: 'var(--div-text-color)' }}>
                Sessions: {matter.sessionInformations ? 
                  matter.sessionInformations.filter(session => session.fabric.fabricIndex === fabric.fabricIndex && session.isPeerActive === true).length :
                  '0'}
                {' '}
                subscriptions: {matter.sessionInformations ? 
                  matter.sessionInformations.filter(session => session.fabric.fabricIndex === fabric.fabricIndex && session.isPeerActive === true && session.numberOfActiveSubscriptions > 0).length :
                  '0'}
              </p>
            </div>
          ))}
          <div key={'serial'} style={{ margin: '0px', padding: '0px', gap: '0px', color: 'var(--secondary-color)', backgroundColor: 'var(--div-bg-color)', textAlign: 'center', fontSize: '14px' }}>
            <p style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--secondary-color)' }}>Serial number: {matter.serialNumber}</p>
          </div>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-around' }}>
          <Button onClick={() => handleCommissionClick()}>Turn on pairing</Button>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  } else if (matter.commissioned === false && matter.advertising && matter.qrPairingCode && matter.manualPairingCode) {
    if(debug) console.log('QRDivDevice rendering advertising state');
    return (
      <Dialog open={open} maxWidth="sm" style={{ maxWidth: '550px', margin: 'auto' }} onClose={onClose}>
        <DialogTitle sx={{ padding: '10px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
            <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
            <h4 style={{ margin: 0 }}>QR pairing code</h4>
          </div>
        </DialogTitle>
        <DialogContent sx={{ padding: '10px 20px' }} dividers>
          <p style={{ overflowX: 'auto', maxWidth: '230px', padding: '5px', margin: '0px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', color: 'var(--secondary-color)' }}>{matter.id}</p>
          <QRCodeSVG value={matter.qrPairingCode} size={256} level='M' fgColor={'var(--div-text-color)'} bgColor={'var(--div-bg-color)'} style={{ margin: '20px' }} />
          <p style={{ padding: '5px', margin: '0px', textAlign: 'center', fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' }}>Manual pairing code: {matter.manualPairingCode}</p>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-around' }}>
          <Button onClick={() => handleAdvertiseClick()}>Re-Advertise</Button>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  } else if (matter.commissioned === false && !matter.advertising) {
    if(debug) console.log('QRDivDevice rendering not advertising state');
    return (
      <Dialog open={open} maxWidth="sm" style={{ maxWidth: '550px', margin: 'auto' }} onClose={onClose}>
        <DialogTitle sx={{ padding: '10px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
            <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
            <h4 style={{ margin: 0 }}>QR pairing code</h4>
          </div>
        </DialogTitle>
        <DialogContent sx={{ padding: '10px 20px' }} dividers>
          <p style={{ padding: '5px', margin: '0px', textAlign: 'center', fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' }}>Advertise has expired for server</p>
          <p style={{ overflowX: 'auto', maxWidth: '230px', padding: '5px', margin: '0px', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', color: 'var(--secondary-color)' }}>{matter.id}</p>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-around' }}>
          <Button onClick={() => handleCommissionClick()}>Turn on pairing</Button>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  } else {
    return null;
  }
};
