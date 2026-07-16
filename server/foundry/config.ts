import type {
  AgentFoundrySessionConfig,
  FoundrySessionConfig,
  LocalFoundrySessionConfig,
} from "./types";

const DEFAULT_MAX_SESSION_MINUTES = 8 * 60;
const MIN_SESSION_MINUTES = 15;
const MAX_SESSION_MINUTES = 24 * 60;

export interface FoundryConfigResult {
  config: FoundrySessionConfig | null;
  warning: string | null;
}

function value(environment: NodeJS.ProcessEnv, name: string): string {
  return environment[name]?.trim() ?? "";
}

function parseMaxSessionMinutes(raw: string): number | null {
  if (!raw) return DEFAULT_MAX_SESSION_MINUTES;
  if (!/^\d+$/.test(raw)) return null;

  const minutes = Number(raw);
  return Number.isSafeInteger(minutes) &&
    minutes >= MIN_SESSION_MINUTES &&
    minutes <= MAX_SESSION_MINUTES
    ? minutes
    : null;
}

function parseBoolean(raw: string, defaultValue: boolean): boolean | null {
  if (!raw) return defaultValue;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

function parseWorldUrl(raw: string, production: boolean): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    const isLoopback =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";
    if (url.protocol !== "https:" && (production || !isLoopback)) return null;
    return url;
  } catch {
    return null;
  }
}

function commonConfig(
  environment: NodeJS.ProcessEnv,
): { userName: string; maxSessionMs: number } | { warning: string } {
  const userName = value(environment, "FOUNDRY_BRIDGE_USER");
  if (!userName) {
    return { warning: "Foundry session disabled; missing FOUNDRY_BRIDGE_USER" };
  }
  if (userName.length > 200 || /[\u0000-\u001f\u007f]/.test(userName)) {
    return {
      warning:
        "Foundry session disabled; FOUNDRY_BRIDGE_USER must contain at most 200 printable characters",
    };
  }

  const maxMinutes = parseMaxSessionMinutes(
    value(environment, "FOUNDRY_SESSION_MAX_MINUTES"),
  );
  if (maxMinutes === null) {
    return {
      warning:
        "Foundry session disabled; FOUNDRY_SESSION_MAX_MINUTES must be an integer from 15 to 1440",
    };
  }

  return { userName, maxSessionMs: maxMinutes * 60_000 };
}

function readLocalConfig(
  environment: NodeJS.ProcessEnv,
): FoundryConfigResult {
  const worldUrl = value(environment, "FOUNDRY_WORLD_URL");
  const accessKey = value(environment, "FOUNDRY_BRIDGE_ACCESS_KEY");
  const common = commonConfig(environment);
  const missing = [
    ["FOUNDRY_WORLD_URL", worldUrl],
    ["FOUNDRY_BRIDGE_ACCESS_KEY", accessKey],
  ]
    .filter(([, configuredValue]) => !configuredValue)
    .map(([name]) => name);
  if ("warning" in common && !value(environment, "FOUNDRY_BRIDGE_USER")) {
    missing.splice(1, 0, "FOUNDRY_BRIDGE_USER");
  }
  if (missing.length > 0) {
    return {
      config: null,
      warning: `Foundry local browser disabled; missing ${missing.join(", ")}`,
    };
  }
  if ("warning" in common) return { config: null, warning: common.warning };

  const production = value(environment, "NODE_ENV") === "production";
  const parsedUrl = parseWorldUrl(worldUrl, production);
  if (!parsedUrl) {
    return {
      config: null,
      warning:
        "Foundry local browser disabled; FOUNDRY_WORLD_URL must be HTTPS (or loopback HTTP in development) without embedded credentials",
    };
  }
  if (accessKey.length > 1_024) {
    return {
      config: null,
      warning:
        "Foundry local browser disabled; FOUNDRY_BRIDGE_ACCESS_KEY exceeds 1024 characters",
    };
  }

  const headless = parseBoolean(value(environment, "FOUNDRY_HEADLESS"), true);
  if (headless === null) {
    return {
      config: null,
      warning: "Foundry local browser disabled; FOUNDRY_HEADLESS must be true or false",
    };
  }
  if (production && !headless) {
    return {
      config: null,
      warning:
        "Foundry local browser disabled; FOUNDRY_HEADLESS must be true in production",
    };
  }

  const disableCanvas = parseBoolean(
    value(environment, "FOUNDRY_DISABLE_CANVAS"),
    true,
  );
  if (disableCanvas === null) {
    return {
      config: null,
      warning:
        "Foundry local browser disabled; FOUNDRY_DISABLE_CANVAS must be true or false",
    };
  }

  const config: LocalFoundrySessionConfig = {
    mode: "local",
    worldUrl: parsedUrl.toString(),
    userName: common.userName,
    accessKey,
    maxSessionMs: common.maxSessionMs,
    headless,
    disableCanvas,
  };
  return { config, warning: null };
}

function readAgentConfig(
  environment: NodeJS.ProcessEnv,
): FoundryConfigResult {
  const agentId = value(environment, "FOUNDRY_AGENT_ID");
  const agentToken = value(environment, "FOUNDRY_AGENT_TOKEN");
  const common = commonConfig(environment);
  const missing = [
    ["FOUNDRY_AGENT_ID", agentId],
    ["FOUNDRY_AGENT_TOKEN", agentToken],
    ["FOUNDRY_BRIDGE_USER", value(environment, "FOUNDRY_BRIDGE_USER")],
  ]
    .filter(([, configuredValue]) => !configuredValue)
    .map(([name]) => name);
  if (missing.length > 0) {
    return {
      config: null,
      warning: `Foundry agent mode disabled; missing ${missing.join(", ")}`,
    };
  }
  if ("warning" in common) return { config: null, warning: common.warning };
  if (agentId.length > 128 || /[\u0000-\u001f\u007f]/.test(agentId)) {
    return {
      config: null,
      warning:
        "Foundry agent mode disabled; FOUNDRY_AGENT_ID must be at most 128 printable characters",
    };
  }
  if (!/^[a-fA-F0-9]{64}$/.test(agentToken)) {
    return {
      config: null,
      warning:
        "Foundry agent mode disabled; FOUNDRY_AGENT_TOKEN must be a 64-character hexadecimal secret",
    };
  }

  const config: AgentFoundrySessionConfig = {
    mode: "agent",
    agentId,
    agentToken,
    userName: common.userName,
    maxSessionMs: common.maxSessionMs,
  };
  return { config, warning: null };
}

/**
 * Invalid optional configuration disables only Foundry session control rather
 * than taking down the website. Warnings name variables but never their values.
 * Without an explicit mode, agent-specific variables select agent mode and the
 * legacy world URL/access-key variables continue to select local mode.
 */
export function readFoundrySessionConfig(
  environment: NodeJS.ProcessEnv = process.env,
): FoundryConfigResult {
  const explicitMode = value(environment, "FOUNDRY_SESSION_MODE");
  if (explicitMode && explicitMode !== "local" && explicitMode !== "agent") {
    return {
      config: null,
      warning:
        "Foundry session disabled; FOUNDRY_SESSION_MODE must be local or agent",
    };
  }

  const hasAgentValues = Boolean(
    value(environment, "FOUNDRY_AGENT_ID") ||
      value(environment, "FOUNDRY_AGENT_TOKEN"),
  );
  const hasLocalValues = Boolean(
    value(environment, "FOUNDRY_WORLD_URL") ||
      value(environment, "FOUNDRY_BRIDGE_ACCESS_KEY"),
  );
  const hasSharedValues = Boolean(
    value(environment, "FOUNDRY_BRIDGE_USER"),
  );

  if (!explicitMode && !hasAgentValues && !hasLocalValues && !hasSharedValues) {
    return { config: null, warning: null };
  }

  const mode = explicitMode || (hasAgentValues ? "agent" : "local");
  return mode === "agent"
    ? readAgentConfig(environment)
    : readLocalConfig(environment);
}
