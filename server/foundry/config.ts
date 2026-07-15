import type { FoundrySessionConfig } from "./types";

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

function parseHeadless(raw: string): boolean | null {
  if (!raw || raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

function parseWorldUrl(
  raw: string,
  production: boolean,
): URL | null {
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

/**
 * Invalid optional configuration disables only the Foundry browser rather than
 * taking down the character-sheet website. Warnings contain variable names,
 * never their values.
 */
export function readFoundrySessionConfig(
  environment: NodeJS.ProcessEnv = process.env,
): FoundryConfigResult {
  const worldUrl = value(environment, "FOUNDRY_WORLD_URL");
  const userName = value(environment, "FOUNDRY_BRIDGE_USER");
  const accessKey = value(environment, "FOUNDRY_BRIDGE_ACCESS_KEY");
  const production = value(environment, "NODE_ENV") === "production";
  const supplied = [worldUrl, userName, accessKey].filter(Boolean).length;

  if (supplied === 0) return { config: null, warning: null };
  if (supplied !== 3) {
    const missing = [
      ["FOUNDRY_WORLD_URL", worldUrl],
      ["FOUNDRY_BRIDGE_USER", userName],
      ["FOUNDRY_BRIDGE_ACCESS_KEY", accessKey],
    ]
      .filter(([, configuredValue]) => !configuredValue)
      .map(([name]) => name)
      .join(", ");
    return {
      config: null,
      warning: `Foundry browser disabled; missing ${missing}`,
    };
  }

  const parsedUrl = parseWorldUrl(
    worldUrl,
    production,
  );
  if (!parsedUrl) {
    return {
      config: null,
      warning:
        "Foundry browser disabled; FOUNDRY_WORLD_URL must be HTTPS (or loopback HTTP in development) without embedded credentials",
    };
  }
  if (userName.length > 200) {
    return {
      config: null,
      warning:
        "Foundry browser disabled; FOUNDRY_BRIDGE_USER exceeds 200 characters",
    };
  }
  if (accessKey.length > 1_024) {
    return {
      config: null,
      warning:
        "Foundry browser disabled; FOUNDRY_BRIDGE_ACCESS_KEY exceeds 1024 characters",
    };
  }

  const maxMinutes = parseMaxSessionMinutes(
    value(environment, "FOUNDRY_SESSION_MAX_MINUTES"),
  );
  if (maxMinutes === null) {
    return {
      config: null,
      warning:
        "Foundry browser disabled; FOUNDRY_SESSION_MAX_MINUTES must be an integer from 15 to 1440",
    };
  }

  const headless = parseHeadless(value(environment, "FOUNDRY_HEADLESS"));
  if (headless === null) {
    return {
      config: null,
      warning:
        "Foundry browser disabled; FOUNDRY_HEADLESS must be true or false",
    };
  }
  if (production && !headless) {
    return {
      config: null,
      warning:
        "Foundry browser disabled; FOUNDRY_HEADLESS must be true in production",
    };
  }

  return {
    config: {
      worldUrl: parsedUrl.toString(),
      userName,
      accessKey,
      maxSessionMs: maxMinutes * 60_000,
      headless,
    },
    warning: null,
  };
}
