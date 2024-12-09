#!/usr/bin/env bash

# deploy to a server

# go to current folder
cd "$(dirname "$0")"
cd ..

# add env vars
if [ -f .deploy-env-ipfs-pubsub ]; then
  export $(echo $(cat .deploy-env-ipfs-pubsub | sed 's/#.*//g'| xargs) | envsubst)
fi

# check creds
if [ -z "${DEPLOY_HOST+xxx}" ]; then echo "DEPLOY_HOST not set" && exit; fi
if [ -z "${DEPLOY_USER+xxx}" ]; then echo "DEPLOY_USER not set" && exit; fi
if [ -z "${DEPLOY_PASSWORD+xxx}" ]; then echo "DEPLOY_PASSWORD not set" && exit; fi

SCRIPT="
cd /home
git clone https://github.com/plebbit/plebbit-uptime-monitor.git
cd plebbit-uptime-monitor
git reset HEAD --hard
git pull
scripts/start-ipfs-docker.sh
"

echo "$SCRIPT" | sshpass -p "$DEPLOY_PASSWORD" ssh "$DEPLOY_USER"@"$DEPLOY_HOST"
