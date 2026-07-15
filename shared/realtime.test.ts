import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createFoundryActionRequestMessage,
  createInstrumentFoundryActionRequestMessage,
  createSpiritDieRollMessage,
  foundryActionRequestDataSchema,
  foundryActionRequestMessageSchema,
  instrumentFoundryActionRequestDataSchema,
  instrumentFoundryActionRequestMessageSchema,
  MAX_INVESTMENT_EFFECT_LENGTH,
  realtimeMessageSchema,
  REALTIME_PROTOCOL_VERSION,
  spiritDieRollMessageSchema,
  type FoundryActionRequestData,
  type InstrumentFoundryActionRequestData,
  type SpiritDieRollBroadcast,
} from "./realtime";

const roll: SpiritDieRollBroadcast = {
  character: {
    id: "character-1",
    name: "Raan",
    path: "Path of Gluttony",
    level: 8,
    portraitUrl: null,
  },
  roll: {
    spInvestment: 2,
    dieSize: "d8",
    dieIndex: 0,
    value: 6,
    success: true,
    techniqueId: null,
    techniqueName: "Devour Essence",
    investmentEffect: "Deal damage and restore vitality.",
    timestamp: "2026-07-13T12:00:00.000Z",
  },
};

const actionRequest: FoundryActionRequestData = {
  requestedAt: "2026-07-13T12:00:01.000Z",
  sourceRollEventId: "5c13c52f-f89d-41f5-8816-7d5ac0ab132f",
  character: {
    ...roll.character,
    spiritualArtsDc: 15,
  },
  technique: {
    id: "6a4b7b9d-cbf7-4e41-8110-294a9036cfa0",
    name: "Devour Essence",
  },
  spInvestment: 2,
  action: {
    id: "523240f5-7433-4e0b-876c-c209ad3b310a",
    kind: "roll_damage",
    formula: "2d8 + 4",
    damageType: "necrotic",
    label: "Devour Essence",
    savingThrow: { ability: "dex" },
    template: { type: "circle", distance: 20 },
  },
};

const instrumentActionRequest: InstrumentFoundryActionRequestData = {
  requestedAt: "2026-07-15T12:00:01.000Z",
  sourceUseId: "15f60104-1654-4b6e-9c1b-d62e5a0b5199",
  character: {
    ...roll.character,
    spiritualArtsDc: 15,
  },
  instrument: {
    id: "cc9fd3c7-fccc-4f44-967f-bb5780fc1037",
    name: "Ghost Lantern",
  },
  instrumentAction: {
    id: "c11af797-bad8-4566-a5f8-455420f70db4",
    name: "Lantern Burst",
  },
  action: {
    id: "523240f5-7433-4e0b-876c-c209ad3b310a",
    kind: "roll_damage",
    formula: "2d8 + 4",
    damageType: "radiant",
    savingThrow: { ability: "dex" },
  },
};

test("Spirit Die broadcasts include stable bridge metadata", () => {
  const eventId = "5c13c52f-f89d-41f5-8816-7d5ac0ab132f";
  const message = createSpiritDieRollMessage(eventId, roll);

  assert.equal(message.protocolVersion, REALTIME_PROTOCOL_VERSION);
  assert.equal(message.eventId, eventId);
  assert.equal(message.type, "spirit_die_roll");
  assert.deepEqual(message.data, roll);
  assert.equal(spiritDieRollMessageSchema.safeParse(message).success, true);

  const legacy = structuredClone(message);
  delete legacy.data.roll.investmentEffect;
  assert.equal(spiritDieRollMessageSchema.safeParse(legacy).success, true);
});

test("Spirit Die broadcasts reject invalid event identifiers and protocol versions", () => {
  assert.equal(
    spiritDieRollMessageSchema.safeParse({
      protocolVersion: REALTIME_PROTOCOL_VERSION,
      eventId: "not-a-uuid",
      type: "spirit_die_roll",
      data: roll,
    }).success,
    false,
  );

  assert.equal(
    spiritDieRollMessageSchema.safeParse({
      protocolVersion: REALTIME_PROTOCOL_VERSION + 1,
      eventId: "5c13c52f-f89d-41f5-8816-7d5ac0ab132f",
      type: "spirit_die_roll",
      data: roll,
    }).success,
    false,
  );

  for (const investmentEffect of ["", "x".repeat(MAX_INVESTMENT_EFFECT_LENGTH + 1)]) {
    assert.equal(
      spiritDieRollMessageSchema.safeParse({
        ...createSpiritDieRollMessage(
          "5c13c52f-f89d-41f5-8816-7d5ac0ab132f",
          roll,
        ),
        data: {
          ...roll,
          roll: { ...roll.roll, investmentEffect },
        },
      }).success,
      false,
    );
  }
});

test("Foundry action requests use a strict version-one envelope", () => {
  const eventId = "0b793756-5e97-4bdf-952e-3c897ea31e42";
  const message = createFoundryActionRequestMessage(eventId, actionRequest);

  assert.equal(message.protocolVersion, REALTIME_PROTOCOL_VERSION);
  assert.equal(message.eventId, eventId);
  assert.equal(message.type, "foundry_action_request");
  assert.deepEqual(message.data, actionRequest);
  assert.equal(foundryActionRequestMessageSchema.safeParse(message).success, true);
  assert.equal(realtimeMessageSchema.safeParse(message).success, true);
  assert.equal(spiritDieRollMessageSchema.safeParse(message).success, false);

  const legacyActionRequest = structuredClone(actionRequest);
  delete legacyActionRequest.character.spiritualArtsDc;
  delete legacyActionRequest.action.savingThrow;
  delete legacyActionRequest.action.template;
  assert.equal(
    foundryActionRequestMessageSchema.safeParse({
      ...message,
      data: legacyActionRequest,
    }).success,
    true,
  );
});

test("instrument Foundry action requests use a strict same-envelope variant", () => {
  const eventId = "35006819-9883-4256-ae6b-4bc58e5610ab";
  const message = createInstrumentFoundryActionRequestMessage(
    eventId,
    instrumentActionRequest,
  );

  assert.equal(message.protocolVersion, REALTIME_PROTOCOL_VERSION);
  assert.equal(message.eventId, eventId);
  assert.equal(message.type, "foundry_action_request");
  assert.deepEqual(message.data, instrumentActionRequest);
  assert.equal(
    instrumentFoundryActionRequestMessageSchema.safeParse(message).success,
    true,
  );
  assert.equal(foundryActionRequestMessageSchema.safeParse(message).success, false);
  assert.equal(realtimeMessageSchema.safeParse(message).success, true);

  const invalidRequests = [
    { ...instrumentActionRequest, sourceUseId: "not-a-uuid" },
    { ...instrumentActionRequest, sourceRollEventId: actionRequest.sourceRollEventId },
    { ...instrumentActionRequest, spInvestment: 2 },
    { ...instrumentActionRequest, technique: actionRequest.technique },
    {
      ...instrumentActionRequest,
      instrument: { ...instrumentActionRequest.instrument, future: true },
    },
    {
      ...instrumentActionRequest,
      instrument: { ...instrumentActionRequest.instrument, id: "not-a-uuid" },
    },
    {
      ...instrumentActionRequest,
      instrumentAction: {
        ...instrumentActionRequest.instrumentAction,
        id: "not-a-uuid",
      },
    },
  ];

  for (const request of invalidRequests) {
    assert.equal(
      instrumentFoundryActionRequestDataSchema.safeParse(request).success,
      false,
    );
  }
});

test("instrument Foundry action requests enforce action-specific derived values", () => {
  const attack = {
    ...instrumentActionRequest,
    character: {
      ...roll.character,
      spiritualArtsAttackModifier: 7,
    },
    action: {
      id: "34109839-d482-4ef7-bde4-98ce40d330f2",
      kind: "roll_attack" as const,
      label: "Lantern ray",
    },
  };
  assert.equal(instrumentFoundryActionRequestDataSchema.safeParse(attack).success, true);

  const missingModifier = structuredClone(attack);
  delete missingModifier.character.spiritualArtsAttackModifier;
  assert.equal(
    instrumentFoundryActionRequestDataSchema.safeParse(missingModifier).success,
    false,
  );
  assert.equal(
    instrumentFoundryActionRequestDataSchema.safeParse({
      ...instrumentActionRequest,
      character: {
        ...instrumentActionRequest.character,
        spiritualArtsAttackModifier: 7,
      },
    }).success,
    false,
  );
});

test("attack requests require only the derived Spiritual Arts attack modifier", () => {
  const attackRequest: FoundryActionRequestData = {
    ...actionRequest,
    character: {
      ...roll.character,
      spiritualArtsAttackModifier: 7,
    },
    action: {
      id: "34109839-d482-4ef7-bde4-98ce40d330f2",
      kind: "roll_attack",
      label: "Essence strike",
    },
  };

  for (const spiritualArtsAttackModifier of [7, null]) {
    assert.equal(
      foundryActionRequestDataSchema.safeParse({
        ...attackRequest,
        character: {
          ...attackRequest.character,
          spiritualArtsAttackModifier,
        },
      }).success,
      true,
    );
  }

  const withoutModifier = structuredClone(attackRequest);
  delete withoutModifier.character.spiritualArtsAttackModifier;
  assert.equal(foundryActionRequestDataSchema.safeParse(withoutModifier).success, false);
  assert.equal(
    foundryActionRequestDataSchema.safeParse({
      ...actionRequest,
      character: {
        ...actionRequest.character,
        spiritualArtsAttackModifier: 7,
      },
    }).success,
    false,
  );
  for (const spiritualArtsAttackModifier of [-4, 17, 7.5]) {
    assert.equal(
      foundryActionRequestDataSchema.safeParse({
        ...attackRequest,
        character: {
          ...attackRequest.character,
          spiritualArtsAttackModifier,
        },
      }).success,
      false,
    );
  }
});

test("template-only requests carry geometry without derived roll values", () => {
  const templateRequest: FoundryActionRequestData = {
    ...actionRequest,
    character: { ...roll.character },
    action: {
      id: "75ca2097-da4f-4875-98d2-15863caa83b3",
      kind: "place_template",
      label: "Difficult terrain",
      template: { type: "rectangle", distance: 20 },
    },
  };

  const parsed = foundryActionRequestDataSchema.parse(templateRequest);
  assert.deepEqual(parsed.action, templateRequest.action);
  assert.equal(Object.hasOwn(parsed.character, "spiritualArtsDc"), false);
  assert.equal(
    Object.hasOwn(parsed.character, "spiritualArtsAttackModifier"),
    false,
  );
});

test("Foundry action requests reject malformed and future envelopes", () => {
  const valid = createFoundryActionRequestMessage(
    "0b793756-5e97-4bdf-952e-3c897ea31e42",
    actionRequest,
  );
  const invalidMessages = [
    { ...valid, protocolVersion: 2 },
    { ...valid, eventId: "not-a-uuid" },
    { ...valid, future: true },
    { ...valid, data: { ...valid.data, future: true } },
    {
      ...valid,
      data: {
        ...valid.data,
        technique: { ...valid.data.technique, id: "not-a-uuid" },
      },
    },
    {
      ...valid,
      data: {
        ...valid.data,
        action: { ...valid.data.action, formula: "@abilities.str.mod" },
      },
    },
    {
      ...valid,
      data: {
        ...valid.data,
        character: { ...valid.data.character, spiritualArtsDc: 10.5 },
      },
    },
    {
      ...valid,
      data: {
        ...valid.data,
        action: {
          ...valid.data.action,
          template: { type: "circle", distance: -20 },
        },
      },
    },
  ];

  for (const message of invalidMessages) {
    assert.equal(
      foundryActionRequestMessageSchema.safeParse(message).success,
      false,
    );
  }

  assert.throws(() =>
    createFoundryActionRequestMessage(
      "0b793756-5e97-4bdf-952e-3c897ea31e42",
      {
        ...actionRequest,
        character: { ...actionRequest.character, name: "x".repeat(256) },
      },
    ),
  );
});
