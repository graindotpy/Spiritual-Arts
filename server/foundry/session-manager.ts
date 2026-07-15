import {
  FoundryRunnerError,
  type FoundryConnection,
  type FoundryConnectionStage,
  type FoundryConnectionTermination,
  type FoundryConnector,
  type FoundrySessionConfig,
  type FoundrySessionFailure,
  type FoundrySessionStatus,
  type FoundryStopReason,
} from "./types";

export interface FoundrySessionClock {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface FoundrySessionLogger {
  error(message: string, error?: unknown): void;
}

const systemClock: FoundrySessionClock = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

const defaultLogger: FoundrySessionLogger = {
  error: (message, error) => console.error(message, error),
};

interface SafeErrorLog {
  name: string;
  message: string;
  stack?: string;
}

function redactText(
  text: string,
  config: Readonly<FoundrySessionConfig> | null,
): string {
  let redacted = text;
  for (const secret of [config?.accessKey, config?.worldUrl]) {
    if (secret) redacted = redacted.split(secret).join("[redacted]");
  }
  return redacted;
}

function safeErrorLog(
  error: unknown,
  config: Readonly<FoundrySessionConfig> | null,
): SafeErrorLog {
  if (!(error instanceof Error)) {
    return {
      name: "NonErrorFailure",
      message: "A non-Error value was thrown",
    };
  }

  return {
    name: error.name,
    message: redactText(error.message, config),
    ...(error.stack ? { stack: redactText(error.stack, config) } : {}),
  };
}

function iso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function failureFor(error: unknown): FoundrySessionFailure {
  if (error instanceof FoundryRunnerError) {
    return { code: error.code, message: error.publicMessage };
  }

  return {
    code: "startup_failed",
    message: "The Foundry system user could not be connected.",
  };
}

function failureForTermination(
  termination: FoundryConnectionTermination,
): FoundrySessionFailure {
  if (termination.kind === "page_crashed") {
    return {
      code: "page_crashed",
      message: "The Foundry browser page crashed and was disconnected.",
    };
  }
  if (termination.kind === "page_closed") {
    return {
      code: "page_closed",
      message: "The Foundry browser page closed unexpectedly.",
    };
  }
  return {
    code: "browser_closed",
    message: "The Foundry browser closed unexpectedly.",
  };
}

function stageState(
  stage: FoundryConnectionStage,
): "starting" | "authenticating" {
  return stage === "authenticating" || stage === "verifying"
    ? "authenticating"
    : "starting";
}

function unrefTimer(handle: unknown): void {
  if (
    typeof handle === "object" &&
    handle !== null &&
    "unref" in handle &&
    typeof (handle as { unref?: unknown }).unref === "function"
  ) {
    (handle as { unref: () => void }).unref();
  }
}

export class FoundrySessionManager {
  private readonly config: Readonly<FoundrySessionConfig> | null;
  private readonly connector: FoundryConnector;
  private readonly clock: FoundrySessionClock;
  private readonly logger: FoundrySessionLogger;

  private currentStatus: FoundrySessionStatus;
  private connection: FoundryConnection | null = null;
  private startTask: Promise<void> | null = null;
  private stopTask: Promise<FoundrySessionStatus> | null = null;
  private abortController: AbortController | null = null;
  private expiryTimer: unknown = null;
  private runId = 0;
  private disposed = false;

  constructor(
    config: Readonly<FoundrySessionConfig> | null,
    connector: FoundryConnector,
    options: {
      clock?: FoundrySessionClock;
      logger?: FoundrySessionLogger;
    } = {},
  ) {
    if (config && (!Number.isFinite(config.maxSessionMs) || config.maxSessionMs <= 0)) {
      throw new TypeError("Foundry maxSessionMs must be a positive number");
    }

    this.config = config;
    this.connector = connector;
    this.clock = options.clock ?? systemClock;
    this.logger = options.logger ?? defaultLogger;
    this.currentStatus = {
      configured: config !== null,
      state: config === null ? "unconfigured" : "stopped",
      startedAt: null,
      readyAt: null,
      expiresAt: null,
      stoppedAt: null,
      stopReason: null,
      failure: null,
      bridgeUser: config?.userName ?? null,
    };
  }

  status(): FoundrySessionStatus {
    return {
      ...this.currentStatus,
      failure: this.currentStatus.failure
        ? { ...this.currentStatus.failure }
        : null,
    };
  }

  /**
   * Begin connecting without holding the HTTP request open while Foundry loads.
   * Repeated calls while a start, stop, or live session is active are no-ops.
   */
  start(): FoundrySessionStatus {
    if (this.config === null || this.disposed) return this.status();
    if (
      this.currentStatus.state === "starting" ||
      this.currentStatus.state === "authenticating" ||
      this.currentStatus.state === "ready" ||
      this.currentStatus.state === "stopping"
    ) {
      return this.status();
    }

    const startedAt = this.clock.now();
    const runId = ++this.runId;
    const abortController = new AbortController();
    this.abortController = abortController;
    this.currentStatus = {
      configured: true,
      state: "starting",
      startedAt: iso(startedAt),
      readyAt: null,
      expiresAt: iso(startedAt + this.config.maxSessionMs),
      stoppedAt: null,
      stopReason: null,
      failure: null,
      bridgeUser: this.config.userName,
    };

    this.clearExpiryTimer();
    this.expiryTimer = this.clock.setTimeout(() => {
      void this.stop("ttl_expired").catch((error: unknown) => {
        this.logError("Failed to stop the expired Foundry session", error);
      });
    }, this.config.maxSessionMs);
    unrefTimer(this.expiryTimer);

    const startTask = this.connect(runId, abortController);
    this.startTask = startTask;
    void startTask.finally(() => {
      if (this.startTask === startTask) this.startTask = null;
    });

    return this.status();
  }

  async stop(
    reason: FoundryStopReason = "requested",
  ): Promise<FoundrySessionStatus> {
    if (this.config === null) return this.status();
    if (this.stopTask) return this.stopTask;
    if (this.currentStatus.state === "stopped") return this.status();

    const stopTask = this.performStop(reason);
    this.stopTask = stopTask;
    try {
      return await stopTask;
    } finally {
      if (this.stopTask === stopTask) this.stopTask = null;
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      if (this.stopTask) await this.stopTask;
      return;
    }
    this.disposed = true;
    await this.stop("server_shutdown");
  }

  private async connect(
    runId: number,
    abortController: AbortController,
  ): Promise<void> {
    try {
      const connection = await this.connector.connect(
        this.config as Readonly<FoundrySessionConfig>,
        abortController.signal,
        (stage) => this.updateStage(runId, abortController, stage),
      );

      if (
        runId !== this.runId ||
        abortController.signal.aborted ||
        this.currentStatus.state === "stopping"
      ) {
        await this.closeConnection(connection, "start cancelled");
        return;
      }

      this.connection = connection;
      this.abortController = null;
      this.currentStatus = {
        ...this.currentStatus,
        state: "ready",
        readyAt: iso(this.clock.now()),
        failure: null,
      };

      void connection.terminated
        .then((termination) =>
          this.handleUnexpectedTermination(runId, connection, termination),
        )
        .catch((error: unknown) => {
          this.logError(
            "Failed while monitoring the Foundry browser session",
            error,
          );
        });
    } catch (error: unknown) {
      if (
        runId !== this.runId ||
        abortController.signal.aborted ||
        this.currentStatus.state === "stopping"
      ) {
        return;
      }

      this.abortController = null;
      this.clearExpiryTimer();
      this.currentStatus = {
        ...this.currentStatus,
        state: "failed",
        expiresAt: null,
        stoppedAt: iso(this.clock.now()),
        failure: failureFor(error),
      };
      this.logError(
        "Failed to connect the Foundry system user",
        error instanceof FoundryRunnerError ? error.cause ?? error : error,
      );
    }
  }

  private updateStage(
    runId: number,
    abortController: AbortController,
    stage: FoundryConnectionStage,
  ): void {
    if (
      runId !== this.runId ||
      abortController.signal.aborted ||
      (this.currentStatus.state !== "starting" &&
        this.currentStatus.state !== "authenticating")
    ) {
      return;
    }

    const nextState = stageState(stage);
    // A late "opening" callback must not regress an authentication state.
    if (
      this.currentStatus.state === "authenticating" &&
      nextState === "starting"
    ) {
      return;
    }
    this.currentStatus = { ...this.currentStatus, state: nextState };
  }

  private async performStop(
    reason: FoundryStopReason,
  ): Promise<FoundrySessionStatus> {
    this.currentStatus = {
      ...this.currentStatus,
      state: "stopping",
      stopReason: reason,
      failure: null,
    };
    this.clearExpiryTimer();
    this.abortController?.abort();
    this.abortController = null;

    const pendingStart = this.startTask;
    if (pendingStart) await pendingStart;

    const connection = this.connection;
    this.connection = null;
    if (connection) await this.closeConnection(connection, reason);

    this.runId += 1;
    this.currentStatus = {
      ...this.currentStatus,
      state: "stopped",
      expiresAt: null,
      stoppedAt: iso(this.clock.now()),
      stopReason: reason,
      failure: null,
    };
    return this.status();
  }

  private async handleUnexpectedTermination(
    runId: number,
    connection: FoundryConnection,
    termination: FoundryConnectionTermination,
  ): Promise<void> {
    if (
      runId !== this.runId ||
      this.connection !== connection ||
      this.currentStatus.state === "stopping" ||
      this.currentStatus.state === "stopped"
    ) {
      return;
    }

    this.connection = null;
    this.clearExpiryTimer();
    this.currentStatus = {
      ...this.currentStatus,
      state: "failed",
      expiresAt: null,
      stoppedAt: iso(this.clock.now()),
      stopReason: termination.kind,
      failure: failureForTermination(termination),
    };
    await this.closeConnection(connection, termination.kind);
  }

  private async closeConnection(
    connection: FoundryConnection,
    reason: string,
  ): Promise<void> {
    try {
      await connection.close(reason);
    } catch (error: unknown) {
      this.logError("Failed to close the Foundry browser cleanly", error);
    }
  }

  private logError(message: string, error: unknown): void {
    this.logger.error(message, safeErrorLog(error, this.config));
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer === null) return;
    this.clock.clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
  }
}
