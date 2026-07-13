import { z } from "zod";
import { dieSizeSchema } from "./spirit-dice";

export const REALTIME_PROTOCOL_VERSION = 1 as const;

export const spiritDieRollBroadcastSchema = z.object({
  character: z.object({
    id: z.string(),
    name: z.string(),
    path: z.string(),
    level: z.number().int().min(1).max(20),
    portraitUrl: z.string().nullable(),
  }),
  roll: z.object({
    spInvestment: z.number().int().positive(),
    dieSize: dieSizeSchema,
    dieIndex: z.number().int().nonnegative(),
    value: z.number().int().positive(),
    success: z.boolean(),
    techniqueId: z.string().uuid().nullable().optional(),
    techniqueName: z.string().trim().min(1).max(255).nullable().optional(),
    timestamp: z.string().datetime(),
  }),
});

export const spiritDieRollMessageSchema = z.object({
  protocolVersion: z.literal(REALTIME_PROTOCOL_VERSION),
  eventId: z.string().uuid(),
  type: z.literal("spirit_die_roll"),
  data: spiritDieRollBroadcastSchema,
});

export type SpiritDieRollBroadcast = z.infer<typeof spiritDieRollBroadcastSchema>;
export type SpiritDieRollMessage = z.infer<typeof spiritDieRollMessageSchema>;

export function createSpiritDieRollMessage(
  eventId: string,
  data: SpiritDieRollBroadcast,
): SpiritDieRollMessage {
  return {
    protocolVersion: REALTIME_PROTOCOL_VERSION,
    eventId,
    type: "spirit_die_roll",
    data,
  };
}
