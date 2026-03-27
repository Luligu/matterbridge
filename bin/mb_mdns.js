#!/usr/bin/env node
const { mbMdnsMain } = await import('@matterbridge/core/mb_mdns');

mbMdnsMain();
