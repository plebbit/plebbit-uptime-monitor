# go to current folder
cd "$(dirname "$0")"
cd ..

docker rm -f plebbit-uptime-monitor 2>/dev/null

MONITOR_ARGS="$@"

docker run \
  --detach \
  --name plebbit-uptime-monitor \
  --restart always \
  --log-opt max-size=10m \
  --log-opt max-file=5 \
  --volume=$(pwd):/usr/src/plebbit-uptime-monitor \
  --workdir="/usr/src/plebbit-uptime-monitor" \
  --publish 80:3000 \
  node:18 \
  sh -c "npm install; npm start -- $MONITOR_ARGS"

docker logs --follow plebbit-uptime-monitor
