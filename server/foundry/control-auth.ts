import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const DEFAULT_SESSION_DURATION_MS = 12 * 60 * 60 * 1_000;
const DEFAULT_ATTEMPT_WINDOW_MS = 15 * 60 * 1_000;
const DEFAULT_MAX_FAILED_ATTEMPTS = 8;
const MAX_TRACKED_CLIENTS = 1_000;
const MAX_ACTIVE_SESSIONS = 20;

interface LoginAttempt {
  failures: number;
  resetsAt: number;
}

interface ControlSession {
  expiresAt: number;
}

interface FoundryControlAuthOptions {
  password?: string;
  now?: () => number;
  createToken?: () => string;
  sessionDurationMs?: number;
  attemptWindowMs?: number;
  maxFailedAttempts?: number;
}

export type FoundryControlAuthFailure =
  | "not_configured"
  | "invalid_password"
  | "rate_limited";

export class FoundryControlAuthError extends Error {
  constructor(readonly code: FoundryControlAuthFailure) {
    super(code);
    this.name = "FoundryControlAuthError";
  }
}

export interface FoundryControlLogin {
  token: string;
  expiresAt: number;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function positiveInteger(value: number, fallback: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

/**
 * Process-local authorization for the small, privileged Foundry control API.
 * Sessions intentionally disappear on a deploy or restart so a stale browser
 * cannot silently retain permission to launch compute.
 */
export class FoundryControlAuth {
  private readonly passwordDigest: Buffer | undefined;
  private readonly now: () => number;
  private readonly createToken: () => string;
  private readonly sessionDurationMs: number;
  private readonly attemptWindowMs: number;
  private readonly maxFailedAttempts: number;
  private readonly sessions = new Map<string, ControlSession>();
  private readonly attempts = new Map<string, LoginAttempt>();

  constructor(options: FoundryControlAuthOptions = {}) {
    const password = options.password?.trim();
    this.passwordDigest = password ? digest(password) : undefined;
    this.now = options.now ?? Date.now;
    this.createToken =
      options.createToken ?? (() => randomBytes(32).toString("base64url"));
    this.sessionDurationMs = positiveInteger(
      options.sessionDurationMs ?? DEFAULT_SESSION_DURATION_MS,
      DEFAULT_SESSION_DURATION_MS,
    );
    this.attemptWindowMs = positiveInteger(
      options.attemptWindowMs ?? DEFAULT_ATTEMPT_WINDOW_MS,
      DEFAULT_ATTEMPT_WINDOW_MS,
    );
    this.maxFailedAttempts = positiveInteger(
      options.maxFailedAttempts ?? DEFAULT_MAX_FAILED_ATTEMPTS,
      DEFAULT_MAX_FAILED_ATTEMPTS,
    );
  }

  get configured(): boolean {
    return this.passwordDigest !== undefined;
  }

  login(password: string, clientKey: string): FoundryControlLogin {
    if (!this.passwordDigest) {
      throw new FoundryControlAuthError("not_configured");
    }

    const now = this.now();
    this.prune(now);

    const attempt = this.attempts.get(clientKey);
    if (
      attempt &&
      attempt.resetsAt > now &&
      attempt.failures >= this.maxFailedAttempts
    ) {
      throw new FoundryControlAuthError("rate_limited");
    }

    const suppliedDigest = digest(password);
    if (!timingSafeEqual(this.passwordDigest, suppliedDigest)) {
      this.recordFailure(clientKey, now);
      throw new FoundryControlAuthError("invalid_password");
    }

    this.attempts.delete(clientKey);
    const token = this.createToken();
    const expiresAt = now + this.sessionDurationMs;
    this.sessions.set(digest(token).toString("hex"), { expiresAt });
    this.trimSessions();
    return { token, expiresAt };
  }

  isAuthorized(token: string | undefined): boolean {
    if (!token) return false;

    const now = this.now();
    const key = digest(token).toString("hex");
    const session = this.sessions.get(key);
    if (!session || session.expiresAt <= now) {
      this.sessions.delete(key);
      return false;
    }

    return true;
  }

  revoke(token: string | undefined): void {
    if (token) {
      this.sessions.delete(digest(token).toString("hex"));
    }
  }

  private recordFailure(clientKey: string, now: number): void {
    const current = this.attempts.get(clientKey);
    if (!current || current.resetsAt <= now) {
      this.attempts.set(clientKey, {
        failures: 1,
        resetsAt: now + this.attemptWindowMs,
      });
    } else {
      current.failures += 1;
    }

    if (this.attempts.size > MAX_TRACKED_CLIENTS) {
      const oldestKey = this.attempts.keys().next().value as
        | string
        | undefined;
      if (oldestKey) this.attempts.delete(oldestKey);
    }
  }

  private prune(now: number): void {
    for (const [key, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(key);
    }
    for (const [key, attempt] of this.attempts) {
      if (attempt.resetsAt <= now) this.attempts.delete(key);
    }
  }

  private trimSessions(): void {
    while (this.sessions.size > MAX_ACTIVE_SESSIONS) {
      const oldestKey = this.sessions.keys().next().value as
        | string
        | undefined;
      if (!oldestKey) break;
      this.sessions.delete(oldestKey);
    }
  }
}
