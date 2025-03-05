/* eslint-disable no-console */
// React
import React, { useMemo } from 'react';

// @mui/material
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import { ThemeProvider } from '@mui/material';

// @mui/icons-material

// @rjsf
import Form from '@rjsf/mui';
// import Form from '@rjsf/core'; 
import validator from '@rjsf/validator-ajv8';

// Frontend
import { sendCommandToMatterbridge } from './sendApiCommand';
import { ArrayFieldTemplate, ObjectFieldTemplate, TitleFieldTemplate, DescriptionFieldTemplate, ErrorListTemplate, FieldErrorTemplate, RemoveButton, CheckboxWidget, createConfigTheme } from './configEditor';
// import { ArrayFieldTemplate, ObjectFieldTemplate, TitleFieldTemplate, DescriptionFieldTemplate, BaseInputTemplate, ErrorListTemplate, FieldErrorTemplate, RemoveButton, SubmitButton, CheckboxWidget, createConfigTheme } from './configEditor';
import { getCssVariable } from './muiTheme';
import { debug } from '../App';
// const debug = true;

const configUiSchema = {
  "password": {
    "ui:widget": "password",
  },
  "ui:submitButtonOptions": {
    "props": {
      "variant": "contained",
      "disabled": false,
      "className": "configSubmitButton",
      sx: { margin: '0px', marginLeft: '20px', marginBottom: '10px' },
      style: { margin: '0px', marginLeft: '20px', marginBottom: '10px' },
    },
    "norender": false,
    "submitText": "Save the changes to the config file",
  },
  'ui:globalOptions': { orderable: true },
};

export const ConfigPluginDialog = ({ open, onClose, plugin }) => {

  const primaryColor = useMemo(() => getCssVariable('--primary-color', '#009a00'), []);
  const configTheme = useMemo(() => createConfigTheme(primaryColor), [primaryColor]);

  const handleSaveChanges = ({ formData }) => {
    if(debug) console.log('handleSaveChanges:', formData);
    // Save the configuration
    plugin.configJson = formData;
    plugin.restartRequired = true;
    const config = JSON.stringify(formData, null, 2)
    sendCommandToMatterbridge('saveconfig', formData.name, config);
    // Close the dialog
    onClose();
  };
  
  if(debug) console.log('ConfigPluginDialog rendering...');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='800px'>
      <DialogTitle gap={'20px'}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
          <img src="matterbridge.svg" alt="Matterbridge Logo" style={{ height: '32px', width: '32px' }} />
          <h3>Matterbridge plugin configuration</h3>
        </div>
      </DialogTitle>
      <DialogContent style={{ padding: '0px', margin: '0px' }}>
        <ThemeProvider theme={configTheme}>
          <div style={{ width: '800px', height: '600px', overflow: 'auto' }}>
            <Form
              schema={plugin.schemaJson}
              formData={plugin.configJson}
              uiSchema={configUiSchema}
              validator={validator}
              widgets={{ CheckboxWidget }}
              templates={{ ArrayFieldTemplate, ObjectFieldTemplate, TitleFieldTemplate, DescriptionFieldTemplate, FieldErrorTemplate, ErrorListTemplate, ButtonTemplates: { RemoveButton } }}
              onSubmit={handleSaveChanges} />
          </div>
        </ThemeProvider>
      </DialogContent>
    </Dialog>
);
};