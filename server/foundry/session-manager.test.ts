import assert from "node:assert/strict";
import { test } from "node:test";
import { FoundrySessionManager, type FoundrySessionClock } from "./session-manager";
import {
  FoundryRunnerError,
  type FoundryConnection,
  type FoundryConnectionStage,
  type FoundryConnectionTermination,
  type FoundryConnector,
  type FoundrySessionConfig,
} from "./types";

const config: FoundrySessionConfig = {
  worldUrl: "https://foundry.example.test/join",
  userName: "Spiritual Arts Bridge",
  accessKey: "never-return-this-secret",
  maxSessionMs: 1_000,
  headless: true,
};

const quietLogger = { error: () => undefined };

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class FakeClock implements FoundrySessionClock {
  private sequence = 0;
  private readonly timers = new Map<
    number,
    { callback: () => void; dueAt: number }
  >();

  constructor(private timestamp: number) {}

  now(): number {
    return this.timestamp;
  }

  setTimeout(callback: () => void, delayMs: number): unknown {
    const id = ++this.sequence;
    this.timers.set(id, { callback, dueAt: this.timestamp + delayMs });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }

  advance(delayMs: number): void {
    this.timestamp += delayMs;
    const due = [...this.timers.entries()]
      .filter(([, timer]) => timer.dueAt <= this.timestamp)
      .sort((left, right) => left[1].dueAt - right[1].dueAt);
    for (const [id, timer] of due) {
      if (!this.timers.delete(id)) continue;
      timer.callback();
    }
  }
}

class FakeConnection implements FoundryConnection {
  readonly termination = deferred<FoundryConnectionTermination>();
  readonly terminated = this.termination.promise;
  readonly closeReasons: string[] = [];

  async close(reason: string): Promise<void> {
    this.closeReasons.push(reason);
  }
}

async function flushTasks(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

test("start is immediate and idempotent through authentication and ready", async () => {
  const clock = new FakeClock(Date.parse("2026-01-01T00:00:00.000Z"));
  const pending = deferred<FoundryConnection>();
  const connection = new FakeConnection();
  let connectCalls = 0;
  let reportStage: ((stage: FoundryConnectionStage) => void) | undefined;
  const connector: FoundryConnector = {
    connect: (_config, _signal, onStage) => {
      connectCalls += 1;
      reportStage = onStage;
      return pending.promise;
    },
  };
  const manager = new FoundrySessionManager(config, connector, {
    clock,
    logger: quietLogger,
  });

  const starting = manager.start();
  assert.equal(starting.state, "starting");
  assert.equal(starting.bridgeUser, config.userName);
  assert.equal(starting.startedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(starting.expiresAt, "2026-01-01T00:00:01.000Z");
  assert.equal(manager.start().state, "starting");
  assert.equal(connectCalls, 1);

  reportStage?.("authenticating");
  assert.equal(manager.status().state, "authenticating");
  reportStage?.("opening");
  assert.equal(manager.status().state, "authenticating");

  pending.resolve(connection);
  await flushTasks();
  assert.equal(manager.status().state, "ready");
  assert.equal(manager.start().state, "ready");
  assert.equal(connectCalls, 1);

  const stopped = await manager.stop();
  assert.equal(stopped.state, "stopped");
  assert.equal(stopped.stopReason, "requested");
  assert.deepEqual(connection.closeReasons, ["requested"]);
  await manager.stop();
  assert.deepEqual(connection.closeReasons, ["requested"]);
});

test("stop aborts a pending start and closes a connection that arrives late", async () => {
  const pending = deferred<FoundryConnection>();
  const connection = new FakeConnection();
  let observedSignal: AbortSignal | undefined;
  const connector: FoundryConnector = {
    connect: (_config, signal) => {
      observedSignal = signal;
      return pending.promise;
    },
  };
  const manager = new FoundrySessionManager(config, connector, {
    logger: quietLogger,
  });

  manager.start();
  const stopping = manager.stop();
  assert.equal(manager.status().state, "stopping");
  assert.equal(observedSignal?.aborted, true);

  pending.resolve(connection);
  const status = await stopping;
  assert.equal(status.state, "stopped");
  assert.deepEqual(connection.closeReasons, ["start cancelled"]);
});

test("the maximum session timer disconnects without restarting", async () => {
  const clock = new FakeClock(1_000_000);
  const connection = new FakeConnection();
  let connectCalls = 0;
  const connector: FoundryConnector = {
    connect: async () => {
      connectCalls += 1;
      return connection;
    },
  };
  const manager = new FoundrySessionManager(config, connector, {
    clock,
    logger: quietLogger,
  });

  manager.start();
  await flushTasks();
  assert.equal(manager.status().state, "ready");
  clock.advance(config.maxSessionMs);
  await flushTasks();

  assert.equal(manager.status().state, "stopped");
  assert.equal(manager.status().stopReason, "ttl_expired");
  assert.deepEqual(connection.closeReasons, ["ttl_expired"]);
  assert.equal(connectCalls, 1);
});

test("an unexpected page crash fails the session and permits a manual retry", async () => {
  const first = new FakeConnection();
  const second = new FakeConnection();
  const connections = [first, second];
  let connectCalls = 0;
  const connector: FoundryConnector = {
    connect: async () => connections[connectCalls++] as FakeConnection,
  };
  const manager = new FoundrySessionManager(config, connector, {
    logger: quietLogger,
  });

  manager.start();
  await flushTasks();
  first.termination.resolve({ kind: "page_crashed" });
  await flushTasks();

  const failed = manager.status();
  assert.equal(failed.state, "failed");
  assert.equal(failed.stopReason, "page_crashed");
  assert.equal(failed.failure?.code, "page_crashed");
  assert.deepEqual(first.closeReasons, ["page_crashed"]);
  assert.equal(connectCalls, 1);

  assert.equal(manager.start().state, "starting");
  await flushTasks();
  assert.equal(manager.status().state, "ready");
  assert.equal(connectCalls, 2);
  await manager.stop();
});

test("a stale termination event cannot overwrite a manually stopped session", async () => {
  const connection = new FakeConnection();
  const connector: FoundryConnector = { connect: async () => connection };
  const manager = new FoundrySessionManager(config, connector, {
    logger: quietLogger,
  });

  manager.start();
  await flushTasks();
  await manager.stop();
  connection.termination.resolve({ kind: "browser_closed" });
  await flushTasks();

  assert.equal(manager.status().state, "stopped");
  assert.equal(manager.status().stopReason, "requested");
  assert.equal(manager.status().failure, null);
});

test("startup errors expose only curated details and can be retried", async () => {
  const connection = new FakeConnection();
  const logged: unknown[] = [];
  let connectCalls = 0;
  const connector: FoundryConnector = {
    connect: async () => {
      connectCalls += 1;
      if (connectCalls === 1) {
        throw new FoundryRunnerError(
          "login_rejected",
          "Foundry rejected the system-user login. Check its access key.",
          { cause: new Error(`bad secret ${config.accessKey}`) },
        );
      }
      return connection;
    },
  };
  const manager = new FoundrySessionManager(config, connector, {
    logger: { error: (_message, error) => logged.push(error) },
  });

  manager.start();
  await flushTasks();
  const failed = manager.status();
  assert.equal(failed.state, "failed");
  assert.equal(failed.failure?.code, "login_rejected");
  assert.equal(JSON.stringify(failed).includes(config.accessKey), false);
  assert.equal(JSON.stringify(logged).includes(config.accessKey), false);

  manager.start();
  await flushTasks();
  assert.equal(manager.status().state, "ready");
  await manager.stop();
});

test("dispose closes once and prevents a later restart", async () => {
  const connection = new FakeConnection();
  let connectCalls = 0;
  const connector: FoundryConnector = {
    connect: async () => {
      connectCalls += 1;
      return connection;
    },
  };
  const manager = new FoundrySessionManager(config, connector, {
    logger: quietLogger,
  });

  manager.start();
  await flushTasks();
  await manager.dispose();
  await manager.dispose();
  assert.deepEqual(connection.closeReasons, ["server_shutdown"]);
  assert.equal(manager.start().state, "stopped");
  assert.equal(connectCalls, 1);
});

test("an unconfigured manager remains a secret-free no-op", async () => {
  let connectCalls = 0;
  const connector: FoundryConnector = {
    connect: async () => {
      connectCalls += 1;
      return new FakeConnection();
    },
  };
  const manager = new FoundrySessionManager(null, connector, {
    logger: quietLogger,
  });

  assert.deepEqual(manager.start(), {
    configured: false,
    mode: null,
    agentAvailable: null,
    state: "unconfigured",
    startedAt: null,
    readyAt: null,
    expiresAt: null,
    stoppedAt: null,
    stopReason: null,
    failure: null,
    bridgeUser: null,
  });
  await manager.stop();
  assert.equal(connectCalls, 0);
});

test("agent availability is live status and never exposes agent secrets", () => {
  let available = false;
  const connector: FoundryConnector = {
    available: () => available,
    connect: async () => new FakeConnection(),
  };
  const agentToken = "0123456789abcdef".repeat(4);
  const manager = new FoundrySessionManager(
    {
      mode: "agent",
      agentId: "zima-home",
      agentToken,
      userName: "Spiritual Arts Bridge",
      maxSessionMs: 60_000,
    },
    connector,
    { logger: quietLogger },
  );

  assert.equal(manager.status().mode, "agent");
  assert.equal(manager.status().agentAvailable, false);
  available = true;
  const online = manager.status();
  assert.equal(online.agentAvailable, true);
  assert.equal(JSON.stringify(online).includes(agentToken), false);
  assert.equal(JSON.stringify(online).includes("zima-home"), false);
});
