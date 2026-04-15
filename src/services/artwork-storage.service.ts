import { randomUUID } from 'crypto';
import path from 'path';
import { ARTWORKS_BUCKET } from '../config/artwork-storage';
import { getSupabase } from '../config/supabase';

const resolveSafeExtension = (originalName: string): string => {
  const ext = path.extname(originalName || '').toLowerCase();
  return ext && ext.length <= 10 ? ext : '.bin';
};

const buildArtworkStoragePath = (artistId: string, originalName: string): string => {
  return `${artistId}/${randomUUID()}${resolveSafeExtension(originalName)}`;
};

export const extractArtworkStoragePath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^\/+/, '');
  }

  try {
    const url = new URL(trimmed);
    const markers = [
      `/object/public/${ARTWORKS_BUCKET}/`,
      `/object/sign/${ARTWORKS_BUCKET}/`,
      `/render/image/public/${ARTWORKS_BUCKET}/`,
    ];

    for (const marker of markers) {
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex >= 0) {
        return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
      }
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

export const toArtworkPublicUrl = (storagePath: string): string => {
  const normalizedPath = extractArtworkStoragePath(storagePath);
  if (!normalizedPath) return storagePath;

  const { data } = getSupabase().storage.from(ARTWORKS_BUCKET).getPublicUrl(normalizedPath);
  return data.publicUrl;
};

export const uploadArtworkFiles = async (
  files: Express.Multer.File[],
  artistId: string
): Promise<string[]> => {
  if (files.length === 0) {
    return [];
  }

  const supabase = getSupabase();
  const uploadedPaths: string[] = [];

  try {
    for (const file of files) {
      const storagePath = buildArtworkStoragePath(artistId, file.originalname || 'image.bin');
      const { error } = await supabase.storage.from(ARTWORKS_BUCKET).upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false,
      });

      if (error) {
        throw error;
      }

      uploadedPaths.push(storagePath);
    }

    return uploadedPaths;
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await removeArtworkObjects(uploadedPaths).catch(() => undefined);
    }

    throw error;
  }
};

export const removeArtworkObjects = async (paths: string[]): Promise<void> => {
  const normalizedPaths = paths
    .map((value) => extractArtworkStoragePath(value))
    .filter((value, index, allValues) => !!value && allValues.indexOf(value) === index);

  if (normalizedPaths.length === 0) {
    return;
  }

  const { error } = await getSupabase().storage.from(ARTWORKS_BUCKET).remove(normalizedPaths);
  if (error) {
    throw error;
  }
};
