#!/usr/bin/env node
const { mbHealthMain } = await import('@matterbridge/core/mb_health');

await mbHealthMain(process.exit, process.argv[2]);
