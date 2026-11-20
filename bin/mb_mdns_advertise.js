#!/usr/bin/env node
const { runMatterbridgeAdvertise } = await import('@matterbridge/dgram');

await runMatterbridgeAdvertise(process.argv.slice(2));
