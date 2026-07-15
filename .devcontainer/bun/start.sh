#!/usr/bin/env bash

set -euo pipefail

bun install
bun run build
mkdir -p "$BUN_INSTALL_BIN" "$BUN_INSTALL_GLOBAL_DIR"
bun link

cd apps/frontend
bun install
bun run build
cd ../..
