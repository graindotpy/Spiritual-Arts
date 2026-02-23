import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { sendFoundryWebhook, type FoundryRollPayload } from "./foundry";

function payload(): FoundryRollPayload {
  return {
    character: {
      id: "c1",
      name: "Aiko",
      path: "Way of Wind",
      level: 5,
      portraitUrl: null,
    },
    roll: {
      spInvestment: 3,
      dieSize: "d8",
      dieIndex: 0,
      value: 6,
      success: true,
      techniqueId: null,
      techniqueName: "Gale Step",
      timestamp: new Date().toISOString(),
    },
    source: "spiritual-arts",
    version: 1,
  };
}

async function withServer(handler: (req: http.IncomingMessage, body: string) => void) {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      handler(req, body);
      res.statusCode = 202;
      res.end("ok");
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve server address");
  }

  return {
    url: `http://127.0.0.1:${address.port}/webhook`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

const originalEnv = { ...process.env };

test.afterEach(() => {
  process.env = { ...originalEnv };
});

test("sendFoundryWebhook posts payload and bearer token", async () => {
  let seenAuth = "";
  let seenBody = "";
  const srv = await withServer((req, body) => {
    seenAuth = req.headers.authorization || "";
    seenBody = body;
  });

  process.env.FOUNDRY_ENABLED = "true";
  process.env.FOUNDRY_WEBHOOK_URL = srv.url;
  process.env.FOUNDRY_WEBHOOK_TOKEN = "secret-token";

  await sendFoundryWebhook(payload());
  await srv.close();

  assert.equal(seenAuth, "Bearer secret-token");
  const parsed = JSON.parse(seenBody);
  assert.equal(parsed.character.name, "Aiko");
  assert.equal(parsed.source, "spiritual-arts");
});

test("sendFoundryWebhook skips when disabled", async () => {
  let hitCount = 0;
  const srv = await withServer(() => {
    hitCount += 1;
  });

  process.env.FOUNDRY_ENABLED = "false";
  process.env.FOUNDRY_WEBHOOK_URL = srv.url;

  await sendFoundryWebhook(payload());
  await new Promise((resolve) => setTimeout(resolve, 100));
  await srv.close();

  assert.equal(hitCount, 0);
});

test("sendFoundryWebhook returns cleanly when URL missing", async () => {
  delete process.env.FOUNDRY_WEBHOOK_URL;
  process.env.FOUNDRY_ENABLED = "true";

  await assert.doesNotReject(async () => {
    await sendFoundryWebhook(payload());
  });
});
