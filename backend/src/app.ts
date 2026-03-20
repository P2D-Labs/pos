import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorMiddleware } from "./lib/http";
import { auditMeta } from "./middleware/audit";
import { auditWriteMiddleware } from "./middleware/audit-write";
import { sanitizeRequestMiddleware } from "./middleware/sanitize";
import { api } from "./routes/index";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(auditMeta);
app.use(sanitizeRequestMiddleware);
app.use(auditWriteMiddleware);
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
  }),
);

app.use("/api", api);
app.use(errorMiddleware);
