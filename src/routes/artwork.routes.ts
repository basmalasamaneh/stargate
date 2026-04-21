import { Router } from 'express';
import { addArtwork, listArtworks, getArtwork, updateArtwork, deleteArtwork, getMyArtworks } from '../controllers/artwork.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireArtist } from '../middlewares/artist.middleware';
import { artworkUpload } from '../middlewares/upload.middleware';

const router = Router();

// Add new artwork (artists only)
router.post('/', requireAuth, requireArtist, ...artworkUpload, addArtwork);

// List all artworks with optional filters
router.get('/', listArtworks);

// Get current artist's artworks (artists only)
router.get('/my-artworks', requireAuth, requireArtist, getMyArtworks);

// Get single artwork by ID
router.get('/:id', getArtwork);

// Update artwork (artists only, owner only)
router.patch('/:id', requireAuth, requireArtist, ...artworkUpload, updateArtwork);

// Delete artwork (artists only, owner only)
router.delete('/:id', requireAuth, requireArtist, deleteArtwork);

export default router;
