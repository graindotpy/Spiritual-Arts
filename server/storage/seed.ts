import type {
  InsertCharacter,
  InsertTechnique,
  SpiritDiePool,
} from "@shared/schema";
import { getSpiritDiceForLevel } from "@shared/schema";

interface SeedCharacter extends InsertCharacter {
  id: string;
  techniques?: Omit<InsertTechnique, "characterId">[];
}

export interface DefaultSeedData {
  characters: SeedCharacter[];
  diceForLevel(level: number): SpiritDiePool["currentDice"];
}

const raanTechniques: Omit<InsertTechnique, "characterId">[] = [
  {
    name: "Omnivore",
    triggerDescription:
      "You activate this technique as a reaction when you reduce a creature to 0HP.",
    spEffects: {
      1: {
        effect: "You gain 5 temporary hit points.",
        actionType: "reaction",
      },
      3: {
        effect:
          "You grow in size by one stage. Melee attacks now deal 1d4 extra damage, and you have advantage on strength checks and saving throws.",
        actionType: "reaction",
      },
      4: {
        effect: "You regain HP equal to 3d8 + your Spiritual Arts modifier",
        actionType: "reaction",
      },
      6: {
        effect:
          "You gain the ability to absorb one technique from the target - stealing for yourself, temporarily. See Technique Drain for full details. At 6SP, the stolen Technique lasts for one hour, or until you use it.",
        actionType: "reaction",
      },
    },
  },
  {
    name: "Tongue Lash",
    triggerDescription: "You activate this technique as a Bonus Action.",
    spEffects: {
      2: {
        effect:
          "Your tongue has a 15ft range. The target gains one level of Grung Toxin. Make an attack roll with your Spiritual Arts modifier against a creature within range. You only expend a Spirit Die if the attack makes contact.",
        actionType: "bonus",
      },
      3: { effect: "Your tongue deals 2d6 poison damage", actionType: "bonus" },
      4: {
        effect:
          "Your tongue now has a range of 25ft. You inflict two levels of Grung Toxin.",
        actionType: "bonus",
      },
      6: {
        effect:
          "Your tongue now deals 5d6 poison damage. The target must make a Strength saving throw - on a fail, you may choose to either grapple the target (with your tongue) or knock them prone.",
        actionType: "bonus",
      },
    },
  },
  {
    name: "The Thrill of the Hunt",
    triggerDescription:
      "You activate this technique as a reaction, when you cause damage to a target.",
    spEffects: {
      4: {
        effect:
          "Your speed increases by 10ft. You have an additional +1 to hit with melee attacks. Your extra bite attack deals 1d8+Wis poison damage. When you activate this technique, you target a creature within 30ft - this creature becomes the target of your hunger.",
        actionType: "reaction",
      },
      6: {
        effect:
          "All hits with a melee weapon deal 1d8 extra damage. If you are within 20ft of the target of your hunt, attack rolls are made against you with disadvantage. You are invisible to the target of your hunt outside of this range.",
        actionType: "reaction",
      },
    },
  },
  {
    name: "Bear's Ferocity",
    triggerDescription:
      "Once you activate this technique, you must make a melee attack against a creature on each of your turns.",
    spEffects: {
      2: {
        effect:
          "You grow sharp and your fangs increase in length, becoming natural weapons which deal 1d8 damage. If you make a second attack with your bonus action as part of two weapon fighting, add your full modifier.",
        actionType: "action",
      },
      4: {
        effect:
          "Your natural weapons receive a +2 bonus to attack and damage. You gain the Extra Attack feature. Once per turn, when you hit with one of these attacks, you can force the target to make a Con saving throw. On a fail, you inflict one level of Grung Toxin.",
        actionType: "action",
      },
      6: {
        effect:
          "Your natural weapons now inflict 1d12 damage, and their modifier increases to +3. Your size increases by one stage, and your range increases by 5ft. You are immune to the effects of Mind Control",
        actionType: "action",
      },
    },
  },
];

export const DEFAULT_SEED_DATA: DefaultSeedData = {
  characters: [
    {
      id: "2167178a-df9f-4f08-8d94-05b342dfcef1",
      name: "R'aan Fames",
      path: "Path of Gluttony",
      level: 9,
      // Seed data must not point at deployment-specific local files. Existing
      // databases keep their uploaded portrait URLs; only a fresh database uses
      // this fixture.
      portraitUrl: null,
      techniques: raanTechniques,
    },
    {
      id: "50cf2e2f-d76d-452d-8f70-da84c2aadbd4",
      name: "Azuma",
      path: "Hiroshi-Do",
      level: 9,
      portraitUrl: null,
    },
    {
      id: "d0efdf5f-c9f2-4803-8488-4e757d37a202",
      name: "Yorinaga Masashige",
      path: "Path of the Spiteful Dragon",
      level: 9,
      portraitUrl: null,
    },
  ],
  diceForLevel(level) {
    return structuredClone(getSpiritDiceForLevel(level));
  },
};
