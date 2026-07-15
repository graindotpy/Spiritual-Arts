import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { afterEach, test } from "node:test";
import express from "express";
import type { InstrumentFoundryActionRequestData } from "@shared/realtime";
import type { FoundryMechanics } from "@shared/schema";
import { apiErrorHandler } from "../http/errors";
import { MemStorage } from "../storage/memory-storage";
import type { InstrumentActionBroadcaster } from "../websocket";
import { createInstrumentRouter } from "./instruments";

const INVOCATION_ID = "15f60104-1654-4b6e-9c1b-d62e5a0b5199";
const REQUESTED_AT = "2026-07-15T12:00:00.000Z";
const INSTRUMENT_ACTION_ID = "c11af797-bad8-4566-a5f8-455420f70db4";

const mechanics: FoundryMechanics = {
  version: 5,
  actions: [
    {
      id: "523240f5-7433-4e0b-876c-c209ad3b310a",
      kind: "roll_damage",
      formula: "2d8 + 4",
      damageType: "radiant",
      label: "Lantern burst",
      savingThrow: { ability: "dex" },
    },
    {
      id: "af51a725-e3a2-40ea-b016-cc7040df091c",
      kind: "roll_healing",
      formula: "1d8 + 3",
    },
    {
      id: "19b956a4-3a17-49f2-bcdc-e156b2fe416f",
      kind: "saving_throw",
      label: "Resist the light",
      savingThrow: { ability: "con" },
    },
    {
      id: "34109839-d482-4ef7-bde4-98ce40d330f2",
      kind: "roll_attack",
      label: "Lantern ray",
    },
    {
      id: "75ca2097-da4f-4875-98d2-15863caa83b3",
      kind: "place_template",
      label: "Lantern aura",
      template: { type: "circle", distance: 20 },
    },
  ],
};

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

class RecordingInstrumentBroadcaster implements InstrumentActionBroadcaster {
  readonly requests: InstrumentFoundryActionRequestData[] = [];

  broadcastInstrumentFoundryAction(
    data: InstrumentFoundryActionRequestData,
  ): string {
    this.requests.push(structuredClone(data));
    return randomUUID();
  }
}

async function startInstrumentServer(
  storage: MemStorage,
  broadcaster: InstrumentActionBroadcaster,
): Promise<string> {
  const app = express();
  app.use(express.json());
  app.use(
    createInstrumentRouter(storage, broadcaster, {
      now: () => new Date(REQUESTED_AT),
      randomUuid: () => INVOCATION_ID,
    }),
  );
  app.use(apiErrorHandler);

  const server = createServer(app);
  servers.add(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function createAssignedInstrument(
  storage: MemStorage,
  options: {
    highestAbilityScore?: number | null;
    isRevealed?: boolean;
    mechanics?: FoundryMechanics;
  } = {},
) {
  const character = await storage.createCharacterWithSpiritDice({
    name: "Raan",
    path: "Path of Gluttony",
    level: 8,
    highestAbilityScore:
      options.highestAbilityScore === undefined
        ? 18
        : options.highestAbilityScore,
  });
  const instrument = await storage.createSpiritualInstrument({
    name: "Ghost Lantern",
    description: "A lantern that burns with spirit light.",
    isRevealed: options.isRevealed ?? true,
    actions: [
      {
        id: INSTRUMENT_ACTION_ID,
        name: "Lantern Burst",
        description: "Release the lantern's stored light.",
        actionType: "action",
        ...(options.mechanics ? { mechanics: options.mechanics } : {}),
      },
    ],
  });
  await storage.setSpiritualInstrumentAssignments(instrument.id, [character.id]);
  return { character, instrument };
}

function useUrl(
  baseUrl: string,
  characterId: string,
  instrumentId: string,
  actionId = INSTRUMENT_ACTION_ID,
): string {
  return `${baseUrl}/api/character/${characterId}/instruments/${instrumentId}/actions/${actionId}/use`;
}

test("using an assigned instrument action broadcasts every stored Foundry action without consuming a Spirit Die", async () => {
  const storage = new MemStorage(null);
  const { character, instrument } = await createAssignedInstrument(storage, {
    mechanics,
  });
  const poolBefore = await storage.getSpiritDiePool(character.id);
  const broadcaster = new RecordingInstrumentBroadcaster();
  const baseUrl = await startInstrumentServer(storage, broadcaster);

  const response = await fetch(useUrl(baseUrl, character.id, instrument.id), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    invocationId: INVOCATION_ID,
    actionCount: mechanics.actions.length,
  });
  assert.equal(broadcaster.requests.length, mechanics.actions.length);
  assert.deepEqual(await storage.getSpiritDiePool(character.id), poolBefore);

  for (const request of broadcaster.requests) {
    assert.equal(request.requestedAt, REQUESTED_AT);
    assert.equal(request.sourceUseId, INVOCATION_ID);
    assert.deepEqual(request.instrument, {
      id: instrument.id,
      name: instrument.name,
    });
    assert.deepEqual(request.instrumentAction, {
      id: INSTRUMENT_ACTION_ID,
      name: "Lantern Burst",
    });
    assert.equal(request.character.id, character.id);
  }

  const [damage, healing, savingThrow, attack, template] = broadcaster.requests;
  assert.equal(damage.character.spiritualArtsDc, 15);
  assert.equal(Object.hasOwn(damage.character, "spiritualArtsAttackModifier"), false);
  assert.equal(Object.hasOwn(healing.character, "spiritualArtsDc"), false);
  assert.equal(savingThrow.character.spiritualArtsDc, 15);
  assert.equal(attack.character.spiritualArtsAttackModifier, 7);
  assert.equal(Object.hasOwn(attack.character, "spiritualArtsDc"), false);
  assert.equal(Object.hasOwn(template.character, "spiritualArtsDc"), false);
  assert.deepEqual(
    broadcaster.requests.map(({ action }) => action),
    mechanics.actions,
  );
});

test("hidden assigned instruments remain usable and missing ability scores produce null derived values", async () => {
  const storage = new MemStorage(null);
  const { character, instrument } = await createAssignedInstrument(storage, {
    highestAbilityScore: null,
    isRevealed: false,
    mechanics,
  });
  const broadcaster = new RecordingInstrumentBroadcaster();
  const baseUrl = await startInstrumentServer(storage, broadcaster);

  const response = await fetch(useUrl(baseUrl, character.id, instrument.id), {
    method: "POST",
  });
  assert.equal(response.status, 200);
  assert.equal(broadcaster.requests[0].character.spiritualArtsDc, null);
  assert.equal(broadcaster.requests[2].character.spiritualArtsDc, null);
  assert.equal(
    broadcaster.requests[3].character.spiritualArtsAttackModifier,
    null,
  );
});

test("an assigned action with no mechanics succeeds without broadcasting", async () => {
  const storage = new MemStorage(null);
  const { character, instrument } = await createAssignedInstrument(storage);
  const broadcaster = new RecordingInstrumentBroadcaster();
  const baseUrl = await startInstrumentServer(storage, broadcaster);

  const response = await fetch(useUrl(baseUrl, character.id, instrument.id), {
    method: "POST",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    invocationId: INVOCATION_ID,
    actionCount: 0,
  });
  assert.deepEqual(broadcaster.requests, []);
});

test("instrument use is scoped to the persisted character, assignment, instrument, and action IDs", async () => {
  const storage = new MemStorage(null);
  const { character: owner, instrument } = await createAssignedInstrument(storage, {
    mechanics,
  });
  const otherCharacter = await storage.createCharacterWithSpiritDice({
    name: "Other Bearer",
    path: "Other Path",
    level: 5,
  });
  const otherInstrument = await storage.createSpiritualInstrument({
    name: "Other Instrument",
    description: "Not the requested instrument.",
    actions: [
      {
        id: "0615c0d7-490b-4ac6-abfe-14ca5420bace",
        name: "Other Action",
        description: "Belongs to another instrument.",
        actionType: "action",
        mechanics,
      },
    ],
  });
  await storage.setSpiritualInstrumentAssignments(otherInstrument.id, [owner.id]);
  const broadcaster = new RecordingInstrumentBroadcaster();
  const baseUrl = await startInstrumentServer(storage, broadcaster);

  const cases = [
    useUrl(baseUrl, otherCharacter.id, instrument.id),
    useUrl(
      baseUrl,
      owner.id,
      instrument.id,
      "0615c0d7-490b-4ac6-abfe-14ca5420bace",
    ),
    useUrl(baseUrl, randomUUID(), instrument.id),
    useUrl(baseUrl, owner.id, randomUUID()),
    useUrl(baseUrl, owner.id, instrument.id, randomUUID()),
  ];

  for (const url of cases) {
    const response = await fetch(url, { method: "POST" });
    assert.equal(response.status, 404, url);
  }

  await storage.setSpiritualInstrumentAssignments(instrument.id, []);
  const unassigned = await fetch(useUrl(baseUrl, owner.id, instrument.id), {
    method: "POST",
  });
  assert.equal(unassigned.status, 404);
  assert.deepEqual(broadcaster.requests, []);
});

test("instrument use rejects client-supplied mechanics and malformed identifiers", async () => {
  const storage = new MemStorage(null);
  const { character, instrument } = await createAssignedInstrument(storage, {
    mechanics,
  });
  const broadcaster = new RecordingInstrumentBroadcaster();
  const baseUrl = await startInstrumentServer(storage, broadcaster);

  const injected = await fetch(useUrl(baseUrl, character.id, instrument.id), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mechanics: {
        version: 5,
        actions: [
          {
            id: randomUUID(),
            kind: "roll_damage",
            formula: "999d20",
          },
        ],
      },
    }),
  });
  assert.equal(injected.status, 400);
  assert.match(
    String((await injected.json() as { message: string }).message),
    /accepts no client-provided data/,
  );

  const nullBody = await fetch(useUrl(baseUrl, character.id, instrument.id), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "null",
  });
  assert.equal(nullBody.status, 400);

  const malformed = await fetch(
    useUrl(baseUrl, "not-a-uuid", instrument.id),
    { method: "POST" },
  );
  assert.equal(malformed.status, 400);
  assert.deepEqual(broadcaster.requests, []);
});
