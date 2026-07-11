import type { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import type { SpiritDieRollBroadcast } from "@shared/realtime";

export interface SpiritRollBroadcaster {
  broadcastSpiritRoll(data: SpiritDieRollBroadcast): void;
}

export class SpiritRollWebSocket implements SpiritRollBroadcaster {
  private readonly clients = new Set<WebSocket>();
  private readonly responsive = new WeakMap<WebSocket, boolean>();
  private readonly server: WebSocketServer;
  private readonly heartbeat: NodeJS.Timeout;

  constructor(httpServer: Server) {
    this.server = new WebSocketServer({ server: httpServer, path: "/ws" });
    this.server.on("connection", (client) => this.track(client));
    this.server.on("error", (error) => {
      console.error("WebSocket server error:", error);
    });
    this.heartbeat = setInterval(() => this.removeUnresponsiveClients(), 30_000);
    this.heartbeat.unref();
    httpServer.once("close", () => {
      clearInterval(this.heartbeat);
      this.clients.forEach((client) => client.terminate());
      this.clients.clear();
      this.server.close();
    });
  }

  broadcastSpiritRoll(data: SpiritDieRollBroadcast): void {
    const message = JSON.stringify({
      type: "spirit_die_roll",
      data,
    });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 1_000_000) {
        client.send(message, (error?: Error) => {
          if (error) {
            this.clients.delete(client);
            client.terminate();
          }
        });
      }
    });
  }

  private track(client: WebSocket): void {
    this.clients.add(client);
    this.responsive.set(client, true);

    client.on("pong", () => {
      this.responsive.set(client, true);
    });

    const release = () => {
      this.clients.delete(client);
    };

    client.once("close", release);
    client.once("error", release);
  }

  private removeUnresponsiveClients(): void {
    this.clients.forEach((client) => {
      if (this.responsive.get(client) === false) {
        this.clients.delete(client);
        client.terminate();
        return;
      }
      this.responsive.set(client, false);
      client.ping();
    });
  }
}
