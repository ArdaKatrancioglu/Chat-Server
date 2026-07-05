import { Router } from "express";
import { protectUserParamRoute } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import {
  createUserLoadout,
  deleteUserLoadout,
  listUserLoadouts,
  updateUserLoadout
} from "../services/loadouts.service";
import { parseIntParam, parseStringParam } from "./params";

export const loadoutsRouter = Router();

loadoutsRouter.get(
  "/users/:id/loadouts",
  protectUserParamRoute,
  asyncHandler(async (req, res) => {
    const userId = parseStringParam(req.params.id, "id");
    const loadouts = await listUserLoadouts(userId);
    res.json(loadouts);
  })
);

loadoutsRouter.post(
  "/users/:id/loadouts",
  protectUserParamRoute,
  asyncHandler(async (req, res) => {
    const userId = parseStringParam(req.params.id, "id");
    const loadout = await createUserLoadout(userId, req.body);
    res.status(201).json(loadout);
  })
);

loadoutsRouter.put(
  "/users/:id/loadouts/:loadoutId",
  protectUserParamRoute,
  asyncHandler(async (req, res) => {
    const userId = parseStringParam(req.params.id, "id");
    const loadoutId = parseIntParam(req.params.loadoutId, "loadoutId");
    const loadout = await updateUserLoadout(userId, loadoutId, req.body);
    res.json(loadout);
  })
);

loadoutsRouter.delete(
  "/users/:id/loadouts/:loadoutId",
  protectUserParamRoute,
  asyncHandler(async (req, res) => {
    const userId = parseStringParam(req.params.id, "id");
    const loadoutId = parseIntParam(req.params.loadoutId, "loadoutId");
    await deleteUserLoadout(userId, loadoutId);
    res.status(204).send();
  })
);
