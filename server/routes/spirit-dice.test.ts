import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { afterEach, test } from "node:test";
import express from "express";
import type {
  FoundryActionRequestData,
  SpiritDieRollBroadcast,
} from "@shared/realtime";
import { apiErrorHandler } from "../http/errors";
import { MemStorage } from "../storage/memory-storage";
import type { SpiritRollBroadcaster } from "../websocket";
import { createSpiritDiceRouter } from "./spirit-dice";

const servers = new Set<Server>();

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  servers.clear();
});

class RecordingBroadcaster implements SpiritRollBroadcaster {
  readonly spiritRolls: Array<{
    eventId: string;
    data: SpiritDieRollBroadcast;
  }> = [];

  readonly foundryActions: Array<{
    eventId: string;
    data: FoundryActionRequestData;
  }> = [];

  broadcastSpiritRoll(data: SpiritDieRollBroadcast): string {
    const eventId = randomUUID();
    this.spiritRolls.push({ eventId, data });
    return eventId;
  }

  broadcastFoundryAction(data: FoundryActionRequestData): string {
    const eventId = randomUUID();
    this.foundryActions.push({ eventId, data });
    return eventId;
  }
}

async function startRollServer(
  storage: MemStorage,
  broadcaster: RecordingBroadcaster,
  random: () => number,
): Promise<string> {
  const app = express();
  app.use(express.json());
  app.use(
    createSpiritDiceRouter(storage, broadcaster, {
      random,
      now: () => new Date("2026-07-13T12:00:00.000Z"),
    }),
  );
  app.use(apiErrorHandler);

  const server = createServer(app);
  servers.add(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function createCharacterWithTechnique(
  storage: MemStorage,
  highestAbilityScore: number | null = 18,
) {
  const character = await storage.createCharacterWithSpiritDice({
    name: "Raan",
    path: "Path of Gluttony",
    level: 8,
    highestAbilityScore,
  });
  const technique = await storage.createTechnique({
    characterId: character.id,
    name: "Devour Essence",
    triggerDescription: "Consume a defeated foe.",
    spEffects: {
      "2": {
        effect: "Deal damage and restore vitality.",
        actionType: "action",
        mechanics: {
          version: 2,
          actions: [
            {
              id: "523240f5-7433-4e0b-876c-c209ad3b310a",
              kind: "roll_damage",
              formula: "2d8 + 4",
              damageType: "necrotic",
              label: "Essence damage",
              savingThrow: { ability: "dex" },
              template: { type: "circle", distance: 20 },
            },
            {
              id: "af51a725-e3a2-40ea-b016-cc7040df091c",
              kind: "roll_healing",
              formula: "1d8 + 3",
            },
          ],
        },
      },
    },
  });
  return { character, technique };
}

async function roll(
  baseUrl: string,
  characterId: string,
  techniqueId: string,
): Promise<Response> {
  return fetch(`${baseUrl}/api/character/${characterId}/roll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spInvestment: 2, dieIndex: 0, techniqueId }),
  });
}

test("a technique roll broadcasts each stored action after the Spirit Die event", async () => {
  const storage = new MemStorage(null);
  const { character, technique } = await createCharacterWithTechnique(storage);
  const broadcaster = new RecordingBroadcaster();
  const baseUrl = await startRollServer(storage, broadcaster, () => 0.99);

  const response = await roll(baseUrl, character.id, technique.id);
  assert.equal(response.status, 200);
  assert.equal(broadcaster.spiritRolls.length, 1);
  assert.equal(broadcaster.spiritRolls[0].data.roll.success, true);
  assert.equal(broadcaster.foundryActions.length, 2);

  const [damage, healing] = broadcaster.foundryActions;
  assert.equal(
    damage.data.sourceRollEventId,
    broadcaster.spiritRolls[0].eventId,
  );
  assert.equal(
    healing.data.sourceRollEventId,
    broadcaster.spiritRolls[0].eventId,
  );
  assert.equal(damage.data.technique.id, technique.id);
  assert.equal(damage.data.character.id, character.id);
  assert.equal(damage.data.character.spiritualArtsDc, 15);
  assert.equal(
    Object.hasOwn(healing.data.character, "spiritualArtsDc"),
    false,
  );
  assert.equal(damage.data.spInvestment, 2);
  assert.deepEqual(damage.data.action, technique.spEffects["2"].mechanics?.actions[0]);
  assert.deepEqual(healing.data.action, technique.spEffects["2"].mechanics?.actions[1]);
  assert.notEqual(damage.eventId, healing.eventId);
  assert.equal(damage.data.requestedAt, "2026-07-13T12:00:00.000Z");
});

test("a failed Spirit Die roll still broadcasts each stored Foundry action", async () => {
  const storage = new MemStorage(null);
  const { character, technique } = await createCharacterWithTechnique(storage);
  const broadcaster = new RecordingBroadcaster();
  const baseUrl = await startRollServer(storage, broadcaster, () => 0);

  const response = await roll(baseUrl, character.id, technique.id);
  assert.equal(response.status, 200);
  assert.equal(broadcaster.spiritRolls[0].data.roll.success, false);
  assert.equal(broadcaster.foundryActions.length, 2);
  assert.equal(
    broadcaster.foundryActions[0].data.sourceRollEventId,
    broadcaster.spiritRolls[0].eventId,
  );
  assert.deepEqual(
    broadcaster.foundryActions.map(({ data }) => data.action),
    technique.spEffects["2"].mechanics?.actions,
  );
});

test("Foundry actions report an unavailable DC when the character has not configured it", async () => {
  const storage = new MemStorage(null);
  const { character, technique } = await createCharacterWithTechnique(storage, null);
  const broadcaster = new RecordingBroadcaster();
  const baseUrl = await startRollServer(storage, broadcaster, () => 0.99);

  const response = await roll(baseUrl, character.id, technique.id);
  assert.equal(response.status, 200);
  assert.equal(broadcaster.foundryActions.length, 2);
  assert.equal(broadcaster.foundryActions[0].data.character.spiritualArtsDc, null);
});

test("a roll for a mechanics-free tier broadcasts no Foundry actions", async () => {
  const storage = new MemStorage(null);
  const character = await storage.createCharacterWithSpiritDice({
    name: "Legacy",
    path: "Legacy Path",
    level: 8,
  });
  const technique = await storage.createTechnique({
    characterId: character.id,
    name: "Legacy Technique",
    triggerDescription: "Trigger.",
    spEffects: {
      "2": { effect: "Effect.", actionType: "action" },
    },
  });
  const broadcaster = new RecordingBroadcaster();
  const baseUrl = await startRollServer(storage, broadcaster, () => 0.99);

  const response = await roll(baseUrl, character.id, technique.id);
  assert.equal(response.status, 200);
  assert.equal(broadcaster.spiritRolls[0].data.roll.success, true);
  assert.deepEqual(broadcaster.foundryActions, []);
});

test("a technique owned by another character cannot trigger Foundry actions", async () => {
  const storage = new MemStorage(null);
  const owner = await createCharacterWithTechnique(storage);
  const rollingCharacter = await storage.createCharacterWithSpiritDice({
    name: "Other",
    path: "Other Path",
    level: 8,
  });
  const broadcaster = new RecordingBroadcaster();
  const baseUrl = await startRollServer(storage, broadcaster, () => 0.99);

  const response = await roll(
    baseUrl,
    rollingCharacter.id,
    owner.technique.id,
  );
  assert.equal(response.status, 200);
  assert.equal(broadcaster.spiritRolls[0].data.roll.techniqueId, null);
  assert.deepEqual(broadcaster.foundryActions, []);
});

test("roll requests cannot inject client-supplied mechanics", async () => {
  const storage = new MemStorage(null);
  const { character, technique } = await createCharacterWithTechnique(storage);
  const broadcaster = new RecordingBroadcaster();
  const baseUrl = await startRollServer(storage, broadcaster, () => 0.99);

  const response = await fetch(
    `${baseUrl}/api/character/${character.id}/roll`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spInvestment: 2,
        dieIndex: 0,
        techniqueId: technique.id,
        mechanics: {
          version: 1,
          actions: [
            {
              id: randomUUID(),
              kind: "roll_damage",
              formula: "100d1000",
              damageType: "force",
            },
          ],
        },
      }),
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(broadcaster.spiritRolls, []);
  assert.deepEqual(broadcaster.foundryActions, []);
});
