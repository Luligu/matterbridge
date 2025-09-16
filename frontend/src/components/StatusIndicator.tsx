// @mui/material

import Tooltip from '@mui/material/Tooltip';

interface StatusIndicatorProps {
  status?: boolean;
  enabledText?: string;
  disabledText?: string;
  tooltipText?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export function StatusIndicator({
  status,
  enabledText = 'Enabled',
  disabledText = undefined,
  tooltipText = undefined,
  onClick
}: StatusIndicatorProps) {
  if (status === undefined) {
    return (
      <div style={{ margin: '-2.5px' }}>
        <div></div>
      </div>
    );
  } else {
    const content = (
      <div
        className={status ? 'status-enabled' : 'status-disabled'}
        style={{ cursor: 'default' }}
        onClick={onClick}
      >
        {status ? enabledText : disabledText ?? enabledText}
      </div>
    );
    if (tooltipText !== undefined) {
      return <Tooltip title={tooltipText}>{content}</Tooltip>;
    } else {
      return content;
    }
  }
}