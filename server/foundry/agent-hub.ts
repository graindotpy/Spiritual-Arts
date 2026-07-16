import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import {
  FOUNDRY_AGENT_PROTOCOL_VERSION,
  FOUNDRY_AGENT_WEBSOCKET_PATH,
  foundryAgentHelloSchema,
  foundryAgentMessageSchema,
  foundryWebsiteAgentMessageSchema,
  type FoundryAgentHello,
  type FoundryAgentMessage,
  type FoundryWebsiteAgentMessage,
} from "@shared/foundry-agent-protocol";
import type { FoundrySessionFailureCode } from "@shared/foundry-session";
import { getWebSocketUpgradeRouter } from "../websocket-upgrade";
import {
  FoundryRunnerError,
  type FoundryConnection,
  type FoundryConnectionStage,
  type FoundryConnectionTermination,
} from "./types";

const DEFAULT_HEARTBEAT_MS = 30_000;
const DEFAULT_HELLO_TIMEOUT_MS = 10_000;
const DEFAULT_STOP_TIMEOUT_MS = 5_000;
const MAX_AGENT_PAYLOAD_BYTES = 64 * 1_024;

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly settled: () => boolean;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (error: unknown) => void;
  let isSettled = false;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    settled: () => isSettled,
    resolve: (value) => {
      if (isSettled) return;
      isSettled = true;
      resolvePromise(value);
    },
    reject: (error) => {
      if (isSettled) return;
      isSettled = true;
      rejectPromise(error);
    },
  };
}

function abortError(): Error {
  const error = new Error("Foundry connection was cancelled");
  error.name = "AbortError";
  return error;
}

function normalizeStopReason(reason: string): string {
  const normalized = reason.trim().slice(0, 100);
  return normalized || "requested";
}

function safeError(error: unknown, token: string): { name: string; message: string } {
  if (!(error instanceof Error)) {
    return { name: "NonErrorFailure", message: "A non-Error value was thrown" };
  }
  return {
    name: error.name,
    message: error.message.split(token).join("[redacted]"),
  };
}

function bearerMatches(request: IncomingMessage, expectedToken: string): boolean {
  const authorization = request.headers.authorization;
  const hasBearer =
    typeof authorization === "string" && authorization.startsWith("Bearer ");
  const suppliedToken = hasBearer
    ? (authorization as string).slice("Bearer ".length)
    : "";
  const supplied = createHash("sha256").update(suppliedToken).digest();
  const expected = createHash("sha256").update(expectedToken).digest();
  return hasBearer && timingSafeEqual(supplied, expected);
}

function publicMessageForAgentFailure(code: FoundrySessionFailureCode): string {
  switch (code) {
    case "browser_launch_failed":
      return "The Foundry browser could not be started.";
    case "foundry_unreachable":
      return "The Foundry world could not be reached.";
    case "join_form_missing":
      return "The Foundry join form was not available.";
    case "user_not_found":
      return "The configured Foundry system user was not present on the join page.";
    case "user_ambiguous":
      return "More than one Foundry user has the configured system-user name.";
    case "login_rejected":
      return "Foundry rejected the system-user login. Check its access key.";
    case "login_timeout":
      return "Timed out waiting for the Foundry world to finish loading.";
    case "wrong_user":
      return "Foundry loaded without the configured system user.";
    case "module_inactive":
      return "The Spiritual Arts Foundry module is not active in this world.";
    case "bridge_user_mismatch":
      return "The Foundry module designates a different roll-bridge user.";
    case "browser_closed":
      return "The Foundry browser closed while connecting.";
    case "page_closed":
      return "The Foundry browser page closed while connecting.";
    case "page_crashed":
      return "The Foundry browser page crashed while connecting.";
    case "agent_unavailable":
      return "The remote Foundry agent is offline.";
    case "agent_disconnected":
      return "The remote Foundry agent disconnected while starting the session.";
    case "agent_protocol_error":
      return "The remote Foundry agent sent an invalid control message.";
    case "agent_session_stopped":
      return "The remote Foundry agent stopped before the session was ready.";
    case "command_expired":
      return "The remote Foundry agent received the start command after it expired.";
    case "session_busy":
      return "The remote Foundry agent is already running another browser session.";
    case "startup_failed":
      return "The Foundry system user could not be connected.";
  }
}

function terminationForAgentFailure(
  code: FoundrySessionFailureCode,
): FoundryConnectionTermination {
  switch (code) {
    case "browser_closed":
    case "page_closed":
    case "page_crashed":
      return { kind: code };
    default:
      return { kind: "agent_stopped" };
  }
}

function rejectUpgrade(
  socket: Duplex,
  status: 401 | 409 | 503,
  label: string,
): void {
  if (!socket.writable) {
    socket.destroy();
    return;
  }
  socket.end(
    `HTTP/1.1 ${status} ${label}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
}

interface AgentSessionRecord {
  readonly sessionId: string;
  readonly expectedBridgeUser: string;
  readonly onStage: (stage: FoundryConnectionStage) => void;
  readonly signal: AbortSignal;
  readonly onAbort: () => void;
  readonly ready: Deferred<FoundryConnection>;
  readonly terminated: Deferred<FoundryConnectionTermination>;
  readonly stopped: Deferred<boolean>;
  phase: "starting" | "ready" | "stopping";
  closeTask: Promise<void> | null;
}

export interface FoundryAgentHubOptions {
  agentId: string;
  token: string;
  bridgeUser: string;
  heartbeatMs?: number;
  helloTimeoutMs?: number;
  stopTimeoutMs?: number;
  logger?: { error(message: string, error?: unknown): void };
}

export interface FoundryAgentStartRequest {
  expectedBridgeUser: string;
  expiresAt: string;
  signal: AbortSignal;
  onStage: (stage: FoundryConnectionStage) => void;
}

/** Authenticated, single-agent control channel for an on-demand browser worker. */
export class FoundryAgentHub {
  private readonly webSocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_AGENT_PAYLOAD_BYTES,
    perMessageDeflate: false,
  });
  private readonly heartbeat: NodeJS.Timeout;
  private readonly unregisterUpgrade: () => void;
  private readonly logger: { error(message: string, error?: unknown): void };
  private readonly heartbeatMs: number;
  private readonly helloTimeoutMs: number;
  private readonly stopTimeoutMs: number;

  private socket: WebSocket | null = null;
  private hello: FoundryAgentHello | null = null;
  private helloTimer: NodeJS.Timeout | null = null;
  private responsive = true;
  private session: AgentSessionRecord | null = null;
  private closed = false;

  constructor(
    httpServer: Server,
    private readonly options: FoundryAgentHubOptions,
  ) {
    this.heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
    this.helloTimeoutMs = options.helloTimeoutMs ?? DEFAULT_HELLO_TIMEOUT_MS;
    this.stopTimeoutMs = options.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS;
    this.logger = options.logger ?? console;
    this.webSocketServer.on("connection", (socket) => this.track(socket));
    this.webSocketServer.on("error", (error) => {
      this.logger.error(
        "Foundry agent WebSocket server error",
        safeError(error, options.token),
      );
    });
    this.unregisterUpgrade = getWebSocketUpgradeRouter(httpServer).register(
      FOUNDRY_AGENT_WEBSOCKET_PATH,
      (request, socket, head) => this.upgrade(request, socket, head),
    );
    this.heartbeat = setInterval(() => this.checkHeartbeat(), this.heartbeatMs);
    this.heartbeat.unref();
  }

  available(): boolean {
    return (
      !this.closed &&
      this.hello !== null &&
      this.socket?.readyState === WebSocket.OPEN
    );
  }

  startSession(request: FoundryAgentStartRequest): Promise<FoundryConnection> {
    if (request.signal.aborted) return Promise.reject(abortError());
    if (!this.available()) {
      return Promise.reject(
        new FoundryRunnerError(
          "agent_unavailable",
          "The remote Foundry agent is offline.",
        ),
      );
    }
    if (this.session) {
      return Promise.reject(
        new FoundryRunnerError(
          "session_busy",
          "The remote Foundry agent is already handling a session.",
        ),
      );
    }

    const sessionId = randomUUID();
    const ready = deferred<FoundryConnection>();
    const terminated = deferred<FoundryConnectionTermination>();
    const stopped = deferred<boolean>();
    const record = {} as AgentSessionRecord;
    Object.assign(record, {
      sessionId,
      expectedBridgeUser: request.expectedBridgeUser,
      onStage: request.onStage,
      signal: request.signal,
      ready,
      terminated,
      stopped,
      phase: "starting" as const,
      closeTask: null,
      onAbort: () => {
        if (this.session !== record) return;
        void this.stopRecord(record, "start_cancelled").finally(() => {
          record.ready.reject(abortError());
        });
      },
    });
    this.session = record;
    request.signal.addEventListener("abort", record.onAbort, { once: true });

    const command: FoundryWebsiteAgentMessage = {
      protocolVersion: FOUNDRY_AGENT_PROTOCOL_VERSION,
      type: "session_start",
      commandId: randomUUID(),
      sessionId,
      expiresAt: request.expiresAt,
      expectedBridgeUser: request.expectedBridgeUser,
    };
    void this.send(command).catch((error: unknown) => {
      if (this.session !== record || record.phase !== "starting") return;
      record.ready.reject(
        new FoundryRunnerError(
          "agent_disconnected",
          "The remote Foundry agent disconnected before it could start the session.",
          { cause: error },
        ),
      );
      this.invalidateSocket();
      this.releaseRecord(record);
    });
    return ready.promise;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.heartbeat);
    this.clearHelloTimer();
    this.unregisterUpgrade();
    const session = this.session;
    if (session) {
      if (session.phase === "starting") {
        session.ready.reject(
          new FoundryRunnerError(
            "agent_disconnected",
            "The remote Foundry agent disconnected while the website was stopping.",
          ),
        );
      } else if (session.phase === "ready") {
        session.terminated.resolve({ kind: "agent_disconnected" });
      } else {
        session.stopped.resolve(false);
      }
      this.releaseRecord(session);
    }
    this.socket?.terminate();
    this.socket = null;
    this.hello = null;
    this.webSocketServer.close();
  }

  private upgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void {
    if (this.closed) {
      rejectUpgrade(socket, 503, "Service Unavailable");
      return;
    }
    if (!bearerMatches(request, this.options.token)) {
      rejectUpgrade(socket, 401, "Unauthorized");
      return;
    }
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      // The expected agent gets one control channel. A newcomer cannot evict a
      // healthy connection or its active browser session.
      rejectUpgrade(socket, 409, "Conflict");
      return;
    }
    this.webSocketServer.handleUpgrade(request, socket, head, (client) => {
      this.webSocketServer.emit("connection", client, request);
    });
  }

  private track(socket: WebSocket): void {
    if (this.closed || (this.socket && this.socket !== socket)) {
      socket.close(1008, "Agent connection already active");
      return;
    }
    this.socket = socket;
    this.hello = null;
    this.responsive = true;
    this.clearHelloTimer();
    this.helloTimer = setTimeout(() => {
      if (this.socket === socket && this.hello === null) {
        socket.close(1008, "Agent hello timed out");
      }
    }, this.helloTimeoutMs);
    this.helloTimer.unref();

    socket.on("pong", () => {
      if (this.socket === socket) this.responsive = true;
    });
    socket.on("message", (data, isBinary) => {
      this.receive(socket, data, isBinary);
    });
    socket.once("close", () => this.disconnected(socket));
    socket.once("error", () => this.disconnected(socket));
  }

  private receive(socket: WebSocket, raw: RawData, isBinary: boolean): void {
    if (socket !== this.socket) return;
    if (isBinary) {
      this.protocolViolation(socket, "Binary agent messages are not supported");
      return;
    }

    let value: unknown;
    try {
      value = JSON.parse(raw.toString());
    } catch {
      this.protocolViolation(socket, "Agent message was not valid JSON");
      return;
    }

    if (this.hello === null) {
      const hello = foundryAgentHelloSchema.safeParse(value);
      if (
        !hello.success ||
        hello.data.agentId !== this.options.agentId ||
        hello.data.bridgeUser !== this.options.bridgeUser
      ) {
        this.protocolViolation(socket, "Agent identity did not match configuration");
        return;
      }
      this.hello = hello.data;
      this.clearHelloTimer();
      return;
    }

    const parsed = foundryAgentMessageSchema.safeParse(value);
    if (!parsed.success || parsed.data.type === "hello") {
      this.protocolViolation(socket, "Agent message did not match protocol v1");
      return;
    }
    if (parsed.data.agentId !== this.options.agentId) {
      this.protocolViolation(socket, "Agent message identity changed");
      return;
    }
    this.handleSessionMessage(parsed.data);
  }

  private handleSessionMessage(message: Exclude<FoundryAgentMessage, FoundryAgentHello>): void {
    const record = this.session;
    // Late acknowledgements for an expired/replaced session are harmless.
    if (!record || message.sessionId !== record.sessionId) return;

    switch (message.type) {
      case "session_stage":
        if (record.phase === "starting") record.onStage(message.stage);
        return;
      case "session_ready":
        if (record.phase !== "starting") return;
        if (message.bridgeUser !== record.expectedBridgeUser) {
          void this.stopRecord(record, "bridge_user_mismatch").finally(() => {
            record.ready.reject(
              new FoundryRunnerError(
                "bridge_user_mismatch",
                "The remote agent connected a different Foundry bridge user.",
              ),
            );
          });
          return;
        }
        record.phase = "ready";
        record.ready.resolve({
          terminated: record.terminated.promise,
          close: (reason: string) => this.stopRecord(record, reason),
        });
        return;
      case "session_failed":
        if (record.phase === "starting") {
          record.ready.reject(
            new FoundryRunnerError(
              message.failure.code,
              publicMessageForAgentFailure(message.failure.code),
            ),
          );
        } else if (record.phase === "ready") {
          record.terminated.resolve(
            terminationForAgentFailure(message.failure.code),
          );
        } else {
          record.stopped.resolve(false);
        }
        this.releaseRecord(record);
        return;
      case "session_stopped":
        if (record.phase === "starting") {
          record.ready.reject(
            new FoundryRunnerError(
              "agent_session_stopped",
              "The remote Foundry agent stopped before the session was ready.",
            ),
          );
        } else if (record.phase === "ready") {
          record.terminated.resolve({ kind: "agent_stopped" });
        } else {
          record.stopped.resolve(true);
        }
        this.releaseRecord(record);
    }
  }

  private stopRecord(record: AgentSessionRecord, reason: string): Promise<void> {
    if (record.closeTask) return record.closeTask;
    if (this.session !== record) return Promise.resolve();
    record.phase = "stopping";
    const stopCommand: FoundryWebsiteAgentMessage = {
      protocolVersion: FOUNDRY_AGENT_PROTOCOL_VERSION,
      type: "session_stop",
      commandId: randomUUID(),
      sessionId: record.sessionId,
      reason: normalizeStopReason(reason),
    };

    record.closeTask = (async () => {
      let timer: NodeJS.Timeout | undefined;
      let acknowledged = false;
      try {
        await this.send(stopCommand);
        acknowledged = await Promise.race([
          record.stopped.promise,
          new Promise<boolean>((resolve) => {
            timer = setTimeout(() => resolve(false), this.stopTimeoutMs);
            timer.unref();
          }),
        ]);
      } catch {
        // The agent enforces the command expiry locally if its control channel
        // disappears before the stop acknowledgement reaches the website.
      } finally {
        if (timer) clearTimeout(timer);
        if (!acknowledged) this.invalidateSocket();
        this.releaseRecord(record);
      }
    })();
    return record.closeTask;
  }

  private send(message: FoundryWebsiteAgentMessage): Promise<void> {
    const socket = this.socket;
    if (!this.available() || !socket) {
      return Promise.reject(new Error("Foundry agent is not connected"));
    }
    const encoded = JSON.stringify(foundryWebsiteAgentMessageSchema.parse(message));
    return new Promise<void>((resolve, reject) => {
      socket.send(encoded, (error?: Error) => (error ? reject(error) : resolve()));
    });
  }

  private protocolViolation(socket: WebSocket, reason: string): void {
    const record = this.session;
    if (record?.phase === "starting") {
      record.ready.reject(
        new FoundryRunnerError(
          "agent_protocol_error",
          "The remote Foundry agent sent an invalid control message.",
        ),
      );
      this.releaseRecord(record);
    }
    socket.close(1008, reason.slice(0, 123));
  }

  private disconnected(socket: WebSocket): void {
    if (this.socket !== socket) return;
    this.clearHelloTimer();
    this.socket = null;
    this.hello = null;
    const record = this.session;
    if (!record) return;
    if (record.phase === "starting") {
      record.ready.reject(
        new FoundryRunnerError(
          "agent_disconnected",
          "The remote Foundry agent disconnected while starting the session.",
        ),
      );
    } else if (record.phase === "ready") {
      record.terminated.resolve({ kind: "agent_disconnected" });
    } else {
      record.stopped.resolve(false);
    }
    this.releaseRecord(record);
  }

  private releaseRecord(record: AgentSessionRecord): void {
    record.signal.removeEventListener("abort", record.onAbort);
    if (this.session === record) this.session = null;
  }

  private checkHeartbeat(): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (!this.responsive) {
      socket.terminate();
      return;
    }
    this.responsive = false;
    socket.ping();
  }

  private invalidateSocket(): void {
    const socket = this.socket;
    this.socket = null;
    this.hello = null;
    this.clearHelloTimer();
    socket?.terminate();
  }

  private clearHelloTimer(): void {
    if (!this.helloTimer) return;
    clearTimeout(this.helloTimer);
    this.helloTimer = null;
  }
}
