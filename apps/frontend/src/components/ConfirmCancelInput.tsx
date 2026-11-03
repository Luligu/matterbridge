/**
 * @file apps/frontend/src/components/ConfirmCancelInput.tsx
 * @description Confirmation dialog with an editable text field
 * @author Copilot
 * @created 2026-11-03
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026 Luligu.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @mui/material
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
// React
import { useState } from 'react';

// Frontend
import { debug } from '../appState';

/** Props for a confirmation dialog that returns an edited text value */
export interface ConfirmCancelInputProps {
  open: boolean;
  title: string;
  message: string;
  /** Starting value, restored when the dialog is reopened or this prop changes */
  initialValue?: string;
  label?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * Render a confirmation dialog with OK enabled only for a changed value
 *
 * @param {ConfirmCancelInputProps} props Dialog content, initial input value and action callbacks
 * @returns {React.JSX.Element} Confirmation dialog with a text field between the message and buttons
 */
export function ConfirmCancelInput({ open, title, message, initialValue = '', label = 'Value', onConfirm, onCancel }: ConfirmCancelInputProps): React.JSX.Element {
  const [input, setInput] = useState({ open, initialValue, value: initialValue });

  if (input.open !== open || input.initialValue !== initialValue) {
    setInput({ open, initialValue, value: initialValue });
  }
  const { value } = input;

  const handleConfirm = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (debug) console.log('Confirmed');
    event.preventDefault();
    onConfirm(value);
  };

  const handleCancel = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (debug) console.log('Canceled');
    event.preventDefault();
    onCancel();
  };

  return (
    <Dialog open={open}>
      <DialogTitle>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
          <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
          <h4 style={{ margin: 0 }}>{title}</h4>
        </div>
      </DialogTitle>
      <DialogContent>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0',
            marginBottom: '20px',
            maxHeight: '350px',
            maxWidth: '350px',
          }}
        >
          <p style={{ flex: 1, margin: '0' }}>{message}</p>
        </div>
        <TextField label={label} value={value} onChange={(event) => setInput({ ...input, value: event.target.value })} fullWidth size="small" sx={{ marginBottom: '20px' }} />
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
          <Button onClick={handleConfirm} disabled={value === initialValue} variant="contained" color="primary" size="small">
            OK
          </Button>
          <Button onClick={handleCancel} variant="contained" color="primary" size="small">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
