#!/usr/bin/env node

import { Matterbridge } from './matterbridge.js';

async function main() {
  // eslint-disable-next-line no-console
  console.log('Loading Matterbridge from cli');
  await Matterbridge.loadInstance(true);
}

process.title = 'matterbridge';

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`Failed to initialize Matterbridge from cli: ${error}`);
});
