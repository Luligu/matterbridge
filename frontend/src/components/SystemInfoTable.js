// Frontend
import { TruncatedText } from './TruncatedText';

// This function takes systemInfo as a parameter and returns a table element with the systemInfo
export function SystemInfoTable({ systemInfo, compact }) {
  const excludeKeys = ['totalMemory', 'osRelease', 'osArch'];
  if (compact && systemInfo.totalMemory) {
    const totalMemory = systemInfo.totalMemory;
    const freeMemory = systemInfo.freeMemory;
    systemInfo.freeMemory = `${freeMemory} / ${totalMemory}`;
    delete systemInfo.totalMemory;
  }
  if (compact && systemInfo.osRelease) {
    const osType = systemInfo.osType;
    const osRelease	= systemInfo.osRelease;
    systemInfo.osType = `${osType} (${osRelease})`;
    delete systemInfo.osRelease;
  }
  if(compact && systemInfo.osArch) {
    const osPlatform = systemInfo.osPlatform;
    const osArch = systemInfo.osArch;
    systemInfo.osPlatform = `${osPlatform} (${osArch})`;
    delete systemInfo.osArch;
  }

  return (
    <div className="MbfWindowDiv" style={{ minWidth: '302px', overflow: 'hidden' }}>
      <div className="MbfWindowDivTable" style={{ overflow: 'hidden' }}>
        <table >
          <thead>
            <tr>
              <th colSpan="2">System Information</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(systemInfo).filter(([key, _]) => !excludeKeys.includes(key)).map(([key, value], index) => (
              <tr key={key} className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'} style={{ borderTop: '1px solid #ddd' }}>
                <td>{key}</td>
                <td>
                  <TruncatedText value={typeof value !== 'string' ? value.toString() : value} maxChars={26} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
  