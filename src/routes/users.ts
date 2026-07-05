import { Router } from "express";
import { protectUserCreateRoute, protectUserParamRoute } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { createUser, getUserById, updateUser } from "../services/users.service";
import { parseStringParam } from "./params";

export const usersRouter = Router();

usersRouter.post(
  "/users",
  protectUserCreateRoute,
  asyncHandler(async (req, res) => {
    const user = await createUser(req.body);
    res.status(201).json(user);
  })
);

usersRouter.get(
  "/users/:id",
  protectUserParamRoute,
  asyncHandler(async (req, res) => {
    const id = parseStringParam(req.params.id, "id");
    const user = await getUserById(id);
    res.json(user);
  })
);

usersRouter.patch(
  "/users/:id",
  protectUserParamRoute,
  asyncHandler(async (req, res) => {
    const id = parseStringParam(req.params.id, "id");
    const user = await updateUser(id, req.body);
    res.json(user);
  })
);
