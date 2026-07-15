import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FoundryControlAuth,
  FoundryControlAuthError,
} from "./control-auth";

function assertAuthError(
  callback: () => unknown,
  code: FoundryControlAuthError["code"],
): void {
  assert.throws(
    callback,
    (error: unknown) =>
      error instanceof FoundryControlAuthError && error.code === code,
  );
}

test("control authorization is disabled without a server password", () => {
  const auth = new FoundryControlAuth();

  assert.equal(auth.configured, false);
  assert.equal(auth.isAuthorized("anything"), false);
  assertAuthError(() => auth.login("password", "client"), "not_configured");
});

test("control authorization creates expiring, revocable opaque sessions", () => {
  let now = 1_000;
  const auth = new FoundryControlAuth({
    password: "correct horse",
    now: () => now,
    createToken: () => "opaque-token",
    sessionDurationMs: 500,
  });

  assertAuthError(
    () => auth.login("wrong horse", "client"),
    "invalid_password",
  );

  const login = auth.login("correct horse", "client");
  assert.deepEqual(login, { token: "opaque-token", expiresAt: 1_500 });
  assert.equal(auth.isAuthorized(login.token), true);

  now = 1_500;
  assert.equal(auth.isAuthorized(login.token), false);

  now = 2_000;
  const replacement = auth.login("correct horse", "client");
  assert.equal(auth.isAuthorized(replacement.token), true);
  auth.revoke(replacement.token);
  assert.equal(auth.isAuthorized(replacement.token), false);
});

test("repeated failed logins are bounded per client and reset later", () => {
  let now = 0;
  const auth = new FoundryControlAuth({
    password: "secret",
    now: () => now,
    maxFailedAttempts: 2,
    attemptWindowMs: 100,
  });

  assertAuthError(() => auth.login("wrong", "client-a"), "invalid_password");
  assertAuthError(() => auth.login("wrong", "client-a"), "invalid_password");
  assertAuthError(() => auth.login("secret", "client-a"), "rate_limited");

  // A different client remains unaffected.
  assert.equal(typeof auth.login("secret", "client-b").token, "string");

  now = 100;
  assert.equal(typeof auth.login("secret", "client-a").token, "string");
});
