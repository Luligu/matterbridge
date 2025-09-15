// QRCode
import { useContext, useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// Frontend
import { debug } from '../App';
import { WebSocketContext } from './WebSocketProvider';

// @mui/material
import { Dialog, DialogTitle, DialogContent, IconButton, Tooltip } from '@mui/material';

// @mdi/js
import Icon from '@mdi/react';
import { mdiWindowClose, mdiShareOutline, mdiShareOffOutline, mdiRestart, mdiDeleteForever, mdiContentCopy } from '@mdi/js';

// Reusable hover styling for all action icon buttons (mdi icons)
const iconBtnSx = {
  color: 'var(--div-text-color)',
  transition: 'color 0.2s ease',
  '& svg': { display: 'block' },
  '& svg path': { fill: 'var(--div-text-color)', transition: 'fill 0.2s ease' },
  '&:hover': { color: 'var(--primary-color)' },
  '&:hover svg path': { fill: 'var(--primary-color)' },
  '&:focus-visible': { outline: '2px solid var(--primary-color)', outlineOffset: '2px' }
};

// const debug = true; // Set to true to enable debug logs

// Format manual pairing code as 4-3-4 (0000-000-0000); non-digit characters are stripped.
const formatManualCode = (code) => {
  if (!code) return '';
  const digits = code.toString().replace(/[^0-9]/g, '');
  if (digits.length < 5) return digits; // too short to format fully
  const part1 = digits.slice(0, 4);
  const part2 = digits.slice(4, 7);
  const part3 = digits.slice(7, 11);
  return [part1, part2, part3].filter(Boolean).join('-');
};

export const QRDivDevice = ({ id, open, onClose }) => {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener } = useContext(WebSocketContext);
  const [storeId, setStoreId] = useState(null);
  const [matter, setMatter] = useState(null);
  const advertiseTimeoutRef = useRef(null);

  const handleCommissionClick = () => {
    if (debug) console.log(`QRDivDevice sent matter startCommission for node "${matter.id}"`);
    if (!matter) return;
    sendMessage({ method: "/api/matter", src: "Frontend", dst: "Matterbridge", params: { id: matter.id, startCommission: true } });
  };

  const handleStopCommissionClick = () => {
    if (debug) console.log(`QRDivDevice sent matter stopCommission for node "${matter.id}"`);
    if (!matter) return;
    sendMessage({ method: "/api/matter", src: "Frontend", dst: "Matterbridge", params: { id: matter.id, stopCommission: true } });
  };

  const handleAdvertiseClick = () => {
    if (debug) console.log(`QRDivDevice sent matter advertise for node "${matter.id}"`);
    if (!matter) return;
    sendMessage({ method: "/api/matter", src: "Frontend", dst: "Matterbridge", params: { id: matter.id, advertise: true } });
  };

  const handleRemoveFabric = (fabricIndex) => {
    if (debug) console.log(`QRDivDevice sent matter removeFabric for node "${matter.id}" and fabricIndex ${fabricIndex}`);
    if (!matter) return;
    sendMessage({ method: "/api/matter", src: "Frontend", dst: "Matterbridge", params: { id: matter.id, removeFabric: fabricIndex } });
  };

  const handleCopyManualCode = async () => {
    if (!matter || !matter.manualPairingCode) return;
    const text = matter.manualPairingCode.toString();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      if (debug) console.log('Manual pairing code copied to clipboard');
    } catch (e) {
      console.error('Failed to copy manual pairing code', e);
    }
  };

  // Effect to request server data when id changes
  useEffect(() => {
    if (debug) console.log(`QRDivDevice received storeId update "${id}"`);
    if(id) {
      if (debug) console.log(`QRDivDevice sending data request for storeId "${id}":`);
      setStoreId(id);
      sendMessage({ method: "/api/matter", src: "Frontend", dst: "Matterbridge", params: { id: id, server: true } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // run on mount/unmount and id change

  // WebSocket message handler effect
  useEffect(() => {
    const handleWebSocketMessage = (msg) => {
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (msg.method === 'refresh_required' && msg.params.changed === 'matter' && msg.params.matter) {
          // if(debug) console.log(`QRDivDevice received refresh_required for storeId "${msg.params.matter.id}"`);
          if(storeId === msg.params.matter.id) {
            if(debug) console.log(`QRDivDevice received refresh_required/matter: setting matter data for storeId "${msg.params.matter.id}":`, msg.params.matter);
            clearTimeout(advertiseTimeoutRef.current);
            if (msg.params.matter.advertising && msg.params.matter.advertiseTime && msg.params.matter.advertiseTime + 15 * 60 * 1000 <= Date.now()) msg.params.matter.advertising = false; // already expired
            setMatter(msg.params.matter);
            if(msg.params.matter.advertising) {
              if(debug) console.log(`QRDivDevice setting matter advertise timeout for storeId "${msg.params.matter.id}":`, msg.params.matter.advertiseTime + 15 * 60 * 1000 - Date.now());
              advertiseTimeoutRef.current = setTimeout(() => {
                // Clear advertising state after 15 minutes
                clearTimeout(advertiseTimeoutRef.current);
                if(debug) console.log(`QRDivDevice clearing advertising state for storeId "${msg.params.matter.id}" after 15 minutes`);
                setMatter((prev) => ({ ...prev, advertising: false }));
              }, msg.params.matter.advertiseTime + 15 * 60 * 1000 - Date.now());
            }
          }
        }
      }
    };

    addListener(handleWebSocketMessage);
    if(debug) console.log('QRDivDevice useEffect webSocket mounted');

    return () => {
      removeListener(handleWebSocketMessage);
      clearTimeout(advertiseTimeoutRef.current);
      if(debug) console.log('QRDivDevice useEffect webSocket unmounted');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]); // run on mount/unmount and storeId change
  
  if (!matter || !online) {
    return null;
  } else if (matter.advertising && matter.qrPairingCode && matter.manualPairingCode) {
    if(debug) console.log('QRDivDevice rendering advertising state: QRCode');
    return (
      <Dialog open={open} maxWidth="sm" style={{ maxWidth: '550px', margin: 'auto' }} onClose={onClose}>
        <DialogTitle sx={{ padding: '10px 20px' }}>
          <div className="header">
            <div className="sub-header">
              <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
              <h4 style={{ margin: 0 }}>QR pairing code</h4>
            </div>
            <div className="sub-header" style={{ gap: '5px' }}>
              <Tooltip title="Send again the mDNS advertisement" arrow>
                <IconButton aria-label="re-advertise" size="small" onClick={handleAdvertiseClick} sx={iconBtnSx}>
                  <Icon path={mdiRestart} size={1} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Turn off pairing" arrow>
                <IconButton aria-label="stop pairing" size="small" onClick={handleStopCommissionClick} sx={iconBtnSx}>
                  <Icon path={mdiShareOffOutline} size={1} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Close the window" arrow>
                <IconButton aria-label="close" size="small" onClick={onClose} sx={iconBtnSx}>
                  <Icon path={mdiWindowClose} size={1} />
                </IconButton>
              </Tooltip>
            </div>
          </div>
        </DialogTitle>
        <DialogContent sx={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} dividers>
          <p style={{ overflowX: 'auto', maxWidth: '260px', padding: '5px', margin: '0 0 10px 0', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', color: 'var(--secondary-color)' }}>
            {matter.id}
          </p>
          <QRCodeSVG value={matter.qrPairingCode} size={256} level='M' fgColor={'var(--div-text-color)'} bgColor={'var(--div-bg-color)'} style={{ margin: '10px 0 10px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
            <p style={{ padding: '5px', margin: 0, textAlign: 'center', fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' }}>
              Manual pairing code: {formatManualCode(matter.manualPairingCode)}
            </p>
            <Tooltip title="Copy manual pairing code" arrow>
              <IconButton aria-label="copy manual pairing code" size="small" onClick={handleCopyManualCode} sx={iconBtnSx}>
                <Icon path={mdiContentCopy} size={0.85} />
              </IconButton>
            </Tooltip>
          </div>
        </DialogContent>
      </Dialog>
    );
  } else if (matter.commissioned && matter.fabricInformations && matter.sessionInformations) {
    if(debug) console.log('QRDivDevice rendering commissioned state: fabrics');
    return (
      <Dialog open={open} maxWidth="sm" style={{ maxWidth: '550px', margin: 'auto' }} onClose={onClose}>
        <DialogTitle sx={{ padding: '10px 20px' }}>
          <div className="header">
            <div className="sub-header">
              <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
              <h4 style={{ margin: 0 }}>Paired fabrics</h4>
            </div>
            <div className="sub-header" style={{ gap: '5px' }}>
              <Tooltip title="Turn on pairing" arrow>
                <IconButton aria-label="share" size="small" onClick={handleCommissionClick} sx={iconBtnSx}>
                  <Icon path={mdiShareOutline} size={1} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Close the window" arrow>
                <IconButton aria-label="close" size="small" onClick={onClose} sx={iconBtnSx}>
                  <Icon path={mdiWindowClose} size={1} />
                </IconButton>
              </Tooltip>
            </div>
          </div>
        </DialogTitle>
        <DialogContent sx={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} dividers>
          <p style={{ overflowX: 'auto', maxWidth: '260px', padding: '5px', margin: '0 0 10px 0', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', color: 'var(--secondary-color)' }}>
            {matter.id}
          </p>
          {matter.fabricInformations.map((fabric, index) => (
            <div key={index} style={{ margin: '0px', padding: '0px', gap: '0px', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)', textAlign: 'left', fontSize: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', margin: '0 10px 10px 10px', fontSize: '14px', gap: '6px' }}>
                <span className="status-blue" style={{ flex: 1, display: 'inline-block', padding: '3px', margin: 0, fontSize: '14px', color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)' }}>
                  Fabric: {fabric.fabricIndex}
                </span>
                <Tooltip title="Remove the fabric. You will need to remove it also from the controller." arrow>
                  <IconButton aria-label="remove fabric" size="small" onClick={() => handleRemoveFabric(fabric.fabricIndex)} sx={{ ...iconBtnSx, padding: '2px' }}>
                    <Icon path={mdiDeleteForever} size={1} />
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
      </Dialog>
    );
  } else if (!matter.commissioned && !matter.advertising) {
    if(debug) console.log('QRDivDevice rendering not advertising state: no QRCode');
    return (
      <Dialog open={open} maxWidth="sm" style={{ maxWidth: '550px', margin: 'auto' }} onClose={onClose}>
        <DialogTitle sx={{ padding: '10px 20px' }}>
          <div className="header">
            <div className="sub-header">
              <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
              <h4 style={{ margin: 0 }}>QR pairing code</h4>
            </div>
            <div className="sub-header" style={{ gap: '5px' }}>
              <Tooltip title="Turn on pairing" arrow>
                <IconButton aria-label="share" size="small" onClick={handleCommissionClick} sx={iconBtnSx}>
                  <Icon path={mdiShareOutline} size={1} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Close the window" arrow>
                <IconButton aria-label="close" size="small" onClick={onClose} sx={iconBtnSx}>
                  <Icon path={mdiWindowClose} size={1} />
                </IconButton>
              </Tooltip>
            </div>
          </div>
        </DialogTitle>
        <DialogContent sx={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} dividers>
          <p style={{ overflowX: 'auto', maxWidth: '300px', padding: '5px', margin: '0 0 10px 0', textAlign: 'center', fontSize: '16px', fontWeight: 'bold', color: 'var(--secondary-color)' }}>
            {matter.id}
          </p>
          <p style={{ padding: '5px', margin: '0px', textAlign: 'center', fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' }}>
            Advertise has expired.
          </p>
          <p style={{ padding: '5px', margin: '0px', textAlign: 'center', fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' }}>
            Click on the share icon to turn on pairing mode.
          </p>
        </DialogContent>
      </Dialog>
    );
  } else {
    if(debug) console.error('QRDivDevice rendering with no valid state');
    return null;
  }
};
