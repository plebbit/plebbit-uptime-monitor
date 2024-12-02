pkill ipfs

IPFS_PATH=.ipfs bin/ipfs daemon --enable-pubsub-experiment &
sleep 3

curl -v -X POST "http://127.0.0.1:5001/api/v0/pubsub/sub?on-error=onError%28t%29%7Br.error%28%22pubsub+callback+error%2C+topic%22%2Ce%2C%22provider+url%22%2Cn%2C%22error%22%2Ct%29%7D&arg=uMTJEM0tvb1c5eEg1VkZmU1E1WVdvSEsxZldTOVljNUM3eXl0YmlxZ2c0VVB2ekcxTlFCNg"
