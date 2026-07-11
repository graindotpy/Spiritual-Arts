import assert from "node:assert/strict";
import test from "node:test";

import { MemStorage } from "./memory-storage";
import type { DefaultSeedData } from "./seed";

async function createCharacter(storage: MemStorage, name = "Character") {
  return storage.createCharacter({ name, path: "Test Path", level: 3 });
}

test("default data is completely seeded before construction returns", async () => {
  const storage = new MemStorage();
  const characters = await storage.getCharacters();

  assert.equal(characters.length, 3);
  const raan = characters.find((character) => character.name === "R'aan Fames");
  assert.ok(raan);
  assert.deepEqual((await storage.getSpiritDiePool(raan.id))?.currentDice, [
    "d6",
    "d6",
  ]);
  assert.equal((await storage.getTechniques(raan.id)).length, 4);
});

test("all resource families are available in memory mode", async () => {
  const storage = new MemStorage(null);
  const character = await createCharacter(storage);
  await storage.createSpiritDiePool({
    characterId: character.id,
    currentDice: ["d4", null],
    overrideDice: null,
  });
  const technique = await storage.createTechnique({
    characterId: character.id,
    name: "Technique",
    triggerDescription: "Trigger",
    spEffects: { "1": { effect: "Effect", actionType: "action" } },
  });
  await storage.createActiveEffect({ characterId: character.id, name: "Effect" });
  await storage.createGlossaryTerm({
    characterId: character.id,
    keyword: "Keyword",
    definition: "Definition",
  });
  await storage.upsertTechniquePreference({
    userId: "user-1",
    techniqueId: technique.id,
    isMinimized: true,
  });
  await storage.createTracker({ characterId: character.id, name: "Tracker" });
  await storage.createDmStack({
    userId: "user-1",
    name: "Stack",
    target: "Target",
    effect: "Effect",
  });
  await storage.createDmGlossaryTerm({
    userId: "user-1",
    keyword: "Keyword",
    definition: "Definition",
  });
  await storage.createDmScratchpad({
    userId: "user-1",
    title: "Notes",
    content: "Content",
  });

  assert.ok(await storage.getSpiritDiePool(character.id));
  assert.equal((await storage.getTechniques(character.id)).length, 1);
  assert.equal((await storage.getActiveEffects(character.id)).length, 1);
  assert.equal((await storage.getGlossaryTerms(character.id)).length, 1);
  assert.equal((await storage.getTechniquePreferences("user-1")).length, 1);
  assert.equal((await storage.getTrackers(character.id)).length, 1);
  assert.equal((await storage.getDmStacks("user-1")).length, 1);
  assert.equal((await storage.getDmGlossary("user-1")).length, 1);
  assert.equal((await storage.getDmScratchpads("user-1")).length, 1);
});

test("character creation and level changes reconcile spirit dice atomically", async () => {
  const storage = new MemStorage(null);
  const character = await storage.createCharacterWithSpiritDice({
    name: "Character",
    path: "Path",
    level: 3,
  });

  assert.deepEqual((await storage.getSpiritDiePool(character.id))?.currentDice, [
    "d4",
    "d4",
  ]);

  const updated = await storage.updateCharacterAndSpiritDice(character.id, {
    level: 10,
  });
  assert.equal(updated?.level, 10);
  const updatedPool = await storage.getSpiritDiePool(character.id);
  assert.deepEqual(updatedPool?.currentDice, ["d6", "d8"]);
  assert.equal(updatedPool?.overrideDice, null);
});

test("memory mode mirrors relational constraints and delete cascades", async () => {
  const storage = new MemStorage(null);
  const character = await createCharacter(storage);
  await storage.createSpiritDiePool({
    characterId: character.id,
    currentDice: ["d4", null],
  });

  await assert.rejects(() =>
    storage.createSpiritDiePool({
      characterId: character.id,
      currentDice: ["d4", null],
    }),
  );
  await assert.rejects(() =>
    storage.createTracker({ characterId: "missing", name: "Tracker" }),
  );

  const technique = await storage.createTechnique({
    characterId: character.id,
    name: "Technique",
    triggerDescription: "Trigger",
    spEffects: { "1": { effect: "Effect", actionType: "action" } },
  });
  await storage.upsertTechniquePreference({
    userId: "user-1",
    techniqueId: technique.id,
    isMinimized: true,
  });
  assert.equal(await storage.deleteTechnique(technique.id), true);
  assert.deepEqual(await storage.getTechniquePreferences("user-1"), []);
});

test("lists are deterministic and returned JSON data is defensively copied", async () => {
  const seed: DefaultSeedData = {
    characters: [
      { id: "b", name: "Second", path: "Path", level: 3 },
      { id: "a", name: "First", path: "Path", level: 3 },
    ],
    diceForLevel: () => ["d4", null],
  };
  const storage = new MemStorage(seed);

  assert.deepEqual(
    (await storage.getCharacters()).map((character) => character.id),
    ["a", "b"],
  );

  const firstPool = await storage.getSpiritDiePool("a");
  assert.ok(firstPool);
  firstPool.currentDice[0] = null;
  assert.deepEqual((await storage.getSpiritDiePool("a"))?.currentDice, [
    "d4",
    null,
  ]);
});
