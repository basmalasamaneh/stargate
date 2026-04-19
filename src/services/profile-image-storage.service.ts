import { randomUUID } from 'crypto';
import path from 'path';
import { PROFILES_BUCKET } from '../config/profile-storage';
import { getSupabase } from '../config/supabase';

const resolveSafeExtension = (originalName: string): string => {
  const ext = path.extname(originalName || '').toLowerCase();
  return ext && ext.length <= 10 ? ext : '.bin';
};

const buildProfileStoragePath = (artistId: string, originalName: string): string => {
  return `${artistId}/${randomUUID()}${resolveSafeExtension(originalName)}`;
};

export const extractProfileStoragePath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^\/+/, '');
  }

  try {
    const url = new URL(trimmed);
    const markers = [
      `/object/public/${PROFILES_BUCKET}/`,
      `/object/sign/${PROFILES_BUCKET}/`,
      `/render/image/public/${PROFILES_BUCKET}/`,
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

export const toProfileImagePublicUrl = (storagePath: string): string => {
  const normalizedPath = extractProfileStoragePath(storagePath);
  if (!normalizedPath) return storagePath;

  const { data } = getSupabase().storage.from(PROFILES_BUCKET).getPublicUrl(normalizedPath);
  return data.publicUrl;
};

export const uploadProfileImageFile = async (
  file: Express.Multer.File,
  artistId: string
): Promise<string> => {
  const storagePath = buildProfileStoragePath(artistId, file.originalname || 'profile.bin');

  const { error } = await getSupabase().storage.from(PROFILES_BUCKET).upload(storagePath, file.buffer, {
    contentType: file.mimetype,
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return storagePath;
};

export const removeProfileImageObject = async (value?: string | null): Promise<void> => {
  if (!value) return;

  const normalizedPath = extractProfileStoragePath(value);
  if (!normalizedPath) return;

  const { error } = await getSupabase().storage.from(PROFILES_BUCKET).remove([normalizedPath]);
  if (error) {
    throw error;
  }
};
