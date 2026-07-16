import assert from "node:assert/strict";
import { test } from "node:test";
import {
  foundryAgentMessageSchema,
  foundryWebsiteAgentMessageSchema,
} from "./foundry-agent-protocol";

const base = {
  protocolVersion: 1 as const,
  agentId: "zima-home",
  sentAt: "2026-07-15T12:00:00.000Z",
};

test("Foundry agent protocol accepts every strict v1 message variant", () => {
  const sessionId = "21a32776-4d37-4ba2-96c0-9ab4cd16feee";
  for (const message of [
    {
      ...base,
      type: "hello",
      agentVersion: "1.0.0",
      bootId: "51d9e3c5-b079-4c15-82eb-01f5f1a8859d",
      agentState: "idle",
      bridgeUser: "Website Bridge",
    },
    { ...base, type: "session_stage", sessionId, stage: "verifying" },
    {
      ...base,
      type: "session_ready",
      sessionId,
      bridgeUser: "Website Bridge",
    },
    {
      ...base,
      type: "session_failed",
      sessionId,
      failure: { code: "login_timeout" },
    },
    { ...base, type: "session_stopped", sessionId, reason: "requested" },
  ]) {
    assert.equal(foundryAgentMessageSchema.safeParse(message).success, true);
  }

  for (const message of [
    {
      protocolVersion: 1,
      type: "session_start",
      commandId: "80d80d21-b504-4a2e-8d33-117e67c83f8a",
      sessionId,
      expiresAt: "2026-07-15T20:00:00.000Z",
      expectedBridgeUser: "Website Bridge",
    },
    {
      protocolVersion: 1,
      type: "session_stop",
      commandId: "773792e7-e27b-4627-8b40-bb9bcb799484",
      sessionId,
      reason: "requested",
    },
  ]) {
    assert.equal(foundryWebsiteAgentMessageSchema.safeParse(message).success, true);
  }
});

test("Foundry agent protocol rejects additions, bad IDs, and future versions", () => {
  assert.equal(
    foundryAgentMessageSchema.safeParse({
      ...base,
      type: "hello",
      agentVersion: "1.0.0",
      bootId: "51d9e3c5-b079-4c15-82eb-01f5f1a8859d",
      agentState: "idle",
      bridgeUser: "Website Bridge",
      token: "must-not-be-accepted",
    }).success,
    false,
  );
  assert.equal(
    foundryAgentMessageSchema.safeParse({
      ...base,
      type: "hello",
      agentVersion: "1.0.0",
      bootId: "51d9e3c5-b079-4c15-82eb-01f5f1a8859d",
      agentState: "running",
      bridgeUser: "Website Bridge",
    }).success,
    false,
  );
  assert.equal(
    foundryAgentMessageSchema.safeParse({
      ...base,
      type: "session_failed",
      sessionId: "21a32776-4d37-4ba2-96c0-9ab4cd16feee",
      failure: { code: "login_timeout", message: "untrusted detail" },
    }).success,
    false,
  );
  assert.equal(
    foundryWebsiteAgentMessageSchema.safeParse({
      protocolVersion: 2,
      type: "session_stop",
      commandId: "not-a-uuid",
      sessionId: "not-a-uuid",
      reason: "requested",
    }).success,
    false,
  );
});
