/// <reference types="jest" />
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";
import {
  createArtwork,
  getArtworks,
  getArtworkById,
  updateArtwork,
  deleteArtwork,
  getMyArtworks,
} from "../services/artwork.service";
import { extractArtworkStoragePath, removeArtworkObjects, uploadArtworkFiles } from "../services/artwork-storage.service";
import { getSupabase } from "../config/supabase";

jest.mock("../services/artwork.service");
jest.mock("../services/artwork-storage.service");
jest.mock("../config/supabase", () => ({
  getSupabase: jest.fn(),
}));

const mockCreateArtwork = createArtwork as jest.MockedFunction<typeof createArtwork>;
const mockGetArtworks = getArtworks as jest.MockedFunction<typeof getArtworks>;
const mockGetArtworkById = getArtworkById as jest.MockedFunction<typeof getArtworkById>;
const mockUpdateArtwork = updateArtwork as jest.MockedFunction<typeof updateArtwork>;
const mockDeleteArtwork = deleteArtwork as jest.MockedFunction<typeof deleteArtwork>;
const mockGetMyArtworks = getMyArtworks as jest.MockedFunction<typeof getMyArtworks>;
const mockExtractArtworkStoragePath = extractArtworkStoragePath as jest.MockedFunction<typeof extractArtworkStoragePath>;
const mockUploadArtworkFiles = uploadArtworkFiles as jest.MockedFunction<typeof uploadArtworkFiles>;
const mockRemoveArtworkObjects = removeArtworkObjects as jest.MockedFunction<typeof removeArtworkObjects>;
const mockGetSupabase = getSupabase as jest.MockedFunction<typeof getSupabase>;

const testJwtSecret = process.env["JWT_SECRET"] ?? "dev-secret";

const pngFixture = Buffer.from([
  0x89, 0x50, 0x4e, 0x47,
  0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
]);

const buildToken = (userId: string) =>
  jwt.sign(
    {
      userId,
      email: "artist@example.com",
      role: "artist",
      firstName: "Artist",
      lastName: "User",
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
  mockExtractArtworkStoragePath.mockImplementation((value) => value);
  mockUploadArtworkFiles.mockResolvedValue([]);
  mockRemoveArtworkObjects.mockResolvedValue();
});

describe("POST /api/artworks", () => {
  it("should return 401 when token is missing", async () => {
    const res = await request(app).post("/api/v1/artworks");

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockCreateArtwork).not.toHaveBeenCalled();
  });

  it("should return 403 when user is not an artist", async () => {
    mockArtistRoleCheck("user");
    const token = buildToken("artist-1");

    const res = await request(app)
      .post("/api/v1/artworks")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe("error");
    expect(mockCreateArtwork).not.toHaveBeenCalled();
  });

  it("should return 400 when no images are uploaded", async () => {
    const token = buildToken("artist-1");

    const res = await request(app)
      .post("/api/v1/artworks")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "لوحة جميلة")
      .field("description", "هذا وصف طويل كفاية لاجتياز التحقق")
      .field("category", "لوحات فنية")
      .field("price", "150")
      .field("quantity", "1");

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(mockCreateArtwork).not.toHaveBeenCalled();
  });

  it("should create artwork successfully with multipart upload", async () => {
    const token = buildToken("artist-1");
    mockUploadArtworkFiles.mockResolvedValueOnce(["artist-1/path-1.png"]);
    mockCreateArtwork.mockResolvedValueOnce({
      id: "art-1",
      title: "sunset study",
      artwork_images: [],
    } as any);

    const res = await request(app)
      .post("/api/v1/artworks")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "sunset study")
      .field("description", "this is a long enough description for schema")
      .field("category", "لوحات فنية")
      .field("price", "250")
      .field("quantity", "1")
      .field("mainImageIndex", "0")
      .attach("images", pngFixture, {
        filename: "sunset.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(mockCreateArtwork).toHaveBeenCalledTimes(1);

    const payload = mockCreateArtwork.mock.calls[0][1];
    expect(mockCreateArtwork.mock.calls[0][0]).toBe("artist-1");
    expect(payload.images).toHaveLength(1);
    expect(payload.images[0]?.filename).toBe("artist-1/path-1.png");
    expect(payload.images[0]?.is_featured).toBe(true);
  });
});

describe("GET /api/artworks", () => {
  it("should list artworks and pass query filters", async () => {
    mockGetArtworks.mockResolvedValueOnce([] as any);

    const res = await request(app)
      .get("/api/v1/artworks")
      .query({ category: "لوحات فنية", artist_id: "artist-1" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(mockGetArtworks).toHaveBeenCalledWith({ page: 1, limit: 12, category: "لوحات فنية", artistId: "artist-1" }, false);
  });

  it("should pass showContactInfo=true when authorization header contains a valid token", async () => {
    const token = buildToken("artist-1");
    mockGetArtworks.mockResolvedValueOnce([] as any);

    const res = await request(app)
      .get("/api/v1/artworks")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockGetArtworks).toHaveBeenCalledWith({ page: 1, limit: 12 }, true);
  });
});

describe("GET /api/artworks/:id", () => {
  it("should return artwork by id", async () => {
    mockGetArtworkById.mockResolvedValueOnce({ id: "art-1" } as any);

    const res = await request(app).get("/api/v1/artworks/art-1");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(mockGetArtworkById).toHaveBeenCalledWith("art-1", false);
  });

  it("should return 404 when artwork not found", async () => {
    mockGetArtworkById.mockResolvedValueOnce(null as any);

    const res = await request(app).get("/api/v1/artworks/missing-id");

    expect(res.status).toBe(404);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("العمل الفني غير موجود");
  });
});

describe("PATCH /api/artworks/:id", () => {
  it("should return 401 when token is missing", async () => {
    const res = await request(app).patch("/api/v1/artworks/art-1");

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockUpdateArtwork).not.toHaveBeenCalled();
  });

  it("should return 403 when user is not artist", async () => {
    mockArtistRoleCheck("user");
    const token = buildToken("artist-1");

    const res = await request(app)
      .patch("/api/v1/artworks/art-1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe("error");
    expect(mockUpdateArtwork).not.toHaveBeenCalled();
  });

  it("should return 400 when payload has invalid values", async () => {
    const token = buildToken("artist-1");

    const res = await request(app)
      .patch("/api/v1/artworks/art-1")
      .set("Authorization", `Bearer ${token}`)
      .field("price", "-1");

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(mockUpdateArtwork).not.toHaveBeenCalled();
  });

  it("should update artwork successfully with existing and new images", async () => {
    const token = buildToken("artist-1");
    mockUploadArtworkFiles.mockResolvedValueOnce(["artist-1/new-image.png"]);
    mockUpdateArtwork.mockResolvedValueOnce({
      artwork: { id: "art-1", title: "updated" },
      oldImageFilenames: ["old-1.jpg"],
    } as any);

    const res = await request(app)
      .patch("/api/v1/artworks/art-1")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "updated title")
      .field("description", "this is a long enough updated description")
      .field("category", "لوحات فنية")
      .field("price", "300")
      .field("quantity", "2")
      .field("mainImageIndex", "0")
      .field("existingImages", "old-1.jpg")
      .field("imageOrder", "existing:old-1.jpg")
      .field("imageOrder", "new:0")
      .attach("images", pngFixture, {
        filename: "new-image.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(mockUpdateArtwork).toHaveBeenCalledTimes(1);

    const updatePayload = mockUpdateArtwork.mock.calls[0][2];
    const mappedImages = updatePayload.images || [];
    expect(mappedImages).toHaveLength(2);
    expect(mappedImages[0]?.filename).toBe("old-1.jpg");
    expect(mappedImages[1]?.filename).toBe("artist-1/new-image.png");
  });

  it("should propagate service status errors", async () => {
    const token = buildToken("artist-1");
    const notFoundError = new Error("Artwork not found") as Error & { statusCode?: number };
    notFoundError.statusCode = 404;
    mockUpdateArtwork.mockRejectedValueOnce(notFoundError);

    const res = await request(app)
      .patch("/api/v1/artworks/missing-id")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "updated title");

    expect(res.status).toBe(404);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Artwork not found");
  });
});

describe("DELETE /api/artworks/:id", () => {
  it("should return 401 when token is missing", async () => {
    const res = await request(app).delete("/api/v1/artworks/art-1");

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockDeleteArtwork).not.toHaveBeenCalled();
  });

  it("should return 403 when user is not artist", async () => {
    mockArtistRoleCheck("user");
    const token = buildToken("artist-1");

    const res = await request(app)
      .delete("/api/v1/artworks/art-1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe("error");
    expect(mockDeleteArtwork).not.toHaveBeenCalled();
  });

  it("should soft delete artwork successfully", async () => {
    const token = buildToken("artist-1");
    mockDeleteArtwork.mockResolvedValueOnce({
      message: "تم حذف العمل الفني بنجاح",
      deletedImageFilenames: ["img-1.jpg"],
    } as any);

    const res = await request(app)
      .delete("/api/v1/artworks/art-1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toBe("تم حذف العمل الفني بنجاح");
    expect(mockDeleteArtwork).toHaveBeenCalledWith("art-1", "artist-1");
  });

  it("should return 409 when artwork already deleted", async () => {
    const token = buildToken("artist-1");
    const conflictError = new Error("Artwork already deleted") as Error & { statusCode?: number };
    conflictError.statusCode = 409;
    mockDeleteArtwork.mockRejectedValueOnce(conflictError);

    const res = await request(app)
      .delete("/api/v1/artworks/art-1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Artwork already deleted");
  });
});

describe("GET /api/artworks/my-artworks", () => {
  it("should return 401 when token is missing", async () => {
    const res = await request(app).get("/api/v1/artworks/my-artworks");

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(mockGetMyArtworks).not.toHaveBeenCalled();
  });

  it("should return 403 when user is not artist", async () => {
    mockArtistRoleCheck("user");
    const token = buildToken("artist-1");

    const res = await request(app)
      .get("/api/v1/artworks/my-artworks")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.status).toBe("error");
    expect(mockGetMyArtworks).not.toHaveBeenCalled();
  });

  it("should return current artist artworks with filters", async () => {
    const token = buildToken("artist-1");
    mockGetMyArtworks.mockResolvedValueOnce([] as any);

    const res = await request(app)
      .get("/api/v1/artworks/my-artworks")
      .set("Authorization", `Bearer ${token}`)
      .query({ category: "لوحات فنية" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toBe("تم جلب أعمالك الفنية بنجاح");
    expect(mockGetMyArtworks).toHaveBeenCalledWith("artist-1", {
      page: 1, limit: 9, category: "لوحات فنية",
    });
  });
});
