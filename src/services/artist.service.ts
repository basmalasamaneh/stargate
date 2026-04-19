import { getSupabase } from '../config/supabase';

export const getAllArtists = async () => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('id, first_name, last_name, artist_name, bio, location, role')
    .eq('role', 'artist')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
};

export const getArtistProfile = async (artistId: string) => {
  const supabase = getSupabase();

  const { data: artist, error } = await supabase
    .from('users')
    .select('id, first_name, last_name, artist_name, bio, location, phone, social_media, role')
    .eq('id', artistId)
    .eq('role', 'artist')
    .single();

  if (error || !artist) {
    const err = new Error('Artist not found');
    (err as any).statusCode = 404;
    throw err;
  }

  return artist;
};

export const getArtistArtworks = async (artistId: string, filters: { category?: string; page?: number; limit?: number }) => {
  const supabase = getSupabase();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 12;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // تحقق إن الفنان موجود
  const { data: artist, error: artistError } = await supabase
    .from('users')
    .select('id')
    .eq('id', artistId)
    .eq('role', 'artist')
    .single();

  if (artistError || !artist) {
    const err = new Error('Artist not found');
    (err as any).statusCode = 404;
    throw err;
  }

  let query = supabase
    .from('artworks')
    .select('*, artwork_images(*)', { count: 'exact' })
    .eq('artist_id', artistId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.category) query = query.eq('category', filters.category);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return { artworks: data ?? [], totalCount: count ?? 0, page, limit };
};