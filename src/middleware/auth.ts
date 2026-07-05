import type { NextFunction, Request, RequestHandler, Response } from "express";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { AppError } from "./errorHandler";

let firebaseAuth: Auth | null = null;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function isEnabled(value: string | undefined): boolean {
  return value === "true";
}

function isLocalhostRequest(req: Request): boolean {
  const remoteAddress = req.socket.remoteAddress ?? req.ip ?? "";
  const normalizedAddress = remoteAddress.replace(/^::ffff:/, "");

  return normalizedAddress === "127.0.0.1" || normalizedAddress === "::1";
}

export function shouldUseDevAuthBypass(input: {
  hasAuthorizationHeader: boolean;
  isProduction: boolean;
  isLocalhost: boolean;
  devAuthBypassEnabled: boolean;
}): boolean {
  return (
    !input.hasAuthorizationHeader &&
    !input.isProduction &&
    input.isLocalhost &&
    input.devAuthBypassEnabled
  );
}

export function shouldAllowDevAdminBypass(input: {
  isProduction: boolean;
  isLocalhost: boolean;
  devAuthBypassEnabled: boolean;
  headerUserId: string | undefined;
  expectedUserId: string | undefined;
}): boolean {
  if (
    input.isProduction ||
    !input.isLocalhost ||
    !input.devAuthBypassEnabled ||
    !input.headerUserId
  ) {
    return false;
  }

  return !input.expectedUserId || input.headerUserId === input.expectedUserId;
}

export function buildMissingAuthHeaderError(): AppError {
  return new AppError(401, "MISSING_AUTH_HEADER", "Missing Firebase bearer token.");
}

export function buildInvalidAuthTokenError(): AppError {
  return new AppError(401, "INVALID_AUTH_TOKEN", "Invalid Firebase bearer token.");
}

function getFirebaseAdminAuth(): Auth {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new AppError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Firebase Admin credentials are not configured."
    );
  }

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      })
    });

  firebaseAuth = getAuth(app);
  return firebaseAuth;
}

function applyDevAuthBypass(req: Request): boolean {
  if (
    !shouldUseDevAuthBypass({
      hasAuthorizationHeader: Boolean(req.get("authorization")),
      isProduction: isProduction(),
      isLocalhost: isLocalhostRequest(req),
      devAuthBypassEnabled: isEnabled(process.env.DEV_AUTH_BYPASS)
    })
  ) {
    return false;
  }

  const headerUserId = req.get("x-dev-user-id")?.trim();
  const fallbackUserId = process.env.DEV_AUTH_USER_ID?.trim() || "local-dev-user";

  req.auth = {
    uid: headerUserId || fallbackUserId,
    source: "dev",
    email: null
  };

  return true;
}

function getBearerToken(req: Request): string {
  const authorization = req.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw buildMissingAuthHeaderError();
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw buildMissingAuthHeaderError();
  }

  return token;
}

export const requireAuth: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authorization = req.get("authorization");

    if (!authorization && applyDevAuthBypass(req)) {
      next();
      return;
    }

    const decodedToken = await getFirebaseAdminAuth().verifyIdToken(getBearerToken(req));
    req.auth = {
      uid: decodedToken.uid,
      source: "firebase",
      email: decodedToken.email ?? null
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(buildInvalidAuthTokenError());
  }
};

export function getAuthUid(req: Request): string {
  if (!req.auth?.uid) {
    throw new AppError(401, "AUTH_REQUIRED", "Authentication required.");
  }

  return req.auth.uid;
}

export function canUseDevUserRoutes(req: Request): boolean {
  return (
    !isProduction() &&
    isLocalhostRequest(req) &&
    isEnabled(process.env.ALLOW_DEV_USER_ROUTES)
  );
}

export function canUseDevAdminBypass(req: Request): boolean {
  return shouldAllowDevAdminBypass({
    isProduction: isProduction(),
    isLocalhost: isLocalhostRequest(req),
    devAuthBypassEnabled: isEnabled(process.env.DEV_AUTH_BYPASS),
    headerUserId: req.get("x-dev-user-id")?.trim(),
    expectedUserId: process.env.DEV_AUTH_USER_ID?.trim()
  });
}

export const protectUserParamRoute: RequestHandler = (req, res, next) => {
  if (canUseDevUserRoutes(req)) {
    next();
    return;
  }

  requireAuth(req, res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }

    if (getAuthUid(req) !== req.params.id) {
      next(new AppError(403, "FORBIDDEN", "You do not have permission to access this resource."));
      return;
    }

    next();
  });
};

export const protectUserCreateRoute: RequestHandler = (req, res, next) => {
  if (canUseDevUserRoutes(req)) {
    next();
    return;
  }

  requireAuth(req, res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }

    if (getAuthUid(req) !== req.body?.id) {
      next(new AppError(403, "FORBIDDEN", "You do not have permission to access this resource."));
      return;
    }

    next();
  });
};
