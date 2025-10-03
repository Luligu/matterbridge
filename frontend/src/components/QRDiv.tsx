// React
import { useContext, useEffect, useState, useRef, memo } from 'react';

// QRCode
import { QRCodeSVG } from 'qrcode.react';

// @mui/material
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';

// @mdi/js
import Icon from '@mdi/react';
import { mdiShareOutline, mdiContentCopy, mdiShareOffOutline, mdiRestart, mdiDeleteForever } from '@mdi/js';

// Frontend
import { WebSocketContext } from './WebSocketProvider';
import { UiContext } from './UiProvider';
import { ApiMatterResponse } from '../../../src/matterbridgeTypes';
import { WsMessageApiResponse } from '../../../src/frontendTypes';
import { MbfWindow, MbfWindowFooter, MbfWindowFooterText, MbfWindowHeader, MbfWindowHeaderText, MbfWindowIcons, MbfWindowText } from './MbfWindow';
import { debug } from '../App';
// const debug = true; // Debug flag for this component

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
  '&:focus-visible': { outline: '2px solid var(--primary-color)', outlineOffset: '2px' },
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
  const [matter, setMatter] = useState<ApiMatterResponse | null>(null);
  // Refs
  const storeIdRef = useRef<string | null>(null);
  const advertiseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const uniqueId = useRef(getUniqueId());
  // Ui context
  const { showConfirmCancelDialog } = useContext(UiContext);

  if (debug) console.log(`QRDiv loading with id = "${id}" storeId = "${storeIdRef.current}" timeout = ${advertiseTimeoutRef.current} and  matter:`, matter);

  // Request server data when id changes
  useEffect(() => {
    if (debug) console.log(`QRDiv id effect "${id}"`);
    storeIdRef.current = id;
    if (advertiseTimeoutRef.current) clearTimeout(advertiseTimeoutRef.current);
    advertiseTimeoutRef.current = null;
    if (id) {
      if (debug) console.log(`QRDiv id effect sending data request for storeId "${id}"`);
      sendMessage({ id: uniqueId.current, sender: 'QRDiv', method: '/api/matter', src: 'Frontend', dst: 'Matterbridge', params: { id: id, server: true } });
    } else {
      if (debug) console.log('QRDiv id effect setting matter to null');
      setMatter(null);
    }
  }, [id, sendMessage]);

  // WebSocket message handler effect
  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessageApiResponse) => {
      if (debug) console.log('QRDiv received WebSocket Message:', msg);
      if (msg.method === 'refresh_required' && msg.response.changed === 'matter' && msg.response.matter) {
        if (debug) console.log(`QRDiv received refresh_required: changed=${msg.response.changed} for storeId "${msg.response.matter.id}":`, msg.response.matter);
        if (storeIdRef.current === msg.response.matter.id) {
          if (debug) console.log(`QRDiv received refresh_required/matter: setting matter data for storeId "${msg.response.matter.id}":`, msg.response.matter);
          if (advertiseTimeoutRef.current) clearTimeout(advertiseTimeoutRef.current);
          if (msg.response.matter.advertising && msg.response.matter.advertiseTime && msg.response.matter.advertiseTime + 15 * 60 * 1000 <= Date.now()) msg.response.matter.advertising = false; // already expired
          setMatter(msg.response.matter);
          if (msg.response.matter.advertising) {
            if (debug) console.log(`QRDiv setting matter advertise timeout for storeId "${msg.response.matter.id}":`, msg.response.matter.advertiseTime + 15 * 60 * 1000 - Date.now());
            advertiseTimeoutRef.current = setTimeout(
              () => {
                // Clear advertising state after 15 minutes
                if (advertiseTimeoutRef.current) clearTimeout(advertiseTimeoutRef.current);
                if (debug) console.log(`QRDiv clearing advertising state for storeId "${storeIdRef.current}" after 15 minutes`);
                setMatter((prev) => (prev ? { ...prev, advertising: false } : prev));
              },
              msg.response.matter.advertiseTime + 15 * 60 * 1000 - Date.now(),
            );
          }
        }
      }
    };

    addListener(handleWebSocketMessage, uniqueId.current);
    if (debug) console.log('QRDiv webSocket effect mounted');

    return () => {
      removeListener(handleWebSocketMessage);
      if (advertiseTimeoutRef.current) clearTimeout(advertiseTimeoutRef.current);
      advertiseTimeoutRef.current = null;
      if (debug) console.log('QRDiv webSocket effect unmounted');
    };
  }, [addListener, removeListener]);

  const handleStartCommissioningClick = () => {
    if (debug) console.log(`QRDiv sent matter startCommission for node "${matter?.id}"`);
    if (!matter) return;
    sendMessage({ id: uniqueId.current, sender: 'QRDiv', method: '/api/matter', src: 'Frontend', dst: 'Matterbridge', params: { id: matter.id, startCommission: true } });
  };

  const handleStopCommissioningClick = () => {
    if (debug) console.log(`QRDiv sent matter stopCommission for node "${matter?.id}"`);
    if (!matter) return;
    sendMessage({ id: uniqueId.current, sender: 'QRDiv', method: '/api/matter', src: 'Frontend', dst: 'Matterbridge', params: { id: matter.id, stopCommission: true } });
  };

  const handleAdvertiseClick = () => {
    if (debug) console.log(`QRDiv sent matter advertise for node "${matter?.id}"`);
    if (!matter) return;
    sendMessage({ id: uniqueId.current, sender: 'QRDiv', method: '/api/matter', src: 'Frontend', dst: 'Matterbridge', params: { id: matter.id, advertise: true } });
  };

  const handleRemoveFabric = (fabricIndex: number) => {
    if (debug) console.log(`QRDiv sent matter removeFabric for node "${matter?.id}" and fabricIndex ${fabricIndex}`);
    if (!matter) return;
    sendMessage({ id: uniqueId.current, sender: 'QRDiv', method: '/api/matter', src: 'Frontend', dst: 'Matterbridge', params: { id: matter.id, removeFabric: fabricIndex } });
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
  // prettier-ignore
  if (!matter || !online) {
    if(debug) console.log('QRDiv rendering undefined state');
    return null;
  } else if (!matter.online) {
    if(debug) console.log('QRDiv rendering offline state');
    return (
      <MbfWindow style={{ alignItems: 'center', minWidth: '302px' }}>
        <MbfWindowHeader style={{ height: '30px', justifyContent: 'space-between' }}>
          <MbfWindowHeaderText>Server node</MbfWindowHeaderText>
        </MbfWindowHeader>
        <MbfWindowText style={{ maxWidth: '280px', fontWeight: 'bold', color: 'var(--secondary-color)' }}>{storeIdRef.current}</MbfWindowText>
        <MbfWindowText style={{ fontWeight: 'bold' }}>Server offline</MbfWindowText>
        <MbfWindowFooter style={{ justifyContent: 'center' }}>
          <MbfWindowFooterText style={{ fontWeight: 'normal' }}>Serial number: {matter.serialNumber}</MbfWindowFooterText>
        </MbfWindowFooter>
      </MbfWindow>
    );
  } else if (matter.advertising && matter.qrPairingCode && matter.manualPairingCode) {
    if(debug) console.log('QRDiv rendering advertising state');
    return (
      <MbfWindow style={{ alignItems: 'center', minWidth: '302px' }}>
        <MbfWindowHeader>
          <MbfWindowHeaderText>QR pairing code</MbfWindowHeaderText>
          <MbfWindowIcons>
            <IconButton aria-label="send advertising" size='small' onClick={handleAdvertiseClick} sx={{ color: 'var(--header-text-color)', margin: '0px', padding: '0px' }}>
              <Tooltip title="Send again the mDNS advertisement" arrow><Icon path={mdiRestart} size='22px'/></Tooltip>
            </IconButton>
            <IconButton aria-label="stop pairing" size='small' onClick={handleStopCommissioningClick} sx={{ color: 'var(--header-text-color)', margin: '0px', padding: '0px' }}>
              <Tooltip title="Turn off pairing" arrow><Icon path={mdiShareOffOutline} size='22px'/></Tooltip>
            </IconButton>
          </MbfWindowIcons>
        </MbfWindowHeader>
        <MbfWindowText style={{ maxWidth: '280px', fontWeight: 'bold', color: 'var(--secondary-color)' }}>{storeIdRef.current}</MbfWindowText>
        <QRCodeSVG value={matter.qrPairingCode} size={256} level='M' fgColor={'var(--div-text-color)'} bgColor={'var(--div-bg-color)'} style={{ margin: '20px' }} />
        <MbfWindowFooter style={{ justifyContent: 'space-between' }}>
          <MbfWindowFooterText style={{ fontWeight: 'normal', color: 'var(--div-text-color)' }}>Manual pairing code: {formatManualCode(matter.manualPairingCode)}</MbfWindowFooterText>
          <MbfWindowIcons>
            <Tooltip title="Copy manual pairing code" arrow>
              <IconButton aria-label="copy manual pairing code" size="small" onClick={handleCopyManualCode} sx={iconBtnSx}>
                <Icon path={mdiContentCopy} size={0.85} />
              </IconButton>
            </Tooltip>
          </MbfWindowIcons>
        </MbfWindowFooter>
      </MbfWindow>
    );
  } else if (matter.commissioned && matter.fabricInformations && matter.sessionInformations) {
    if(debug) console.log('QRDiv rendering commissioned state');
    return (
      <MbfWindow style={{ alignItems: 'center', minWidth: '302px', overflow: 'hidden' }} >
        <MbfWindowHeader>
          <MbfWindowHeaderText>Paired fabrics</MbfWindowHeaderText>
          <MbfWindowIcons>
            <IconButton aria-label="send advertising" size="small" onClick={handleAdvertiseClick} sx={{ color: 'var(--header-text-color)', margin: '0px', padding: '0px' }}>
              <Tooltip title="Send again the mDNS advertisement" arrow><Icon path={mdiRestart} size='22px' /></Tooltip>
            </IconButton>
            <IconButton aria-label="start pairing" size="small" onClick={handleStartCommissioningClick} sx={{ color: 'var(--header-text-color)', margin: '0px', padding: '0px' }}>
              <Tooltip title="Turn on pairing" arrow><Icon path={mdiShareOutline} size='22px' /></Tooltip>
            </IconButton>
          </MbfWindowIcons>
        </MbfWindowHeader>
        <MbfWindowText style={{ maxWidth: '280px', fontWeight: 'bold', color: 'var(--secondary-color)' }}>{storeIdRef.current}</MbfWindowText>
        <div className="MbfWindowBodyColumn" style={{ paddingTop: '0px' }}>
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
                Sessions: {matter.sessionInformations ? matter.sessionInformations.filter(session => session.fabric?.fabricIndex === fabric.fabricIndex && session.isPeerActive === true).length : '0'}
                {' '}
                subscriptions: {matter.sessionInformations ? matter.sessionInformations.filter(session => session.fabric?.fabricIndex === fabric.fabricIndex && session.isPeerActive === true && session.numberOfActiveSubscriptions > 0).length : '0'}
              </p>
            </div>
          ))}
        </div>
        <MbfWindowFooter style={{ justifyContent: 'center' }}>
          <MbfWindowFooterText style={{ fontWeight: 'normal' }}>Serial number: {matter.serialNumber}</MbfWindowFooterText>
        </MbfWindowFooter>
      </MbfWindow>
    );
  } else if (!matter.commissioned && !matter.advertising) {
    if(debug) console.log('QRDiv rendering not commissioned and not advertising state');
    return (
      <MbfWindow style={{ alignItems: 'center', minWidth: '302px' }}>
        <MbfWindowHeader>
          <MbfWindowHeaderText>QR pairing code</MbfWindowHeaderText>
        </MbfWindowHeader>
        <MbfWindowText style={{ maxWidth: '280px', fontWeight: 'bold', color: 'var(--secondary-color)' }}>{storeIdRef.current}</MbfWindowText>
        <Button onClick={handleStartCommissioningClick} endIcon={<Icon path={mdiShareOutline} size={1}/>} style={{ margin: '20px', color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px', minWidth: '90px' }}>Turn on pairing</Button>
        <MbfWindowFooter style={{ justifyContent: 'center' }}>
          <MbfWindowFooterText style={{ fontWeight: 'normal' }}>Serial number: {matter.serialNumber}</MbfWindowFooterText>
        </MbfWindowFooter>
      </MbfWindow>
    );
  } else {
    if(debug) console.log('QRDiv rendering unknown state');
    return null;
  }
}

export default memo(QRDiv);
