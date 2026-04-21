/// <reference types="jest" />
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";
import {
  saveArtistProfile,
  deleteUserAccount,
  getUserProfile,
  updateArtistProfileImage,
} from "../services/user.service";
import { getSupabase } from "../config/supabase";
import { toProfileImagePublicUrl } from "../services/profile-image-storage.service";

jest.mock("../services/user.service");
jest.mock("../config/supabase", () => ({
  getSupabase: jest.fn(),
}));
jest.mock("../services/profile-image-storage.service", () => ({
  toProfileImagePublicUrl: jest.fn((value: string) => `https://cdn.example/${value}`),
}));

const mockDeleteUserAccount =
  deleteUserAccount as jest.MockedFunction<typeof deleteUserAccount>;
const mockSaveArtistProfile =
  saveArtistProfile as jest.MockedFunction<typeof saveArtistProfile>;
const mockGetUserProfile =
  getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const mockUpdateArtistProfileImage =
  updateArtistProfileImage as jest.MockedFunction<typeof updateArtistProfileImage>;
const mockGetSupabase = getSupabase as jest.MockedFunction<typeof getSupabase>;
const mockToProfileImagePublicUrl =
  toProfileImagePublicUrl as jest.MockedFunction<typeof toProfileImagePublicUrl>;

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

const mockArtistRoleCheck = (role: "artist" | "user" = "artist") => {
  const single = jest.fn().mockResolvedValue({ data: { role }, error: null });
  const eq = jest.fn().mockReturnValue({ single });
  const select = jest.fn().mockReturnValue({ eq });
  const from = jest.fn().mockImplementation((table: string) => {
    if (table === "users") {
      return { select };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  mockGetSupabase.mockReturnValue({ from } as any);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockArtistRoleCheck("artist");
  mockToProfileImagePublicUrl.mockImplementation((value: string) => `https://cdn.example/${value}`);
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

const pngFixture = Buffer.from([
  0x89, 0x50, 0x4e, 0x47,
  0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
]);

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
      artist_since: "2026-01-10T10:00:00.000Z",
      profile_image: "user-123/profile.png",
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
        artistSince: "2026-01-10T10:00:00.000Z",
        profileImage: "https://cdn.example/user-123/profile.png",
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
  it("should return 200 and upsert artist profile (idempotent)", async () => {
    const token = buildToken("user-123");
    mockGetUserProfile.mockResolvedValueOnce({
      id: "user-123",
      role: "artist",
    } as any);
    mockSaveArtistProfile.mockResolvedValueOnce({
      id: "user-123",
      first_name: "Maryam",
      last_name: "Rw",
      email: "user@example.com",
      role: "artist",
      artist_name: validBecomeArtistBody.artistName,
      artist_since: "2026-01-10T10:00:00.000Z",
      profile_image: "user-123/profile-new.png",
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
    expect(res.body.message).toBe("تم تحديث الملف الشخصي بنجاح");
    expect(res.body.data.user.socialMedia).toEqual(validBecomeArtistBody.socialMedia);
    expect(res.body.data.user.artistSince).toBe("2026-01-10T10:00:00.000Z");
    expect(res.body.data.user.profileImage).toBe("https://cdn.example/user-123/profile-new.png");
    expect(mockSaveArtistProfile).toHaveBeenCalledWith("user-123", validBecomeArtistBody);
  });

  it("should return registration success message when upgrading a normal user to artist", async () => {
    const token = buildToken("user-123");
    mockGetUserProfile.mockResolvedValueOnce({
      id: "user-123",
      role: "user",
    } as any);
    mockSaveArtistProfile.mockResolvedValueOnce({
      id: "user-123",
      first_name: "Maryam",
      last_name: "Rw",
      email: "user@example.com",
      role: "artist",
      artist_name: validBecomeArtistBody.artistName,
      artist_since: "2026-01-10T10:00:00.000Z",
      profile_image: null,
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
    expect(res.body.message).toBe("تم تسجيلك كفنان بنجاح");
  });

  it("should return 401 when token is missing", async () => {
    const res = await request(app)
      .patch("/api/users/profile")
      .send(validBecomeArtistBody);

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockSaveArtistProfile).not.toHaveBeenCalled();
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
    expect(mockSaveArtistProfile).not.toHaveBeenCalled();
  });

  it("should return 500 on service error", async () => {
    const token = buildToken("user-123");
    mockGetUserProfile.mockResolvedValueOnce({
      id: "user-123",
      role: "artist",
    } as any);
    mockSaveArtistProfile.mockRejectedValueOnce(new Error("DB update profile failed"));

    const res = await request(app)
      .patch("/api/users/profile")
      .set("Authorization", `Bearer ${token}`)
      .send(validBecomeArtistBody);

    expect(res.status).toBe(500);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("DB update profile failed");
  });

  it("should return 409 when artist name is already in use", async () => {
    const token = buildToken("user-123");
    const conflictError = new Error("Artist name is already in use.") as any;
    conflictError.statusCode = 409;
    mockGetUserProfile.mockResolvedValueOnce({
      id: "user-123",
      role: "artist",
    } as any);
    mockSaveArtistProfile.mockRejectedValueOnce(conflictError);

    const res = await request(app)
      .patch("/api/users/profile")
      .set("Authorization", `Bearer ${token}`)
      .send(validBecomeArtistBody);

    expect(res.status).toBe(409);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Artist name is already in use.");
  });
});

describe("PATCH /api/users/profile/image", () => {
  it("should return 200 and update profile image for artist", async () => {
    const token = buildToken("user-123");
    mockUpdateArtistProfileImage.mockResolvedValueOnce({
      id: "user-123",
      first_name: "Maryam",
      last_name: "Rw",
      email: "user@example.com",
      role: "artist",
      artist_name: "Basmala",
      artist_since: "2026-01-10T10:00:00.000Z",
      profile_image: "user-123/new-profile.png",
      bio: validBecomeArtistBody.bio,
      location: validBecomeArtistBody.location,
      phone: validBecomeArtistBody.phone,
      social_media: JSON.stringify(validBecomeArtistBody.socialMedia),
    } as any);

    const res = await request(app)
      .patch("/api/users/profile/image")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", pngFixture, {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.user.profileImage).toBe("https://cdn.example/user-123/new-profile.png");
    expect(mockUpdateArtistProfileImage).toHaveBeenCalledWith(
      "user-123",
      expect.objectContaining({
        originalname: "avatar.png",
        mimetype: "image/png",
      })
    );
  });

  it("should return 401 when token is missing", async () => {
    const res = await request(app)
      .patch("/api/users/profile/image")
      .attach("image", Buffer.from("fake-image-content"), {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockUpdateArtistProfileImage).not.toHaveBeenCalled();
  });

  it("should return 403 when user is not artist", async () => {
    mockArtistRoleCheck("user");
    const token = buildToken("user-123");

    const res = await request(app)
      .patch("/api/users/profile/image")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", pngFixture, {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(403);
    expect(res.body.status).toBe("error");
    expect(mockUpdateArtistProfileImage).not.toHaveBeenCalled();
  });

  it("should return 400 when image file is missing", async () => {
    const token = buildToken("user-123");

    const res = await request(app)
      .patch("/api/users/profile/image")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(mockUpdateArtistProfileImage).not.toHaveBeenCalled();
  });

  it("should return 400 when uploaded file is not an image", async () => {
    const token = buildToken("user-123");

    const res = await request(app)
      .patch("/api/users/profile/image")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", Buffer.from("not-image"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(mockUpdateArtistProfileImage).not.toHaveBeenCalled();
  });

  it("should return 500 on service error", async () => {
    const token = buildToken("user-123");
    mockUpdateArtistProfileImage.mockRejectedValueOnce(new Error("storage upload failed"));

    const res = await request(app)
      .patch("/api/users/profile/image")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", pngFixture, {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(500);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("storage upload failed");
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
    expect(res.body.message).toBe("تم حذف الحساب بنجاح");
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


