#!/bin/bash
export PATH="/Users/wangfuliang/.nvm/versions/node/v22.17.0/bin:$PATH"
exec npx next dev --port "${PORT:-3000}"
