import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateSpiritualArtsAttackModifier,
  calculateSpiritualArtsDc,
  getProficiencyBonusForLevel,
} from "./spiritual-arts-dc";

test("Spiritual Arts DC and attack modifier use level proficiency and ability", () => {
  assert.equal(getProficiencyBonusForLevel(1), 2);
  assert.equal(getProficiencyBonusForLevel(8), 3);
  assert.equal(getProficiencyBonusForLevel(20), 6);
  assert.equal(calculateSpiritualArtsDc(8, 18), 15);
  assert.equal(calculateSpiritualArtsDc(20, 30), 24);
  assert.equal(calculateSpiritualArtsDc(1, 9), 9);
  assert.equal(calculateSpiritualArtsAttackModifier(8, 18), 7);
  assert.equal(calculateSpiritualArtsAttackModifier(20, 30), 16);
  assert.equal(calculateSpiritualArtsAttackModifier(1, 9), 1);
  assert.equal(calculateSpiritualArtsAttackModifier(1, 1), -3);
});

test("Spiritual Arts derived values are unavailable without valid source data", () => {
  assert.equal(calculateSpiritualArtsDc(8, null), null);
  assert.equal(calculateSpiritualArtsDc(0, 18), null);
  assert.equal(calculateSpiritualArtsDc(8, 31), null);
  assert.equal(calculateSpiritualArtsAttackModifier(8, null), null);
  assert.equal(calculateSpiritualArtsAttackModifier(0, 18), null);
  assert.equal(calculateSpiritualArtsAttackModifier(8, 31), null);
});
