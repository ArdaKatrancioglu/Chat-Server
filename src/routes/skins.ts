import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { createSkin, getSkinById, listSkins } from "../services/skins.service";
import { parseIntParam } from "./params";

export const skinsRouter = Router();

skinsRouter.get(
  "/skins",
  asyncHandler(async (_req, res) => {
    const skins = await listSkins();
    res.json(skins);
  })
);

skinsRouter.post(
  "/skins",
  asyncHandler(async (req, res) => {
    const skin = await createSkin(req.body);
    res.status(201).json(skin);
  })
);

skinsRouter.get(
  "/skins/:skinId",
  asyncHandler(async (req, res) => {
    const skinId = parseIntParam(req.params.skinId, "skinId");
    const skin = await getSkinById(skinId);
    res.json(skin);
  })
);
