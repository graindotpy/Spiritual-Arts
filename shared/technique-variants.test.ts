import assert from "node:assert/strict";
import test from "node:test";
import type { Technique } from "./schema";
import {
  getTechniqueVariantLabel,
  groupTechniqueFamilies,
  splitTechniqueName,
} from "./technique-variants";

function technique(id: string, name: string): Technique {
  return {
    id,
    characterId: "character",
    name,
    triggerDescription: "Trigger",
    spEffects: { 1: { effect: "Effect", actionType: "action" } },
    isActive: true,
  };
}

test("splits a technique name at its first colon", () => {
  assert.deepEqual(splitTechniqueName("Blood Rite: Crimson Tide"), {
    baseName: "Blood Rite",
    variantName: "Crimson Tide",
  });
  assert.deepEqual(splitTechniqueName("Ordinary Technique"), {
    baseName: "Ordinary Technique",
    variantName: null,
  });
});

test("groups variants and an original technique into one manual slot", () => {
  const original = technique("1", "Blood Rite");
  const first = technique("2", "Blood Rite: Crimson Tide");
  const second = technique("3", "Blood Rite: Sanguine Ward");
  const separate = technique("4", "Tongue Lash");
  const families = groupTechniqueFamilies([original, first, second, separate]);

  assert.equal(families.length, 2);
  assert.deepEqual(families[0].techniques.map(({ id }) => id), ["1", "2", "3"]);
  assert.equal(getTechniqueVariantLabel(original), "Original");
  assert.equal(getTechniqueVariantLabel(first), "Crimson Tide");
});
