import { Request, Response } from 'express';
import { createArtwork, getArtworks, getArtworkById, updateArtwork as updateArtworkService, deleteArtwork as deleteArtworkService, getMyArtworks as getMyArtworksService } from '../services/artwork.service';
import type { CreateArtworkData } from '../services/artwork.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createArtworkSchema, updateArtworkSchema } from '../middlewares/validate.middleware';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const imageDirectoryPath = path.resolve(__dirname, '../../images');

const removeFilesSafely = (filenames: string[]) => {
  for (const filename of filenames) {
    const targetPath = path.resolve(imageDirectoryPath, filename);
    if (!targetPath.startsWith(imageDirectoryPath)) continue;
    if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
  }
};

const normalizeStoredFilename = (value: string): string => {
  const withoutPrefix = value.replace(/^\/images\//, '');
  return path.basename(withoutPrefix);
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value === 'string') {
    return [value];
  }

  return [];
};

const dedupeFilenames = (filenames: string[]): string[] => {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const rawName of filenames) {
    const normalized = normalizeStoredFilename(rawName);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
};

const parseMainImageIndex = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
};

const sendValidationError = (res: Response, issues: z.ZodIssue[]) => {
  res.status(400).json({
    status: 'error',
    errors: issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  });
};

const extractUploadedFiles = (req: AuthRequest): Express.Multer.File[] => {
  const files = (req as AuthRequest & { files?: Express.Multer.File[] }).files;
  return files || [];
};

export const addArtwork = async (req: AuthRequest, res: Response): Promise<void> => {
  const uploadedFiles = extractUploadedFiles(req);
  const uploadedFilenames = uploadedFiles.map((file) => file.filename);

  try {
    if (!req.userId) {
      removeFilesSafely(uploadedFilenames);
      res.status(401).json({ status: 'error', message: 'يجب تسجيل الدخول أولاً' });
      return;
    }

    const featuredImageIndex = parseMainImageIndex(req.body.mainImageIndex);
    const images = uploadedFiles.map((file, index) => ({
      filename: file.filename,
      alt_text: req.body.title,
      is_featured: index === featuredImageIndex,
    }));

    const validationResult = createArtworkSchema.safeParse({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      price: req.body.price,
      quantity: req.body.quantity,
      images,
    });

    if (!validationResult.success) {
      removeFilesSafely(uploadedFilenames);
      sendValidationError(res, validationResult.error.issues);
      return;
    }

    const artworkData: CreateArtworkData = {
      title: validationResult.data.title,
      description: validationResult.data.description,
      category: validationResult.data.category,
      price: validationResult.data.price,
      quantity: validationResult.data.quantity,
      images: validationResult.data.images.map((image) => ({
        filename: image.filename as string,
        ...(image.alt_text ? { alt_text: image.alt_text } : {}),
        is_featured: image.is_featured,
      })),
    };

    const artwork = await createArtwork(req.userId, artworkData);
    
    res.status(201).json({
      status: 'success',
      message: 'تم إنشاء العمل الفني بنجاح',
      data: { artwork }
    });
    
  } catch (error: any) {
    removeFilesSafely(uploadedFilenames);
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message ?? 'حدث خطأ داخلي في الخادم'
    });
  }
};

export const listArtworks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, status, artist_id } = req.query;
    const showContactInfo = req.headers['authorization'] ? true : false;
    
    const artworks = await getArtworks(
      category as string,
      status as string,
      artist_id as string,
      showContactInfo
    );
    
    res.status(200).json({
      status: 'success',
      message: 'تم جلب الأعمال الفنية بنجاح',
      data: { artworks }
    });
    
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message ?? 'حدث خطأ داخلي في الخادم'
    });
  }
};

export const getArtwork = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const showContactInfo = req.headers['authorization'] ? true : false;
    
    const artwork = await getArtworkById(id as string, showContactInfo);
    
    if (!artwork) {
      res.status(404).json({
        status: 'error',
        message: 'العمل الفني غير موجود'
      });
      return;
    }
    
    res.status(200).json({
      status: 'success',
      message: 'تم جلب العمل الفني بنجاح',
      data: { artwork }
    });
    
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message ?? 'حدث خطأ داخلي في الخادم'
    });
  }
};

export const updateArtwork = async (req: AuthRequest, res: Response): Promise<void> => {
  const uploadedFiles = extractUploadedFiles(req);
  const uploadedFilenames = uploadedFiles.map((file) => file.filename);

  try {
    if (!req.userId) {
      removeFilesSafely(uploadedFilenames);
      res.status(401).json({ status: 'error', message: 'يجب تسجيل الدخول أولاً' });
      return;
    }

    const featuredImageIndex = parseMainImageIndex(req.body.mainImageIndex);
    const existingImageNames = toStringArray(req.body.existingImages).map(normalizeStoredFilename);
    const newImageNames = uploadedFiles.map((file) => file.filename);
    const imageOrderTokens = toStringArray(req.body.imageOrder);

    let mergedImageNames = [...existingImageNames, ...newImageNames];
    if (imageOrderTokens.length > 0) {
      const orderedNames: string[] = [];

      for (const token of imageOrderTokens) {
        if (token.startsWith('existing:')) {
          const filename = normalizeStoredFilename(token.slice('existing:'.length));
          orderedNames.push(filename);
          continue;
        }

        if (token.startsWith('new:')) {
          const indexValue = Number(token.slice('new:'.length));
          if (Number.isInteger(indexValue) && indexValue >= 0 && indexValue < newImageNames.length) {
            const orderedFile = newImageNames[indexValue];
            if (orderedFile) {
              orderedNames.push(orderedFile);
            }
          }
        }
      }

      if (orderedNames.length > 0) {
        mergedImageNames = orderedNames;
      }
    }

    mergedImageNames = dedupeFilenames(mergedImageNames);

    const payload: Record<string, unknown> = {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      price: req.body.price,
      quantity: req.body.quantity,
    };

    if (mergedImageNames.length > 0) {
      payload.images = mergedImageNames.map((filename, index) => ({
        filename,
        alt_text: req.body.title,
        is_featured: index === featuredImageIndex,
      }));
    }

    const validationResult = updateArtworkSchema.safeParse(payload);
    if (!validationResult.success) {
      removeFilesSafely(uploadedFilenames);
      sendValidationError(res, validationResult.error.issues);
      return;
    }

    const cleanedUpdateData: Partial<CreateArtworkData> = {};

    if (validationResult.data.title !== undefined) cleanedUpdateData.title = validationResult.data.title;
    if (validationResult.data.description !== undefined) cleanedUpdateData.description = validationResult.data.description;
    if (validationResult.data.category !== undefined) cleanedUpdateData.category = validationResult.data.category;
    if (validationResult.data.price !== undefined) cleanedUpdateData.price = validationResult.data.price;
    if (validationResult.data.quantity !== undefined) cleanedUpdateData.quantity = validationResult.data.quantity;

    if (Array.isArray(validationResult.data.images)) {
      cleanedUpdateData.images = validationResult.data.images.map((image) => ({
        filename: image.filename as string,
        ...(image.alt_text ? { alt_text: image.alt_text } : {}),
        is_featured: image.is_featured,
      }));
    }

    const { id } = req.params;
    const updateResult = await updateArtworkService(id as string, req.userId, cleanedUpdateData);

    const keptImageSet = new Set(
      (Array.isArray(cleanedUpdateData.images)
        ? cleanedUpdateData.images.map((image) => image.filename)
        : [])
    );

    const filesToRemove = (updateResult.oldImageFilenames || []).filter(
      (filename) => !keptImageSet.has(filename)
    );
    removeFilesSafely(filesToRemove);
    
    res.status(200).json({
      status: 'success',
      message: 'تم تحديث العمل الفني بنجاح',
      data: { artwork: updateResult.artwork }
    });
    
  } catch (error: any) {
    removeFilesSafely(uploadedFilenames);
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message ?? 'حدث خطأ داخلي في الخادم'
    });
  }
};

export const deleteArtwork = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ status: 'error', message: 'يجب تسجيل الدخول أولاً' });
      return;
    }

    const { id } = req.params;
    const deleteResult = await deleteArtworkService(id as string, req.userId);
    
    res.status(200).json({
      status: 'success',
      message: 'تم حذف العمل الفني بنجاح',
      data: null
    });
    
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message ?? 'حدث خطأ داخلي في الخادم'
    });
  }
};

export const getMyArtworks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ status: 'error', message: 'يجب تسجيل الدخول أولاً' });
      return;
    }

    const { category, status } = req.query;
    
    const filters: any = {};
    if (category) filters.category = category;
    if (status) filters.status = status;

    const artworks = await getMyArtworksService(req.userId, filters);
    
    res.status(200).json({
      status: 'success',
      message: 'تم جلب أعمالك الفنية بنجاح',
      data: { artworks }
    });
    
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message ?? 'حدث خطأ داخلي في الخادم'
    });
  }
};
