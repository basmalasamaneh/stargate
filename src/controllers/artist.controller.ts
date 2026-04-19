import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getAllArtists, getArtistProfile, getArtistArtworks } from '../services/artist.service';

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
    const category = typeof req.query['category'] === 'string' ? req.query['category'] : undefined;
    const page = typeof req.query['page'] === 'string' ? Number(req.query['page']) : undefined;
    const limit = typeof req.query['limit'] === 'string' ? Number(req.query['limit']) : undefined;

    const filters: { category?: string; page?: number; limit?: number } = {}; // ← التعديل هون
    if (category !== undefined) filters.category = category;                  // ← التعديل هون
    if (page !== undefined) filters.page = page;                              // ← التعديل هون
    if (limit !== undefined) filters.limit = limit;                           // ← التعديل هون

    const result = await getArtistArtworks(id, filters);
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    const statusCode = Number(error.statusCode ?? 500) || 500;
    res.status(statusCode).json({ status: 'error', message: error.message });
  }
};