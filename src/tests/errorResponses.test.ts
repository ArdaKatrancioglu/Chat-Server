import assert from "node:assert/strict";
import test from "node:test";
import { buildInvalidAuthTokenError, buildMissingAuthHeaderError } from "../middleware/auth";
import { AppError, errorHandler, toApiErrorBody } from "../middleware/errorHandler";
import { validateTypedItemPayload } from "../services/items.service";
import { buildUserNotRegisteredError } from "../services/sync.service";

test("missing auth errors serialize with stable API shape", () => {
  assert.deepEqual(toApiErrorBody(buildMissingAuthHeaderError()), {
    error: {
      code: "MISSING_AUTH_HEADER",
      message: "Missing Firebase bearer token.",
      status: 401
    }
  });
});

test("invalid auth token errors serialize with stable API shape", () => {
  assert.deepEqual(toApiErrorBody(buildInvalidAuthTokenError()), {
    error: {
      code: "INVALID_AUTH_TOKEN",
      message: "Invalid Firebase bearer token.",
      status: 401
    }
  });
});

test("/auth/sync missing user returns parseable registration error", () => {
  assert.deepEqual(toApiErrorBody(buildUserNotRegisteredError("firebase-user-2", "player2@test.com")), {
    error: {
      code: "USER_NOT_REGISTERED",
      message:
        "Authenticated Firebase user does not exist in the backend database. Create the user first, then call /auth/sync again.",
      status: 409,
      requiredAction: "CREATE_USER",
      details: {
        user: {
          id: "firebase-user-2",
          email: "player2@test.com"
        }
      }
    }
  });
});

test("invalid item payloads serialize as validation errors", () => {
  let thrown: unknown;

  try {
    validateTypedItemPayload({
      item_type: "weapon",
      details: { melee_id: "wrong", skin_id: -1, pattern_x: 0, pattern_y: 0, pattern_z: 0 }
    });
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown instanceof AppError);
  assert.deepEqual(toApiErrorBody(thrown), {
    error: {
      code: "MISSING_REQUIRED_FIELD",
      message: "details.weapon_id is required",
      status: 400,
      details: {
        field: "details.weapon_id"
      }
    }
  });
});

test("unexpected errors return generic 500 response shape", () => {
  let statusCode = 0;
  let payload: unknown;
  const originalConsoleError = console.error;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    }
  };

  console.error = () => undefined;

  try {
    errorHandler(new Error("secret stack detail"), {} as never, res as never, (() => {}) as never);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(statusCode, 500);
  assert.deepEqual(payload, {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error.",
      status: 500
    }
  });
});
