import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import express from "express";
import { apiErrorHandler } from "../http/errors";
import { registerRoutes } from "../routes";
import { MemStorage } from "../storage/memory-storage";

let baseUrl: string;
let closeServer: () => Promise<void>;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  const server = await registerRoutes(app, new MemStorage(null));
  app.use(apiErrorHandler);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  closeServer = () => new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

after(async () => closeServer());

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
