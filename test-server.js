import http from "node:http"

const port = 5001

http
  .createServer(async (req, res) => {
    console.log(`${req.method} ${req.url}`);
  })
  .listen(port)

console.log(`Server running at http://127.0.0.1:${port}/`)
