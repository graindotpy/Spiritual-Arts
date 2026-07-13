import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSpiritDieRollMessage,
  REALTIME_PROTOCOL_VERSION,
  spiritDieRollMessageSchema,
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
