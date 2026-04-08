/// <reference types="jest" />
import request from "supertest";
import app from "../app";

describe("GET /api/health", () => {
  it("should return 200 with status Ok Healthy", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Ok Healthy");
  });

  it("should return a valid ISO timestamp", async () => {
    const res = await request(app).get("/api/health");
    const { timestamp } = res.body as { timestamp: string };

    expect(timestamp).toBeDefined();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });
});

  