#!/usr/bin/env node
const { runCoapMonitor } = await import('@matterbridge/dgram');

runCoapMonitor(process.argv.slice(2));
