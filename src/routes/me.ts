import { Router, type Request } from "express";
import { getAuthUid, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import {
  createTypedUserItem,
  deleteUserItem,
  getHydratedUserItem,
  listHydratedUserItems
} from "../services/items.service";
import {
  createUserLoadout,
  deleteUserLoadout,
  listHydratedUserLoadouts,
  updateUserLoadout
} from "../services/loadouts.service";
import { ensureUserSynced, getMeProfile } from "../services/me.service";
import { getUserSettings, putUserSettings } from "../services/settings.service";
import {
  getGenericStats,
  getPlayStats,
  patchGenericStats,
  patchPlayStats,
  putGenericStats,
  putPlayStats
} from "../services/stats.service";
import { parseIntParam } from "./params";

export const meRouter = Router();

async function getSyncedAuthUid(req: Request): Promise<string> {
  const userId = getAuthUid(req);
  await ensureUserSynced(userId);
  return userId;
}

meRouter.use("/me", requireAuth);

meRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const profile = await getMeProfile(getAuthUid(req));
    res.json(profile);
  })
);

meRouter.get(
  "/me/settings",
  asyncHandler(async (req, res) => {
    const userId = await getSyncedAuthUid(req);
    const settings = await getUserSettings(userId);
    res.json(settings);
  })
);

meRouter.put(
  "/me/settings",
  asyncHandler(async (req, res) => {
    const userId = await getSyncedAuthUid(req);
    const settings = await putUserSettings(userId, req.body);
    res.json(settings);
  })
);

meRouter.get(
  "/me/generic-stats",
  asyncHandler(async (req, res) => {
    const userId = await getSyncedAuthUid(req);
    const stats = await getGenericStats(userId);
    res.json(stats);
  })
);

meRouter.put(
  "/me/generic-stats",
  asyncHandler(async (req, res) => {
    const userId = await getSyncedAuthUid(req);
    const stats = await putGenericStats(userId, req.body);
    res.json(stats);
  })
);

meRouter.patch(
  "/me/generic-stats",
  asyncHandler(async (req, res) => {
    const userId = getAuthUid(req);
    const stats = await patchGenericStats(userId, req.body);
    res.json(stats);
  })
);

meRouter.get(
  "/me/play-stats",
  asyncHandler(async (req, res) => {
    const userId = await getSyncedAuthUid(req);
    const stats = await getPlayStats(userId);
    res.json(stats);
  })
);

meRouter.put(
  "/me/play-stats",
  asyncHandler(async (req, res) => {
    const userId = await getSyncedAuthUid(req);
    const stats = await putPlayStats(userId, req.body);
    res.json(stats);
  })
);

meRouter.patch(
  "/me/play-stats",
  asyncHandler(async (req, res) => {
    const userId = getAuthUid(req);
    const stats = await patchPlayStats(userId, req.body);
    res.json(stats);
  })
);

meRouter.get(
  "/me/loadouts",
  asyncHandler(async (req, res) => {
    const userId = await getSyncedAuthUid(req);
    const loadouts = await listHydratedUserLoadouts(userId);
    res.json({ loadouts });
  })
);

meRouter.post(
  "/me/loadouts",
  asyncHandler(async (req, res) => {
    const userId = await getSyncedAuthUid(req);
    const loadout = await createUserLoadout(userId, req.body);
    res.status(201).json(loadout);
  })
);

meRouter.put(
  "/me/loadouts/:loadoutId",
  asyncHandler(async (req, res) => {
    const userId = await getSyncedAuthUid(req);
    const loadoutId = parseIntParam(req.params.loadoutId, "loadoutId");
    const loadout = await updateUserLoadout(userId, loadoutId, req.body);
    res.json(loadout);
  })
);

meRouter.delete(
  "/me/loadouts/:loadoutId",
  asyncHandler(async (req, res) => {
    const userId = await getSyncedAuthUid(req);
    const loadoutId = parseIntParam(req.params.loadoutId, "loadoutId");
    await deleteUserLoadout(userId, loadoutId);
    res.status(204).send();
  })
);

meRouter.get(
  "/me/items",
  asyncHandler(async (req, res) => {
    const userId = await getSyncedAuthUid(req);
    const items = await listHydratedUserItems(userId);
    res.json({ items });
  })
);

meRouter.get(
  "/me/items/:itemId",
  asyncHandler(async (req, res) => {
    const userId = await getSyncedAuthUid(req);
    const itemId = parseIntParam(req.params.itemId, "itemId");
    const item = await getHydratedUserItem(userId, itemId);
    res.json(item);
  })
);

meRouter.post(
  "/me/items",
  asyncHandler(async (req, res) => {
    const userId = getAuthUid(req);
    const item = await createTypedUserItem(userId, req.body);
    res.status(201).json(item);
  })
);

meRouter.delete(
  "/me/items/:itemId",
  asyncHandler(async (req, res) => {
    const userId = await getSyncedAuthUid(req);
    const itemId = parseIntParam(req.params.itemId, "itemId");
    await deleteUserItem(userId, itemId);
    res.status(204).send();
  })
);
