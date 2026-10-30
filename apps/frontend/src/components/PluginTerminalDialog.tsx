// @mui/material
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
// React
import { useContext, useEffect, useRef, useState } from 'react';

import { debug } from '../appState';
import { type WsMessageApiResponse } from '../utils/backendShared';
import { WebSocketContext } from './WebSocketProvider';

interface TerminalLine {
  kind: 'input' | 'output' | 'error';
  text: string;
}

interface PluginTerminalDialogProps {
  open: boolean;
  onClose: () => void;
  pluginName: string;
}

const lineColor = { input: 'var(--primary-color)', output: 'var(--div-text-color)', error: 'var(--secondary-color)' };

/**
 * Terminal popup of a plugin: sends the typed command line to the plugin (onCommand) and shows the returned output.
 *
 * @param {PluginTerminalDialogProps} props The open state, the close callback and the name of the plugin.
 * @returns {React.JSX.Element} The terminal dialog.
 */
export function PluginTerminalDialog({ open, onClose, pluginName }: PluginTerminalDialogProps): React.JSX.Element {
  const { sendMessage, addListener, removeListener, getUniqueId } = useContext(WebSocketContext);
  const uniqueId = useRef(getUniqueId());
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [command, setCommand] = useState('');
  const [pending, setPending] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  // Listen for the command responses of this dialog
  useEffect(() => {
    const handleWebSocketMessage = (msg: WsMessageApiResponse) => {
      if (msg.id === uniqueId.current && msg.method === '/api/plugin-command') {
        if (debug) console.log(`PluginTerminalDialog (id: ${msg.id}) received output:`, msg.response);
        setLines((prev) => [...prev, { kind: msg.response.error ? 'error' : 'output', text: msg.response.output }]);
        setPending(false);
      }
    };
    addListener(handleWebSocketMessage, uniqueId.current);
    return () => {
      removeListener(handleWebSocketMessage);
    };
  }, [addListener, removeListener]);

  // Keep the last line visible
  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  });

  const handleSend = () => {
    const line = command.trim();
    if (!line || pending) return;
    setLines((prev) => [...prev, { kind: 'input', text: `> ${line}` }]);
    setHistory((prev) => [...prev, line]);
    setHistoryIndex(null);
    setCommand('');
    setPending(true);
    sendMessage({
      id: uniqueId.current,
      sender: 'PluginTerminalDialog',
      method: '/api/plugin-command',
      src: 'Frontend',
      dst: 'Matterbridge',
      params: { plugin: pluginName, command: line },
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSend();
    } else if (event.key === 'ArrowUp' && history.length > 0) {
      event.preventDefault();
      const next = historyIndex === null ? history.length - 1 : Math.max(historyIndex - 1, 0);
      setHistoryIndex(next);
      setCommand(history[next]);
    } else if (event.key === 'ArrowDown' && historyIndex !== null) {
      event.preventDefault();
      const next = historyIndex + 1;
      setHistoryIndex(next < history.length ? next : null);
      setCommand(next < history.length ? history[next] : '');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" slotProps={{ transition: { onEntered: () => inputRef.current?.focus() } }}>
      <DialogTitle>Terminal - {pluginName}</DialogTitle>
      <DialogContent dividers>
        <div
          ref={outputRef}
          aria-label="Terminal output"
          style={{ height: '40vh', overflowY: 'auto', fontFamily: 'monospace', fontSize: '14px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', paddingBottom: '10px' }}
        >
          {lines.map((line, index) => (
            <div key={index} style={{ color: lineColor[line.kind] }}>
              {line.text}
            </div>
          ))}
        </div>
        <TextField
          fullWidth
          inputRef={inputRef}
          size="small"
          variant="outlined"
          placeholder="Type a command and press Enter"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={handleKeyDown}
          slotProps={{ htmlInput: { 'aria-label': 'Terminal command', 'readOnly': pending, 'style': { fontFamily: 'monospace' } } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setLines([])}>Clear</Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
