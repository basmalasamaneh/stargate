import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

const imagesDir = path.resolve(__dirname, "../../images");

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

const slugify = (value: unknown, maxLength = 40): string => {
  if (typeof value !== "string") return "";

  return value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, "");
};

const buildTimestamp = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");

  return `${y}${m}${d}-${h}${min}${s}`;
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : ".bin";
    const shortId = randomUUID().replace(/-/g, "").slice(0, 8);
    const originalBaseName = path.parse(file.originalname || "").name;
    const descriptorSlug =
      slugify(req.body?.title) ||
      slugify(originalBaseName) ||
      "image";
    const timestamp = buildTimestamp();

    // Example: artwork-20260413-154210-a1b2c3d4-غروب-القدس.jpg
    cb(null, `artwork-${timestamp}-${shortId}-${descriptorSlug}${safeExt}`);
  },
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("يُسمح برفع ملفات الصور فقط"));
      return;
    }

    cb(null, true);
  },
});

export const artworkUpload = imageUpload.array("images", 5);
