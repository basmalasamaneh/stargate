import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";
import { SocialMediaPlatform } from "../types/auth.types";
import { MAX_ARTWORK_IMAGES } from "../config/artwork-storage";
import { ArtworkCategory, ARTWORK_CATEGORIES } from "../types/artwork.types";

const artworkCategoryMap: Record<string, string> = {
  paintings: "لوحات فنية",
  embroidery: "تطريز فلسطيني",
  ceramics: "خزف وفخار",
  calligraphy: "خط عربي",
  photography: "تصوير فوتوغرافي",
  sculpture: "نحت ومجسمات",
};

const normalizeCategory = (category: unknown): unknown => {
  if (typeof category !== "string") return category;
  return artworkCategoryMap[category] ?? category;
};

const normalizedImageSchema = z
  .union([
    z.string().min(1, "اسم الملف مطلوب"),
    z.object({
      filename: z.string().min(1, "اسم الملف مطلوب").optional(),
      url: z.string().min(1, "اسم الملف مطلوب").optional(),
      imageUrl: z.string().min(1, "اسم الملف مطلوب").optional(),
      alt_text: z.string().optional(),
      altText: z.string().optional(),
      is_featured: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
    }),
  ])
  .transform((image) => {
    if (typeof image === "string") {
      return { filename: image, alt_text: undefined, is_featured: false };
    }

    const filename = image.filename ?? image.url ?? image.imageUrl;
    return {
      filename,
      alt_text: image.alt_text ?? image.altText,
      is_featured: image.is_featured ?? image.isFeatured ?? false,
    };
  })
  .refine((image) => !!image.filename, {
    message: "اسم الملف مطلوب",
  });

const normalizeArtworkBody = (input: unknown) => {
  if (!input || typeof input !== "object") return input;

  const body = { ...(input as Record<string, unknown>) };
  body.category = normalizeCategory(body.category);

  if (body.images === undefined) {
    const singleImage = body.image ?? body.imageUrl ?? body.filename;
    if (singleImage) {
      body.images = [singleImage];
    }
  }

  return body;
};

export const signupSchema = z
  .object({
    firstName: z.string().min(2, "الاسم الأول يجب أن يتكون من حرفين على الأقل"),
    lastName: z.string().min(2, "اسم العائلة يجب أن يتكون من حرفين على الأقل"),
    email: z.string().toLowerCase().email("البريد الإلكتروني غير صالح"),
    password: z
      .string()
      .min(8, "كلمة المرور يجب أن تتكون من 8 أحرف على الأقل")
      .regex(/[A-Z]/, "كلمة المرور يجب أن تحتوي على حرف إنجليزي كبير واحد على الأقل")
      .regex(/[a-z]/, "كلمة المرور يجب أن تحتوي على حرف إنجليزي صغير واحد على الأقل")
      .regex(/[0-9]/, "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل"),
    confirmPassword: z.string(),
  })
  .refine((data: { password: string; confirmPassword: string }) => data.password === data.confirmPassword, {
    message: "تأكيد كلمة المرور غير مطابق",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().toLowerCase().email("البريد الإلكتروني غير صالح"),
  password: z.string().min(8, "كلمة المرور يجب أن تتكون من 8 أحرف على الأقل"),
});

const validPlatforms = Object.values(SocialMediaPlatform);

export const becomeArtistSchema = z.object({
  artistName: z.string().min(3, "الاسم الفني يجب أن يتكون من 3 أحرف على الأقل"),
  bio: z.string().min(20, "النبذة الشخصية يجب أن تتكون من 20 حرفاً على الأقل").max(1000, "النبذة الشخصية يجب ألا تتجاوز 1000 حرف"),
  location: z.string().min(3, "الموقع يجب أن يتكون من 3 أحرف على الأقل").max(255, "الموقع طويل جداً"),
  phone: z.string().regex(/^\d{10}$/, "رقم الهاتف يجب أن يتكون من 10 أرقام بالضبط").max(50, "رقم الهاتف طويل جداً"),
  socialMedia: z
    .array(
      z.object({
        platform: z.nativeEnum(SocialMediaPlatform, {
          message: `المنصة يجب أن تكون واحدة من: ${validPlatforms.join(", ")}`,
        }),
        url: z.string().url("رابط حساب التواصل الاجتماعي غير صالح"),
      })
    )
    .optional(),
});

export const createArtworkSchema = z.preprocess(normalizeArtworkBody, z.object({
  title: z.string().min(2, "العنوان يجب أن يكون على الأقل حرفين"),
  description: z.string().min(10, "الوصف يجب أن يكون على الأقل 10 أحرف"),
  category: z.enum(ARTWORK_CATEGORIES as [string, ...string[]], {
    message: `الفئة يجب أن تكون واحدة من: ${ARTWORK_CATEGORIES.join(", ")}`,
  }),
  price: z.coerce.number().positive("السعر يجب أن يكون موجبًا"),
  quantity: z.coerce.number().int().min(0, "الكمية يجب أن تكون غير سالبة"),
  images: z.array(normalizedImageSchema).min(1, "مطلوب صورة واحدة على الأقل").max(MAX_ARTWORK_IMAGES, "الحد الأقصى 3 صور")
}));

export const updateArtworkSchema = z.preprocess(normalizeArtworkBody, z.object({
  title: z.string().min(2, "العنوان يجب أن يكون على الأقل حرفين").optional(),
  description: z.string().min(10, "الوصف يجب أن يكون على الأقل 10 أحرف").optional(),
  category: z.enum(ARTWORK_CATEGORIES as [string, ...string[]], {
    message: `الفئة يجب أن تكون واحدة من: ${ARTWORK_CATEGORIES.join(", ")}`,
  }).optional(),
  price: z.coerce.number().positive("السعر يجب أن يكون موجبًا").optional(),
  quantity: z.coerce.number().int().min(0, "الكمية يجب أن تكون غير سالبة").optional(),
  images: z.array(normalizedImageSchema).min(1, "مطلوب صورة واحدة على الأقل").max(MAX_ARTWORK_IMAGES, "الحد الأقصى 3 صور").optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "مطلوب تحديث حقل واحد على الأقل"
}));

export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        status: "error",
        errors: result.error.issues.map((e: z.ZodIssue) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
