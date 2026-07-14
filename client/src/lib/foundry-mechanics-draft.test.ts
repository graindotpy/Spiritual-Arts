import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cloneFoundryMechanicsWithNewActionIds,
  createFoundryAction,
  hasFoundryActionsWithoutEffect,
  moveFoundryAction,
  normalizeFoundryMechanics,
  parseStoredFoundryMechanics,
} from "./foundry-mechanics-draft";

const DAMAGE_ID = "523240f5-7433-4e0b-876c-c209ad3b310a";
const HEALING_ID = "af51a725-e3a2-40ea-b016-cc7040df091c";
const SAVING_THROW_ID = "64558d3a-6642-42fb-b125-9089f8c63e86";
const ATTACK_ID = "598b7d31-b13b-44f1-8334-9b8de0c3d9a2";
const TEMPLATE_ID = "75ca2097-da4f-4875-98d2-15863caa83b3";

test("mechanics drafts preserve stable IDs and normalize submission strings", () => {
  const stored = {
    version: 5 as const,
    actions: [
      {
        id: DAMAGE_ID,
        kind: "roll_damage" as const,
        formula: " 2d8 + 4 ",
        damageType: "necrotic" as const,
        label: " Essence damage ",
        savingThrow: { ability: "dex" as const },
        template: { type: "cone" as const, distance: 20, angle: 53 },
      },
      {
        id: HEALING_ID,
        kind: "roll_healing" as const,
        formula: "1d6",
        label: "   ",
      },
      {
        id: SAVING_THROW_ID,
        kind: "saving_throw" as const,
        label: " Push away ",
        savingThrow: { ability: "str" as const },
        template: { type: "circle" as const, distance: 15 },
      },
      {
        id: ATTACK_ID,
        kind: "roll_attack" as const,
        label: " Spirit strike ",
      },
      {
        id: TEMPLATE_ID,
        kind: "place_template" as const,
        label: " Difficult terrain ",
        template: { type: "rectangle" as const, distance: 20 },
      },
    ],
  };

  const parsed = parseStoredFoundryMechanics(stored);
  assert.equal(parsed.error, undefined);
  assert.notEqual(parsed.mechanics, stored);
  assert.notEqual(parsed.mechanics?.actions, stored.actions);
  assert.notEqual(
    parsed.mechanics?.actions[0].savingThrow,
    stored.actions[0].savingThrow,
  );
  assert.notEqual(
    parsed.mechanics?.actions[0].template,
    stored.actions[0].template,
  );
  assert.notEqual(
    parsed.mechanics?.actions[2].savingThrow,
    stored.actions[2].savingThrow,
  );
  assert.notEqual(
    parsed.mechanics?.actions[2].template,
    stored.actions[2].template,
  );
  assert.deepEqual(
    parsed.mechanics?.actions.map((action) => action.id),
    [DAMAGE_ID, HEALING_ID, SAVING_THROW_ID, ATTACK_ID, TEMPLATE_ID],
  );
  assert.deepEqual(normalizeFoundryMechanics(parsed.mechanics), {
    version: 5,
    actions: [
      {
        id: DAMAGE_ID,
        kind: "roll_damage",
        formula: "2d8 + 4",
        damageType: "necrotic",
        label: "Essence damage",
        savingThrow: { ability: "dex" },
        template: { type: "cone", distance: 20, angle: 53 },
      },
      {
        id: HEALING_ID,
        kind: "roll_healing",
        formula: "1d6",
        label: undefined,
      },
      {
        id: SAVING_THROW_ID,
        kind: "saving_throw",
        label: "Push away",
        savingThrow: { ability: "str" },
        template: { type: "circle", distance: 15 },
      },
      {
        id: ATTACK_ID,
        kind: "roll_attack",
        label: "Spirit strike",
      },
      {
        id: TEMPLATE_ID,
        kind: "place_template",
        label: "Difficult terrain",
        template: { type: "rectangle", distance: 20 },
      },
    ],
  });
});

test("empty drafts are omitted and unsupported stored mechanics are surfaced", () => {
  assert.equal(
    normalizeFoundryMechanics({ version: 5, actions: [] }),
    undefined,
  );
  assert.deepEqual(parseStoredFoundryMechanics(undefined), {});
  assert.equal(
    typeof parseStoredFoundryMechanics({ version: 6, actions: [] }).error,
    "string",
  );
  assert.equal(
    parseStoredFoundryMechanics({
      version: 1,
      actions: [
        {
          id: HEALING_ID,
          kind: "roll_healing",
          formula: "1d6",
        },
      ],
    }).mechanics?.version,
    5,
  );
  assert.equal(
    parseStoredFoundryMechanics({
      version: 2,
      actions: [
        {
          id: DAMAGE_ID,
          kind: "roll_damage",
          formula: "1d6",
          damageType: "force",
          savingThrow: { ability: "wis" },
        },
      ],
    }).mechanics?.version,
    5,
  );
  assert.equal(
    parseStoredFoundryMechanics({
      version: 3,
      actions: [
        {
          id: SAVING_THROW_ID,
          kind: "saving_throw",
          savingThrow: { ability: "str" },
        },
      ],
    }).mechanics?.version,
    5,
  );
  assert.equal(
    parseStoredFoundryMechanics({
      version: 4,
      actions: [{ id: ATTACK_ID, kind: "roll_attack" }],
    }).mechanics?.version,
    5,
  );
});

test("configured actions require the SP tier to have an effect", () => {
  const mechanics = {
    version: 5 as const,
    actions: [createFoundryAction("roll_healing", HEALING_ID)],
  };
  assert.equal(hasFoundryActionsWithoutEffect("", mechanics), true);
  assert.equal(hasFoundryActionsWithoutEffect("   ", mechanics), true);
  assert.equal(
    hasFoundryActionsWithoutEffect("Restore vitality.", mechanics),
    false,
  );
  assert.equal(hasFoundryActionsWithoutEffect("", undefined), false);
});

test("new action shapes and reordering retain their supplied UUIDs", () => {
  const damage = createFoundryAction("roll_damage", DAMAGE_ID);
  const healing = createFoundryAction("roll_healing", HEALING_ID);
  const savingThrow = createFoundryAction("saving_throw", SAVING_THROW_ID);
  const attack = createFoundryAction("roll_attack", ATTACK_ID);
  const template = createFoundryAction("place_template", TEMPLATE_ID);
  assert.deepEqual(damage, {
    id: DAMAGE_ID,
    kind: "roll_damage",
    formula: "1d6",
    damageType: "force",
  });
  assert.deepEqual(healing, {
    id: HEALING_ID,
    kind: "roll_healing",
    formula: "1d6",
  });
  assert.deepEqual(savingThrow, {
    id: SAVING_THROW_ID,
    kind: "saving_throw",
    savingThrow: { ability: "dex" },
  });
  assert.deepEqual(attack, {
    id: ATTACK_ID,
    kind: "roll_attack",
  });
  assert.deepEqual(template, {
    id: TEMPLATE_ID,
    kind: "place_template",
    template: { type: "circle", distance: 5 },
  });
  assert.deepEqual(
    moveFoundryAction([damage, healing], 1, -1).map((action) => action.id),
    [HEALING_ID, DAMAGE_ID],
  );
  assert.deepEqual(
    moveFoundryAction([damage, healing], 0, -1).map((action) => action.id),
    [DAMAGE_ID, HEALING_ID],
  );

  const replacementIds = [
    HEALING_ID,
    SAVING_THROW_ID,
    DAMAGE_ID,
    ATTACK_ID,
    TEMPLATE_ID,
  ][Symbol.iterator]();
  const cloned = cloneFoundryMechanicsWithNewActionIds(
    {
      version: 5,
      actions: [damage, healing, savingThrow, attack, template],
    },
    () => replacementIds.next().value ?? DAMAGE_ID,
  );
  assert.deepEqual(
    cloned.actions.map((action) => action.id),
    [HEALING_ID, SAVING_THROW_ID, DAMAGE_ID, ATTACK_ID, TEMPLATE_ID],
  );
  assert.deepEqual(
    [damage, healing, savingThrow, attack, template].map(
      (action) => action.id,
    ),
    [DAMAGE_ID, HEALING_ID, SAVING_THROW_ID, ATTACK_ID, TEMPLATE_ID],
  );
});
