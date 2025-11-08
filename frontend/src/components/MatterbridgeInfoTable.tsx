// React
import { memo, useState } from 'react';

// Backend
import { MatterbridgeInformation } from '../../../src/matterbridgeTypes';

// Frontend
import { TruncatedText } from './TruncatedText';
import { MbfWindow, MbfWindowContent, MbfWindowHeader, MbfWindowHeaderText, MbfWindowIcons } from './MbfWindow';
import { debug } from '../App';
// const debug = true;

function MatterbridgeInfoTable({ matterbridgeInfo }: { matterbridgeInfo: MatterbridgeInformation }) {
  if (debug) console.log('MatterbridgeInfoTable:', matterbridgeInfo);

  const excludeKeys = [
    'matterbridgeLatestVersion',
    'matterbridgeDevVersion',
    'matterFileLogger',
    'fileLogger',
    'matterLoggerLevel',
    'loggerLevel',
    'virtualMode',
    'bridgeMode',
    'restartMode',
    'restartRequired',
    'fixedRestartRequired',
    'updateRequired',
    'matterMdnsInterface',
    'matterIpv4Address',
    'matterIpv6Address',
    'readOnly',
    'shellyBoard',
    'shellySysUpdate',
    'shellyMainUpdate',
    'matterPort',
    'matterDiscriminator',
    'matterPasscode',
  ];

  const [closed, setClosed] = useState(false);

  if (!matterbridgeInfo || closed) return null;

  if (debug) console.log('MatterbridgeInfoTable rendering...');

  return (
    <MbfWindow style={{ flex: '0 1 auto', width: '302px', minWidth: '302px' }}>
      <MbfWindowHeader>
        <MbfWindowHeaderText>Matterbridge Information</MbfWindowHeaderText>
        <MbfWindowIcons onClose={() => setClosed(true)} />
      </MbfWindowHeader>
      <MbfWindowContent style={{ flex: '1 1 auto', overflow: 'auto', margin: '0px', padding: '0px', gap: '0px' }}>
        <table style={{ border: 'none', borderCollapse: 'collapse' }}>
          <tbody style={{ border: 'none', borderCollapse: 'collapse' }}>
            {Object.entries(matterbridgeInfo)
              .filter(([key, value]) => !excludeKeys.includes(key) && value !== null && value !== undefined && value !== '')
              .map(([key, value], index) => (
                <tr key={key} className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'} style={{ border: 'none', borderCollapse: 'collapse' }}>
                  <td style={{ border: 'none', borderCollapse: 'collapse' }}>
                    {key
                      .replace('matterbridgeVersion', 'matterbridge')
                      .replace('frontendVersion', 'frontend')
                      .replace('homeDirectory', 'home')
                      .replace('rootDirectory', 'root')
                      .replace('matterbridgeDirectory', 'storage')
                      .replace('matterbridgeCertDirectory', 'cert')
                      .replace('matterbridgePluginDirectory', 'plugins')
                      .replace('globalModulesDirectory', 'modules')}
                  </td>
                  <td style={{ border: 'none', borderCollapse: 'collapse' }}>
                    <TruncatedText value={typeof value !== 'string' ? value.toString() : value} maxChars={26} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </MbfWindowContent>
    </MbfWindow>
  );
}

/**
 * Matterbridge Info Table
 * Displays Matterbridge Information in a table format.
 *
 * Props:
 * - matterbridgeInfo: MatterbridgeInformation object containing various details about Matterbridge.
 */
export default memo(MatterbridgeInfoTable);
