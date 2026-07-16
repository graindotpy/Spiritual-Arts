import type { FoundrySessionFailureCode } from "@shared/foundry-session";

export type {
  FoundrySessionFailure,
  FoundrySessionFailureCode,
  FoundrySessionMode,
  FoundrySessionState,
  FoundrySessionStatus,
  FoundryStopReason,
} from "@shared/foundry-session";

/** Internal compatibility alias; the public source of truth is shared. */
export type FoundryFailureCode = FoundrySessionFailureCode;

interface FoundryBaseSessionConfig {
  userName: string;
  maxSessionMs: number;
}

export interface LocalFoundrySessionConfig extends FoundryBaseSessionConfig {
  /** Omitted by older callers and tests; local remains the compatibility mode. */
  mode?: "local";
  worldUrl: string;
  accessKey: string;
  headless: boolean;
  disableCanvas?: boolean;
  navigationTimeoutMs?: number;
  loginTimeoutMs?: number;
  actionTimeoutMs?: number;
}

export interface AgentFoundrySessionConfig extends FoundryBaseSessionConfig {
  mode: "agent";
  agentId: string;
  agentToken: string;
}

export type FoundrySessionConfig =
  | LocalFoundrySessionConfig
  | AgentFoundrySessionConfig;

export type FoundryConnectionStage =
  | "launching"
  | "opening"
  | "authenticating"
  | "verifying";

export type FoundryConnectionTermination = {
  kind:
    | "browser_closed"
    | "page_closed"
    | "page_crashed"
    | "agent_disconnected"
    | "agent_stopped";
};

export interface FoundryConnection {
  /** Resolves only when the live session ends unexpectedly. */
  readonly terminated: Promise<FoundryConnectionTermination>;
  close(reason: string): Promise<void>;
}

export interface FoundryConnector {
  /** Null for an in-process connector; boolean for a remote agent connector. */
  available?(): boolean | null;
  connect(
    config: Readonly<FoundrySessionConfig>,
    signal: AbortSignal,
    onStage: (stage: FoundryConnectionStage) => void,
  ): Promise<FoundryConnection>;
}

export class FoundryRunnerError extends Error {
  readonly code: FoundryFailureCode;
  readonly publicMessage: string;
  readonly cause?: unknown;

  constructor(
    code: FoundryFailureCode,
    publicMessage: string,
    options: { cause?: unknown } = {},
  ) {
    super(publicMessage);
    this.name = "FoundryRunnerError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.cause = options.cause;
  }
}
