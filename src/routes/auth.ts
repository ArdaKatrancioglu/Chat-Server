import { Router } from "express";
import { getAuthUid, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { syncAuthenticatedUser } from "../services/sync.service";

export const authRouter = Router();

authRouter.post(
  "/auth/sync",
  requireAuth,
  asyncHandler(async (req, res) => {
    const profile = await syncAuthenticatedUser(getAuthUid(req), req.body, {
      authEmail: req.auth?.email
    });
    res.json(profile);
  })
);
