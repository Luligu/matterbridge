/* eslint-disable no-console */
import { exec } from 'child_process';

const command = 'npm link matterbridge';

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`exec error: ${error}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
  if (stderr) {
    console.error(`stderr: ${stderr}`);
  }
});
