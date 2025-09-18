
// React
import { memo } from 'react';

// Backend
import { MatterbridgeInformation } from '../../../src/matterbridgeTypes';

// Frontend
import { TruncatedText } from './TruncatedText';
import { debug } from '../App';
// const debug = true;

// This function takes systemInfo as a parameter and returns a table element with the systemInfo
function MatterbridgeInfoTable({ matterbridgeInfo }: { matterbridgeInfo: MatterbridgeInformation }) {
  if(debug) console.log('MatterbridgeInfoTable:', matterbridgeInfo);

  const excludeKeys = ['matterbridgeVersion', 'matterbridgeLatestVersion', 'matterFileLogger', 'fileLogger', 'matterLoggerLevel', 'loggerLevel',
    'bridgeMode', 'restartMode', 'matterbridgeFabricInformations', 'matterbridgeSessionInformations', 'restartRequired', 
    'matterbridgeQrPairingCode', 'matterbridgeManualPairingCode', 'updateRequired',
    'mattermdnsinterface', 'matteripv4address', 'matteripv6address', 'matterbridgePaired', 'matterbridgeConnected', 'matterbridgeAdvertise', 
    'readOnly', 'shellyBoard', 'shellySysUpdate', 'shellyMainUpdate', 'matterPort', 'matterDiscriminator', 'matterPasscode'];

  return (
    <div className="MbfWindowDiv" style={{ minWidth: '302px' }}>
      <div className="MbfWindowHeader">
        <p className="MbfWindowHeaderText" style={{ textAlign: 'left' }}>Matterbridge Information</p>
      </div>
      <div className="MbfWindowDivTable">
        <table style={{ border: 'none', borderCollapse: 'collapse' }}>
          <tbody style={{ border: 'none', borderCollapse: 'collapse' }}>
            {Object.entries(matterbridgeInfo)
              .filter(([key, value]) => !excludeKeys.includes(key) && value !== undefined && value !== '')
              .map(([key, value], index) => (
                <tr key={key} className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'} style={{ border: 'none', borderCollapse: 'collapse' }}>
                  <td style={{ border: 'none', borderCollapse: 'collapse' }}>{key.replace('matterbridgePaired', 'paired').replace('homeDirectory', 'home').replace('rootDirectory', 'root').replace('matterbridgeDirectory', 'storage').replace('matterbridgePluginDirectory', 'plugins').replace('globalModulesDirectory', 'modules')}</td>
                  <td style={{ border: 'none', borderCollapse: 'collapse' }}>
                    <TruncatedText value={typeof value !== 'string' ? value.toString() : value} maxChars={28} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default memo(MatterbridgeInfoTable);
