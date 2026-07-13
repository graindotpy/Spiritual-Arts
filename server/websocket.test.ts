import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { WebSocket } from "ws";
import {
  REALTIME_PROTOCOL_VERSION,
  spiritDieRollMessageSchema,
  type SpiritDieRollBroadcast,
  type SpiritDieRollMessage,
} from "@shared/realtime";
import { SpiritRollWebSocket } from "./websocket";

const roll: SpiritDieRollBroadcast = {
  character: {
    id: "character-1",
    name: "Raan",
    path: "Path of Gluttony",
    level: 8,
    portraitUrl: null,
  },
  roll: {
    spInvestment: 2,
    dieSize: "d8",
    dieIndex: 0,
    value: 6,
    success: true,
    techniqueId: null,
    techniqueName: "Devour Essence",
    timestamp: "2026-07-13T12:00:00.000Z",
  },
};

test("the realtime server gives each Spirit Die broadcast a unique event ID", async () => {
  const server = createServer();
  const realtime = new SpiritRollWebSocket(server);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const client = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);

  try {
    await new Promise<void>((resolve, reject) => {
      client.once("open", resolve);
      client.once("error", reject);
    });

    const received = new Promise<SpiritDieRollMessage[]>((resolve, reject) => {
      const messages: SpiritDieRollMessage[] = [];
      client.on("message", (raw) => {
        const parsed = spiritDieRollMessageSchema.safeParse(JSON.parse(raw.toString()));
        if (!parsed.success) {
          reject(parsed.error);
          return;
        }
        messages.push(parsed.data);
        if (messages.length === 2) resolve(messages);
      });
      client.once("error", reject);
    });

    realtime.broadcastSpiritRoll(roll);
    realtime.broadcastSpiritRoll(roll);

    const [first, second] = await received;
    assert.equal(first.protocolVersion, REALTIME_PROTOCOL_VERSION);
    assert.equal(second.protocolVersion, REALTIME_PROTOCOL_VERSION);
    assert.notEqual(first.eventId, second.eventId);
  } finally {
    if (client.readyState === WebSocket.OPEN) {
      const closed = new Promise<void>((resolve) => client.once("close", () => resolve()));
      client.close();
      await closed;
    }
    realtime.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
