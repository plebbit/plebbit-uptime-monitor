# go to current folder
cd "$(dirname "$0")"
cd ..

docker rm -f plebbit-uptime-monitor-ipfs 2>/dev/null

docker run \
  --detach \
  --name plebbit-uptime-monitor-ipfs \
  --restart always \
  --log-opt max-size=10m \
  --log-opt max-file=5 \
  --volume=$(pwd):/usr/src/plebbit-uptime-monitor \
  --workdir="/usr/src/plebbit-uptime-monitor" \
  --network=host \
  node:18 \
  sh -c "npm install; node start-ipfs"

docker logs --follow plebbit-uptime-monitor-ipfs
