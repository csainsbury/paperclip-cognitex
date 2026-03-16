import { Router } from "express";

export function pingRoutes() {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({
      message: "pong",
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
