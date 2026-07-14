import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateSpiritualArtsDc,
  getProficiencyBonusForLevel,
} from "./spiritual-arts-dc";

test("Spiritual Arts DC uses level proficiency and highest ability modifier", () => {
  assert.equal(getProficiencyBonusForLevel(1), 2);
  assert.equal(getProficiencyBonusForLevel(8), 3);
  assert.equal(getProficiencyBonusForLevel(20), 6);
  assert.equal(calculateSpiritualArtsDc(8, 18), 15);
  assert.equal(calculateSpiritualArtsDc(20, 30), 24);
  assert.equal(calculateSpiritualArtsDc(1, 9), 9);
});

test("Spiritual Arts DC is unavailable when its source data is unavailable", () => {
  assert.equal(calculateSpiritualArtsDc(8, null), null);
  assert.equal(calculateSpiritualArtsDc(0, 18), null);
  assert.equal(calculateSpiritualArtsDc(8, 31), null);
});
