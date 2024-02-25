// Home.js
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode.react';

function Home() {
  const [qrCode, setQrCode] = useState('');
  const [systemInfo, setSystemInfo] = useState({});

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

  }, []);

  return (
    <div>
      {qrCode && <QRCode value={qrCode} />}
      <table>
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
  );}

export default Home;
