import { z } from "zod";
import { dieSizeSchema } from "./spirit-dice";

const spiritDieRollBroadcastSchema = z.object({
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
    timestamp: z.string().datetime(),
  }),
});

export const spiritDieRollMessageSchema = z.object({
  type: z.literal("spirit_die_roll"),
  data: spiritDieRollBroadcastSchema,
});

export type SpiritDieRollBroadcast = z.infer<typeof spiritDieRollBroadcastSchema>;
