import { z } from "zod";
import { foundrySessionFailureCodeSchema } from "./foundry-session";

export const FOUNDRY_AGENT_PROTOCOL_VERSION = 1 as const;
export const FOUNDRY_AGENT_WEBSOCKET_PATH = "/ws/foundry-agent";

const protocolVersionSchema = z.literal(FOUNDRY_AGENT_PROTOCOL_VERSION);
const agentIdSchema = z.string().trim().min(1).max(128);
const agentVersionSchema = z.string().trim().min(1).max(100);
const bridgeUserSchema = z.string().trim().min(1).max(200);
const timestampSchema = z.string().datetime({ offset: true });
const sessionIdSchema = z.string().uuid();
const commandIdSchema = z.string().uuid();

export const foundryAgentStageSchema = z.enum([
  "launching",
  "opening",
  "authenticating",
  "verifying",
]);

export const foundryAgentHelloSchema = z
  .object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("hello"),
    agentId: agentIdSchema,
    agentVersion: agentVersionSchema,
    bootId: z.string().uuid(),
    agentState: z.literal("idle"),
    bridgeUser: bridgeUserSchema,
    sentAt: timestampSchema,
  })
  .strict();

export const foundryAgentSessionStageSchema = z
  .object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("session_stage"),
    agentId: agentIdSchema,
    sessionId: sessionIdSchema,
    stage: foundryAgentStageSchema,
    sentAt: timestampSchema,
  })
  .strict();

export const foundryAgentSessionReadySchema = z
  .object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("session_ready"),
    agentId: agentIdSchema,
    sessionId: sessionIdSchema,
    bridgeUser: bridgeUserSchema,
    sentAt: timestampSchema,
  })
  .strict();

export const foundryAgentSessionFailedSchema = z
  .object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("session_failed"),
    agentId: agentIdSchema,
    sessionId: sessionIdSchema,
    failure: z
      .object({
        code: foundrySessionFailureCodeSchema,
      })
      .strict(),
    sentAt: timestampSchema,
  })
  .strict();

export const foundryAgentSessionStoppedSchema = z
  .object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("session_stopped"),
    agentId: agentIdSchema,
    sessionId: sessionIdSchema,
    reason: z.string().trim().min(1).max(100),
    sentAt: timestampSchema,
  })
  .strict();

export const foundryAgentMessageSchema = z.discriminatedUnion("type", [
  foundryAgentHelloSchema,
  foundryAgentSessionStageSchema,
  foundryAgentSessionReadySchema,
  foundryAgentSessionFailedSchema,
  foundryAgentSessionStoppedSchema,
]);

export const foundryAgentSessionStartSchema = z
  .object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("session_start"),
    commandId: commandIdSchema,
    sessionId: sessionIdSchema,
    expiresAt: timestampSchema,
    expectedBridgeUser: bridgeUserSchema,
  })
  .strict();

export const foundryAgentSessionStopSchema = z
  .object({
    protocolVersion: protocolVersionSchema,
    type: z.literal("session_stop"),
    commandId: commandIdSchema,
    sessionId: sessionIdSchema,
    reason: z.string().trim().min(1).max(100),
  })
  .strict();

export const foundryWebsiteAgentMessageSchema = z.discriminatedUnion("type", [
  foundryAgentSessionStartSchema,
  foundryAgentSessionStopSchema,
]);

export type FoundryAgentStage = z.infer<typeof foundryAgentStageSchema>;
export type FoundryAgentHello = z.infer<typeof foundryAgentHelloSchema>;
export type FoundryAgentMessage = z.infer<typeof foundryAgentMessageSchema>;
export type FoundryAgentSessionStart = z.infer<
  typeof foundryAgentSessionStartSchema
>;
export type FoundryAgentSessionStop = z.infer<
  typeof foundryAgentSessionStopSchema
>;
export type FoundryWebsiteAgentMessage = z.infer<
  typeof foundryWebsiteAgentMessageSchema
>;
