/// <reference types="jest" />
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";
import { deleteUserAccount } from "../services/user.service";

jest.mock("../services/user.service");

const mockDeleteUserAccount =
  deleteUserAccount as jest.MockedFunction<typeof deleteUserAccount>;

const testJwtSecret = process.env["JWT_SECRET"] ?? "dev-secret";

const buildToken = (userId: string) =>
  jwt.sign(
    {
      userId,
      email: "user@example.com",
      role: "user",
      firstName: "Old",
      lastName: "Name",
    },
    testJwtSecret,
    { expiresIn: "7d" }
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DELETE /api/users/me", () => {
  it("should return 200 and delete account on valid token", async () => {
    const token = buildToken("user-123");
    mockDeleteUserAccount.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toBe("Account deleted successfully");
    expect(mockDeleteUserAccount).toHaveBeenCalledWith("user-123");
  });

  it("should return 401 when token is missing", async () => {
    const res = await request(app).delete("/api/users/me");

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockDeleteUserAccount).not.toHaveBeenCalled();
  });

  it("should return 401 when token is invalid", async () => {
    const res = await request(app)
      .delete("/api/users/me")
      .set("Authorization", "Bearer invalid-token");

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockDeleteUserAccount).not.toHaveBeenCalled();
  });

  it("should return 500 on service error", async () => {
    const token = buildToken("user-123");
    mockDeleteUserAccount.mockRejectedValueOnce(new Error("DB delete failed"));

    const res = await request(app)
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("DB delete failed");
  });
});
