import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import {
  createMelee,
  createThrowable,
  createUserItem,
  createWeapon,
  deleteUserItem,
  getMeleeByItemId,
  getThrowableByItemId,
  getWeaponByItemId,
  listMelee,
  listThrowables,
  listUserItems,
  listWeapons
} from "../services/items.service";
import { parseIntParam } from "./params";

export const itemsRouter = Router();

itemsRouter.get(
  "/users/:id/items",
  asyncHandler(async (req, res) => {
    const userId = parseIntParam(req.params.id, "id");
    const items = await listUserItems(userId);
    res.json(items);
  })
);

itemsRouter.post(
  "/users/:id/items",
  asyncHandler(async (req, res) => {
    const userId = parseIntParam(req.params.id, "id");
    const item = await createUserItem(userId, req.body);
    res.status(201).json(item);
  })
);

itemsRouter.delete(
  "/users/:id/items/:itemId",
  asyncHandler(async (req, res) => {
    const userId = parseIntParam(req.params.id, "id");
    const itemId = parseIntParam(req.params.itemId, "itemId");
    await deleteUserItem(userId, itemId);
    res.status(204).send();
  })
);

itemsRouter.get(
  "/weapons",
  asyncHandler(async (_req, res) => {
    const weapons = await listWeapons();
    res.json(weapons);
  })
);

itemsRouter.post(
  "/weapons",
  asyncHandler(async (req, res) => {
    const weapon = await createWeapon(req.body);
    res.status(201).json(weapon);
  })
);

itemsRouter.get(
  "/weapons/:itemId",
  asyncHandler(async (req, res) => {
    const itemId = parseIntParam(req.params.itemId, "itemId");
    const weapon = await getWeaponByItemId(itemId);
    res.json(weapon);
  })
);

itemsRouter.get(
  "/melee",
  asyncHandler(async (_req, res) => {
    const melee = await listMelee();
    res.json(melee);
  })
);

itemsRouter.post(
  "/melee",
  asyncHandler(async (req, res) => {
    const melee = await createMelee(req.body);
    res.status(201).json(melee);
  })
);

itemsRouter.get(
  "/melee/:itemId",
  asyncHandler(async (req, res) => {
    const itemId = parseIntParam(req.params.itemId, "itemId");
    const melee = await getMeleeByItemId(itemId);
    res.json(melee);
  })
);

itemsRouter.get(
  "/throwables",
  asyncHandler(async (_req, res) => {
    const throwables = await listThrowables();
    res.json(throwables);
  })
);

itemsRouter.post(
  "/throwables",
  asyncHandler(async (req, res) => {
    const throwable = await createThrowable(req.body);
    res.status(201).json(throwable);
  })
);

itemsRouter.get(
  "/throwables/:itemId",
  asyncHandler(async (req, res) => {
    const itemId = parseIntParam(req.params.itemId, "itemId");
    const throwable = await getThrowableByItemId(itemId);
    res.json(throwable);
  })
);
