/// <reference types="jest" />
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";
import { deleteUserAccount, updateUserProfile } from "../services/user.service";

jest.mock("../services/user.service");

const mockUpdateUserProfile =
  updateUserProfile as jest.MockedFunction<typeof updateUserProfile>;
const mockDeleteUserAccount =
  deleteUserAccount as jest.MockedFunction<typeof deleteUserAccount>;

const buildToken = (userId: string) =>
  jwt.sign(
    {
      userId,
      email: "user@example.com",
      role: "user",
      firstName: "Old",
      lastName: "Name",
    },
    "dev-secret",
    { expiresIn: "7d" }
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PATCH /api/users/me", () => {
  it("should return 200 and update profile on valid token and body", async () => {
    const token = buildToken("user-123");

    mockUpdateUserProfile.mockResolvedValueOnce({
      token: "new-jwt-token",
      user: {
        id: "user-123",
        email: "user@example.com",
        role: "user",
        first_name: "New",
        last_name: "Name",
      } as any,
    });

    const res = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ firstName: "New", lastName: "Name" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toBe("Profile updated successfully");
    expect(res.body.data.token).toBe("new-jwt-token");
    expect(res.body.data.user).toBeDefined();
    expect(mockUpdateUserProfile).toHaveBeenCalledWith("user-123", "New", "Name");
  });

  it("should return 401 when token is missing", async () => {
    const res = await request(app)
      .patch("/api/users/me")
      .send({ firstName: "New", lastName: "Name" });

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
  });

  it("should return 401 when token is invalid", async () => {
    const res = await request(app)
      .patch("/api/users/me")
      .set("Authorization", "Bearer invalid-token")
      .send({ firstName: "New", lastName: "Name" });

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
  });

  it("should return 400 when firstName is missing", async () => {
    const token = buildToken("user-123");

    const res = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ lastName: "Name" });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("firstName and lastName are required");
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
  });

  it("should return 500 on service error", async () => {
    const token = buildToken("user-123");
    mockUpdateUserProfile.mockRejectedValueOnce(new Error("DB update failed"));

    const res = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ firstName: "New", lastName: "Name" });

    expect(res.status).toBe(500);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("DB update failed");
  });
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
