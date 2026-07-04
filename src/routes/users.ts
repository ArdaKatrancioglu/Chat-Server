import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { createUser, getUserById, updateUser } from "../services/users.service";
import { parseIntParam } from "./params";

export const usersRouter = Router();

usersRouter.post(
  "/users",
  asyncHandler(async (req, res) => {
    const user = await createUser(req.body);
    res.status(201).json(user);
  })
);

usersRouter.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const id = parseIntParam(req.params.id, "id");
    const user = await getUserById(id);
    res.json(user);
  })
);

usersRouter.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const id = parseIntParam(req.params.id, "id");
    const user = await updateUser(id, req.body);
    res.json(user);
  })
);
