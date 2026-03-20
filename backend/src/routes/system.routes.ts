import { Router } from "express";

export const systemRoutes = Router();

systemRoutes.get("/health", (_req, res) => {
  res.json({ success: true, message: "OK" });
});
