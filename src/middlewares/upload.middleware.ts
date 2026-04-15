import multer from "multer";
import { MAX_ARTWORK_IMAGES } from "../config/artwork-storage";

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_ARTWORK_IMAGES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("يُسمح برفع ملفات الصور فقط"));
      return;
    }

    cb(null, true);
  },
});

export const artworkUpload = imageUpload.array("images", MAX_ARTWORK_IMAGES);
