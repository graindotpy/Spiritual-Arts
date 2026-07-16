import type { Server } from "http";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import {
  createFoundryActionRequestMessage,
  createInstrumentFoundryActionRequestMessage,
  createSpiritDieRollMessage,
  type FoundryActionRequestData,
  type InstrumentFoundryActionRequestData,
  type RealtimeMessage,
  type SpiritDieRollBroadcast,
} from "@shared/realtime";
import { getWebSocketUpgradeRouter } from "./websocket-upgrade";

export interface SpiritRollBroadcaster {
  broadcastSpiritRoll(data: SpiritDieRollBroadcast): string;
  broadcastFoundryAction(data: FoundryActionRequestData): string | null;
}

export interface InstrumentActionBroadcaster {
  broadcastInstrumentFoundryAction(
    data: InstrumentFoundryActionRequestData,
  ): string | null;
}

export class SpiritRollWebSocket
  implements SpiritRollBroadcaster, InstrumentActionBroadcaster
{
  private readonly clients = new Set<WebSocket>();
  private readonly responsive = new WeakMap<WebSocket, boolean>();
  private readonly server: WebSocketServer;
  private readonly unregisterUpgrade: () => void;
  private readonly heartbeat: NodeJS.Timeout;
  private closed = false;

  constructor(httpServer: Server) {
    this.server = new WebSocketServer({
      noServer: true,
      maxPayload: 64 * 1_024,
      perMessageDeflate: false,
    });
    this.server.on("connection", (client) => this.track(client));
    this.server.on("error", (error) => {
      console.error("WebSocket server error:", error);
    });
    this.heartbeat = setInterval(() => this.removeUnresponsiveClients(), 30_000);
    this.heartbeat.unref();
    this.unregisterUpgrade = getWebSocketUpgradeRouter(httpServer).register(
      "/ws",
      (request, socket, head) => {
        this.server.handleUpgrade(request, socket, head, (client) => {
          this.server.emit("connection", client, request);
        });
      },
    );
    httpServer.once("close", () => this.close());
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.heartbeat);
    this.unregisterUpgrade();
    this.clients.forEach((client) => client.terminate());
    this.clients.clear();
    this.server.close((error) => {
      if (error) console.error("Failed to close WebSocket server:", error);
    });
  }

  broadcastSpiritRoll(data: SpiritDieRollBroadcast): string {
    const eventId = randomUUID();
    this.broadcast(createSpiritDieRollMessage(eventId, data));
    return eventId;
  }

  broadcastFoundryAction(data: FoundryActionRequestData): string | null {
    const eventId = randomUUID();
    let event: RealtimeMessage;
    try {
      event = createFoundryActionRequestMessage(eventId, data);
    } catch (error) {
      console.error("Skipped invalid Foundry action request:", error);
      return null;
    }
    this.broadcast(event);
    return eventId;
  }

  broadcastInstrumentFoundryAction(
    data: InstrumentFoundryActionRequestData,
  ): string | null {
    const eventId = randomUUID();
    let event: RealtimeMessage;
    try {
      event = createInstrumentFoundryActionRequestMessage(eventId, data);
    } catch (error) {
      console.error("Skipped invalid instrument Foundry action request:", error);
      return null;
    }
    this.broadcast(event);
    return eventId;
  }

  private broadcast(event: RealtimeMessage): void {
    const message = JSON.stringify(event);
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
