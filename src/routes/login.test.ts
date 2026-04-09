/// <reference types="jest" />
import request from "supertest";
import app from "../app";
import { loginUser } from "../services/auth.service";

jest.mock("../services/auth.service");

const mockLoginUser = loginUser as jest.MockedFunction<typeof loginUser>;

const validBody = {
  email: "user@example.com",
  password: "Secret123",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/auth/login", () => {
  it("should return 200 with token and user on valid credentials", async () => {
    mockLoginUser.mockResolvedValueOnce({
      token: "mock-jwt-token",
      user: { id: "uuid-1", email: "user@example.com", role: "user" } as any,
    });

    const res = await request(app).post("/api/auth/login").send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toBe("Login successful");
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user).toBeDefined();
  });

  it("should normalize email to lowercase", async () => {
    mockLoginUser.mockResolvedValueOnce({
      token: "mock-jwt-token",
      user: { id: "uuid-1", email: "user@example.com", role: "user" } as any,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ ...validBody, email: "USER@EXAMPLE.COM" });

    expect(res.status).toBe(200);
    expect(mockLoginUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "user@example.com" })
    );
  });

  it("should return 400 when email is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "Secret123" });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "email" })])
    );
    expect(mockLoginUser).not.toHaveBeenCalled();
  });

  it("should return 400 when email format is invalid", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ ...validBody, email: "notanemail" });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "email" })])
    );
    expect(mockLoginUser).not.toHaveBeenCalled();
  });

  it("should return 400 when password is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "user@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "password" })])
    );
    expect(mockLoginUser).not.toHaveBeenCalled();
  });

  it("should return 400 when password is shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ ...validBody, password: "Ab1" });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "password" })])
    );
    expect(mockLoginUser).not.toHaveBeenCalled();
  });

  it("should return 401 on invalid credentials", async () => {
    const error = new Error("Invalid email or password") as any;
    error.statusCode = 401;
    mockLoginUser.mockRejectedValueOnce(error);

    const res = await request(app).post("/api/auth/login").send(validBody);

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("should not expose password in response", async () => {
    mockLoginUser.mockResolvedValueOnce({
      token: "mock-jwt-token",
      user: { id: "uuid-1", email: "user@example.com", role: "user" } as any,
    });

    const res = await request(app).post("/api/auth/login").send(validBody);

    expect(res.body.data.user.password).toBeUndefined();
  });

  it("should return 500 on unexpected server error", async () => {
    mockLoginUser.mockRejectedValueOnce(new Error("DB connection failed"));

    const res = await request(app).post("/api/auth/login").send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("DB connection failed");
  });
});