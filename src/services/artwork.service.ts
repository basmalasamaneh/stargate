import { getSupabase } from '../config/supabase';

export interface CreateArtworkData {
  title: string;
  description: string;
  category: 'لوحات فنية' | 'تطريز فلسطيني' | 'خزف وفخار' | 'خط عربي' | 'تصوير فوتوغرافي' | 'نحت ومجسمات';
  price: number;
  quantity: number;
  images: { filename: string; alt_text?: string; is_featured?: boolean }[];
}

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
        quantity: artworkData.quantity
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
          location,
          phone
        ),
        artwork_images(*)
      `)
      .eq('id', artwork.id)
      .single();
    
    if (completeError) throw completeError;
    
    return completeArtwork;
    
  } catch (error) {
    throw error;
  }
};

export const getArtworks = async (category?: string, status?: string, artistId?: string) => {
  const supabase = getSupabase();
  
  let query = supabase
    .from('artworks')
    .select(`
      *,
      users!inner(
        artist_name,
        first_name,
        last_name,
        location,
        phone
      ),
      artwork_images(*)
    `);
  
  if (category) {
    query = query.eq('category', category);
  }
  
  if (status) {
    query = query.eq('status', status);
  }
  
  if (artistId) {
    query = query.eq('artist_id', artistId);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return data || [];
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
        location,
        phone
      ),
      artwork_images(*)
    `)
    .eq('id', id)
    .single();
  
  if (error) throw error;
  
  return data;
};

export const updateArtwork = async (id: string, artistId: string, updateData: Partial<CreateArtworkData>) => {
  const supabase = getSupabase();
  
  // First check if artwork exists and belongs to the artist
  const { data: existingArtwork, error: checkError } = await supabase
    .from('artworks')
    .select('artist_id')
    .eq('id', id)
    .single();
  
  if (checkError || !existingArtwork) {
    throw new Error('Artwork not found');
  }
  
  if (existingArtwork.artist_id !== artistId) {
    throw new Error('You can only update your own artworks');
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
    // Delete existing images
    await supabase
      .from('artwork_images')
      .delete()
      .eq('artwork_id', id);
    
    // Insert new images
    if (updateData.images.length > 0) {
      const imagesToInsert = updateData.images.map((image, index) => ({
        artwork_id: id,
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
        location,
        phone
      ),
      artwork_images(*)
    `)
    .eq('id', id)
    .single();
  
  if (completeError) throw completeError;
  
  return completeArtwork;
};

export const deleteArtwork = async (id: string, artistId: string) => {
  const supabase = getSupabase();
  
  // First check if artwork exists and belongs to the artist
  const { data: existingArtwork, error: checkError } = await supabase
    .from('artworks')
    .select('artist_id')
    .eq('id', id)
    .single();
  
  if (checkError || !existingArtwork) {
    throw new Error('Artwork not found');
  }
  
  if (existingArtwork.artist_id !== artistId) {
    throw new Error('You can only delete your own artworks');
  }
  
  // Delete artwork (this will cascade delete images due to foreign key constraint)
  const { error: deleteError } = await supabase
    .from('artworks')
    .delete()
    .eq('id', id);
  
  if (deleteError) throw deleteError;
  
  return { message: 'Artwork deleted successfully' };
};

export const getMyArtworks = async (artistId: string, filters?: {
  category?: string;
  status?: string;
}) => {
  const supabase = getSupabase();
  
  let query = supabase
    .from('artworks')
    .select(`
      *,
      artwork_images(*)
    `)
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false });
  
  // Apply filters if provided
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  
  return data;
};
