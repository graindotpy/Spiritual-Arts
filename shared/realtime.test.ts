import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createFoundryActionRequestMessage,
  createSpiritDieRollMessage,
  foundryActionRequestMessageSchema,
  realtimeMessageSchema,
  REALTIME_PROTOCOL_VERSION,
  spiritDieRollMessageSchema,
  type FoundryActionRequestData,
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
    timestamp: "2026-07-13T12:00:00.000Z",
  },
};

const actionRequest: FoundryActionRequestData = {
  requestedAt: "2026-07-13T12:00:01.000Z",
  sourceRollEventId: "5c13c52f-f89d-41f5-8816-7d5ac0ab132f",
  character: roll.character,
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
