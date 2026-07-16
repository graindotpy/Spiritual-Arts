import assert from "node:assert/strict";
import { test } from "node:test";
import { readFoundrySessionConfig } from "./config";

const complete = {
  NODE_ENV: "production",
  FOUNDRY_WORLD_URL: "https://foundry.example/game",
  FOUNDRY_BRIDGE_USER: "Website Bridge",
  FOUNDRY_BRIDGE_ACCESS_KEY: "do-not-expose",
};

test("Foundry browser configuration is optional", () => {
  assert.deepEqual(readFoundrySessionConfig({}), {
    config: null,
    warning: null,
  });
});

test("Foundry browser configuration applies bounded safe defaults", () => {
  const result = readFoundrySessionConfig(complete);
  assert.equal(result.warning, null);
  assert.deepEqual(result.config, {
    mode: "local",
    worldUrl: "https://foundry.example/game",
    userName: "Website Bridge",
    accessKey: "do-not-expose",
    maxSessionMs: 480 * 60_000,
    headless: true,
    disableCanvas: true,
  });
});

test("remote agent mode needs only its identity, strong token, and bridge user", () => {
  const result = readFoundrySessionConfig({
    FOUNDRY_SESSION_MODE: "agent",
    FOUNDRY_AGENT_ID: "zima-home",
    FOUNDRY_AGENT_TOKEN: "a".repeat(64),
    FOUNDRY_BRIDGE_USER: "Website Bridge",
  });
  assert.equal(result.warning, null);
  assert.deepEqual(result.config, {
    mode: "agent",
    agentId: "zima-home",
    agentToken: "a".repeat(64),
    userName: "Website Bridge",
    maxSessionMs: 480 * 60_000,
  });
  assert.equal("worldUrl" in (result.config ?? {}), false);
  assert.equal("accessKey" in (result.config ?? {}), false);
});

test("agent variables autodetect mode and invalid agent config is secret-free", () => {
  const autodetected = readFoundrySessionConfig({
    FOUNDRY_AGENT_ID: "zima-home",
    FOUNDRY_AGENT_TOKEN: "b".repeat(64),
    FOUNDRY_BRIDGE_USER: "Website Bridge",
  });
  assert.equal(autodetected.config?.mode, "agent");

  const weakToken = "do-not-print-this-token";
  const invalid = readFoundrySessionConfig({
    FOUNDRY_SESSION_MODE: "agent",
    FOUNDRY_AGENT_ID: "zima-home",
    FOUNDRY_AGENT_TOKEN: weakToken,
    FOUNDRY_BRIDGE_USER: "Website Bridge",
  });
  assert.equal(invalid.config, null);
  assert.match(invalid.warning ?? "", /64-character hexadecimal/);
  assert.equal(invalid.warning?.includes(weakToken), false);

  const controlCharacterUser = readFoundrySessionConfig({
    FOUNDRY_SESSION_MODE: "agent",
    FOUNDRY_AGENT_ID: "zima-home",
    FOUNDRY_AGENT_TOKEN: "b".repeat(64),
    FOUNDRY_BRIDGE_USER: "Website\nBridge",
  });
  assert.equal(controlCharacterUser.config, null);
  assert.match(controlCharacterUser.warning ?? "", /printable characters/);
});

test("explicit modes reject missing variables and invalid mode names", () => {
  const missingAgent = readFoundrySessionConfig({
    FOUNDRY_SESSION_MODE: "agent",
    FOUNDRY_BRIDGE_USER: "Website Bridge",
  });
  assert.equal(missingAgent.config, null);
  assert.match(missingAgent.warning ?? "", /FOUNDRY_AGENT_ID/);
  assert.match(missingAgent.warning ?? "", /FOUNDRY_AGENT_TOKEN/);

  const invalidMode = readFoundrySessionConfig({
    ...complete,
    FOUNDRY_SESSION_MODE: "remote",
  });
  assert.equal(invalidMode.config, null);
  assert.match(invalidMode.warning ?? "", /local or agent/);
});

test("partial and unsafe Foundry browser configuration is disabled safely", () => {
  const partial = readFoundrySessionConfig({
    FOUNDRY_WORLD_URL: complete.FOUNDRY_WORLD_URL,
  });
  assert.equal(partial.config, null);
  assert.match(partial.warning ?? "", /FOUNDRY_BRIDGE_USER/);
  assert.doesNotMatch(partial.warning ?? "", /foundry\.example/);

  const insecure = readFoundrySessionConfig({
    ...complete,
    FOUNDRY_WORLD_URL: "http://foundry.example/game",
  });
  assert.equal(insecure.config, null);
  assert.match(insecure.warning ?? "", /HTTPS/);

  const embeddedCredentials = readFoundrySessionConfig({
    ...complete,
    FOUNDRY_WORLD_URL: "https://name:password@foundry.example/game",
  });
  assert.equal(embeddedCredentials.config, null);
});

test("session duration and headed mode are explicitly bounded", () => {
  const configured = readFoundrySessionConfig({
    ...complete,
    NODE_ENV: "development",
    FOUNDRY_SESSION_MAX_MINUTES: "15",
    FOUNDRY_HEADLESS: "false",
  });
  assert.equal(configured.config?.maxSessionMs, 15 * 60_000);
  assert.equal(configured.config?.headless, false);

  for (const invalid of ["0", "14", "1441", "1.5", "eight hours"]) {
    assert.equal(
      readFoundrySessionConfig({
        ...complete,
        FOUNDRY_SESSION_MAX_MINUTES: invalid,
      }).config,
      null,
    );
  }

  const productionHeaded = readFoundrySessionConfig({
    ...complete,
    FOUNDRY_HEADLESS: "false",
  });
  assert.equal(productionHeaded.config, null);
  assert.match(productionHeaded.warning ?? "", /true in production/);

  const canvasEnabled = readFoundrySessionConfig({
    ...complete,
    FOUNDRY_DISABLE_CANVAS: "false",
  });
  assert.equal(
    canvasEnabled.config?.mode === "local"
      ? canvasEnabled.config.disableCanvas
      : undefined,
    false,
  );
  assert.equal(
    readFoundrySessionConfig({
      ...complete,
      FOUNDRY_DISABLE_CANVAS: "sometimes",
    }).config,
    null,
  );
});

test("development permits HTTP only for a loopback Foundry server", () => {
  const local = readFoundrySessionConfig({
    ...complete,
    NODE_ENV: "development",
    FOUNDRY_WORLD_URL: "http://127.0.0.1:30000/join",
  });
  assert.equal(local.config?.worldUrl, "http://127.0.0.1:30000/join");

  const remote = readFoundrySessionConfig({
    ...complete,
    NODE_ENV: "development",
    FOUNDRY_WORLD_URL: "http://foundry.example/join",
  });
  assert.equal(remote.config, null);
});
