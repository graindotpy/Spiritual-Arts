import type { FoundrySessionFailureCode } from "@shared/foundry-session";

export type {
  FoundrySessionFailure,
  FoundrySessionFailureCode,
  FoundrySessionState,
  FoundrySessionStatus,
  FoundryStopReason,
} from "@shared/foundry-session";

/** Internal compatibility alias; the public source of truth is shared. */
export type FoundryFailureCode = FoundrySessionFailureCode;

export interface FoundrySessionConfig {
  worldUrl: string;
  userName: string;
  accessKey: string;
  maxSessionMs: number;
  headless: boolean;
  navigationTimeoutMs?: number;
  loginTimeoutMs?: number;
  actionTimeoutMs?: number;
}

export type FoundryConnectionStage =
  | "launching"
  | "opening"
  | "authenticating"
  | "verifying";

export type FoundryConnectionTermination = {
  kind: "browser_closed" | "page_closed" | "page_crashed";
};

export interface FoundryConnection {
  /** Resolves only when the live session ends unexpectedly. */
  readonly terminated: Promise<FoundryConnectionTermination>;
  close(reason: string): Promise<void>;
}

export interface FoundryConnector {
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
