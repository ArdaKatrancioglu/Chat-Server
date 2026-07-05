import { Router } from "express";
import { protectUserParamRoute } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { getUserSettings, putUserSettings } from "../services/settings.service";
import { parseStringParam } from "./params";

export const settingsRouter = Router();

settingsRouter.get(
  "/users/:id/settings",
  protectUserParamRoute,
  asyncHandler(async (req, res) => {
    const userId = parseStringParam(req.params.id, "id");
    const settings = await getUserSettings(userId);
    res.json(settings);
  })
);

settingsRouter.put(
  "/users/:id/settings",
  protectUserParamRoute,
  asyncHandler(async (req, res) => {
    const userId = parseStringParam(req.params.id, "id");
    const settings = await putUserSettings(userId, req.body);
    res.json(settings);
  })
);
