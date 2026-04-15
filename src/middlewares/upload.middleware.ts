import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

const imagesDir = path.resolve(__dirname, "../../images");

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, imagesDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : ".bin";
    const fileId = randomUUID();
    cb(null, `${fileId}${safeExt}`);
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
