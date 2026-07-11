import assert from "node:assert/strict";
import test from "node:test";
import {
  canSpiritDieMeetInvestment,
  getSpiritDiceForLevel,
  normalizeSpiritDieSlots,
  restoreSpiritDieSlot,
  rollSpiritDie,
} from "./spirit-dice";

test("level progression is clamped and returned by value", () => {
  assert.deepEqual(getSpiritDiceForLevel(-10), ["d4"]);
  assert.deepEqual(getSpiritDiceForLevel(10), ["d6", "d8"]);
  assert.deepEqual(getSpiritDiceForLevel(99), ["d12", "d12"]);

  const dice = getSpiritDiceForLevel(3);
  dice[0] = "d12";
  assert.deepEqual(getSpiritDiceForLevel(3), ["d4", "d4"]);
});

test("a failed d4 roll depletes its stable slot without shifting other dice", () => {
  const result = rollSpiritDie({
    currentDice: ["d4", "d8"],
    dieIndex: 0,
    spInvestment: 4,
    random: () => 0,
  });

  assert.equal(result.value, 1);
  assert.equal(result.success, false);
  assert.deepEqual(result.newDicePool, [null, "d8"]);
});

test("restoring a die advances one step up to its configured maximum", () => {
  assert.deepEqual(restoreSpiritDieSlot([null, "d4"], ["d6", "d8"], 0), [
    "d4",
    "d4",
  ]);
  assert.deepEqual(restoreSpiritDieSlot(["d4", "d4"], ["d6", "d8"], 1), [
    "d4",
    "d6",
  ]);
});

test("legacy shortened pools normalize missing trailing slots as depleted", () => {
  assert.deepEqual(normalizeSpiritDieSlots(["d6"], 2), ["d6", null]);
  assert.deepEqual(normalizeSpiritDieSlots(["not-a-die"], 2), [null, null]);
});

test("roll validation rejects invalid or depleted selections", () => {
  assert.throws(
    () => rollSpiritDie({ currentDice: [null], dieIndex: 0, spInvestment: 1 }),
    /depleted/,
  );
  assert.throws(
    () => rollSpiritDie({ currentDice: ["d4"], dieIndex: 0.5, spInvestment: 1 }),
    /index/,
  );
  assert.equal(canSpiritDieMeetInvestment("d4", 4), true);
  assert.equal(canSpiritDieMeetInvestment("d4", 6), false);
  assert.throws(
    () => rollSpiritDie({ currentDice: ["d4"], dieIndex: 0, spInvestment: 6 }),
    /cannot power/,
  );
});
