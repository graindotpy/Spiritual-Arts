import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";
import type {
  FoundrySessionResponse,
  FoundrySessionStatus,
  FoundryStopReason,
} from "@shared/foundry-session";
import { FoundryControlAuth } from "../foundry/control-auth";
import { apiErrorHandler } from "../http/errors";
import {
  createFoundrySessionRouter,
  type FoundrySessionController,
} from "./foundry-session";

const readyStatus: FoundrySessionStatus = {
  configured: true,
  state: "ready",
  startedAt: "2026-07-15T12:00:00.000Z",
  readyAt: "2026-07-15T12:00:03.000Z",
  expiresAt: "2026-07-15T20:00:00.000Z",
  stoppedAt: null,
  stopReason: null,
  failure: null,
  bridgeUser: "Website Bridge",
};

class FakeFoundryController implements FoundrySessionController {
  current = { ...readyStatus };
  starts = 0;
  stops = 0;

  status(): FoundrySessionStatus {
    return { ...this.current };
  }

  start(): FoundrySessionStatus {
    this.starts += 1;
    this.current = { ...this.current, state: "starting", readyAt: null };
    return this.status();
  }

  async stop(reason: FoundryStopReason = "requested") {
    this.stops += 1;
    this.current = {
      ...this.current,
      state: "stopped",
      expiresAt: null,
      stopReason: reason,
    };
    return this.status();
  }
}

interface TestServer {
  baseUrl: string;
  close(): Promise<void>;
}

async function startServer(
  controller: FoundrySessionController,
  auth: FoundryControlAuth,
): Promise<TestServer> {
  const app = express();
  app.use(express.json());
  app.use(createFoundrySessionRouter(controller, auth));
  app.use(apiErrorHandler);

  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function json(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<{ response: Response; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = (await response.json()) as Record<string, unknown>;
  return { response, body };
}

test("Foundry controls redact status and require server-side authorization", async () => {
  const controller = new FakeFoundryController();
  const auth = new FoundryControlAuth({ password: "control secret" });
  const server = await startServer(controller, auth);

  try {
    const publicStatus = await json(server.baseUrl, "/api/foundry-session");
    assert.equal(publicStatus.response.status, 200);
    assert.deepEqual(publicStatus.body, {
      authenticated: false,
      session: {
        configured: true,
        state: "stopped",
        startedAt: null,
        readyAt: null,
        expiresAt: null,
        stoppedAt: null,
        stopReason: null,
        failure: null,
        bridgeUser: null,
      },
    });

    const missingHeader = await json(
      server.baseUrl,
      "/api/foundry-session/connect",
      { method: "POST" },
    );
    assert.equal(missingHeader.response.status, 403);

    const missingSession = await json(
      server.baseUrl,
      "/api/foundry-session/connect",
      {
        method: "POST",
        headers: { "X-Spiritual-Arts-Control": "1" },
      },
    );
    assert.equal(missingSession.response.status, 401);
    assert.equal(controller.starts, 0);

    const wrongPassword = await json(
      server.baseUrl,
      "/api/foundry-session/authenticate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Spiritual-Arts-Control": "1",
        },
        body: JSON.stringify({ password: "wrong" }),
      },
    );
    assert.equal(wrongPassword.response.status, 401);

    const login = await json(
      server.baseUrl,
      "/api/foundry-session/authenticate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Spiritual-Arts-Control": "1",
        },
        body: JSON.stringify({ password: "control secret" }),
      },
    );
    assert.equal(login.response.status, 200);
    assert.equal(login.body.authenticated, true);
    const setCookie = login.response.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /^spiritual_arts_foundry_control=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);
    const cookie = setCookie.split(";", 1)[0];

    const connect = await json(
      server.baseUrl,
      "/api/foundry-session/connect",
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "X-Spiritual-Arts-Control": "1",
        },
      },
    );
    assert.equal(connect.response.status, 202);
    assert.equal(controller.starts, 1);
    assert.equal(
      ((connect.body as unknown as FoundrySessionResponse).session).state,
      "starting",
    );

    const privateStatus = await json(server.baseUrl, "/api/foundry-session", {
      headers: { Cookie: cookie },
    });
    assert.equal(privateStatus.body.authenticated, true);
    assert.equal(
      ((privateStatus.body as unknown as FoundrySessionResponse).session)
        .bridgeUser,
      "Website Bridge",
    );

    const disconnect = await json(
      server.baseUrl,
      "/api/foundry-session/disconnect",
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          "X-Spiritual-Arts-Control": "1",
        },
      },
    );
    assert.equal(disconnect.response.status, 200);
    assert.equal(controller.stops, 1);
    assert.equal(
      ((disconnect.body as unknown as FoundrySessionResponse).session).state,
      "stopped",
    );
  } finally {
    await server.close();
  }
});

test("Foundry control login reports missing server configuration", async () => {
  const server = await startServer(
    new FakeFoundryController(),
    new FoundryControlAuth(),
  );
  try {
    const result = await json(
      server.baseUrl,
      "/api/foundry-session/authenticate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Spiritual-Arts-Control": "1",
        },
        body: JSON.stringify({ password: "anything" }),
      },
    );
    assert.equal(result.response.status, 503);
  } finally {
    await server.close();
  }
});
