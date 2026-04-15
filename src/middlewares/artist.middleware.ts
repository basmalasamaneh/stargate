import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../config/supabase';
import { AuthRequest } from './auth.middleware';

export const requireArtist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ status: 'error', message: 'يجب تسجيل الدخول أولاً' });
      return;
    }

    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.userId)
      .single();

    if (error || !user || user.role !== 'artist') {
      res.status(403).json({ status: 'error', message: 'هذا الإجراء متاح للفنانين فقط' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'حدث خطأ في الخادم' });
  }
};
