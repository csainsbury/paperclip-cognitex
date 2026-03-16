import { Router } from "express";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

export function versionRoutes() {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ version: pkg.version });
  });

  return router;
}
