import assert from "node:assert/strict";
import test from "node:test";
import {
  instrumentActionsSchema,
  MAX_INSTRUMENT_ACTIONS_JSON_BYTES,
} from "./schema";

function actionId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

test("instrument actions stay within the HTTP-safe aggregate size bound", () => {
  const normalActions = [{
    id: actionId(1),
    name: "Release the Echo",
    description: "Release the captured voice.",
    actionType: "action" as const,
  }];
  assert.equal(instrumentActionsSchema.safeParse(normalActions).success, true);

  const oversizedActions = Array.from({ length: 8 }, (_, index) => ({
    id: actionId(index + 1),
    name: `Action ${index + 1}`,
    description: "x".repeat(95_000),
    actionType: "action" as const,
  }));
  assert.ok(
    new TextEncoder().encode(JSON.stringify(oversizedActions)).byteLength >
      MAX_INSTRUMENT_ACTIONS_JSON_BYTES,
  );
  assert.equal(instrumentActionsSchema.safeParse(oversizedActions).success, false);
});
