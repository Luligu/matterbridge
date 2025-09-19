 

// React
import { useContext, useEffect, useState, useRef, memo } from 'react';

// QRCode
import { QRCodeSVG } from 'qrcode.react';

// @mui
import { IconButton, Tooltip, Button }  from '@mui/material';

// @mdi/js
import Icon from '@mdi/react';
import { mdiShareOutline, mdiContentCopy, mdiShareOffOutline, mdiRestart, mdiDeleteForever  } from '@mdi/js';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { UiContext } from './UiProvider';
import { ApiMatter } from '../../../src/matterbridgeTypes';
import { isBroadcast, WsBroadcastMessageId, WsMessage } from '../../../src/frontendTypes';
// import { debug } from '../App';
const debug = true; // Debug flag for this component

// Reusable hover styling for all action icon buttons (mdi icons)
const iconBtnSx = {
  margin: '0px',
  padding: '0px',
  color: 'var(--div-text-color)',
  transition: 'color 0.2s ease',
  '& svg': { display: 'block' },
  '& svg path': { fill: 'var(--div-text-color)', transition: 'fill 0.2s ease' },
  '&:hover': { color: 'var(--primary-color)' },
  '&:hover svg path': { fill: 'var(--primary-color)' },
  '&:focus-visible': { outline: '2px solid var(--primary-color)', outlineOffset: '2px' }
};

// Format manual pairing code as 0000-000-0000; non-digit characters are stripped.
const formatManualCode = (code: string) => {
  if (!code) return '';
  const digits = code.toString().replace(/[^0-9]/g, '');
  if (digits.length < 5) return digits; // too short to format fully
  const part1 = digits.slice(0, 4);
  const part2 = digits.slice(4, 7);
  const part3 = digits.slice(7, 11);
  return [part1, part2, part3].filter(Boolean).join('-');
};

interface QRDivProps {
  id: string | null; // storeId
}

function QRDiv({ id }: QRDivProps) {
  // WebSocket context
  const { online, sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);
  // States
  const [storeId, setStoreId] = useState<string | null>(null);
  const [matter, setMatter] = useState<ApiMatter | null>(null);
  // Refs
  const advertiseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const uniqueId = useRef(getUniqueId());
  // Ui context
  const { showConfirmCancelDialog } = useContext(UiContext);
  
  // Effect to request server data when id changes
  useEffect(() => {
    if (debug) console.log(`QRDiv received storeId update "${id}"`);
    if(id) {
      if (debug) console.log(`QRDiv sending data request for storeId "${id}"`);
      setStoreId(id);
      sendMessage({ id: uniqueId.current, sender: 'QRDiv', method: "/api/matter", src: "Frontend", dst: "Matterbridge", params: { id: id, server: true } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // run on mount/unmount and id change

  // WebSocket message handler effect
  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessage) => {
      if (msg.src === 'Matterbridge' && msg.dst === 'Frontend') {
        if (isBroadcast(msg) && msg.id === WsBroadcastMessageId.RefreshRequired && msg.params.changed === 'matter' && msg.params.matter) {
          if(debug) console.log(`QRDiv received refresh_required: changed=${msg.params.changed} for storeId "${msg.params.matter.id}":`, msg.params.matter);
          if(storeId === msg.params.matter.id) {
            if(debug) console.log(`QRDiv received refresh_required/matter: setting matter data for storeId "${msg.params.matter.id}":`, msg.params.matter);
            if(advertiseTimeoutRef.current) clearTimeout(advertiseTimeoutRef.current);
            if (msg.params.matter.advertising && msg.params.matter.advertiseTime && msg.params.matter.advertiseTime + 15 * 60 * 1000 <= Date.now()) msg.params.matter.advertising = false; // already expired
            setMatter(msg.params.matter);
            if(msg.params.matter.advertising) {
              if(debug) console.log(`QRDiv setting matter advertise timeout for storeId "${msg.params.matter.id}":`, msg.params.matter.advertiseTime + 15 * 60 * 1000 - Date.now());
              advertiseTimeoutRef.current = setTimeout(() => {
                // Clear advertising state after 15 minutes
                if(advertiseTimeoutRef.current) clearTimeout(advertiseTimeoutRef.current);
                if(debug) console.log(`QRDiv clearing advertising state for storeId "${storeId}" after 15 minutes`);
                setMatter((prev) => prev ? { ...prev, advertising: false } : prev);
              }, msg.params.matter.advertiseTime + 15 * 60 * 1000 - Date.now());
            }
          }
        }
      }
    };

    addListener(handleWebSocketMessage);
    if(debug) console.log('QRDiv webSocket effect mounted');

    return () => {
      removeListener(handleWebSocketMessage);
      if(advertiseTimeoutRef.current) clearTimeout(advertiseTimeoutRef.current);
      if(debug) console.log('QRDiv webSocket effect unmounted');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]); // run on mount/unmount and storeId change
  
  const handleStartCommissioningClick = () => {
    if (debug) console.log(`QRDiv sent matter startCommission for node "${matter?.id}"`);
    if (!matter) return;
    sendMessage({ id: uniqueId.current, sender: 'QRDiv', method: "/api/matter", src: "Frontend", dst: "Matterbridge", params: { id: matter.id, startCommission: true } });
  };

  const handleStopCommissioningClick = () => {
    if (debug) console.log(`QRDiv sent matter stopCommission for node "${matter?.id}"`);
    if (!matter) return;
    sendMessage({ id: uniqueId.current, sender: 'QRDiv', method: "/api/matter", src: "Frontend", dst: "Matterbridge", params: { id: matter.id, stopCommission: true } });
  };

  const handleAdvertiseClick = () => {
    if (debug) console.log(`QRDiv sent matter advertise for node "${matter?.id}"`);
    if (!matter) return;
    sendMessage({ id: uniqueId.current, sender: 'QRDiv', method: "/api/matter", src: "Frontend", dst: "Matterbridge", params: { id: matter.id, advertise: true } });
  };

  const handleRemoveFabric = (fabricIndex: number) => {
    if (debug) console.log(`QRDiv sent matter removeFabric for node "${matter?.id}" and fabricIndex ${fabricIndex}`);
    if (!matter) return;
    sendMessage({ id: uniqueId.current, sender: 'QRDiv', method: "/api/matter", src: "Frontend", dst: "Matterbridge", params: { id: matter.id, removeFabric: fabricIndex } });
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
  
  // if(debug) console.log('QRDiv:', matterbridgeInfo, plugin);
  if (!matter || !online) {
    if(debug) console.log('QRDiv rendering undefined state');
    return null;
  } else if (matter.advertising && matter.qrPairingCode && matter.manualPairingCode) {
    if(debug) console.log('QRDiv rendering advertising state');
    return (
      <div className="MbfWindowDiv" style={{ alignItems: 'center', minWidth: '302px' }}>
        <div className="MbfWindowHeader" style={{ height: '30px', justifyContent: 'space-between' }}>
          <p className="MbfWindowHeaderText" style={{ textAlign: 'left' }}>QR pairing code</p>
          <div className="MbfWindowHeaderFooterIcons">
            <IconButton aria-label="send advertising" size='small' onClick={handleAdvertiseClick} sx={{ color: 'var(--header-text-color)', margin: '0px', padding: '0px' }}>
              <Tooltip title="Send again the mDNS advertisement" arrow><Icon path={mdiRestart} size='22px'/></Tooltip>
            </IconButton>
            <IconButton aria-label="stop pairing" size='small' onClick={handleStopCommissioningClick} sx={{ color: 'var(--header-text-color)', margin: '0px', padding: '0px' }}>
              <Tooltip title="Turn off pairing" arrow><Icon path={mdiShareOffOutline} size='22px'/></Tooltip>
            </IconButton>
          </div>
        </div>
        <p className="MbfWindowHeaderText" style={{ overflow: 'hidden', maxWidth: '280px', textOverflow: 'ellipsis', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: 'var(--secondary-color)' }}>{storeId}</p>
        <QRCodeSVG value={matter.qrPairingCode} size={256} level='M' fgColor={'var(--div-text-color)'} bgColor={'var(--div-bg-color)'} style={{ margin: '20px' }} />
        <div className="MbfWindowFooter" style={{ justifyContent: 'space-between' }}>
          <p className="MbfWindowFooterText" style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' }}>Manual pairing code: {formatManualCode(matter.manualPairingCode)}</p>
          <div className="MbfWindowHeaderFooterIcons">
            <Tooltip title="Copy manual pairing code" arrow>
              <IconButton aria-label="copy manual pairing code" size="small" onClick={handleCopyManualCode} sx={iconBtnSx}>
                <Icon path={mdiContentCopy} size={0.85} />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </div>
    );
  } else if (matter.commissioned && matter.fabricInformations && matter.sessionInformations) {
    if(debug) console.log('QRDiv rendering commissioned state');
    return (
      <div className="MbfWindowDiv" style={{ alignItems: 'center', minWidth: '302px', overflow: 'hidden' }} >
        <div className="MbfWindowHeader" style={{ height: '30px', justifyContent: 'space-between' }}>
          <p className="MbfWindowHeaderText" style={{ textAlign: 'left' }}>Paired fabrics</p>
          <div className="MbfWindowHeaderFooterIcons">
            <IconButton aria-label="send advertising" size="small" onClick={handleAdvertiseClick} sx={{ color: 'var(--header-text-color)', margin: '0px', padding: '0px' }}>
              <Tooltip title="Send again the mDNS advertisement" arrow><Icon path={mdiRestart} size='22px' /></Tooltip>
            </IconButton>
            <IconButton aria-label="start pairing" size="small" onClick={handleStartCommissioningClick} sx={{ color: 'var(--header-text-color)', margin: '0px', padding: '0px' }}>
              <Tooltip title="Turn on pairing" arrow><Icon path={mdiShareOutline} size='22px' /></Tooltip>
            </IconButton>
          </div>
        </div>
        <div className="MbfWindowBodyColumn" style={{ paddingTop: '0px' }}>
          <p className="MbfWindowHeaderText thin-scroll" style={{ overflowX: 'auto', maxWidth: '280px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: 'var(--secondary-color)' }}>{storeId}</p>
          {matter.fabricInformations.map((fabric, index) => (
            <div key={index} style={{ margin: '0px', padding: '10px', gap: '0px', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)', textAlign: 'left', fontSize: '14px' }}>
              <div style={{ marginLeft: '20px', marginBottom: '10px', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: '20px', alignItems: 'center' }}>
                <p className="status-blue" style={{ margin: '0px', padding: '3px 10px', width: '200px', fontSize: '14px', color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)' }}>Fabric: {fabric.fabricIndex}</p>
                <Tooltip title="Remove the fabric. You will also need to remove it from the controller." arrow>
                  <IconButton aria-label="remove the fabric" size="small" onClick={() => showConfirmCancelDialog('Remove fabric','Are you sure you want to remove this fabric? You will also need to remove it from the controller.', 'RemoveFabric', () => handleRemoveFabric(fabric.fabricIndex), () => { })} sx={{ ...iconBtnSx, padding: '2px' }}>
                    <Icon path={mdiDeleteForever} size={1} />
                  </IconButton>
                </Tooltip>
              </div>
              <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Vendor: {fabric.rootVendorId} {fabric.rootVendorName}</p>
              {fabric.label !== '' && <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Label: {fabric.label}</p>}
              <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>
                Sessions: {matter.sessionInformations ? 
                  matter.sessionInformations.filter(session => session.fabric?.fabricIndex === fabric.fabricIndex && session.isPeerActive === true).length :
                  '0'}
                {' '}
                subscriptions: {matter.sessionInformations ? 
                  matter.sessionInformations.filter(session => session.fabric?.fabricIndex === fabric.fabricIndex && session.isPeerActive === true && session.numberOfActiveSubscriptions > 0).length :
                  '0'}
              </p>
            </div>
          ))}
        </div>
        <div className="MbfWindowFooter">
          <p className="MbfWindowFooterText" style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' }}>Serial number: {matter.serialNumber}</p>
        </div>
      </div>
    );
  } else if (!matter.commissioned && !matter.advertising) {
    if(debug) console.log('QRDiv rendering not commissioned and not advertising state');
    return (
      <div className="MbfWindowDiv" style={{ alignItems: 'center', minWidth: '302px' }}>
        <div className="MbfWindowHeader" style={{ height: '30px' }}>
          <p className="MbfWindowHeaderText" style={{ textAlign: 'left' }}>QR pairing code</p>
        </div>
        <p className="MbfWindowHeaderText thin-scroll" style={{ overflowX: 'auto', maxWidth: '280px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: 'var(--secondary-color)' }}>{storeId}</p>
        <Button onClick={handleStartCommissioningClick} endIcon={<Icon path={mdiShareOutline} size={1}/>} style={{ margin: '20px', color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px', minWidth: '90px' }}>Turn on pairing</Button>
        <div className="MbfWindowFooter">
          <p className="MbfWindowFooterText" style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' }}>Serial number: {matter.serialNumber}</p>
        </div>
      </div>
    );
  } else {
    if(debug) console.log('QRDiv rendering unknown state');
    return null;
  }
}

export default memo(QRDiv);
