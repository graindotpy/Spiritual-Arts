import { z } from "zod";

export const LEGACY_FOUNDRY_MECHANICS_VERSION = 1 as const;
export const PREVIOUS_FOUNDRY_MECHANICS_VERSION = 2 as const;
export const SAVE_ONLY_FOUNDRY_MECHANICS_VERSION = 3 as const;
export const ATTACK_FOUNDRY_MECHANICS_VERSION = 4 as const;
export const FOUNDRY_MECHANICS_VERSION = 5 as const;
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

export const SAVING_THROW_ABILITIES = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
] as const;

export const FOUNDRY_TEMPLATE_TYPES = [
  "circle",
  "cone",
  "rectangle",
  "ray",
] as const;

export const MAX_FOUNDRY_TEMPLATE_DISTANCE = 1_000;
export const MAX_FOUNDRY_TEMPLATE_ANGLE = 360;

export const damageTypeSchema = z.enum(DAMAGE_TYPES);
export type DamageType = z.infer<typeof damageTypeSchema>;
export const savingThrowAbilitySchema = z.enum(SAVING_THROW_ABILITIES);
export type SavingThrowAbility = z.infer<typeof savingThrowAbilitySchema>;

export const foundrySavingThrowSchema = z
  .object({
    ability: savingThrowAbilitySchema,
  })
  .strict();

const templateDistanceSchema = z
  .number()
  .positive()
  .max(MAX_FOUNDRY_TEMPLATE_DISTANCE);

export const foundryMeasuredTemplateSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("circle"),
      distance: templateDistanceSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("cone"),
      distance: templateDistanceSchema,
      angle: z.number().positive().max(MAX_FOUNDRY_TEMPLATE_ANGLE),
    })
    .strict(),
  z
    .object({
      type: z.literal("rectangle"),
      distance: templateDistanceSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("ray"),
      distance: templateDistanceSchema,
      width: templateDistanceSchema,
    })
    .strict(),
]);

export type FoundrySavingThrow = z.infer<typeof foundrySavingThrowSchema>;
export type FoundryMeasuredTemplate = z.infer<
  typeof foundryMeasuredTemplateSchema
>;

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

const legacyActionBaseShape = {
  id: z.string().uuid(),
  formula: foundryFormulaSchema,
  label: optionalActionLabelSchema,
};

const actionIdentityShape = {
  id: z.string().uuid(),
  label: optionalActionLabelSchema,
};

const commonActionBaseShape = {
  ...actionIdentityShape,
  template: foundryMeasuredTemplateSchema.optional(),
};

const rollActionBaseShape = {
  ...commonActionBaseShape,
  formula: foundryFormulaSchema,
  savingThrow: foundrySavingThrowSchema.optional(),
};

export const rollDamageActionSchema = z
  .object({
    ...rollActionBaseShape,
    kind: z.literal("roll_damage"),
    damageType: damageTypeSchema,
  })
  .strict();

export const rollHealingActionSchema = z
  .object({
    ...rollActionBaseShape,
    kind: z.literal("roll_healing"),
  })
  .strict();

const rollFoundryActionSchema = z.discriminatedUnion("kind", [
  rollDamageActionSchema,
  rollHealingActionSchema,
]);

export const savingThrowActionSchema = z
  .object({
    ...commonActionBaseShape,
    kind: z.literal("saving_throw"),
    savingThrow: foundrySavingThrowSchema,
  })
  .strict();

export const rollAttackActionSchema = z
  .object({
    ...actionIdentityShape,
    kind: z.literal("roll_attack"),
  })
  .strict();

export const placeTemplateActionSchema = z
  .object({
    ...actionIdentityShape,
    kind: z.literal("place_template"),
    template: foundryMeasuredTemplateSchema,
  })
  .strict();

const preAttackFoundryActionSchema = z.discriminatedUnion("kind", [
  rollDamageActionSchema,
  rollHealingActionSchema,
  savingThrowActionSchema,
]);

const preTemplateFoundryActionSchema = z.discriminatedUnion("kind", [
  rollDamageActionSchema,
  rollHealingActionSchema,
  savingThrowActionSchema,
  rollAttackActionSchema,
]);

export const foundryActionSchema = z.discriminatedUnion("kind", [
  rollDamageActionSchema,
  rollHealingActionSchema,
  savingThrowActionSchema,
  rollAttackActionSchema,
  placeTemplateActionSchema,
]);

const legacyFoundryActionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...legacyActionBaseShape,
      kind: z.literal("roll_damage"),
      damageType: damageTypeSchema,
    })
    .strict(),
  z
    .object({
      ...legacyActionBaseShape,
      kind: z.literal("roll_healing"),
    })
    .strict(),
]);

function enforceUniqueActionIds(
  { actions }: { actions: Array<{ id: string }> },
  context: z.RefinementCtx,
): void {
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
}

const legacyFoundryMechanicsSchema = z
  .object({
    version: z.literal(LEGACY_FOUNDRY_MECHANICS_VERSION),
    actions: z.array(legacyFoundryActionSchema).max(MAX_FOUNDRY_ACTIONS),
  })
  .strict()
  .superRefine(enforceUniqueActionIds);

const previousFoundryMechanicsSchema = z
  .object({
    version: z.literal(PREVIOUS_FOUNDRY_MECHANICS_VERSION),
    actions: z.array(rollFoundryActionSchema).max(MAX_FOUNDRY_ACTIONS),
  })
  .strict()
  .superRefine(enforceUniqueActionIds);

const saveOnlyFoundryMechanicsSchema = z
  .object({
    version: z.literal(SAVE_ONLY_FOUNDRY_MECHANICS_VERSION),
    actions: z.array(preAttackFoundryActionSchema).max(MAX_FOUNDRY_ACTIONS),
  })
  .strict()
  .superRefine(enforceUniqueActionIds);

const attackFoundryMechanicsSchema = z
  .object({
    version: z.literal(ATTACK_FOUNDRY_MECHANICS_VERSION),
    actions: z.array(preTemplateFoundryActionSchema).max(MAX_FOUNDRY_ACTIONS),
  })
  .strict()
  .superRefine(enforceUniqueActionIds);

const currentFoundryMechanicsSchema = z
  .object({
    version: z.literal(FOUNDRY_MECHANICS_VERSION),
    actions: z.array(foundryActionSchema).max(MAX_FOUNDRY_ACTIONS),
  })
  .strict()
  .superRefine(enforceUniqueActionIds);

type CurrentFoundryMechanics = z.infer<typeof currentFoundryMechanicsSchema>;

export const foundryMechanicsSchema = z
  .union([
    currentFoundryMechanicsSchema,
    attackFoundryMechanicsSchema,
    saveOnlyFoundryMechanicsSchema,
    previousFoundryMechanicsSchema,
    legacyFoundryMechanicsSchema,
  ])
  .transform(
    (mechanics): CurrentFoundryMechanics => ({
      version: FOUNDRY_MECHANICS_VERSION,
      actions: mechanics.actions,
    }),
  );

export type RollDamageAction = z.infer<typeof rollDamageActionSchema>;
export type RollHealingAction = z.infer<typeof rollHealingActionSchema>;
export type RollAttackAction = z.infer<typeof rollAttackActionSchema>;
export type PlaceTemplateAction = z.infer<typeof placeTemplateActionSchema>;
export type FoundryAction = z.infer<typeof foundryActionSchema>;
export type SavingThrowAction = z.infer<typeof savingThrowActionSchema>;
export type FoundryMechanics = z.infer<typeof foundryMechanicsSchema>;
