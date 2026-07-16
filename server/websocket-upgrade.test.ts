import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { connect } from "node:net";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { WebSocketUpgradeRouter } from "./websocket-upgrade";

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return (server.address() as AddressInfo).port;
}

function requestUpgrade(port: number, pathname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1");
    let response = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      response += chunk;
    });
    socket.once("connect", () => {
      socket.write(
        `GET ${pathname} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n`,
      );
    });
    socket.once("end", () => resolve(response));
    socket.once("error", reject);
  });
}

test("unknown upgrades remain available to a later development consumer", async () => {
  const server = createServer();
  const router = new WebSocketUpgradeRouter(server, { production: false });
  server.on("upgrade", (request, socket) => {
    if (request.url === "/vite-hmr") {
      socket.end("HTTP/1.1 101 Switching Protocols\r\nConnection: close\r\n\r\n");
    }
  });
  const port = await listen(server);
  try {
    assert.match(await requestUpgrade(port, "/vite-hmr"), /101 Switching Protocols/);
  } finally {
    router.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("unknown production upgrades are closed instead of left dangling", async () => {
  const server = createServer();
  const router = new WebSocketUpgradeRouter(server, { production: true });
  const port = await listen(server);
  try {
    assert.match(await requestUpgrade(port, "/unknown"), /404 Not Found/);
  } finally {
    router.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
