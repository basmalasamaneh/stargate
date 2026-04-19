import { Router } from 'express';
import { listArtists, getArtistById, getArtistArtworksById } from '../controllers/artist.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', requireAuth, listArtists);
router.get('/:id', requireAuth, getArtistById);
router.get('/:id/artworks', requireAuth, getArtistArtworksById);

export default router;