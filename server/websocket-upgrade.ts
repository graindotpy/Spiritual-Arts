import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";

export type WebSocketUpgradeHandler = (
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
) => void;

/**
 * One pathname router owns the HTTP upgrade listener for a server. Unknown
 * paths are deliberately untouched so Vite or another upgrade consumer may
 * handle them.
 */
export class WebSocketUpgradeRouter {
  private readonly handlers = new Map<string, WebSocketUpgradeHandler>();
  private readonly onUpgrade = (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => {
    let pathname: string;
    try {
      pathname = new URL(request.url ?? "", "http://localhost").pathname;
    } catch {
      return;
    }
    const handler = this.handlers.get(pathname);
    if (handler) {
      handler(request, socket, head);
      return;
    }
    if (this.production && socket.writable) {
      socket.end(
        "HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
      );
    }
  };

  private readonly production: boolean;

  constructor(
    private readonly server: Server,
    options: { production?: boolean } = {},
  ) {
    this.production =
      options.production ?? process.env.NODE_ENV === "production";
    server.on("upgrade", this.onUpgrade);
    server.once("close", () => this.close());
  }

  register(
    pathname: string,
    handler: WebSocketUpgradeHandler,
  ): () => void {
    if (!pathname.startsWith("/") || this.handlers.has(pathname)) {
      throw new Error(`WebSocket upgrade path is invalid or already registered: ${pathname}`);
    }
    this.handlers.set(pathname, handler);
    return () => {
      if (this.handlers.get(pathname) === handler) this.handlers.delete(pathname);
    };
  }

  close(): void {
    this.handlers.clear();
    this.server.removeListener("upgrade", this.onUpgrade);
  }
}

const routers = new WeakMap<Server, WebSocketUpgradeRouter>();

export function getWebSocketUpgradeRouter(
  server: Server,
): WebSocketUpgradeRouter {
  let router = routers.get(server);
  if (!router) {
    router = new WebSocketUpgradeRouter(server);
    routers.set(server, router);
  }
  return router;
}
