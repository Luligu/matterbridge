/* eslint-disable no-console */

// Frontend
import { debug } from '../App';

// Send a POST request to the Matterbridge API
export function sendCommandToMatterbridge(command, param, body) {
  const sanitizedParam = param.replace(/\\/g, '*');
  if(debug) console.log('sendCommandToMatterbridge:', command, param, sanitizedParam);
  fetch(`./api/command/${command}/${sanitizedParam}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
   
  .then(json => {
    if(debug) console.log('Command sent successfully:', json);
  })
  .catch(error => {
    console.error('Error sending command:', error);
  });
}