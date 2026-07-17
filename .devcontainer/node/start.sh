#!/usr/bin/env bash

set -euo pipefail

npm install --no-fund --no-audit
npm run build
sudo npm link

cd apps/frontend
npm install --no-fund --no-audit
npm run build
cd ../..
