import { Request, Response } from 'express';
import { createArtwork, getArtworks, getArtworkById, updateArtwork as updateArtworkService, deleteArtwork as deleteArtworkService, getMyArtworks as getMyArtworksService } from '../services/artwork.service';
import type { CreateArtworkData } from '../services/artwork.service';
import { extractArtworkStoragePath, removeArtworkObjects, uploadArtworkFiles } from '../services/artwork-storage.service';
import { ArtworkCategory } from '../types/artwork.types';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createArtworkSchema, updateArtworkSchema } from '../middlewares/validate.middleware';
import { z } from 'zod';

const normalizeStoredFilename = (value: string): string => {
  return extractArtworkStoragePath(value);
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

const buildUploadPlaceholder = (index: number): string => `__new_upload__${index}`;

const parsePositiveInt = (value: unknown, fallback: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
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
  const uploadedStoragePaths: string[] = [];

  try {
    if (!req.userId) {
      res.status(401).json({ status: 'error', message: 'يجب تسجيل الدخول أولاً' });
      return;
    }

    const featuredImageIndex = parseMainImageIndex(req.body.mainImageIndex);
    const images = uploadedFiles.map((file, index) => ({
      filename: buildUploadPlaceholder(index),
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
      sendValidationError(res, validationResult.error.issues);
      return;
    }

    uploadedStoragePaths.push(...await uploadArtworkFiles(uploadedFiles, req.userId));

    const artworkData: CreateArtworkData = {
      title: validationResult.data.title,
      description: validationResult.data.description,
      category: validationResult.data.category as ArtworkCategory,
      price: validationResult.data.price,
      quantity: validationResult.data.quantity,
      images: validationResult.data.images.map((image, index) => ({
        filename: uploadedStoragePaths[index] || image.filename as string,
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

    uploadedStoragePaths.length = 0;
    
  } catch (error: any) {
    if (uploadedStoragePaths.length > 0) {
      await removeArtworkObjects(uploadedStoragePaths).catch(() => undefined);
    }
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message ?? 'حدث خطأ داخلي في الخادم'
    });
  }
};

export const listArtworks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, artist_id, search, searchBy, page, limit } = req.query;
    const showContactInfo = req.headers['authorization'] ? true : false;
    const parsedPage = parsePositiveInt(page, 1, 100000);
    const parsedLimit = parsePositiveInt(limit, 12, 100);
    const searchValue = toOptionalString(search);
    const categoryValue = toOptionalString(category);
    const artistIdValue = toOptionalString(artist_id);
    const searchByValue = toOptionalString(searchBy) === 'global' ? 'global' : 'artwork';

    const filters: {
      page: number;
      limit: number;
      category?: string;
      artistId?: string;
      search?: string;
      searchBy?: 'artwork' | 'global';
    } = {
      page: parsedPage,
      limit: parsedLimit,
    };

    if (categoryValue) filters.category = categoryValue;
    if (artistIdValue) filters.artistId = artistIdValue;
    if (searchValue) filters.search = searchValue;
    if (searchValue) filters.searchBy = searchByValue;
    
    const result = await getArtworks(filters, showContactInfo);
    
    res.status(200).json({
      status: 'success',
      message: 'تم جلب الأعمال الفنية بنجاح',
      data: {
        artworks: result.artworks,
        totalCount: result.totalCount,
        page: result.page,
        limit: result.limit,
      }
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
  const uploadedStoragePaths: string[] = [];

  try {
    if (!req.userId) {
      res.status(401).json({ status: 'error', message: 'يجب تسجيل الدخول أولاً' });
      return;
    }

    const featuredImageIndex = parseMainImageIndex(req.body.mainImageIndex);
    const existingImageNames = toStringArray(req.body.existingImages).map(normalizeStoredFilename);
    const newImageNames = uploadedFiles.map((_file, index) => buildUploadPlaceholder(index));
    const imageOrderTokens = toStringArray(req.body.imageOrder);
    const imageUpdateRequested = req.body.existingImages !== undefined || req.body.imageOrder !== undefined || uploadedFiles.length > 0;

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

    if (imageUpdateRequested) {
      payload.images = mergedImageNames.map((filename, index) => ({
        filename,
        alt_text: req.body.title,
        is_featured: index === featuredImageIndex,
      }));
    }

    const validationResult = updateArtworkSchema.safeParse(payload);
    if (!validationResult.success) {
      sendValidationError(res, validationResult.error.issues);
      return;
    }

    uploadedStoragePaths.push(...await uploadArtworkFiles(uploadedFiles, req.userId));
    const uploadedPathByPlaceholder = new Map(
      newImageNames.map((placeholder, index) => [placeholder, uploadedStoragePaths[index] || placeholder])
    );

    const cleanedUpdateData: Partial<CreateArtworkData> = {};

    if (validationResult.data.title !== undefined) cleanedUpdateData.title = validationResult.data.title;
    if (validationResult.data.description !== undefined) cleanedUpdateData.description = validationResult.data.description;
    if (validationResult.data.category !== undefined) cleanedUpdateData.category = validationResult.data.category as ArtworkCategory;
    if (validationResult.data.price !== undefined) cleanedUpdateData.price = validationResult.data.price;
    if (validationResult.data.quantity !== undefined) cleanedUpdateData.quantity = validationResult.data.quantity;

    if (Array.isArray(validationResult.data.images)) {
      cleanedUpdateData.images = validationResult.data.images.map((image) => ({
        filename: uploadedPathByPlaceholder.get(image.filename as string) || normalizeStoredFilename(image.filename as string),
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
    if (filesToRemove.length > 0) {
      await removeArtworkObjects(filesToRemove).catch(() => undefined);
    }

    uploadedStoragePaths.length = 0;
    
    res.status(200).json({
      status: 'success',
      message: 'تم تحديث العمل الفني بنجاح',
      data: { artwork: updateResult.artwork }
    });
    
  } catch (error: any) {
    if (uploadedStoragePaths.length > 0) {
      await removeArtworkObjects(uploadedStoragePaths).catch(() => undefined);
    }
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
    if (deleteResult.deletedImageFilenames?.length > 0) {
      await removeArtworkObjects(deleteResult.deletedImageFilenames).catch(() => undefined);
    }
    
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

    const { category, search, page, limit } = req.query;
    const parsedPage = parsePositiveInt(page, 1, 100000);
    const parsedLimit = parsePositiveInt(limit, 9, 100);
    const searchValue = toOptionalString(search);
    const categoryValue = toOptionalString(category);

    const filters: {
      category?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {
      page: parsedPage,
      limit: parsedLimit,
    };
    if (searchValue) filters.search = searchValue;
    if (categoryValue) filters.category = categoryValue;

    const result = await getMyArtworksService(req.userId, filters);
    
    res.status(200).json({
      status: 'success',
      message: 'تم جلب أعمالك الفنية بنجاح',
      data: {
        artworks: result.artworks,
        totalCount: result.totalCount,
        page: result.page,
        limit: result.limit,
      }
    });
    
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message ?? 'حدث خطأ داخلي في الخادم'
    });
  }
};
