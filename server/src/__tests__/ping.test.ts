import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { pingRoutes } from "../routes/ping.js";

describe("GET /ping", () => {
  const app = express();
  app.use("/ping", pingRoutes());

  it("returns 200 with message pong and timestamp", async () => {
    const res = await request(app).get("/ping");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("pong");
    expect(res.body.timestamp).toBeDefined();
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });
});
