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
