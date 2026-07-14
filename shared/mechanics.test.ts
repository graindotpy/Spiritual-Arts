import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DAMAGE_TYPES,
  FOUNDRY_MECHANICS_VERSION,
  foundryActionSchema,
  foundryFormulaSchema,
  foundryMechanicsSchema,
  MAX_FOUNDRY_ACTIONS,
  validateFoundryFormula,
} from "./mechanics";

const ACTION_ID = "523240f5-7433-4e0b-876c-c209ad3b310a";

test("the Foundry formula grammar accepts bounded dice arithmetic", () => {
  for (const formula of [
    "2d8 + 4",
    "1d6 + 1d4",
    "3d10 - 2",
    "100D1000 - 1000000",
    "0",
  ]) {
    assert.equal(validateFoundryFormula(formula), true, formula);
  }

  assert.equal(foundryFormulaSchema.parse(" 2d8 + 4 "), "2d8 + 4");
});

test("the Foundry formula grammar rejects unsafe and pathological input", () => {
  for (const formula of [
    "",
    "d20",
    "1d6 * 2",
    "1d6 / 2",
    "(1d6 + 2)",
    "-1d6",
    "1d6 + -2",
    "1d6kh1",
    "1d6x",
    "@abilities.str.mod",
    "game.users.clear()",
    "1d6; alert(1)",
    "0d6",
    "101d6",
    "1d1",
    "1d1001",
    "1000001",
    "51d6 + 50d6",
    Array.from({ length: 51 }, () => "1").join(" + "),
    "1".repeat(201),
    `1d6${" ".repeat(200)}`,
  ]) {
    assert.equal(validateFoundryFormula(formula), false, formula);
  }
  assert.equal(
    foundryFormulaSchema.safeParse(`1d6${" ".repeat(200)}`).success,
    false,
  );
});

test("damage and healing actions are strict discriminated records", () => {
  const damage = foundryActionSchema.parse({
    id: ACTION_ID,
    kind: "roll_damage",
    formula: " 2d8 + 4 ",
    damageType: "necrotic",
    label: " Devour Essence ",
  });
  assert.deepEqual(damage, {
    id: ACTION_ID,
    kind: "roll_damage",
    formula: "2d8 + 4",
    damageType: "necrotic",
    label: "Devour Essence",
  });

  const healing = foundryActionSchema.parse({
    id: ACTION_ID,
    kind: "roll_healing",
    formula: "1d8 + 3",
    label: "   ",
  });
  assert.equal(healing.label, undefined);
  assert.equal("label" in JSON.parse(JSON.stringify(healing)), false);

  assert.equal(
    foundryActionSchema.safeParse({
      id: ACTION_ID,
      kind: "roll_damage",
      formula: "1d6",
    }).success,
    false,
  );
  assert.equal(
    foundryActionSchema.safeParse({
      id: ACTION_ID,
      kind: "roll_healing",
      formula: "1d6",
      damageType: "fire",
    }).success,
    false,
  );
  assert.equal(
    foundryActionSchema.safeParse({
      id: ACTION_ID,
      kind: "run_macro",
      formula: "1d6",
    }).success,
    false,
  );
  assert.equal(
    foundryActionSchema.safeParse({
      id: ACTION_ID,
      kind: "roll_healing",
      formula: "1d6",
      script: "return 42",
    }).success,
    false,
  );
});

test("actions accept bounded saving throws and measured templates", () => {
  const templates = [
    { type: "circle", distance: 20 },
    { type: "cone", distance: 30, angle: 53.13 },
    { type: "rectangle", distance: 10 },
    { type: "ray", distance: 60, width: 5 },
  ] as const;

  for (const template of templates) {
    const parsed = foundryActionSchema.parse({
      id: ACTION_ID,
      kind: "roll_damage",
      formula: "8d6",
      damageType: "fire",
      savingThrow: { ability: "dex" },
      template,
    });
    assert.deepEqual(parsed.savingThrow, { ability: "dex" });
    assert.deepEqual(parsed.template, template);
  }

  for (const extras of [
    { savingThrow: { ability: "luck" } },
    { template: { type: "circle", distance: 0 } },
    { template: { type: "cone", distance: 30 } },
    { template: { type: "cone", distance: 30, angle: 361 } },
    { template: { type: "rectangle", distance: 10, width: 5 } },
    { template: { type: "ray", distance: 60 } },
    { template: { type: "ray", distance: 60, width: 1_001 } },
  ]) {
    assert.equal(
      foundryActionSchema.safeParse({
        id: ACTION_ID,
        kind: "roll_healing",
        formula: "1d8",
        ...extras,
      }).success,
      false,
    );
  }
});

test("save-only actions require a save and reject dice fields", () => {
  const action = foundryActionSchema.parse({
    id: ACTION_ID,
    kind: "saving_throw",
    label: "Resist the push",
    savingThrow: { ability: "str" },
    template: { type: "cone", distance: 15, angle: 53.13 },
  });
  assert.deepEqual(action, {
    id: ACTION_ID,
    kind: "saving_throw",
    label: "Resist the push",
    savingThrow: { ability: "str" },
    template: { type: "cone", distance: 15, angle: 53.13 },
  });

  for (const invalidAction of [
    { id: ACTION_ID, kind: "saving_throw" },
    {
      id: ACTION_ID,
      kind: "saving_throw",
      savingThrow: { ability: "dex" },
      formula: "1d20",
    },
    {
      id: ACTION_ID,
      kind: "saving_throw",
      savingThrow: { ability: "dex" },
      damageType: "force",
    },
  ]) {
    assert.equal(foundryActionSchema.safeParse(invalidAction).success, false);
  }
});

test("mechanics enforce their version, action count, damage types, and string bounds", () => {
  const actions = Array.from({ length: MAX_FOUNDRY_ACTIONS }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    kind: "roll_damage" as const,
    formula: "1d6",
    damageType: DAMAGE_TYPES[index % DAMAGE_TYPES.length],
  }));
  assert.equal(
    foundryMechanicsSchema.safeParse({
      version: FOUNDRY_MECHANICS_VERSION,
      actions,
    }).success,
    true,
  );
  assert.equal(
    foundryMechanicsSchema.safeParse({
      version: FOUNDRY_MECHANICS_VERSION,
      actions: [...actions, actions[0]],
    }).success,
    false,
  );
  assert.equal(
    foundryMechanicsSchema.safeParse({
      version: FOUNDRY_MECHANICS_VERSION,
      actions: [actions[0], actions[0]],
    }).success,
    false,
  );
  const migratedLegacy = foundryMechanicsSchema.parse({ version: 1, actions });
  assert.equal(migratedLegacy.version, FOUNDRY_MECHANICS_VERSION);
  const migratedPrevious = foundryMechanicsSchema.parse({ version: 2, actions });
  assert.equal(migratedPrevious.version, FOUNDRY_MECHANICS_VERSION);
  assert.equal(
    foundryMechanicsSchema.safeParse({ version: 4, actions: [] }).success,
    false,
  );
  assert.equal(
    foundryMechanicsSchema.safeParse({
      version: FOUNDRY_MECHANICS_VERSION,
      actions: [],
      future: true,
    }).success,
    false,
  );
  assert.equal(
    foundryMechanicsSchema.safeParse({
      version: 1,
      actions: [{ ...actions[0], savingThrow: { ability: "dex" } }],
    }).success,
    false,
  );
  assert.equal(
    foundryMechanicsSchema.safeParse({
      version: 2,
      actions: [
        {
          id: ACTION_ID,
          kind: "saving_throw",
          savingThrow: { ability: "dex" },
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    foundryActionSchema.safeParse({
      id: ACTION_ID,
      kind: "roll_damage",
      formula: "1d6",
      damageType: "untyped",
    }).success,
    false,
  );
  assert.equal(
    foundryActionSchema.safeParse({
      id: ACTION_ID,
      kind: "roll_healing",
      formula: "1d6",
      label: "x".repeat(256),
    }).success,
    false,
  );
});
