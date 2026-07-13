import { z } from "zod";

export const FOUNDRY_MECHANICS_VERSION = 1 as const;
export const MAX_FOUNDRY_ACTIONS = 10;
export const MAX_FOUNDRY_FORMULA_LENGTH = 200;
export const MAX_FOUNDRY_FORMULA_TERMS = 50;
export const MAX_FOUNDRY_DICE_PER_TERM = 100;
export const MAX_FOUNDRY_TOTAL_DICE = 100;
export const MAX_FOUNDRY_DIE_FACES = 1_000;
export const MAX_FOUNDRY_INTEGER_CONSTANT = 1_000_000;

export const DAMAGE_TYPES = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
] as const;

export const damageTypeSchema = z.enum(DAMAGE_TYPES);
export type DamageType = z.infer<typeof damageTypeSchema>;

const FORMULA_GRAMMAR =
  /^(?:\d+[dD]\d+|\d+)(?:\s*[+-]\s*(?:\d+[dD]\d+|\d+))*$/;
const FORMULA_TERM = /\d+[dD]\d+|\d+/g;

/**
 * Validates the deliberately small, self-contained dice grammar supported by
 * the phase-one Foundry bridge. This is not a general Foundry Roll parser.
 */
export function validateFoundryFormula(formula: string): boolean {
  const normalized = formula.trim();
  if (
    formula.length > MAX_FOUNDRY_FORMULA_LENGTH ||
    normalized.length === 0 ||
    !FORMULA_GRAMMAR.test(normalized)
  ) {
    return false;
  }

  const terms = normalized.match(FORMULA_TERM) ?? [];
  if (terms.length === 0 || terms.length > MAX_FOUNDRY_FORMULA_TERMS) {
    return false;
  }

  let totalDice = 0;
  for (const term of terms) {
    const separator = term.search(/[dD]/);
    if (separator === -1) {
      const constant = Number(term);
      if (
        !Number.isSafeInteger(constant) ||
        constant > MAX_FOUNDRY_INTEGER_CONSTANT
      ) {
        return false;
      }
      continue;
    }

    const count = Number(term.slice(0, separator));
    const faces = Number(term.slice(separator + 1));
    if (
      !Number.isSafeInteger(count) ||
      count < 1 ||
      count > MAX_FOUNDRY_DICE_PER_TERM ||
      !Number.isSafeInteger(faces) ||
      faces < 2 ||
      faces > MAX_FOUNDRY_DIE_FACES
    ) {
      return false;
    }

    totalDice += count;
    if (totalDice > MAX_FOUNDRY_TOTAL_DICE) {
      return false;
    }
  }

  return true;
}

export const foundryFormulaSchema = z
  .string()
  .max(MAX_FOUNDRY_FORMULA_LENGTH)
  .trim()
  .min(1)
  .refine(validateFoundryFormula, "Use only bounded dice, integers, +, and -");

const optionalActionLabelSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z.string().trim().min(1).max(255).optional(),
);

const actionBaseShape = {
  id: z.string().uuid(),
  formula: foundryFormulaSchema,
  label: optionalActionLabelSchema,
};

export const rollDamageActionSchema = z
  .object({
    ...actionBaseShape,
    kind: z.literal("roll_damage"),
    damageType: damageTypeSchema,
  })
  .strict();

export const rollHealingActionSchema = z
  .object({
    ...actionBaseShape,
    kind: z.literal("roll_healing"),
  })
  .strict();

export const foundryActionSchema = z.discriminatedUnion("kind", [
  rollDamageActionSchema,
  rollHealingActionSchema,
]);

export const foundryMechanicsSchema = z
  .object({
    version: z.literal(FOUNDRY_MECHANICS_VERSION),
    actions: z.array(foundryActionSchema).max(MAX_FOUNDRY_ACTIONS),
  })
  .strict()
  .superRefine(({ actions }, context) => {
    const seen = new Set<string>();
    actions.forEach((action, index) => {
      if (seen.has(action.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Action IDs must be unique within an SP tier",
          path: ["actions", index, "id"],
        });
      }
      seen.add(action.id);
    });
  });

export type RollDamageAction = z.infer<typeof rollDamageActionSchema>;
export type RollHealingAction = z.infer<typeof rollHealingActionSchema>;
export type FoundryAction = z.infer<typeof foundryActionSchema>;
export type FoundryMechanics = z.infer<typeof foundryMechanicsSchema>;
