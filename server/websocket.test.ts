import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { WebSocket } from "ws";
import {
  foundryActionRequestMessageSchema,
  instrumentFoundryActionRequestMessageSchema,
  REALTIME_PROTOCOL_VERSION,
  spiritDieRollMessageSchema,
  type FoundryActionRequestData,
  type FoundryActionRequestMessage,
  type InstrumentFoundryActionRequestData,
  type InstrumentFoundryActionRequestMessage,
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

const actionRequest: FoundryActionRequestData = {
  requestedAt: "2026-07-13T12:00:01.000Z",
  sourceRollEventId: "5c13c52f-f89d-41f5-8816-7d5ac0ab132f",
  character: {
    ...roll.character,
    spiritualArtsDc: 15,
  },
  technique: {
    id: "6a4b7b9d-cbf7-4e41-8110-294a9036cfa0",
    name: "Devour Essence",
  },
  spInvestment: 2,
  action: {
    id: "523240f5-7433-4e0b-876c-c209ad3b310a",
    kind: "roll_damage",
    formula: "2d8 + 4",
    damageType: "necrotic",
    savingThrow: { ability: "dex" },
    template: { type: "circle", distance: 20 },
  },
};

const instrumentActionRequest: InstrumentFoundryActionRequestData = {
  requestedAt: "2026-07-15T12:00:01.000Z",
  sourceUseId: "15f60104-1654-4b6e-9c1b-d62e5a0b5199",
  character: {
    ...roll.character,
    spiritualArtsDc: 15,
  },
  instrument: {
    id: "cc9fd3c7-fccc-4f44-967f-bb5780fc1037",
    name: "Ghost Lantern",
  },
  instrumentAction: {
    id: "c11af797-bad8-4566-a5f8-455420f70db4",
    name: "Lantern Burst",
  },
  action: {
    id: "523240f5-7433-4e0b-876c-c209ad3b310a",
    kind: "roll_damage",
    formula: "2d8 + 4",
    damageType: "radiant",
    savingThrow: { ability: "dex" },
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

test("the realtime server broadcasts each valid Foundry action with a unique event ID", async (t) => {
  t.mock.method(console, "error", () => {});
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

    const received = new Promise<FoundryActionRequestMessage[]>((resolve, reject) => {
      const messages: FoundryActionRequestMessage[] = [];
      client.on("message", (raw) => {
        const parsed = foundryActionRequestMessageSchema.safeParse(
          JSON.parse(raw.toString()),
        );
        if (!parsed.success) {
          reject(parsed.error);
          return;
        }
        messages.push(parsed.data);
        if (messages.length === 3) resolve(messages);
      });
      client.once("error", reject);
    });

    const firstEventId = realtime.broadcastFoundryAction(actionRequest);
    const secondEventId = realtime.broadcastFoundryAction({
      ...actionRequest,
      character: {
        ...roll.character,
        spiritualArtsAttackModifier: 7,
      },
      action: {
        id: "af51a725-e3a2-40ea-b016-cc7040df091c",
        kind: "roll_attack",
        label: "Essence strike",
      },
    });
    const thirdEventId = realtime.broadcastFoundryAction({
      ...actionRequest,
      character: { ...roll.character },
      action: {
        id: "75ca2097-da4f-4875-98d2-15863caa83b3",
        kind: "place_template",
        label: "Difficult terrain",
        template: { type: "rectangle", distance: 20 },
      },
    });

    const [first, second, third] = await received;
    assert.equal(first.eventId, firstEventId);
    assert.equal(second.eventId, secondEventId);
    assert.equal(third.eventId, thirdEventId);
    assert.notEqual(first.eventId, second.eventId);
    assert.notEqual(second.eventId, third.eventId);
    assert.equal(first.data.sourceRollEventId, actionRequest.sourceRollEventId);
    assert.equal(second.data.action.kind, "roll_attack");
    assert.equal(second.data.character.spiritualArtsAttackModifier, 7);
    assert.equal(third.data.action.kind, "place_template");
    assert.equal(Object.hasOwn(third.data.character, "spiritualArtsDc"), false);
    assert.equal(
      realtime.broadcastFoundryAction({
        ...actionRequest,
        character: { ...actionRequest.character, name: "x".repeat(256) },
      }),
      null,
    );
  } finally {
    if (client.readyState === WebSocket.OPEN) {
      const closed = new Promise<void>((resolve) => client.once("close", resolve));
      client.close();
      await closed;
    }
    realtime.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("the realtime server broadcasts strict instrument action variants with independent event IDs", async (t) => {
  t.mock.method(console, "error", () => {});
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

    const received = new Promise<InstrumentFoundryActionRequestMessage[]>(
      (resolve, reject) => {
        const messages: InstrumentFoundryActionRequestMessage[] = [];
        client.on("message", (raw) => {
          const parsed = instrumentFoundryActionRequestMessageSchema.safeParse(
            JSON.parse(raw.toString()),
          );
          if (!parsed.success) {
            reject(parsed.error);
            return;
          }
          messages.push(parsed.data);
          if (messages.length === 2) resolve(messages);
        });
        client.once("error", reject);
      },
    );

    const firstEventId = realtime.broadcastInstrumentFoundryAction(
      instrumentActionRequest,
    );
    const secondEventId = realtime.broadcastInstrumentFoundryAction({
      ...instrumentActionRequest,
      character: {
        ...roll.character,
        spiritualArtsAttackModifier: 7,
      },
      action: {
        id: "34109839-d482-4ef7-bde4-98ce40d330f2",
        kind: "roll_attack",
        label: "Lantern ray",
      },
    });

    const [first, second] = await received;
    assert.equal(first.eventId, firstEventId);
    assert.equal(second.eventId, secondEventId);
    assert.notEqual(first.eventId, second.eventId);
    assert.equal(first.type, "foundry_action_request");
    assert.equal(first.data.sourceUseId, instrumentActionRequest.sourceUseId);
    assert.deepEqual(first.data.instrument, instrumentActionRequest.instrument);
    assert.deepEqual(
      first.data.instrumentAction,
      instrumentActionRequest.instrumentAction,
    );
    assert.equal(second.data.character.spiritualArtsAttackModifier, 7);

    assert.equal(
      realtime.broadcastInstrumentFoundryAction({
        ...instrumentActionRequest,
        sourceUseId: "not-a-uuid",
      } as InstrumentFoundryActionRequestData),
      null,
    );
  } finally {
    if (client.readyState === WebSocket.OPEN) {
      const closed = new Promise<void>((resolve) => client.once("close", resolve));
      client.close();
      await closed;
    }
    realtime.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
