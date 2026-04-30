import { Router } from 'express';
import { listArtists, getArtistById, getArtistArtworksById } from '../controllers/artist.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', listArtists);
router.get('/:id', getArtistById);
router.get('/:id/artworks', getArtistArtworksById);

export default router;