// @mui/icons-material
import TerminalIcon from '@mui/icons-material/Terminal';
// @mui/material
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

interface PluginTerminalButtonProps {
  onClick: () => void;
}

/**
 * Icon button of the plugins table that opens the terminal of a plugin
 *
 * @param {PluginTerminalButtonProps} props The click callback.
 * @returns {React.JSX.Element} The icon button with its tooltip.
 */
export function PluginTerminalButton({ onClick }: PluginTerminalButtonProps): React.JSX.Element {
  return (
    <Tooltip title="Open the plugin terminal" slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [30, 15] } }] } }}>
      <IconButton style={{ margin: '0', padding: '0', width: '19px', height: '19px' }} onClick={onClick} size="small">
        <TerminalIcon />
      </IconButton>
    </Tooltip>
  );
}
