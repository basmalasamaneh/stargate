import { getSupabase } from '../config/supabase';
import { toArtworkPublicUrl } from './artwork-storage.service';
import { toProfileImagePublicUrl } from './profile-image-storage.service';
import { ArtworkCategory } from '../types/artwork.types';

const createStatusError = (message: string, statusCode: number) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

export interface CreateArtworkData {
  title: string;
  description: string;
  category: ArtworkCategory;
  price: number;
  quantity: number;
  images: { filename: string; alt_text?: string; is_featured?: boolean }[];
}

export interface ArtworkQueryFilters {
  category?: string;
  artistId?: string;
  search?: string;
  searchBy?: 'artwork' | 'global';
  page?: number;
  limit?: number;
}

export interface ArtworkListResult {
  artworks: Record<string, unknown>[];
  totalCount: number;
  page: number;
  limit: number;
}

const dedupeImagesByFilename = (
  images: { filename: string; alt_text?: string; is_featured?: boolean }[]
) => {
  const unique: { filename: string; alt_text?: string; is_featured?: boolean }[] = [];
  const seen = new Set<string>();

  for (const image of images) {
    const filename = image.filename;
    if (!filename || seen.has(filename)) continue;
    seen.add(filename);
    unique.push(image);
  }

  return unique;
};

const normalizeFeaturedImageSelection = (
  images: { filename: string; alt_text?: string; is_featured?: boolean }[]
) => {
  if (images.length === 0) {
    return images;
  }

  const featuredIndex = images.findIndex((image) => image.is_featured);
  const safeFeaturedIndex = featuredIndex >= 0 ? featuredIndex : 0;

  return images.map((image, index) => ({
    ...image,
    is_featured: index === safeFeaturedIndex,
  }));
};

const sanitizeArtworkContactInfo = <T extends Record<string, any> | null>(artwork: T, showContactInfo: boolean): T => {
  if (!artwork || showContactInfo) {
    return artwork;
  }

  const artistRecord = Array.isArray(artwork.users) ? artwork.users[0] : artwork.users;
  if (!artistRecord) {
    return artwork;
  }

  return {
    ...artwork,
    users: {
      ...artistRecord,
      location: null,
      phone: null,
    },
  } as T;
};

export const attachArtworkImageUrls = <T extends Record<string, any> | null>(artwork: T): T => {
  if (!artwork || !Array.isArray(artwork.artwork_images)) {
    return artwork;
  }

  const artistRecord = Array.isArray(artwork.users) ? artwork.users[0] : artwork.users;
  const usersWithProfileImage = artistRecord
    ? {
        ...artistRecord,
        profile_image: artistRecord.profile_image
          ? toProfileImagePublicUrl(artistRecord.profile_image)
          : null,
      }
    : artwork.users;

  const transformedImages = artwork.artwork_images.map((image: Record<string, any>) => ({
    ...image,
    storage_path: image.filename,
    filename: toArtworkPublicUrl(image.filename),
    url: toArtworkPublicUrl(image.filename),
  } as any));

  // Find featured image or use the first one
  const featuredImage = transformedImages.find(img => img.is_featured) || transformedImages[0];

  return {
    ...artwork,
    users: usersWithProfileImage,
    artwork_images: transformedImages,
    image: featuredImage ? featuredImage.url : null
  } as T;
};

export const createArtwork = async (artistId: string, artworkData: CreateArtworkData) => {
  const supabase = getSupabase();
  
  try {
    // Insert artwork
    const { data: artwork, error: artworkError } = await supabase
      .from('artworks')
      .insert({
        title: artworkData.title,
        description: artworkData.description,
        category: artworkData.category,
        artist_id: artistId,
        price: artworkData.price,
        quantity: artworkData.quantity,
        is_active: true,
        deleted_at: null,
      })
      .select()
      .single();
    
    if (artworkError) throw artworkError;
    
    // Insert images
    if (artworkData.images && artworkData.images.length > 0) {
      const imagesToInsert = artworkData.images.map((image, index) => ({
        artwork_id: artwork.id,
        filename: image.filename,
        alt_text: image.alt_text || null,
        is_featured: image.is_featured || false,
        sort_order: index
      }));
      
      const { error: imagesError } = await supabase
        .from('artwork_images')
        .insert(imagesToInsert);
      
      if (imagesError) throw imagesError;
    }
    
    // Get the complete artwork with images
    const { data: completeArtwork, error: completeError } = await supabase
      .from('artworks')
      .select(`
        *,
        users!inner(
          artist_name,
          first_name,
          last_name,
          profile_image,
          location,
          phone
        ),
        artwork_images(*)
      `)
      .eq('id', artwork.id)
      .single();
    
    if (completeError) throw completeError;
    
    return attachArtworkImageUrls(completeArtwork);
    
  } catch (error) {
    throw error;
  }
};

export const getArtworks = async (
  filters: ArtworkQueryFilters,
  showContactInfo: boolean = false
): Promise<ArtworkListResult> => {
  const supabase = getSupabase();
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const limit = Math.max(1, Math.min(100, Math.floor(filters.limit ?? 12)));
  const offset = (page - 1) * limit;
  
  let query = supabase
    .from('artworks')
    .select(`
      *,
      users!inner(
        artist_name,
        first_name,
        last_name,
        profile_image,
        location,
        phone
      ),
      artwork_images(*)
    `, { count: 'exact' })
    .eq('is_active', true);
  
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  
  if (filters.artistId) {
    query = query.eq('artist_id', filters.artistId);
  }

  if (filters.search) {
    const sanitizedSearch = filters.search.trim();
    if (sanitizedSearch) {
      // Use ilike and or combination for search
      const searchPattern = `%${sanitizedSearch}%`;
      query = query.or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`);
    }
  }
  
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  // PGRST103 = "Requested range not satisfiable" (HTTP 416)
  // Happens when the requested page is beyond the available data (e.g. after filtering).
  // Treat it as an empty page instead of an error.
  if (error) {
    if ((error as any).code === 'PGRST103') {
      return { artworks: [], totalCount: 0, page, limit };
    }
    throw error;
  }
  
  return {
    artworks: (data || []).map((artwork) => sanitizeArtworkContactInfo(attachArtworkImageUrls(artwork), showContactInfo)),
    totalCount: count ?? 0,
    page,
    limit,
  };
};

export const getArtworkById = async (id: string, showContactInfo: boolean = false) => {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('artworks')
    .select(`
      *,
      users!inner(
        artist_name,
        first_name,
        last_name,
        profile_image,
        location,
        phone
      ),
      artwork_images(*)
    `)
    .eq('id', id)
    .eq('is_active', true)
    .single();
  
  if (error) throw error;
  
  return sanitizeArtworkContactInfo(attachArtworkImageUrls(data), showContactInfo);
};

export const updateArtwork = async (id: string, artistId: string, updateData: Partial<CreateArtworkData>) => {
  const supabase = getSupabase();
  
  // First check if artwork exists and belongs to the artist
  const { data: existingArtwork, error: checkError } = await supabase
    .from('artworks')
    .select('artist_id, is_active')
    .eq('id', id)
    .single();
  
  if (checkError || !existingArtwork) {
    throw createStatusError('العمل الفني غير موجود', 404);
  }
  
  if (existingArtwork.artist_id !== artistId) {
    throw createStatusError('يمكنك تحديث أعمالك الفنية فقط', 403);
  }

  if (!existingArtwork.is_active) {
    throw createStatusError('العمل الفني غير موجود', 404);
  }

  let oldImageFilenames: string[] = [];
  if (updateData.images !== undefined) {
    const { data: oldImages, error: oldImagesError } = await supabase
      .from('artwork_images')
      .select('filename')
      .eq('artwork_id', id);

    if (oldImagesError) throw oldImagesError;
    oldImageFilenames = (oldImages || []).map((image) => image.filename);
  }
  
  // Update artwork basic info
  const updateFields: any = {};
  if (updateData.title !== undefined) updateFields.title = updateData.title;
  if (updateData.description !== undefined) updateFields.description = updateData.description;
  if (updateData.category !== undefined) updateFields.category = updateData.category;
  if (updateData.price !== undefined) updateFields.price = updateData.price;
  if (updateData.quantity !== undefined) updateFields.quantity = updateData.quantity;
  
  const { data: artwork, error: updateError } = await supabase
    .from('artworks')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single();
  
  if (updateError) throw updateError;
  
  // Update images if provided
  if (updateData.images !== undefined) {
    updateData.images = dedupeImagesByFilename(updateData.images);

    if (updateData.images.length === 0) {
      throw createStatusError('يجب أن يحتوي العمل الفني على صورة واحدة على الأقل', 400);
    }

    updateData.images = normalizeFeaturedImageSelection(updateData.images);

    const { data: currentImages, error: currentImagesError } = await supabase
      .from('artwork_images')
      .select('filename')
      .eq('artwork_id', id);

    if (currentImagesError) throw currentImagesError;

    const currentFilenameSet = new Set((currentImages || []).map((image) => image.filename));
    const nextFilenameSet = new Set(updateData.images.map((image) => image.filename));

    const filenamesToDelete = (currentImages || [])
      .map((image) => image.filename)
      .filter((filename) => !nextFilenameSet.has(filename));

    const { error: clearFeaturedError } = await supabase
      .from('artwork_images')
      .update({ is_featured: false })
      .eq('artwork_id', id);

    if (clearFeaturedError) throw clearFeaturedError;

    for (const [index, image] of updateData.images.entries()) {
      const imagePayload = {
        alt_text: image.alt_text || null,
        is_featured: image.is_featured || false,
        sort_order: index,
      };

      if (currentFilenameSet.has(image.filename)) {
        const { error: updateImageError } = await supabase
          .from('artwork_images')
          .update(imagePayload)
          .eq('artwork_id', id)
          .eq('filename', image.filename);

        if (updateImageError) throw updateImageError;
      } else {
        const { error: insertImageError } = await supabase
          .from('artwork_images')
          .insert({
            artwork_id: id,
            filename: image.filename,
            ...imagePayload,
          });

        if (insertImageError) throw insertImageError;
      }
    }

    if (filenamesToDelete.length > 0) {
      const { error: deleteImagesError } = await supabase
        .from('artwork_images')
        .delete()
        .eq('artwork_id', id)
        .in('filename', filenamesToDelete);

      if (deleteImagesError) throw deleteImagesError;
    }
  }
  
  // Get complete updated artwork
  const { data: completeArtwork, error: completeError } = await supabase
    .from('artworks')
    .select(`
      *,
      users!inner(
        artist_name,
        first_name,
        last_name,
        profile_image,
        location,
        phone
      ),
      artwork_images(*)
    `)
    .eq('id', id)
    .single();
  
  if (completeError) throw completeError;
  
  return {
    artwork: attachArtworkImageUrls(completeArtwork),
    oldImageFilenames,
  };
};

export const deleteArtwork = async (id: string, artistId: string) => {
  const supabase = getSupabase();
  
  // First check if artwork exists and belongs to the artist
  const { data: existingArtwork, error: checkError } = await supabase
    .from('artworks')
    .select('artist_id, is_active')
    .eq('id', id)
    .single();
  
  if (checkError || !existingArtwork) {
    throw createStatusError('العمل الفني غير موجود', 404);
  }
  
  if (existingArtwork.artist_id !== artistId) {
    throw createStatusError('يمكنك حذف أعمالك الفنية فقط', 403);
  }

  if (!existingArtwork.is_active) {
    throw createStatusError('تم حذف هذا العمل الفني مسبقاً', 409);
  }

  const { data: images, error: imagesError } = await supabase
    .from('artwork_images')
    .select('filename')
    .eq('artwork_id', id);

  if (imagesError) throw imagesError;
  
  // Soft delete artwork from listings while keeping historical data.
  const { error: deleteError } = await supabase
    .from('artworks')
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', id);
  
  if (deleteError) throw deleteError;
  
  return {
    message: 'تم حذف العمل الفني بنجاح',
    deletedImageFilenames: (images || []).map((image) => image.filename),
  };
};

export const getMyArtworks = async (
  artistId: string,
  filters?: ArtworkQueryFilters
): Promise<ArtworkListResult> => {
  const supabase = getSupabase();
  const page = Math.max(1, Math.floor(filters?.page ?? 1));
  const limit = Math.max(1, Math.min(100, Math.floor(filters?.limit ?? 9)));
  const offset = (page - 1) * limit;
  
  let query = supabase
    .from('artworks')
    .select(`
      *,
      artwork_images(*)
    `, { count: 'exact' })
    .eq('artist_id', artistId)
    .eq('is_active', true);
  
  // Apply filters if provided
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.search) {
    const searchTerm = `%${filters.search.trim().replace(/[%_]/g, '')}%`;
    query = query.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
  }
  
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) {
    if ((error as any).code === 'PGRST103') {
      return { artworks: [], totalCount: 0, page, limit };
    }
    throw error;
  }
  
  return {
    artworks: (data || []).map((artwork) => attachArtworkImageUrls(artwork)),
    totalCount: count ?? 0,
    page,
    limit,
  };
};
