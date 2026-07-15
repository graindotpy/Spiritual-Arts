import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import express from "express";
import { apiErrorHandler } from "../http/errors";
import { registerRoutes } from "../routes";
import { MemStorage } from "../storage/memory-storage";
import { ImageStore } from "../uploads/image-store";

let baseUrl: string;
let closeServer: () => Promise<void>;
let uploadsRoot: string;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  uploadsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "spiritual-arts-routes-"));
  const server = await registerRoutes(
    app,
    new MemStorage(null),
    new ImageStore(uploadsRoot),
  );
  app.use(apiErrorHandler);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  closeServer = () => new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

after(async () => {
  await closeServer();
  await fs.rm(uploadsRoot, { recursive: true, force: true });
});

async function jsonRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = (await response.json()) as Record<string, unknown>;
  return { response, body };
}

test("character creation also creates its level-based spirit pool", async () => {
  const created = await jsonRequest("/api/character", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", path: "Path", level: 3 }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.name, "Test");

  const pool = await jsonRequest(
    `/api/character/${String(created.body.id)}/spirit-die-pool`,
  );
  assert.equal(pool.response.status, 200);
  assert.deepEqual(pool.body.currentDice, ["d4", "d4"]);
});

test("level updates reconcile the pool in the same server operation", async () => {
  const created = await jsonRequest("/api/character", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Level Test", path: "Path", level: 3 }),
  });
  const id = String(created.body.id);

  const updated = await jsonRequest(`/api/character/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ level: 10 }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.level, 10);

  const pool = await jsonRequest(`/api/character/${id}/spirit-die-pool`);
  assert.deepEqual(pool.body.currentDice, ["d6", "d8"]);
  assert.equal(pool.body.overrideDice, null);
});

test("strict request DTOs reject immutable fields and invalid roll values", async () => {
  const created = await jsonRequest("/api/character", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Validation", path: "Path", level: 3 }),
  });
  const id = String(created.body.id);

  const massAssignment = await jsonRequest(`/api/character/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ portraitUrl: "/uploads/portraits/not-server-generated.png" }),
  });
  assert.equal(massAssignment.response.status, 400);

  const invalidRoll = await jsonRequest(`/api/character/${id}/roll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spInvestment: "2", dieIndex: 0 }),
  });
  assert.equal(invalidRoll.response.status, 400);

  const unsupportedRoll = await jsonRequest(`/api/character/${id}/roll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spInvestment: 6, dieIndex: 0 }),
  });
  assert.equal(unsupportedRoll.response.status, 400);
  assert.match(String(unsupportedRoll.body.message), /D4 cannot power a 6 SP technique/);

  const unchangedPool = await jsonRequest(`/api/character/${id}/spirit-die-pool`);
  assert.deepEqual(unchangedPool.body.currentDice, ["d4", "d4"]);

  const emptyUpdate = await jsonRequest(`/api/character/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(emptyUpdate.response.status, 400);
});

test("malformed JSON and unknown API endpoints receive normalized 400/404 responses", async () => {
  const nullBody = await jsonRequest("/api/character", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "null",
  });
  assert.equal(nullBody.response.status, 400);

  const malformed = await jsonRequest("/api/character", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.response.status, 400);
  assert.equal(malformed.body.message, "Invalid JSON body");

  const missing = await jsonRequest("/api/does-not-exist");
  assert.equal(missing.response.status, 404);
  assert.equal(missing.body.message, "API endpoint not found");
});

test("DM characters stay private, receive dice, and can be deleted", async () => {
  const created = await jsonRequest("/api/dm/dm-test/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Hidden NPC", path: "Guide", level: 5 }),
  });
  assert.equal(created.response.status, 201);
  const id = String(created.body.id);

  const dmCharacters = await jsonRequest("/api/dm/dm-test/characters");
  assert.equal(dmCharacters.response.status, 200);
  assert.equal(
    (dmCharacters.body as unknown as Array<{ id: string }>).some(
      (character) => character.id === id,
    ),
    true,
  );

  const publicCharacters = await jsonRequest("/api/characters");
  assert.equal(
    (publicCharacters.body as unknown as Array<{ id: string }>).some(
      (character) => character.id === id,
    ),
    false,
  );

  const pool = await jsonRequest(`/api/character/${id}/spirit-die-pool`);
  assert.equal(pool.response.status, 200);

  const deleted = await jsonRequest(`/api/character/${id}`, { method: "DELETE" });
  assert.equal(deleted.response.status, 200);
  const missing = await jsonRequest(`/api/character/${id}`);
  assert.equal(missing.response.status, 404);
});

test("card game state is persisted and stale writes receive a conflict", async () => {
  const empty = await jsonRequest("/api/card-game/state");
  assert.equal(empty.response.status, 200);
  assert.equal(empty.body.state, null);

  const saved = await jsonRequest("/api/card-game/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: { cards: [], updatedAt: 0 } }),
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.success, true);
  assert.equal(typeof saved.body.updatedAt, "number");

  const stale = await jsonRequest("/api/card-game/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: { cards: [{ id: "stale" }], updatedAt: 0 } }),
  });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.body.conflict, true);
});

test("card uploads use their isolated image namespace", async () => {
  const form = new FormData();
  form.append(
    "image",
    new Blob([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ]),
    "untrusted.svg",
  );

  const response = await fetch(`${baseUrl}/api/upload/card-image`, {
    method: "POST",
    body: form,
  });
  assert.equal(response.status, 201);
  const body = (await response.json()) as { url: string };
  assert.match(body.url, /^\/uploads\/card-images\/image-[\w-]+\.png$/);
  assert.equal((await fetch(`${baseUrl}${body.url}`)).status, 200);
});

test("instrument vault hides drafts and supports many-character assignments", async () => {
  const firstCharacter = await jsonRequest("/api/character", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Bearer One", path: "Path", level: 3 }),
  });
  const secondCharacter = await jsonRequest("/api/character", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Bearer Two", path: "Path", level: 3 }),
  });
  const created = await jsonRequest("/api/instruments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Ghost Lantern",
      description: "Reveals spiritual traces.",
      isRevealed: false,
    }),
  });
  assert.equal(created.response.status, 201);
  assert.deepEqual(created.body.actions, []);
  assert.equal(created.body.expandedContent, null);
  assert.equal(created.body.hasExpandedContent, false);

  const publicList = await jsonRequest("/api/instruments");
  assert.deepEqual(publicList.body, []);
  const dmList = await jsonRequest("/api/instruments?includeHidden=true");
  assert.equal((dmList.body as unknown as unknown[]).length, 1);

  const assigned = await jsonRequest(`/api/instruments/${String(created.body.id)}/assignments`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      characterIds: [String(firstCharacter.body.id), String(secondCharacter.body.id)],
    }),
  });
  assert.deepEqual(assigned.body.characterIds, [firstCharacter.body.id, secondCharacter.body.id]);

  const richContent = JSON.stringify({
    blocks: [{
      id: "instrument-notes",
      type: "text",
      content: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Resonance" }] },
          { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Listen for the bell." }] }] },
          { type: "horizontalRule" },
        ],
      },
    }],
  });
  const enhanced = await jsonRequest(`/api/instruments/${String(created.body.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expandedContent: richContent, hasExpandedContent: true }),
  });
  assert.equal(enhanced.response.status, 200);
  assert.equal(enhanced.body.expandedContent, richContent);
  assert.equal(enhanced.body.hasExpandedContent, true);

  const invalidEnhanced = await jsonRequest(`/api/instruments/${String(created.body.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expandedContent: "not structured json" }),
  });
  assert.equal(invalidEnhanced.response.status, 400);

  const revealed = await jsonRequest(`/api/instruments/${String(created.body.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isRevealed: true }),
  });
  assert.equal(revealed.body.isRevealed, true);
  const revealedList = await jsonRequest("/api/instruments");
  assert.equal((revealedList.body as unknown as unknown[]).length, 1);
  assert.equal(
    (revealedList.body as unknown as Array<{ expandedContent: string }>)[0]?.expandedContent,
    richContent,
  );
});

test("instrument actions round trip and reject invalid nested data", async () => {
  const instrumentActionId = "9896ef77-4c9a-42c7-bd2d-9599c3906aad";
  const foundryActionId = "8af9492a-fbbc-489e-9b8d-2fc07868e01c";
  const passiveActionId = "d3750fb1-2485-4882-b7df-9361038fa0eb";
  const richDescription = JSON.stringify({
    type: "doc",
    content: [{
      type: "paragraph",
      content: [
        { type: "text", text: "Release the light stored inside the lantern." },
      ],
    }],
  });
  const actions = [
    {
      id: instrumentActionId,
      name: "Lantern Burst",
      description: richDescription,
      actionType: "action",
      mechanics: {
        version: 5,
        actions: [{
          id: foundryActionId,
          kind: "roll_damage",
          formula: "2d6 + 3",
          damageType: "radiant",
        }],
      },
    },
    {
      id: passiveActionId,
      name: "Spirit Sight",
      description: "You can see nearby spiritual traces.",
      actionType: "passive",
    },
  ];

  const created = await jsonRequest("/api/instruments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Action Lantern",
      description: "A lantern with a will of its own.",
      actions,
    }),
  });
  assert.equal(created.response.status, 201);
  assert.deepEqual(created.body.actions, actions);

  const replacementActions = [{
    ...actions[1],
    actionType: "reaction",
  }];
  const updated = await jsonRequest(`/api/instruments/${String(created.body.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actions: replacementActions }),
  });
  assert.equal(updated.response.status, 200);
  assert.deepEqual(updated.body.actions, replacementActions);

  const listed = await jsonRequest("/api/instruments?includeHidden=true");
  const persisted = (listed.body as unknown as Array<{ id: string; actions: unknown }>).find(
    (instrument) => instrument.id === created.body.id,
  );
  assert.deepEqual(persisted?.actions, replacementActions);

  const duplicateIds = await jsonRequest(`/api/instruments/${String(created.body.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actions: [actions[1], actions[1]] }),
  });
  assert.equal(duplicateIds.response.status, 400);

  const unknownActionField = await jsonRequest(
    `/api/instruments/${String(created.body.id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actions: [{ ...actions[1], unsupported: true }],
      }),
    },
  );
  assert.equal(unknownActionField.response.status, 400);

  const invalidFoundryMechanics = await jsonRequest(
    `/api/instruments/${String(created.body.id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actions: [{
          ...actions[0],
          mechanics: {
            version: 5,
            actions: [{
              id: foundryActionId,
              kind: "roll_damage",
              formula: "game.macros.getName('unsafe').execute()",
              damageType: "radiant",
            }],
          },
        }],
      }),
    },
  );
  assert.equal(invalidFoundryMechanics.response.status, 400);

  const emptyRichText = await jsonRequest(`/api/instruments/${String(created.body.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actions: [{
        ...actions[1],
        description: JSON.stringify({
          type: "doc",
          content: [{ type: "paragraph", content: [] }],
        }),
      }],
    }),
  });
  assert.equal(emptyRichText.response.status, 400);
});

test("technique mechanics round trip while mechanics-free techniques remain valid", async () => {
  const createdCharacter = await jsonRequest("/api/character", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Mechanist", path: "Foundry Path", level: 8 }),
  });
  const characterId = String(createdCharacter.body.id);
  const actionId = "523240f5-7433-4e0b-876c-c209ad3b310a";
  const saveOnlyActionId = "19b956a4-3a17-49f2-bcdc-e156b2fe416f";
  const attackActionId = "34109839-d482-4ef7-bde4-98ce40d330f2";
  const templateActionId = "75ca2097-da4f-4875-98d2-15863caa83b3";

  const created = await jsonRequest(`/api/character/${characterId}/techniques`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: " Devour Essence ",
      triggerDescription: "Consume a target.",
      spEffects: {
        "2": {
          effect: "Deal damage.",
          actionType: "action",
          mechanics: {
            version: 5,
            actions: [
              {
                id: actionId,
                kind: "roll_damage",
                formula: " 2d8 + 4 ",
                damageType: "necrotic",
                label: " Devour Essence ",
                savingThrow: { ability: "dex" },
                template: { type: "circle", distance: 20 },
              },
              {
                id: saveOnlyActionId,
                kind: "saving_throw",
                label: "Resist the pull",
                savingThrow: { ability: "str" },
                template: { type: "cone", distance: 15, angle: 53.13 },
              },
              {
                id: attackActionId,
                kind: "roll_attack",
                label: " Essence strike ",
              },
              {
                id: templateActionId,
                kind: "place_template",
                label: " Difficult terrain ",
                template: { type: "rectangle", distance: 20 },
              },
            ],
          },
        },
      },
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.name, "Devour Essence");
  const createdEffects = created.body.spEffects as Record<
    string,
    { mechanics?: { version: number; actions: Array<Record<string, unknown>> } }
  >;
  assert.equal(createdEffects["2"].mechanics?.version, 5);
  assert.deepEqual(createdEffects["2"].mechanics?.actions[0], {
    id: actionId,
    kind: "roll_damage",
    formula: "2d8 + 4",
    damageType: "necrotic",
    label: "Devour Essence",
    savingThrow: { ability: "dex" },
    template: { type: "circle", distance: 20 },
  });
  assert.deepEqual(createdEffects["2"].mechanics?.actions[1], {
    id: saveOnlyActionId,
    kind: "saving_throw",
    label: "Resist the pull",
    savingThrow: { ability: "str" },
    template: { type: "cone", distance: 15, angle: 53.13 },
  });
  assert.deepEqual(createdEffects["2"].mechanics?.actions[2], {
    id: attackActionId,
    kind: "roll_attack",
    label: "Essence strike",
  });
  assert.deepEqual(createdEffects["2"].mechanics?.actions[3], {
    id: templateActionId,
    kind: "place_template",
    label: "Difficult terrain",
    template: { type: "rectangle", distance: 20 },
  });

  const listed = await jsonRequest(`/api/character/${characterId}/techniques`);
  const techniques = listed.body as unknown as Array<{
    id: string;
    spEffects: typeof createdEffects;
  }>;
  assert.deepEqual(
    techniques.find((technique) => technique.id === created.body.id)?.spEffects,
    createdEffects,
  );

  const mechanicsFree = await jsonRequest(
    `/api/character/${characterId}/techniques`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Legacy Technique",
        triggerDescription: "Existing trigger.",
        spEffects: {
          "1": { effect: "Existing effect.", actionType: "reaction" },
        },
      }),
    },
  );
  assert.equal(mechanicsFree.response.status, 201);
  const mechanicsFreeEffects = mechanicsFree.body.spEffects as Record<
    string,
    Record<string, unknown>
  >;
  assert.equal("mechanics" in mechanicsFreeEffects["1"], false);
});

test("technique APIs reject malformed Foundry mechanics", async () => {
  const createdCharacter = await jsonRequest("/api/character", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Validator", path: "Foundry Path", level: 8 }),
  });
  const characterId = String(createdCharacter.body.id);
  const actionId = "523240f5-7433-4e0b-876c-c209ad3b310a";
  const validAction = {
    id: actionId,
    kind: "roll_damage",
    formula: "2d8 + 4",
    damageType: "necrotic",
  };
  const invalidMechanics: unknown[] = [
    { version: 6, actions: [] },
    { version: 1, actions: [], future: true },
    { version: 1, actions: [{ ...validAction, kind: "run_macro" }] },
    { version: 1, actions: [{ ...validAction, script: "return 42" }] },
    { version: 1, actions: [{ ...validAction, formula: "@mod + 1d6" }] },
    {
      version: 2,
      actions: [{ ...validAction, savingThrow: { ability: "luck" } }],
    },
    {
      version: 2,
      actions: [{ ...validAction, template: { type: "circle", distance: 0 } }],
    },
    {
      version: 2,
      actions: [
        {
          id: actionId,
          kind: "saving_throw",
          savingThrow: { ability: "str" },
        },
      ],
    },
    {
      version: 3,
      actions: [{ id: actionId, kind: "saving_throw" }],
    },
    {
      version: 3,
      actions: [
        {
          id: actionId,
          kind: "saving_throw",
          savingThrow: { ability: "str" },
          formula: "1d20",
        },
      ],
    },
    {
      version: 3,
      actions: [{ id: actionId, kind: "roll_attack" }],
    },
    {
      version: 4,
      actions: [
        { id: actionId, kind: "roll_attack", formula: "1d20 + 7" },
      ],
    },
    {
      version: 4,
      actions: [
        {
          id: actionId,
          kind: "place_template",
          template: { type: "circle", distance: 15 },
        },
      ],
    },
    {
      version: 1,
      actions: [{ id: actionId, kind: "roll_damage", formula: "1d6" }],
    },
    {
      version: 1,
      actions: [
        {
          id: actionId,
          kind: "roll_healing",
          formula: "1d6",
          damageType: "radiant",
        },
      ],
    },
    {
      version: 1,
      actions: Array.from({ length: 11 }, (_, index) => ({
        ...validAction,
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      })),
    },
    {
      version: 1,
      actions: [{ ...validAction, label: "x".repeat(256) }],
    },
  ];

  for (const mechanics of invalidMechanics) {
    const response = await jsonRequest(
      `/api/character/${characterId}/techniques`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Invalid mechanics",
          triggerDescription: "Trigger.",
          spEffects: {
            "2": {
              effect: "Effect.",
              actionType: "action",
              mechanics,
            },
          },
        }),
      },
    );
    assert.equal(response.response.status, 400, JSON.stringify(mechanics));
  }

  const unknownTierField = await jsonRequest(
    `/api/character/${characterId}/techniques`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Unknown tier field",
        triggerDescription: "Trigger.",
        spEffects: {
          "2": {
            effect: "Effect.",
            actionType: "action",
            macro: "not allowed",
          },
        },
      }),
    },
  );
  assert.equal(unknownTierField.response.status, 400);
});
