// React
import { memo, useContext, useState } from 'react';

import { debug, enableMobile } from '../appState';
import { type MatterbridgeInformation } from '../utils/backendShared';
import { MbfWindow, MbfWindowContent, MbfWindowHeader, MbfWindowHeaderText, MbfWindowIcons } from './MbfWindow';
import { TruncatedText } from './TruncatedText';
import { UiContext } from './UiContext';
// const debug = true;

const keyNameMap = new Map<string, string>([
  ['matterbridgeVersion', 'Matterbridge version'],
  ['frontendVersion', 'Frontend version'],
  ['dockerVersion', 'Docker version'],
  ['homeDirectory', 'Home'],
  ['rootDirectory', 'Root'],
  ['matterbridgeDirectory', 'Storage'],
  ['matterbridgeCertDirectory', 'Cert'],
  ['matterbridgePluginDirectory', 'Plugins'],
  ['globalModulesDirectory', 'Modules'],
  ['bridgeMode', 'Bridge mode'],
  ['restartMode', 'Restart mode'],
  ['virtualMode', 'Virtual mode'],
  ['bridgeStatus', 'Bridge status'],
  ['profile', 'Profile'],
  ['loggerLevel', 'Logger level'],
  ['fileLogger', 'File logger'],
  ['matterLoggerLevel', 'Matter logger level'],
  ['matterFileLogger', 'Matter file logger'],
  ['restartRequired', 'Restart required'],
  ['updateRequired', 'Update required'],
]);

const excludeKeys = new Set([
  'matterbridgeLatestVersion',
  'matterbridgeDevVersion',
  'dockerDev',
  'dockerLatestVersion',
  'dockerDevVersion',
  'fixedRestartRequired',
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
]);

function MatterbridgeInfoTable({ matterbridgeInfo }: { matterbridgeInfo: MatterbridgeInformation }) {
  // Contexts
  const { mobile } = useContext(UiContext);
  if (debug) console.log('MatterbridgeInfoTable:', matterbridgeInfo);

  const [closed, setClosed] = useState(false);

  if (!matterbridgeInfo || closed) return null;

  if (debug) console.log('MatterbridgeInfoTable rendering...');

  return (
    <MbfWindow style={enableMobile && mobile ? { flex: '1 1 300px' } : { flex: '0 1 auto', width: '302px', minWidth: '302px' }}>
      <MbfWindowHeader>
        <MbfWindowHeaderText>Matterbridge info</MbfWindowHeaderText>
        <MbfWindowIcons close={() => setClosed(true)} />
      </MbfWindowHeader>
      <MbfWindowContent
        style={
          enableMobile && mobile
            ? { flex: '1 1 auto', margin: '0px', padding: '0px', gap: '0px' }
            : { flex: '1 1 auto', overflow: 'auto', margin: '0px', padding: '0px', gap: '0px' }
        }
      >
        <table style={{ border: 'none', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '40%' }} />
            <col style={{ width: '60%' }} />
          </colgroup>
          <tbody style={{ border: 'none', borderCollapse: 'collapse' }}>
            {Object.entries(matterbridgeInfo)
              .filter(([key, value]) => !excludeKeys.has(key) && value !== null && value !== undefined && value !== '')
              .map(([key, value], index) => (
                <tr key={key} className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'} style={{ border: 'none', borderCollapse: 'collapse' }}>
                  <td style={{ border: 'none', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>{keyNameMap.get(key) ?? key}</td>
                  <td style={{ border: 'none', borderCollapse: 'collapse', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {enableMobile && mobile ? (
                      typeof value !== 'string' ? (
                        value.toString()
                      ) : (
                        value
                      )
                    ) : (
                      <TruncatedText value={typeof value !== 'string' ? value.toString() : value} maxChars={24} />
                    )}
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
