#!/usr/bin/env node
const { mbHealthMain } = await import('../dist/mb_health.js');
await mbHealthMain();
