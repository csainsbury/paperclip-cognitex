import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { versionRoutes } from "../routes/version.js";

describe("GET /version", () => {
  const app = express();
  app.use("/version", versionRoutes());

  it("returns 200 with a version string", async () => {
    const res = await request(app).get("/version");
    expect(res.status).toBe(200);
    expect(typeof res.body.version).toBe("string");
    expect(res.body.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
