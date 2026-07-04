import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { getUserSettings, putUserSettings } from "../services/settings.service";
import { parseIntParam } from "./params";

export const settingsRouter = Router();

settingsRouter.get(
  "/users/:id/settings",
  asyncHandler(async (req, res) => {
    const userId = parseIntParam(req.params.id, "id");
    const settings = await getUserSettings(userId);
    res.json(settings);
  })
);

settingsRouter.put(
  "/users/:id/settings",
  asyncHandler(async (req, res) => {
    const userId = parseIntParam(req.params.id, "id");
    const settings = await putUserSettings(userId, req.body);
    res.json(settings);
  })
);
