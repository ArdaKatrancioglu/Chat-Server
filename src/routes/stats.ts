import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import {
  getGenericStats,
  getPlayStats,
  patchPlayStats,
  putGenericStats,
  putPlayStats
} from "../services/stats.service";
import { parseIntParam } from "./params";

export const statsRouter = Router();

statsRouter.get(
  "/users/:id/generic-stats",
  asyncHandler(async (req, res) => {
    const userId = parseIntParam(req.params.id, "id");
    const stats = await getGenericStats(userId);
    res.json(stats);
  })
);

statsRouter.put(
  "/users/:id/generic-stats",
  asyncHandler(async (req, res) => {
    const userId = parseIntParam(req.params.id, "id");
    const stats = await putGenericStats(userId, req.body);
    res.json(stats);
  })
);

statsRouter.get(
  "/users/:id/play-stats",
  asyncHandler(async (req, res) => {
    const userId = parseIntParam(req.params.id, "id");
    const stats = await getPlayStats(userId);
    res.json(stats);
  })
);

statsRouter.put(
  "/users/:id/play-stats",
  asyncHandler(async (req, res) => {
    const userId = parseIntParam(req.params.id, "id");
    const stats = await putPlayStats(userId, req.body);
    res.json(stats);
  })
);

statsRouter.patch(
  "/users/:id/play-stats",
  asyncHandler(async (req, res) => {
    const userId = parseIntParam(req.params.id, "id");
    const stats = await patchPlayStats(userId, req.body);
    res.json(stats);
  })
);
