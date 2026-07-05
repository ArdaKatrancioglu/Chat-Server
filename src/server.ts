import express from "express";
import { pool } from "./db/pool";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth";
import { itemsRouter } from "./routes/items";
import { loadoutsRouter } from "./routes/loadouts";
import { meRouter } from "./routes/me";
import { settingsRouter } from "./routes/settings";
import { skinsRouter } from "./routes/skins";
import { statsRouter } from "./routes/stats";
import { usersRouter } from "./routes/users";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());

app.get("/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

app.use(authRouter);
app.use(meRouter);
app.use(usersRouter);
app.use(settingsRouter);
app.use(statsRouter);
app.use(loadoutsRouter);
app.use(itemsRouter);
app.use(skinsRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
