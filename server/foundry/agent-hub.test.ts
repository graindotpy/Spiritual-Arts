import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { WebSocket } from "ws";
import {
  foundryAgentSessionStartSchema,
  foundryAgentSessionStopSchema,
  type FoundryAgentSessionStart,
  type FoundryAgentSessionStop,
} from "@shared/foundry-agent-protocol";
import { SpiritRollWebSocket } from "../websocket";
import { FoundryAgentHub } from "./agent-hub";
import { FoundryRunnerError } from "./types";

const token = "0123456789abcdef".repeat(4);
const agentId = "zima-home";
const bridgeUser = "Website Bridge";

interface Fixture {
  server: Server;
  hub: FoundryAgentHub;
  url: string;
  clients: WebSocket[];
  close(): Promise<void>;
}

async function fixture(withRealtime = false): Promise<Fixture> {
  const server = createServer();
  const realtime = withRealtime ? new SpiritRollWebSocket(server) : null;
  const hub = new FoundryAgentHub(server, {
    agentId,
    token,
    bridgeUser,
    heartbeatMs: 100,
    helloTimeoutMs: 100,
    stopTimeoutMs: 100,
    logger: { error: () => undefined },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const clients: WebSocket[] = [];
  return {
    server,
    hub,
    url: `ws://127.0.0.1:${address.port}/ws/foundry-agent`,
    clients,
    async close() {
      realtime?.close();
      hub.close();
      for (const client of clients) client.terminate();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function openAgent(target: Fixture, suppliedToken = token): Promise<WebSocket> {
  const client = new WebSocket(target.url, {
    headers: { Authorization: `Bearer ${suppliedToken}` },
  });
  target.clients.push(client);
  return new Promise((resolve, reject) => {
    client.once("open", () => resolve(client));
    client.once("error", reject);
  });
}

function sendHello(client: WebSocket): void {
  client.send(
    JSON.stringify({
      protocolVersion: 1,
      type: "hello",
      agentId,
      agentVersion: "1.0.0",
      bootId: "4644d4e9-ec02-4933-bf1f-292a242dc58f",
      agentState: "idle",
      bridgeUser,
      sentAt: new Date().toISOString(),
    }),
  );
}

function nextJson(client: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    client.once("message", (raw) => {
      try {
        resolve(JSON.parse(raw.toString()));
      } catch (error) {
        reject(error);
      }
    });
    client.once("error", reject);
  });
}

async function waitForAvailable(hub: FoundryAgentHub): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (hub.available()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  assert.fail("agent hello was not accepted in time");
}

test("one explicit upgrade router serves both noServer WebSocket paths", async () => {
  const target = await fixture(true);
  try {
    assert.equal(target.server.listenerCount("upgrade"), 1);
    const rollClient = new WebSocket(target.url.replace("/foundry-agent", ""));
    target.clients.push(rollClient);
    await new Promise<void>((resolve, reject) => {
      rollClient.once("open", resolve);
      rollClient.once("error", reject);
    });
    const agent = await openAgent(target);
    sendHello(agent);
    await waitForAvailable(target.hub);
    assert.equal(target.hub.available(), true);
  } finally {
    await target.close();
  }
});

test("the hub rejects bad bearer tokens and does not evict its active agent", async () => {
  const target = await fixture();
  try {
    await assert.rejects(openAgent(target, "wrong-token"), /401/);
    const agent = await openAgent(target);
    sendHello(agent);
    await waitForAvailable(target.hub);
    assert.equal(target.hub.available(), true);
    await assert.rejects(openAgent(target), /409/);
    assert.equal(agent.readyState, WebSocket.OPEN);
    assert.equal(target.hub.available(), true);
  } finally {
    await target.close();
  }
});

test("the hub forwards start, progress, readiness, and acknowledged stop", async () => {
  const target = await fixture();
  try {
    const agent = await openAgent(target);
    sendHello(agent);
    await waitForAvailable(target.hub);

    const startMessage = nextJson(agent);
    const stages: string[] = [];
    const connectionPromise = target.hub.startSession({
      expectedBridgeUser: bridgeUser,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      signal: new AbortController().signal,
      onStage: (stage) => stages.push(stage),
    });
    const start = foundryAgentSessionStartSchema.parse(
      await startMessage,
    ) as FoundryAgentSessionStart;
    agent.send(
      JSON.stringify({
        protocolVersion: 1,
        type: "session_stage",
        agentId,
        sessionId: start.sessionId,
        stage: "authenticating",
        sentAt: new Date().toISOString(),
      }),
    );
    agent.send(
      JSON.stringify({
        protocolVersion: 1,
        type: "session_ready",
        agentId,
        sessionId: start.sessionId,
        bridgeUser,
        sentAt: new Date().toISOString(),
      }),
    );
    const connection = await connectionPromise;
    assert.deepEqual(stages, ["authenticating"]);

    const stopMessage = nextJson(agent);
    const closing = connection.close("requested");
    const stop = foundryAgentSessionStopSchema.parse(
      await stopMessage,
    ) as FoundryAgentSessionStop;
    assert.equal(stop.sessionId, start.sessionId);
    agent.send(
      JSON.stringify({
        protocolVersion: 1,
        type: "session_stopped",
        agentId,
        sessionId: start.sessionId,
        reason: "requested",
        sentAt: new Date().toISOString(),
      }),
    );
    await closing;
  } finally {
    await target.close();
  }
});

test("an unacknowledged stop fails closed before another start", async () => {
  const target = await fixture();
  try {
    const agent = await openAgent(target);
    sendHello(agent);
    await waitForAvailable(target.hub);
    const startMessage = nextJson(agent);
    const connecting = target.hub.startSession({
      expectedBridgeUser: bridgeUser,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      signal: new AbortController().signal,
      onStage: () => undefined,
    });
    const start = foundryAgentSessionStartSchema.parse(await startMessage);
    agent.send(
      JSON.stringify({
        protocolVersion: 1,
        type: "session_ready",
        agentId,
        sessionId: start.sessionId,
        bridgeUser,
        sentAt: new Date().toISOString(),
      }),
    );
    const connection = await connecting;
    const stopMessage = nextJson(agent);
    const closing = connection.close("requested");
    foundryAgentSessionStopSchema.parse(await stopMessage);
    // No session_stopped acknowledgement: the hub must invalidate the agent.
    await closing;
    assert.equal(target.hub.available(), false);
    await assert.rejects(
      target.hub.startSession({
        expectedBridgeUser: bridgeUser,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        signal: new AbortController().signal,
        onStage: () => undefined,
      }),
      (error: unknown) =>
        error instanceof FoundryRunnerError && error.code === "agent_unavailable",
    );
  } finally {
    await target.close();
  }
});

test("cancelling startup waits for bounded remote cleanup", async () => {
  const target = await fixture();
  try {
    const agent = await openAgent(target);
    sendHello(agent);
    await waitForAvailable(target.hub);
    const abortController = new AbortController();
    const startMessage = nextJson(agent);
    const connecting = target.hub.startSession({
      expectedBridgeUser: bridgeUser,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      signal: abortController.signal,
      onStage: () => undefined,
    });
    const start = foundryAgentSessionStartSchema.parse(await startMessage);
    const stopMessage = nextJson(agent);
    abortController.abort();
    foundryAgentSessionStopSchema.parse(await stopMessage);

    const earlySettlement = await Promise.race([
      connecting.then(
        () => "settled",
        () => "settled",
      ),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 20)),
    ]);
    assert.equal(earlySettlement, "pending");
    agent.send(
      JSON.stringify({
        protocolVersion: 1,
        type: "session_stopped",
        agentId,
        sessionId: start.sessionId,
        reason: "start_cancelled",
        sentAt: new Date().toISOString(),
      }),
    );
    await assert.rejects(
      connecting,
      (error: unknown) => error instanceof Error && error.name === "AbortError",
    );
    assert.equal(target.hub.available(), true);
  } finally {
    await target.close();
  }
});

test("offline, agent failure, protocol failure, and live disconnect are curated", async (t) => {
  await t.test("offline start fails without queueing", async () => {
    const target = await fixture();
    try {
      await assert.rejects(
        target.hub.startSession({
          expectedBridgeUser: bridgeUser,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          signal: new AbortController().signal,
          onStage: () => undefined,
        }),
        (error: unknown) =>
          error instanceof FoundryRunnerError && error.code === "agent_unavailable",
      );
    } finally {
      await target.close();
    }
  });

  await t.test("strict protocol failure rejects startup", async () => {
    const target = await fixture();
    try {
      const agent = await openAgent(target);
      sendHello(agent);
      await waitForAvailable(target.hub);
      const startMessage = nextJson(agent);
      const connecting = target.hub.startSession({
        expectedBridgeUser: bridgeUser,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        signal: new AbortController().signal,
        onStage: () => undefined,
      });
      await startMessage;
      agent.send(JSON.stringify({ protocolVersion: 1, type: "surprise" }));
      await assert.rejects(
        connecting,
        (error: unknown) =>
          error instanceof FoundryRunnerError && error.code === "agent_protocol_error",
      );
    } finally {
      await target.close();
    }
  });

  await t.test("agent failures retain their curated code", async () => {
    const target = await fixture();
    try {
      const agent = await openAgent(target);
      sendHello(agent);
      await waitForAvailable(target.hub);
      const startMessage = nextJson(agent);
      const connecting = target.hub.startSession({
        expectedBridgeUser: bridgeUser,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        signal: new AbortController().signal,
        onStage: () => undefined,
      });
      const start = foundryAgentSessionStartSchema.parse(await startMessage);
      agent.send(
        JSON.stringify({
          protocolVersion: 1,
          type: "session_failed",
          agentId,
          sessionId: start.sessionId,
          failure: { code: "login_timeout" },
          sentAt: new Date().toISOString(),
        }),
      );
      await assert.rejects(
        connecting,
        (error: unknown) =>
          error instanceof FoundryRunnerError && error.code === "login_timeout",
      );
    } finally {
      await target.close();
    }
  });

  await t.test("a live browser crash retains its termination kind", async () => {
    const target = await fixture();
    try {
      const agent = await openAgent(target);
      sendHello(agent);
      await waitForAvailable(target.hub);
      const startMessage = nextJson(agent);
      const connecting = target.hub.startSession({
        expectedBridgeUser: bridgeUser,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        signal: new AbortController().signal,
        onStage: () => undefined,
      });
      const start = foundryAgentSessionStartSchema.parse(await startMessage);
      agent.send(
        JSON.stringify({
          protocolVersion: 1,
          type: "session_ready",
          agentId,
          sessionId: start.sessionId,
          bridgeUser,
          sentAt: new Date().toISOString(),
        }),
      );
      const connection = await connecting;
      agent.send(
        JSON.stringify({
          protocolVersion: 1,
          type: "session_failed",
          agentId,
          sessionId: start.sessionId,
          failure: { code: "page_crashed" },
          sentAt: new Date().toISOString(),
        }),
      );
      assert.deepEqual(await connection.terminated, { kind: "page_crashed" });
    } finally {
      await target.close();
    }
  });

  await t.test("a live control-channel loss terminates the connection", async () => {
    const target = await fixture();
    try {
      const agent = await openAgent(target);
      sendHello(agent);
      await waitForAvailable(target.hub);
      const startMessage = nextJson(agent);
      const connecting = target.hub.startSession({
        expectedBridgeUser: bridgeUser,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        signal: new AbortController().signal,
        onStage: () => undefined,
      });
      const start = foundryAgentSessionStartSchema.parse(await startMessage);
      agent.send(
        JSON.stringify({
          protocolVersion: 1,
          type: "session_ready",
          agentId,
          sessionId: start.sessionId,
          bridgeUser,
          sentAt: new Date().toISOString(),
        }),
      );
      const connection = await connecting;
      agent.terminate();
      assert.deepEqual(await connection.terminated, {
        kind: "agent_disconnected",
      });
    } finally {
      await target.close();
    }
  });
});
