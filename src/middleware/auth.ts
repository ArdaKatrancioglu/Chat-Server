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

function getFirebaseAdminAuth(): Auth {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new AppError(500, "Firebase Admin credentials are not configured");
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
  if (isProduction() || !isLocalhostRequest(req) || !isEnabled(process.env.DEV_AUTH_BYPASS)) {
    return false;
  }

  const headerUserId = req.get("x-dev-user-id")?.trim();
  const fallbackUserId = process.env.DEV_AUTH_USER_ID?.trim() || "local-dev-user";

  req.auth = {
    uid: headerUserId || fallbackUserId,
    source: "dev"
  };

  return true;
}

function getBearerToken(req: Request): string {
  const authorization = req.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(401, "Missing Firebase bearer token");
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw new AppError(401, "Missing Firebase bearer token");
  }

  return token;
}

export const requireAuth: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (applyDevAuthBypass(req)) {
      next();
      return;
    }

    const decodedToken = await getFirebaseAdminAuth().verifyIdToken(getBearerToken(req));
    req.auth = {
      uid: decodedToken.uid,
      source: "firebase"
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    next(new AppError(401, "Invalid Firebase bearer token"));
  }
};

export function getAuthUid(req: Request): string {
  if (!req.auth?.uid) {
    throw new AppError(401, "Authentication required");
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
      next(new AppError(403, "Forbidden"));
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
      next(new AppError(403, "Forbidden"));
      return;
    }

    next();
  });
};
