#!/usr/bin/env node
const { runMdnsScanner } = await import('@matterbridge/dgram');

await runMdnsScanner(process.argv.slice(2));
