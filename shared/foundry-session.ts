import { z } from "zod";

export const foundrySessionStateSchema = z.enum([
  "unconfigured",
  "stopped",
  "starting",
  "authenticating",
  "ready",
  "stopping",
  "failed",
]);

export type FoundrySessionState = z.infer<typeof foundrySessionStateSchema>;

export const foundryStopReasonSchema = z.enum([
  "requested",
  "ttl_expired",
  "server_shutdown",
  "browser_closed",
  "page_closed",
  "page_crashed",
]);

export type FoundryStopReason = z.infer<typeof foundryStopReasonSchema>;

export const foundrySessionFailureCodeSchema = z.enum([
  "browser_launch_failed",
  "foundry_unreachable",
  "join_form_missing",
  "user_not_found",
  "user_ambiguous",
  "login_rejected",
  "login_timeout",
  "wrong_user",
  "module_inactive",
  "bridge_user_mismatch",
  "browser_closed",
  "page_closed",
  "page_crashed",
  "startup_failed",
]);

export type FoundrySessionFailureCode = z.infer<
  typeof foundrySessionFailureCodeSchema
>;

const nullableTimestampSchema = z.string().datetime({ offset: true }).nullable();

export const foundrySessionFailureSchema = z
  .object({
    code: foundrySessionFailureCodeSchema,
    message: z.string().trim().min(1).max(500),
  })
  .strict();

export type FoundrySessionFailure = z.infer<
  typeof foundrySessionFailureSchema
>;

/**
 * The deliberately secret-free Foundry session snapshot returned to the client.
 * URLs, access keys, browser arguments, and infrastructure identifiers do not
 * belong in this contract.
 */
export const foundrySessionStatusSchema = z
  .object({
    configured: z.boolean(),
    state: foundrySessionStateSchema,
    startedAt: nullableTimestampSchema,
    readyAt: nullableTimestampSchema,
    expiresAt: nullableTimestampSchema,
    stoppedAt: nullableTimestampSchema,
    stopReason: foundryStopReasonSchema.nullable(),
    failure: foundrySessionFailureSchema.nullable(),
    bridgeUser: z.string().trim().min(1).max(200).nullable(),
  })
  .strict();

export type FoundrySessionStatus = z.infer<typeof foundrySessionStatusSchema>;

export const foundrySessionResponseSchema = z
  .object({
    authenticated: z.boolean(),
    session: foundrySessionStatusSchema,
  })
  .strict();

export type FoundrySessionResponse = z.infer<
  typeof foundrySessionResponseSchema
>;
