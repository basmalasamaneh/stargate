import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";
import { SocialMediaPlatform } from "../types/auth.types";

export const signupSchema = z
  .object({
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().min(2, "Last name must be at least 2 characters"),
    email: z.string().toLowerCase().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data: { password: string; confirmPassword: string }) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().toLowerCase().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const validPlatforms = Object.values(SocialMediaPlatform);

export const becomeArtistSchema = z.object({
  artistName: z.string().min(3, "Artist name must be at least 3 characters"),
  bio: z.string().min(20, "Bio must be at least 20 characters").max(1000, "Bio must not exceed 1000 characters"),
  location: z.string().min(3, "Location must be at least 3 characters").max(255, "Location is too long"),
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits").max(50, "Phone number is too long"),
  socialMedia: z
    .array(
      z.object({
        platform: z.nativeEnum(SocialMediaPlatform, {
          message: `Platform must be one of: ${validPlatforms.join(", ")}`,
        }),
        url: z.string().url("Each social media URL must be valid"),
      })
    )
    .optional(),
});

export const createArtworkSchema = z.object({
  title: z.string().min(2, "العنوان يجب أن يكون على الأقل حرفين"),
  description: z.string().min(10, "الوصف يجب أن يكون على الأقل 10 أحرف"),
  category: z.enum(['لوحات فنية', 'تطريز فلسطيني', 'خزف وفخار', 'خط عربي', 'تصوير فوتوغرافي', 'نحت ومجسمات']),
  price: z.number().positive("السعر يجب أن يكون موجبًا"),
  quantity: z.number().int().min(0, "الكمية يجب أن تكون غير سالبة"),
  images: z.array(z.object({
    filename: z.string().min(1, "اسم الملف مطلوب"),
    alt_text: z.string().optional(),
    is_featured: z.boolean().optional()
  })).min(1, "مطلوب صورة واحدة على الأقل").max(5, "الحد الأقصى 5 صور")
});

export const updateArtworkSchema = z.object({
  title: z.string().min(2, "العنوان يجب أن يكون على الأقل حرفين").optional(),
  description: z.string().min(10, "الوصف يجب أن يكون على الأقل 10 أحرف").optional(),
  category: z.enum(['لوحات فنية', 'تطريز فلسطيني', 'خزف وفخار', 'خط عربي', 'تصوير فوتوغرافي', 'نحت ومجسمات']).optional(),
  price: z.number().positive("السعر يجب أن يكون موجبًا").optional(),
  quantity: z.number().int().min(0, "الكمية يجب أن تكون غير سالبة").optional(),
  images: z.array(z.object({
    filename: z.string().min(1, "اسم الملف مطلوب"),
    alt_text: z.string().optional(),
    is_featured: z.boolean().optional()
  })).min(1, "مطلوب صورة واحدة على الأقل").max(5, "الحد الأقصى 5 صور").optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "مطلوب تحديث حقل واحد على الأقل"
});

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
