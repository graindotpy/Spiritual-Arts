import { z } from "zod";
import { foundryActionSchema } from "./mechanics";
import { dieSizeSchema } from "./spirit-dice";

export const REALTIME_PROTOCOL_VERSION = 1 as const;
export const MAX_INVESTMENT_EFFECT_LENGTH = 8_000;
export const MIN_SPIRITUAL_ARTS_ATTACK_MODIFIER = -3;
export const MAX_SPIRITUAL_ARTS_ATTACK_MODIFIER = 16;

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
    investmentEffect: z
      .string()
      .trim()
      .min(1)
      .max(MAX_INVESTMENT_EFFECT_LENGTH)
      .nullable()
      .optional(),
    timestamp: z.string().datetime(),
  }),
});

export const spiritDieRollMessageSchema = z.object({
  protocolVersion: z.literal(REALTIME_PROTOCOL_VERSION),
  eventId: z.string().uuid(),
  type: z.literal("spirit_die_roll"),
  data: spiritDieRollBroadcastSchema,
});

const foundryActionCharacterSchema = z
  .object({
    id: z.string().min(1).max(255),
    name: z.string().trim().min(1).max(255),
    path: z.string().trim().min(1).max(255),
    level: z.number().int().min(1).max(20),
    portraitUrl: z.string().min(1).max(2_048).nullable(),
    spiritualArtsDc: z.number().int().min(1).max(100).nullable().optional(),
    spiritualArtsAttackModifier: z
      .number()
      .int()
      .min(MIN_SPIRITUAL_ARTS_ATTACK_MODIFIER)
      .max(MAX_SPIRITUAL_ARTS_ATTACK_MODIFIER)
      .nullable()
      .optional(),
  })
  .strict();

function validateFoundryActionDerivedValues(
  data: {
    character: z.infer<typeof foundryActionCharacterSchema>;
    action: z.infer<typeof foundryActionSchema>;
  },
  context: z.RefinementCtx,
): void {
  const attackModifier = data.character.spiritualArtsAttackModifier;
  if (data.action.kind === "roll_attack" && attackModifier === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Attack actions require the derived Spiritual Arts attack modifier",
      path: ["character", "spiritualArtsAttackModifier"],
    });
  } else if (
    data.action.kind !== "roll_attack" &&
    attackModifier !== undefined
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only attack actions may include a Spiritual Arts attack modifier",
      path: ["character", "spiritualArtsAttackModifier"],
    });
  }
}

export const foundryActionRequestDataSchema = z
  .object({
    requestedAt: z.string().datetime(),
    sourceRollEventId: z.string().uuid(),
    character: foundryActionCharacterSchema,
    technique: z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(255),
      })
      .strict(),
    spInvestment: z.number().int().positive().max(100),
    action: foundryActionSchema,
  })
  .strict()
  .superRefine(validateFoundryActionDerivedValues);

export const instrumentFoundryActionRequestDataSchema = z
  .object({
    requestedAt: z.string().datetime(),
    sourceUseId: z.string().uuid(),
    character: foundryActionCharacterSchema,
    instrument: z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(255),
      })
      .strict(),
    instrumentAction: z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(255),
      })
      .strict(),
    action: foundryActionSchema,
  })
  .strict()
  .superRefine(validateFoundryActionDerivedValues);

export const foundryActionRequestMessageSchema = z
  .object({
    protocolVersion: z.literal(REALTIME_PROTOCOL_VERSION),
    eventId: z.string().uuid(),
    type: z.literal("foundry_action_request"),
    data: foundryActionRequestDataSchema,
  })
  .strict();

export const instrumentFoundryActionRequestMessageSchema = z
  .object({
    protocolVersion: z.literal(REALTIME_PROTOCOL_VERSION),
    eventId: z.string().uuid(),
    type: z.literal("foundry_action_request"),
    data: instrumentFoundryActionRequestDataSchema,
  })
  .strict();

export const realtimeMessageSchema = z.union([
  spiritDieRollMessageSchema,
  foundryActionRequestMessageSchema,
  instrumentFoundryActionRequestMessageSchema,
]);

export type SpiritDieRollBroadcast = z.infer<typeof spiritDieRollBroadcastSchema>;
export type SpiritDieRollMessage = z.infer<typeof spiritDieRollMessageSchema>;
export type FoundryActionRequestData = z.infer<
  typeof foundryActionRequestDataSchema
>;
export type FoundryActionRequestMessage = z.infer<
  typeof foundryActionRequestMessageSchema
>;
export type InstrumentFoundryActionRequestData = z.infer<
  typeof instrumentFoundryActionRequestDataSchema
>;
export type InstrumentFoundryActionRequestMessage = z.infer<
  typeof instrumentFoundryActionRequestMessageSchema
>;
export type RealtimeMessage = z.infer<typeof realtimeMessageSchema>;

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

export function createFoundryActionRequestMessage(
  eventId: string,
  data: FoundryActionRequestData,
): FoundryActionRequestMessage {
  return foundryActionRequestMessageSchema.parse({
    protocolVersion: REALTIME_PROTOCOL_VERSION,
    eventId,
    type: "foundry_action_request",
    data,
  });
}

export function createInstrumentFoundryActionRequestMessage(
  eventId: string,
  data: InstrumentFoundryActionRequestData,
): InstrumentFoundryActionRequestMessage {
  return instrumentFoundryActionRequestMessageSchema.parse({
    protocolVersion: REALTIME_PROTOCOL_VERSION,
    eventId,
    type: "foundry_action_request",
    data,
  });
}
