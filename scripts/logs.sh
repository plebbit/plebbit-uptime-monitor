#!/usr/bin/env bash

# deploy to a server

# go to current folder
cd "$(dirname "$0")"
cd ..

# add env vars
if [ -f .deploy-env ]; then
  export $(echo $(cat .deploy-env | sed 's/#.*//g'| xargs) | envsubst)
fi

# check creds
if [ -z "${DEPLOY_HOST+xxx}" ]; then echo "DEPLOY_HOST not set" && exit; fi
if [ -z "${DEPLOY_USER+xxx}" ]; then echo "DEPLOY_USER not set" && exit; fi
if [ -z "${DEPLOY_PASSWORD+xxx}" ]; then echo "DEPLOY_PASSWORD not set" && exit; fi

SCRIPT="
docker logs --follow plebbit-uptime-monitor
"

# only include logs that contain the filter, e.g. `scripts/logs.sh plebbit-uptime-monitor:subplebbit-pubsub`
filter="$1"
if [ -z "$filter" ]; then
  :
else
  SCRIPT="
docker logs --follow plebbit-uptime-monitor 2>&1 | grep '$filter' | sed 's/$filter//g'
"
  echo $SCRIPT
fi

# execute script over ssh
echo "$SCRIPT" | sshpass -p "$DEPLOY_PASSWORD" ssh "$DEPLOY_USER"@"$DEPLOY_HOST"
