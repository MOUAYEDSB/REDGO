import { requireSupabase } from './supabase';

export type DriverReviewItem = {
  id: string;
  missionType: 'delivery' | 'scooter_ride';
  reference: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type DriverReviewsSummary = {
  averageRating: number | null;
  totalReviews: number;
  reviews: DriverReviewItem[];
};

export async function submitDriverReview(params: {
  targetType: 'delivery' | 'scooter_ride';
  targetId: string;
  rating: number;
  comment: string;
}): Promise<void> {
  const client = requireSupabase();
  const { error } = await (client as any).rpc('submit_driver_review', {
    target_type: params.targetType,
    target_id: params.targetId,
    p_rating: params.rating,
    p_comment: params.comment.trim(),
  });
  if (error) throw error;
}

export async function fetchCustomerReviewForTarget(
  targetType: 'delivery' | 'scooter_ride',
  targetId: string,
): Promise<{ rating: number; comment: string; createdAt: string } | null> {
  try {
    const client = requireSupabase();
    const column = targetType === 'delivery' ? 'delivery_order_id' : 'scooter_ride_id';
    const { data, error } = await (client as any)
      .from('driver_reviews')
      .select('rating, comment, created_at')
      .eq(column, targetId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      rating: data.rating,
      comment: data.comment || '',
      createdAt: data.created_at,
    };
  } catch {
    return null;
  }
}

export async function fetchDriverReviews(driverId?: string): Promise<DriverReviewsSummary> {
  if (!driverId) {
    return { averageRating: null, totalReviews: 0, reviews: [] };
  }
  try {
    const client = requireSupabase();
    const { data, error } = await (client as any)
      .from('driver_reviews')
      .select('id, mission_type, rating, comment, created_at, delivery_orders(reference), scooter_rides(reference)')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error || !data || data.length === 0) {
      return { averageRating: null, totalReviews: 0, reviews: [] };
    }

    const reviews: DriverReviewItem[] = (data as any[]).map((row) => ({
      id: row.id,
      missionType: row.mission_type,
      reference:
        row.mission_type === 'delivery'
          ? row.delivery_orders?.reference || 'Commande'
          : row.scooter_rides?.reference || 'Course',
      customerName: 'Client REDGO',
      rating: Number(row.rating),
      comment: row.comment || '',
      createdAt: row.created_at,
    }));

    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const averageRating = reviews.length > 0 ? Number((sum / reviews.length).toFixed(2)) : null;

    return {
      averageRating,
      totalReviews: reviews.length,
      reviews,
    };
  } catch {
    return { averageRating: null, totalReviews: 0, reviews: [] };
  }
}
