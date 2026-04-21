import multer from "multer";
import { MAX_ARTWORK_IMAGES } from "../config/artwork-storage";

// Validate actual file bytes against known image magic numbers
// (cannot be spoofed by the client unlike MIME type)
const MAGIC_BYTES: Array<{ bytes: number[]; offset?: number }> = [
  { bytes: [0xff, 0xd8, 0xff] },                                   // JPEG
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },   // PNG
  { bytes: [0x47, 0x49, 0x46, 0x38] },                             // GIF
  { bytes: [0x42, 0x4d] },                                          // BMP
  { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },                  // WebP (bytes 8-11)
];

const isRealImage = (buffer: Buffer): boolean => {
  for (const { bytes, offset = 0 } of MAGIC_BYTES) {
    if (buffer.length < offset + bytes.length) continue;
    if (bytes.every((b, i) => buffer[offset + i] === b)) return true;
  }
  return false;
};

const imageFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    cb(new Error("يُسمح برفع ملفات الصور فقط"));
    return;
  }
  cb(null, true);
};

// Post-upload magic bytes check middleware factory
const buildMagicBytesValidator = (fieldName: string, isArray: boolean) => {
  return (req: any, _res: any, next: any) => {
    const files: Express.Multer.File[] = isArray
      ? (req.files ?? [])
      : req.file
      ? [req.file]
      : [];

    for (const file of files) {
      if (!file.buffer || !isRealImage(file.buffer)) {
        return next(new Error("يُسمح برفع ملفات الصور فقط"));
      }
    }

    next();
  };
};

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_ARTWORK_IMAGES },
  fileFilter: imageFileFilter,
});

const profileImageUploadInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: imageFileFilter,
});

// Export as stacks: multer upload + magic bytes validator
export const artworkUpload = [
  imageUpload.array("images", MAX_ARTWORK_IMAGES),
  buildMagicBytesValidator("images", true),
];

export const profileImageUpload = [
  profileImageUploadInstance.single("image"),
  buildMagicBytesValidator("image", false),
];
