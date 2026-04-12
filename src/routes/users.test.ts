/// <reference types="jest" />
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";
import {
  becomeArtist,
  deleteUserAccount,
  getUserProfile,
  updateUserProfile,
} from "../services/user.service";

jest.mock("../services/user.service");

const mockDeleteUserAccount =
  deleteUserAccount as jest.MockedFunction<typeof deleteUserAccount>;
const mockBecomeArtist =
  becomeArtist as jest.MockedFunction<typeof becomeArtist>;
const mockGetUserProfile =
  getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const mockUpdateUserProfile =
  updateUserProfile as jest.MockedFunction<typeof updateUserProfile>;

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

const validBecomeArtistBody = {
  artistName: "Basmala",
  bio: "I am a passionate artist specializing in digital illustrations and modern art.",
  location: "Nablus",
  phone: "0591234567",
  socialMedia: [
    {
      platform: "instagram",
      url: "https://instagram.com/batool._.sweiseh",
    },
    {
      platform: "x",
      url: "https://x.com/batool_sweiseh",
    },
  ],
};

describe("GET /api/users/profile", () => {
  it("should return 200 and profile data on valid token", async () => {
    const token = buildToken("user-123");
    mockGetUserProfile.mockResolvedValueOnce({
      id: "user-123",
      email: "user@example.com",
      role: "artist",
      first_name: "Maryam",
      last_name: "Rw",
      artist_name: "Basmala",
      bio: validBecomeArtistBody.bio,
      location: validBecomeArtistBody.location,
      phone: validBecomeArtistBody.phone,
      social_media: JSON.stringify(validBecomeArtistBody.socialMedia),
    } as any);

    const res = await request(app)
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.user).toEqual(
      expect.objectContaining({
        id: "user-123",
        email: "user@example.com",
        role: "artist",
        firstName: "Maryam",
      })
    );
    expect(res.body.data.user.socialMedia).toEqual(validBecomeArtistBody.socialMedia);
    expect(mockGetUserProfile).toHaveBeenCalledWith("user-123");
  });

  it("should return 401 when token is missing", async () => {
    const res = await request(app).get("/api/users/profile");

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockGetUserProfile).not.toHaveBeenCalled();
  });

  it("should return 401 when token is invalid", async () => {
    const res = await request(app)
      .get("/api/users/profile")
      .set("Authorization", "Bearer invalid-token");

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockGetUserProfile).not.toHaveBeenCalled();
  });

  it("should return 500 on service error", async () => {
    const token = buildToken("user-123");
    mockGetUserProfile.mockRejectedValueOnce(new Error("DB profile failed"));

    const res = await request(app)
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("DB profile failed");
  });
});

describe("PATCH /api/users/profile", () => {
  it("should return 200 and update profile for artist", async () => {
    const token = buildToken("user-123");
    mockUpdateUserProfile.mockResolvedValueOnce({
      id: "user-123",
      first_name: "Maryam",
      last_name: "Rw",
      email: "user@example.com",
      role: "artist",
      artist_name: validBecomeArtistBody.artistName,
      bio: validBecomeArtistBody.bio,
      location: validBecomeArtistBody.location,
      phone: validBecomeArtistBody.phone,
      social_media: JSON.stringify(validBecomeArtistBody.socialMedia),
    } as any);

    const res = await request(app)
      .patch("/api/users/profile")
      .set("Authorization", `Bearer ${token}`)
      .send(validBecomeArtistBody);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toBe("Profile updated successfully");
    expect(res.body.data.user.socialMedia).toEqual(validBecomeArtistBody.socialMedia);
    expect(mockUpdateUserProfile).toHaveBeenCalledWith("user-123", validBecomeArtistBody);
  });

  it("should return 401 when token is missing", async () => {
    const res = await request(app)
      .patch("/api/users/profile")
      .send(validBecomeArtistBody);

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
  });

  it("should return 400 when payload is invalid", async () => {
    const token = buildToken("user-123");
    const res = await request(app)
      .patch("/api/users/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validBecomeArtistBody,
        socialMedia: [{ platform: "x", url: "bad-url" }],
      });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
  });

  it("should return 403 when non-artist tries to update", async () => {
    const token = buildToken("user-123");
    const forbiddenError = new Error("Only artist accounts can update artist profile fields.") as any;
    forbiddenError.statusCode = 403;
    mockUpdateUserProfile.mockRejectedValueOnce(forbiddenError);

    const res = await request(app)
      .patch("/api/users/profile")
      .set("Authorization", `Bearer ${token}`)
      .send(validBecomeArtistBody);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Only artist accounts can update artist profile fields.");
  });

  it("should return 500 on service error", async () => {
    const token = buildToken("user-123");
    mockUpdateUserProfile.mockRejectedValueOnce(new Error("DB update profile failed"));

    const res = await request(app)
      .patch("/api/users/profile")
      .set("Authorization", `Bearer ${token}`)
      .send(validBecomeArtistBody);

    expect(res.status).toBe(500);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("DB update profile failed");
  });
});

describe("DELETE /api/users/account", () => {
  it("should return 200 and delete account on valid token", async () => {
    const token = buildToken("user-123");
    mockDeleteUserAccount.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .delete("/api/users/account")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toBe("Account deleted successfully");
    expect(mockDeleteUserAccount).toHaveBeenCalledWith("user-123");
  });

  it("should return 401 when token is missing", async () => {
    const res = await request(app).delete("/api/users/account");

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockDeleteUserAccount).not.toHaveBeenCalled();
  });

  it("should return 401 when token is invalid", async () => {
    const res = await request(app)
      .delete("/api/users/account")
      .set("Authorization", "Bearer invalid-token");

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockDeleteUserAccount).not.toHaveBeenCalled();
  });

  it("should return 500 on service error", async () => {
    const token = buildToken("user-123");
    mockDeleteUserAccount.mockRejectedValueOnce(new Error("DB delete failed"));

    const res = await request(app)
      .delete("/api/users/account")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("DB delete failed");
  });
});

describe("PATCH /api/users/become-artist", () => {
  it("should return 200 and upgrade user to artist", async () => {
    const token = buildToken("user-123");
    mockBecomeArtist.mockResolvedValueOnce({
      id: "user-123",
      first_name: "Maryam",
      last_name: "Rw",
      email: "user@example.com",
      role: "artist",
      bio: validBecomeArtistBody.bio,
      location: validBecomeArtistBody.location,
      phone: validBecomeArtistBody.phone,
      social_media: JSON.stringify(validBecomeArtistBody.socialMedia),
    } as any);

    const res = await request(app)
      .patch("/api/users/become-artist")
      .set("Authorization", `Bearer ${token}`)
      .send(validBecomeArtistBody);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toBe("Successfully became an artist");
    expect(res.body.data.user.socialMedia).toEqual(validBecomeArtistBody.socialMedia);
    expect(res.body.data.user.instagram).toBeUndefined();
    expect(mockBecomeArtist).toHaveBeenCalledWith("user-123", validBecomeArtistBody);
  });

  it("should return 401 when token is missing", async () => {
    const res = await request(app)
      .patch("/api/users/become-artist")
      .send(validBecomeArtistBody);

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockBecomeArtist).not.toHaveBeenCalled();
  });

  it("should return 401 when token is invalid", async () => {
    const res = await request(app)
      .patch("/api/users/become-artist")
      .set("Authorization", "Bearer invalid-token")
      .send(validBecomeArtistBody);

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockBecomeArtist).not.toHaveBeenCalled();
  });

  it("should return 400 when required fields are missing", async () => {
    const token = buildToken("user-123");

    const res = await request(app)
      .patch("/api/users/become-artist")
      .set("Authorization", `Bearer ${token}`)
      .send({
        artistName: "Basmala",
        location: "Nablus",
        phone: "0591234567",
      });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "bio" })])
    );
    expect(mockBecomeArtist).not.toHaveBeenCalled();
  });

  it("should return 400 when socialMedia platform is invalid", async () => {
    const token = buildToken("user-123");

    const res = await request(app)
      .patch("/api/users/become-artist")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validBecomeArtistBody,
        socialMedia: [
          {
            platform: "tiktok",
            url: "https://tiktok.com/@artist",
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "socialMedia.0.platform" }),
      ])
    );
    expect(mockBecomeArtist).not.toHaveBeenCalled();
  });

  it("should return 400 when socialMedia URL is invalid", async () => {
    const token = buildToken("user-123");

    const res = await request(app)
      .patch("/api/users/become-artist")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...validBecomeArtistBody,
        socialMedia: [
          {
            platform: "instagram",
            url: "not-a-url",
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "socialMedia.0.url" }),
      ])
    );
    expect(mockBecomeArtist).not.toHaveBeenCalled();
  });

  it("should return 409 when user is already an artist", async () => {
    const token = buildToken("user-123");
    const conflictError = new Error("You are already an artist.") as any;
    conflictError.statusCode = 409;
    mockBecomeArtist.mockRejectedValueOnce(conflictError);

    const res = await request(app)
      .patch("/api/users/become-artist")
      .set("Authorization", `Bearer ${token}`)
      .send(validBecomeArtistBody);

    expect(res.status).toBe(409);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("You are already an artist.");
  });

  it("should return 500 on service error", async () => {
    const token = buildToken("user-123");
    mockBecomeArtist.mockRejectedValueOnce(new Error("DB update failed"));

    const res = await request(app)
      .patch("/api/users/become-artist")
      .set("Authorization", `Bearer ${token}`)
      .send(validBecomeArtistBody);

    expect(res.status).toBe(500);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("DB update failed");
  });
});
