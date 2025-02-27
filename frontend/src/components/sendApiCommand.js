/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
// Send a POST request to the Matterbridge API
export function sendCommandToMatterbridge(command, param, body) {
  const sanitizedParam = param.replace(/\\/g, '*');
  // console.log('sendCommandToMatterbridge:', command, param, sanitizedParam);
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
    // console.log('Command sent successfully:', json);
  })
  .catch(error => {
    console.error('Error sending command:', error);
  });
}