import { Request, Response } from 'express';
import { createArtwork, getArtworks, getArtworkById, updateArtwork as updateArtworkService, deleteArtwork as deleteArtworkService, getMyArtworks as getMyArtworksService } from '../services/artwork.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const addArtwork = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ status: 'error', message: 'User not authenticated' });
      return;
    }

    const artworkData = {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      price: req.body.price,
      quantity: req.body.quantity,
      images: req.body.images || []
    };

    const artwork = await createArtwork(req.userId, artworkData);
    
    res.status(201).json({
      status: 'success',
      message: 'Artwork created successfully',
      data: { artwork }
    });
    
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message ?? 'Internal server error'
    });
  }
};

export const listArtworks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, status, artist_id } = req.query;
    
    const artworks = await getArtworks(
      category as string,
      status as string,
      artist_id as string
    );
    
    res.status(200).json({
      status: 'success',
      message: 'Artworks retrieved successfully',
      data: { artworks }
    });
    
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message ?? 'Internal server error'
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
        message: 'Artwork not found'
      });
      return;
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Artwork retrieved successfully',
      data: { artwork }
    });
    
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message ?? 'Internal server error'
    });
  }
};

export const updateArtwork = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ status: 'error', message: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    const updateData = {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      price: req.body.price,
      quantity: req.body.quantity,
      images: req.body.images
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    const artwork = await updateArtworkService(id as string, req.userId, updateData);
    
    res.status(200).json({
      status: 'success',
      message: 'Artwork updated successfully',
      data: { artwork }
    });
    
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message ?? 'Internal server error'
    });
  }
};

export const deleteArtwork = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ status: 'error', message: 'User not authenticated' });
      return;
    }

    const { id } = req.params;
    
    await deleteArtworkService(id as string, req.userId);
    
    res.status(200).json({
      status: 'success',
      message: 'Artwork deleted successfully',
      data: null
    });
    
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message ?? 'Internal server error'
    });
  }
};

export const getMyArtworks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ status: 'error', message: 'User not authenticated' });
      return;
    }

    const { category, status } = req.query;
    
    const filters: any = {};
    if (category) filters.category = category;
    if (status) filters.status = status;

    const artworks = await getMyArtworksService(req.userId, filters);
    
    res.status(200).json({
      status: 'success',
      message: 'My artworks retrieved successfully',
      data: { artworks }
    });
    
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message ?? 'Internal server error'
    });
  }
};
