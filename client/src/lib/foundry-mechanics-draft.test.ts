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

test("mechanics drafts preserve stable IDs and normalize submission strings", () => {
  const stored = {
    version: 1 as const,
    actions: [
      {
        id: DAMAGE_ID,
        kind: "roll_damage" as const,
        formula: " 2d8 + 4 ",
        damageType: "necrotic" as const,
        label: " Essence damage ",
      },
      {
        id: HEALING_ID,
        kind: "roll_healing" as const,
        formula: "1d6",
        label: "   ",
      },
    ],
  };

  const parsed = parseStoredFoundryMechanics(stored);
  assert.equal(parsed.error, undefined);
  assert.notEqual(parsed.mechanics, stored);
  assert.notEqual(parsed.mechanics?.actions, stored.actions);
  assert.deepEqual(
    parsed.mechanics?.actions.map((action) => action.id),
    [DAMAGE_ID, HEALING_ID],
  );
  assert.deepEqual(normalizeFoundryMechanics(parsed.mechanics), {
    version: 1,
    actions: [
      {
        id: DAMAGE_ID,
        kind: "roll_damage",
        formula: "2d8 + 4",
        damageType: "necrotic",
        label: "Essence damage",
      },
      {
        id: HEALING_ID,
        kind: "roll_healing",
        formula: "1d6",
        label: undefined,
      },
    ],
  });
});

test("empty drafts are omitted and unsupported stored mechanics are surfaced", () => {
  assert.equal(normalizeFoundryMechanics({ version: 1, actions: [] }), undefined);
  assert.deepEqual(parseStoredFoundryMechanics(undefined), {});
  assert.equal(
    typeof parseStoredFoundryMechanics({ version: 2, actions: [] }).error,
    "string",
  );
});

test("configured actions require the SP tier to have an effect", () => {
  const mechanics = {
    version: 1 as const,
    actions: [createFoundryAction("roll_healing", HEALING_ID)],
  };
  assert.equal(hasFoundryActionsWithoutEffect("", mechanics), true);
  assert.equal(hasFoundryActionsWithoutEffect("   ", mechanics), true);
  assert.equal(hasFoundryActionsWithoutEffect("Restore vitality.", mechanics), false);
  assert.equal(hasFoundryActionsWithoutEffect("", undefined), false);
});

test("new action shapes and reordering retain their supplied UUIDs", () => {
  const damage = createFoundryAction("roll_damage", DAMAGE_ID);
  const healing = createFoundryAction("roll_healing", HEALING_ID);
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
  assert.deepEqual(
    moveFoundryAction([damage, healing], 1, -1).map((action) => action.id),
    [HEALING_ID, DAMAGE_ID],
  );
  assert.deepEqual(
    moveFoundryAction([damage, healing], 0, -1).map((action) => action.id),
    [DAMAGE_ID, HEALING_ID],
  );

  const replacementIds = [HEALING_ID, DAMAGE_ID][Symbol.iterator]();
  const cloned = cloneFoundryMechanicsWithNewActionIds(
    { version: 1, actions: [damage, healing] },
    () => replacementIds.next().value ?? DAMAGE_ID,
  );
  assert.deepEqual(
    cloned.actions.map((action) => action.id),
    [HEALING_ID, DAMAGE_ID],
  );
  assert.deepEqual(
    [damage, healing].map((action) => action.id),
    [DAMAGE_ID, HEALING_ID],
  );
});
