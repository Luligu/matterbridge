/* eslint-disable no-console */

// React
import React, { useContext } from 'react';

// Frontend
import { debug } from '../App';
import { WebSocketContext } from './WebSocketProvider';

// QRCode
import { QRCodeSVG } from 'qrcode.react';

// @mui
import Button from '@mui/material/Button';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

export function QRDiv({ matterbridgeInfo, plugin }) {
  const { sendMessage } = useContext(WebSocketContext);
  
  const handleRestartClick = () => {
    if (matterbridgeInfo.restartMode === '') {
      sendMessage({ method: "/api/restart", src: "Frontend", dst: "Matterbridge", params: {} });
    }
    else {
      sendMessage({ method: "/api/shutdown", src: "Frontend", dst: "Matterbridge", params: {} });
    }
  };

  if(debug) console.log('QRDiv:', matterbridgeInfo, plugin);
  if (matterbridgeInfo.bridgeMode === 'bridge' && matterbridgeInfo.matterbridgePaired === true && matterbridgeInfo.matterbridgeAdvertise === false && matterbridgeInfo.matterbridgeFabricInformations) {
    if (debug) console.log(`QRDiv: paired ${matterbridgeInfo.matterbridgePaired}, got ${matterbridgeInfo.matterbridgeFabricInformations?.length} fabrics, got ${matterbridgeInfo.matterbridgeSessionInformations?.length} sessions`);
    return (
      <div className="MbfWindowDiv" style={{ alignItems: 'center', minWidth: '302px', overflow: 'hidden' }} >
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{ textAlign: 'left', overflow: 'hidden' }}>Paired fabrics</p>
        </div>
        <div className="MbfWindowBodyColumn">
          {matterbridgeInfo.matterbridgeFabricInformations.map((fabric, index) => (
            <div key={index} style={{ margin: '0px', padding: '10px', gap: '0px', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)', textAlign: 'left', fontSize: '14px' }}>
              <p className="status-blue" style={{ margin: '0px 10px 10px 10px', fontSize: '14px', padding: 0, color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)' }}>Fabric: {fabric.fabricIndex}</p>
              <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Vendor: {fabric.rootVendorId} {fabric.rootVendorName}</p>
              {fabric.label !== '' && <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Label: {fabric.label}</p>}
              <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>
                Sessions: {matterbridgeInfo.matterbridgeSessionInformations ? 
                  matterbridgeInfo.matterbridgeSessionInformations.filter(session => session.fabric.fabricIndex === fabric.fabricIndex && session.isPeerActive === true).length :
                  '0'}
                {' '}
                subscriptions: {matterbridgeInfo.matterbridgeSessionInformations ? 
                  matterbridgeInfo.matterbridgeSessionInformations.filter(session => session.fabric.fabricIndex === fabric.fabricIndex && session.isPeerActive === true && session.numberOfActiveSubscriptions > 0).length :
                  '0'}
              </p>
            </div>
          ))}
        </div>
        <div className="MbfWindowFooter" style={{ padding: 0, margin: 0, height: '30px' }}>
          <p className="MbfWindowFooterText" style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--secondary-color)' }}>Serial number: {matterbridgeInfo.matterbridgeSerialNumber}</p>
        </div>
      </div>
    );
  } else if (matterbridgeInfo.bridgeMode === 'childbridge' && plugin && plugin.paired === true && plugin.fabricInformations) {
    if (debug) console.log(`QRDiv: paired ${plugin.paired}, got ${plugin.fabricInformations?.length} fabrics, got ${plugin.sessionInformations?.length} sessions`);
    return (
      <div className="MbfWindowDiv" style={{ alignItems: 'center', minWidth: '302px', overflow: 'hidden' }} >
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{ textAlign: 'left' }}>Paired fabrics</p>
        </div>
        <div className="MbfWindowBodyColumn">
          {plugin.fabricInformations.map((fabric, index) => (
            <div key={index} style={{ margin: '0px', padding: '10px', gap: '0px', color: 'var(--div-text-color)', backgroundColor: 'var(--div-bg-color)', textAlign: 'left', fontSize: '14px' }}>
              <p className="status-blue" style={{ margin: '0px 10px 10px 10px', fontSize: '14px', padding: 0, color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)' }}>Fabric: {fabric.fabricIndex}</p>
              <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Vendor: {fabric.rootVendorId} {fabric.rootVendorName}</p>
              {fabric.label !== '' && <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>Label: {fabric.label}</p>}
              <p style={{ margin: '0px 20px 0px 20px', color: 'var(--div-text-color)' }}>
                Sessions: {plugin.sessionInformations ?
                  plugin.sessionInformations.filter(session => session.fabric.fabricIndex === fabric.fabricIndex && session.isPeerActive === true).length :
                  '0'}
                {' '}
                subscriptions: {plugin.sessionInformations ? 
                  plugin.sessionInformations.filter(session => session.fabric.fabricIndex === fabric.fabricIndex && session.isPeerActive === true && session.numberOfActiveSubscriptions > 0).length :
                  '0'}
              </p>
            </div>
          ))}
        </div>
        <div className="MbfWindowFooter" style={{ padding: 0, margin: 0, height: '30px' }}>
          <p className="MbfWindowFooterText" style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--secondary-color)' }}>Serial number: {plugin.serialNumber}</p>
        </div>
      </div>
    );
  } else if (matterbridgeInfo.bridgeMode === 'bridge' && (matterbridgeInfo.matterbridgePaired === false || matterbridgeInfo.matterbridgeAdvertise === true) && matterbridgeInfo.matterbridgeQrPairingCode && matterbridgeInfo.matterbridgeManualPairingCode) {
    if (debug) console.log(`QRDiv: qrText ${matterbridgeInfo.matterbridgeQrPairingCode} pairingText ${matterbridgeInfo.matterbridgeManualPairingCode}`);
    return (
      <div className="MbfWindowDiv" style={{ alignItems: 'center', minWidth: '302px' }}>
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{ textAlign: 'left' }}>QR pairing code</p>
        </div>
        <QRCodeSVG value={matterbridgeInfo.matterbridgeQrPairingCode} size={256} level='M' fgColor={'var(--div-text-color)'} bgColor={'var(--div-bg-color)'} style={{ margin: '20px' }} />
        <div className="MbfWindowFooter" style={{ padding: 0, marginTop: '-5px', height: '30px' }}>
          <p className="MbfWindowFooterText" style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' }}>Manual pairing code: {matterbridgeInfo.matterbridgeManualPairingCode}</p>
        </div>
      </div>
    );
  } else if (matterbridgeInfo.bridgeMode === 'childbridge' && plugin && plugin.paired === false && plugin.qrPairingCode && plugin.manualPairingCode) {
    if (debug) console.log(`QRDiv: qrText ${plugin.qrPairingCode} pairingText ${plugin.manualPairingCode}`);
    return (
      <div className="MbfWindowDiv" style={{ alignItems: 'center', minWidth: '302px' }}>
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{ textAlign: 'left' }}>QR pairing code</p>
        </div>
        <QRCodeSVG value={plugin.qrPairingCode} size={256} level='M' fgColor={'var(--div-text-color)'} bgColor={'var(--div-bg-color)'} style={{ margin: '20px' }} />
        <div className="MbfWindowFooter" style={{ padding: 0, marginTop: '-5px', height: '30px' }}>
          <p className="MbfWindowFooterText" style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' }}>Manual pairing code: {plugin.manualPairingCode}</p>
        </div>
      </div>
    );
  } else if (matterbridgeInfo.bridgeMode === 'bridge' && matterbridgeInfo.matterbridgePaired === false && !matterbridgeInfo.matterbridgeQrPairingCode && !matterbridgeInfo.matterbridgeManualPairingCode) {
    if (debug) console.log(`QRDiv: qrText ${matterbridgeInfo.matterbridgeQrPairingCode} pairingText ${matterbridgeInfo.matterbridgeManualPairingCode}`);
    return (
      <div className="MbfWindowDiv" style={{ alignItems: 'center', minWidth: '302px' }}>
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{ textAlign: 'left' }}>QR pairing code</p>
        </div>
        <Button onClick={handleRestartClick} endIcon={<RestartAltIcon />} style={{ margin: '20px', color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px', minWidth: '90px' }}> Restart</Button>
        <div className="MbfWindowFooter" style={{ padding: 0, margin: 0, height: '30px' }}>
          <p className="MbfWindowFooterText" style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' }}>Restart to generate a new QRCode.</p>
        </div>
      </div>
    );
  } else if (matterbridgeInfo.bridgeMode === 'childbridge' && plugin && plugin.paired === false && !plugin.qrPairingCode && !plugin.manualPairingCode) {
    if (debug) console.log(`QRDiv: qrText ${plugin.qrPairingCode} pairingText ${plugin.manualPairingCode}`);
    return (
      <div className="MbfWindowDiv" style={{ alignItems: 'center', minWidth: '302px' }}>
        <div className="MbfWindowHeader">
          <p className="MbfWindowHeaderText" style={{ textAlign: 'left' }}>QR pairing code</p>
        </div>
        <Button onClick={handleRestartClick} endIcon={<RestartAltIcon />} style={{ margin: '20px', color: 'var(--main-button-color)', backgroundColor: 'var(--main-button-bg-color)', height: '30px', minWidth: '90px' }}> Restart</Button>
        <div className="MbfWindowFooter" style={{ padding: 0, margin: 0, height: '30px' }}>
          <p className="MbfWindowFooterText" style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--div-text-color)' }}>Restart to generate a new QRCode.</p>
        </div>
      </div>
    );
  }
}