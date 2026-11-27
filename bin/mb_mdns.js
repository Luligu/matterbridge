#!/usr/bin/env node
const { runMdnsMonitor } = await import('@matterbridge/dgram');

runMdnsMonitor(process.argv.slice(2));
