/// <reference types="jest" />
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";
import {
  getAllArtists,
  getArtistProfile,
  getArtistArtworks,
} from "../services/artist.service";

jest.mock("../services/artist.service");

const mockGetAllArtists = getAllArtists as jest.MockedFunction<typeof getAllArtists>;
const mockGetArtistProfile = getArtistProfile as jest.MockedFunction<typeof getArtistProfile>;
const mockGetArtistArtworks = getArtistArtworks as jest.MockedFunction<typeof getArtistArtworks>;

const testJwtSecret = process.env["JWT_SECRET"] ?? "dev-secret";

const buildToken = (userId: string) =>
  jwt.sign(
    {
      userId,
      email: "user@example.com",
      role: "user",
      firstName: "Viewer",
      lastName: "User",
    },
    testJwtSecret,
    { expiresIn: "7d" }
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/artists", () => {
  it("should return 200 and artist list", async () => {
    const token = buildToken("user-123");
    mockGetAllArtists.mockResolvedValueOnce([
      {
        id: "artist-1",
        first_name: "Yara",
        last_name: "Rw",
        artist_name: "يارا",
        bio: "Artist bio here",
        location: "القدس",
        role: "artist",
        artist_since: "2026-01-10T10:00:00.000Z",
        profile_image: "https://cdn.example/artist-1/profile.png",
      },
    ] as any);

    const res = await request(app)
      .get("/api/v1/artists")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        id: "artist-1",
        artist_since: "2026-01-10T10:00:00.000Z",
        profile_image: "https://cdn.example/artist-1/profile.png",
      })
    );
    expect(mockGetAllArtists).toHaveBeenCalledTimes(1);
  });

  it("should return 200 even when token is missing (public route)", async () => {
    mockGetAllArtists.mockResolvedValueOnce([]);
    const res = await request(app).get("/api/v1/artists");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(mockGetAllArtists).toHaveBeenCalledTimes(1);
  });

  it("should return 500 on service error", async () => {
    const token = buildToken("user-123");
    mockGetAllArtists.mockRejectedValueOnce(new Error("artists load failed"));

    const res = await request(app)
      .get("/api/v1/artists")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("artists load failed");
  });
});

describe("GET /api/artists/:id", () => {
  it("should return 200 and artist profile", async () => {
    const token = buildToken("user-123");
    mockGetArtistProfile.mockResolvedValueOnce({
      id: "artist-1",
      first_name: "Yara",
      last_name: "Rw",
      artist_name: "يارا",
      bio: "Artist bio here",
      location: "القدس",
      phone: "0591234567",
      social_media: [{ platform: "instagram", url: "https://instagram.com/yara" }],
      role: "artist",
      artist_since: "2026-01-10T10:00:00.000Z",
      profile_image: "https://cdn.example/artist-1/profile.png",
    } as any);

    const res = await request(app)
      .get("/api/v1/artists/artist-1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data).toEqual(
      expect.objectContaining({
        id: "artist-1",
        artist_since: "2026-01-10T10:00:00.000Z",
        profile_image: "https://cdn.example/artist-1/profile.png",
      })
    );
    expect(mockGetArtistProfile).toHaveBeenCalledWith("artist-1");
  });

  it("should return 404 when artist is not found", async () => {
    const token = buildToken("user-123");
    const notFoundError = new Error("Artist not found") as Error & { statusCode?: number };
    notFoundError.statusCode = 404;
    mockGetArtistProfile.mockRejectedValueOnce(notFoundError);

    const res = await request(app)
      .get("/api/v1/artists/missing-id")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Artist not found");
  });
});

describe("GET /api/artists/:id/artworks", () => {
  it("should return 200 and pass filters correctly", async () => {
    const token = buildToken("user-123");
    mockGetArtistArtworks.mockResolvedValueOnce({
      artworks: [],
      totalCount: 0,
      page: 2,
      limit: 4,
    } as any);

    const res = await request(app)
      .get("/api/v1/artists/artist-1/artworks")
      .set("Authorization", `Bearer ${token}`)
      .query({ category: "لوحات فنية", page: "2", limit: "4" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(mockGetArtistArtworks).toHaveBeenCalledWith("artist-1", {
      category: "لوحات فنية",
      page: 2,
      limit: 4,
    });
  });

  it("should return 200 even when token is missing (public route)", async () => {
    mockGetArtistArtworks.mockResolvedValueOnce({ artworks: [] });
    const res = await request(app).get("/api/v1/artists/artist-1/artworks");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(mockGetArtistArtworks).toHaveBeenCalledTimes(1);
  });
});
