// Home.js
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode.react';

function Home() {
  const [qrCode, setQrCode] = useState('');
  const [systemInfo, setSystemInfo] = useState({});
  const [plugins, setPlugins] = useState([]);

  useEffect(() => {
    // Fetch QR Code
    fetch('/api/qr-code')
      .then(response => response.json())
      .then(data => { setQrCode(data.qrPairingCode); console.log('QR code:', data.qrPairingCode) })
      .catch(error => console.error('Error fetching QR code:', error));

    // Fetch System Info
    fetch('/api/system-info')
      .then(response => response.json())
      .then(data => { setSystemInfo(data); console.log('QR code:', data) })
      .catch(error => console.error('Error fetching system info:', error));

    // Fetch Plugin
    fetch('/api/plugins')
      .then(response => response.json())
      .then(data => setPlugins(data))
      .catch(error => console.error('Error fetching plugins:', error));

  }, []);
/*
*/

  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      <div style={{ flex: 1, flexBasis: 'auto', flexdirection: 'column', margin: 20, minWidth: '256px', maxWidth: '256px' }}>
        {qrCode && <QRCode value={qrCode} includeMargin={false} size={256}/>}
        <p style={{ textAlign: 'center', marginBottom: '40px' }}>Scan me to pair matterbridge</p>
        <table>
          <thead>
            <tr>
              <th colSpan="2">System Information</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(systemInfo).map(([key, value]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ flex: 2, flexGrow: 1, margin: 20  }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Version</th>
              <th>Author</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {plugins.map((plugin, index) => (
              <tr key={index}>
                <td>{plugin.name}</td>
                <td>{plugin.description}</td>
                <td>{plugin.version}</td>
                <td>{plugin.author}</td>
                <td>{plugin.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );}

export default Home;
