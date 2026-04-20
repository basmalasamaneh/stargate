import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getAllArtists, getArtistProfile, getArtistArtworks } from '../services/artist.service';
import { ARTWORK_CATEGORIES } from '../types/artwork.types';

const parseBoundedInt = (value: unknown, fallback: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

export const listArtists = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const artists = await getAllArtists();
    res.status(200).json({ status: 'success', data: artists });
  } catch (error: any) {
    const statusCode = Number(error.statusCode ?? 500) || 500;
    res.status(statusCode).json({ status: 'error', message: error.message });
  }
};

export const getArtistById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const artist = await getArtistProfile(id);
    res.status(200).json({ status: 'success', data: artist });
  } catch (error: any) {
    const statusCode = Number(error.statusCode ?? 500) || 500;
    res.status(statusCode).json({ status: 'error', message: error.message });
  }
};

export const getArtistArtworksById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const rawCategory = typeof req.query['category'] === 'string' ? req.query['category'].trim() : undefined;
    const page = parseBoundedInt(req.query['page'], 1, 100000);
    const limit = parseBoundedInt(req.query['limit'], 12, 100);

    // Only allow known category values to prevent injection/enumeration
    const category = rawCategory && ARTWORK_CATEGORIES.includes(rawCategory as any)
      ? rawCategory
      : undefined;

    if (rawCategory && !category) {
      res.status(400).json({ status: 'error', message: 'قيمة الفئة غير صالحة' });
      return;
    }

    const filters: { category?: string; page?: number; limit?: number } = { page, limit };
    if (category) filters.category = category;

    const result = await getArtistArtworks(id, filters);
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    const statusCode = Number(error.statusCode ?? 500) || 500;
    res.status(statusCode).json({ status: 'error', message: error.message });
  }
};