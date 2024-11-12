import http from "node:http";
import fs from "node:fs";
import { vocabPhysical } from "./prepare-test-data.js";

let server: http.Server;

export function startServer() {
  server?.close();
  server = http
    .createServer((req, res) => {
      if (req.url === "/csvw.jsonld") {
        res.setHeader("Content-Type", "application/ld+json");
        const stream = fs.createReadStream(vocabPhysical);
        stream.pipe(res);
      }
    })
    .listen(8080);
}

export function closeServer() {
  server?.close();
}
