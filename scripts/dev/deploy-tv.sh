#!/bin/bash
# Build, sign, install and launch TV_Abdul on the TV.
#   scripts/dev/deploy-tv.sh <TV_IP> [debug]
# With "debug", the build forwards its console output to scripts/dev/tv-log-server.js on this Mac.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TV_IP="${1:?usage: deploy-tv.sh <TV_IP> [debug]}"
TARGET="$TV_IP:26101"
SDB="$ROOT/tools/data/tools/sdb"
TIZEN="$ROOT/tools/data/tools/ide/bin/tizen.sh"
cd "$ROOT"
if [ "$2" = "debug" ]; then
  MAC_IP="$(ipconfig getifaddr en0 || ipconfig getifaddr en1)"
  VITE_DEBUG_HOST="$MAC_IP" npm run build
else
  npm run build
fi
cp config.xml dist/config.xml
"$TIZEN" package -t wgt -s TV_Abdul -- "$ROOT/dist" | tail -2
"$SDB" connect "$TARGET" >/dev/null
"$TIZEN" install -s "$TARGET" -n TV_Abdul.wgt -- "$ROOT/dist" | tail -3
"$SDB" -s "$TARGET" shell 0 execute Abdul00101.TVAbdul | tail -1
