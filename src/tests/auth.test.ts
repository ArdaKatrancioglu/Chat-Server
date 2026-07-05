import assert from "node:assert/strict";
import test from "node:test";
import { shouldAllowDevAdminBypass, shouldUseDevAuthBypass } from "../middleware/auth";

test("Authorization header takes priority over DEV_AUTH_BYPASS", () => {
  assert.equal(
    shouldUseDevAuthBypass({
      hasAuthorizationHeader: true,
      isProduction: false,
      isLocalhost: true,
      devAuthBypassEnabled: true
    }),
    false
  );
});

test("missing Authorization header uses dev bypass only when enabled", () => {
  assert.equal(
    shouldUseDevAuthBypass({
      hasAuthorizationHeader: false,
      isProduction: false,
      isLocalhost: true,
      devAuthBypassEnabled: true
    }),
    true
  );

  assert.equal(
    shouldUseDevAuthBypass({
      hasAuthorizationHeader: false,
      isProduction: false,
      isLocalhost: true,
      devAuthBypassEnabled: false
    }),
    false
  );
});

test("GET /users dev admin bypass succeeds with valid dev header", () => {
  assert.equal(
    shouldAllowDevAdminBypass({
      isProduction: false,
      isLocalhost: true,
      devAuthBypassEnabled: true,
      headerUserId: "local-dev-user",
      expectedUserId: "local-dev-user"
    }),
    true
  );
});

test("GET /users dev admin bypass rejects missing or disabled dev auth", () => {
  assert.equal(
    shouldAllowDevAdminBypass({
      isProduction: false,
      isLocalhost: true,
      devAuthBypassEnabled: false,
      headerUserId: "local-dev-user",
      expectedUserId: "local-dev-user"
    }),
    false
  );

  assert.equal(
    shouldAllowDevAdminBypass({
      isProduction: false,
      isLocalhost: true,
      devAuthBypassEnabled: true,
      headerUserId: undefined,
      expectedUserId: "local-dev-user"
    }),
    false
  );
});
