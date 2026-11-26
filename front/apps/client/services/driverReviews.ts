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

export async function fetchCustomerReviewedDeliveryIds(
  orderIds: string[],
): Promise<Record<string, { rating: number; comment: string }>> {
  const map: Record<string, { rating: number; comment: string }> = {};
  if (!orderIds || orderIds.length === 0) return map;
  try {
    const client = requireSupabase();
    const { data, error } = await (client as any)
      .from('driver_reviews')
      .select('delivery_order_id, rating, comment')
      .in('delivery_order_id', orderIds);
    if (!error && data) {
      (data as any[]).forEach((row) => {
        if (row.delivery_order_id) {
          map[row.delivery_order_id] = {
            rating: Number(row.rating),
            comment: row.comment || '',
          };
        }
      });
    }
  } catch {
    // Ignorer
  }
  return map;
}

export async function fetchDriverReviews(driverId?: string): Promise<DriverReviewsSummary> {
  if (!driverId) {
    return { averageRating: null, totalReviews: 0, reviews: [] };
  }
  try {
    const client = requireSupabase();
    const { data, error } = await (client as any)
      .from('driver_reviews')
      .select('id, customer_id, mission_type, rating, comment, created_at, delivery_orders(reference), scooter_rides(reference)')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error || !data || data.length === 0) {
      return { averageRating: null, totalReviews: 0, reviews: [] };
    }

    const customerIds = Array.from(new Set((data as any[]).map((r) => r.customer_id).filter(Boolean)));
    const nameMap = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: rpcProfs, error: rpcErr } = await (client as any).rpc('get_driver_customer_profiles', {
        target_customer_ids: customerIds,
      });
      if (!rpcErr && Array.isArray(rpcProfs)) {
        rpcProfs.forEach((p: any) => {
          if (p.id && p.full_name) nameMap.set(p.id, p.full_name);
        });
      } else {
        const { data: profs } = await (client as any)
          .from('profiles')
          .select('id, full_name')
          .in('id', customerIds);
        (profs ?? []).forEach((p: any) => {
          if (p.id && p.full_name) nameMap.set(p.id, p.full_name);
        });
      }
    }

    const reviews: DriverReviewItem[] = (data as any[]).map((row) => ({
      id: row.id,
      missionType: row.mission_type,
      reference:
        row.mission_type === 'delivery'
          ? row.delivery_orders?.reference || 'Commande'
          : row.scooter_rides?.reference || 'Course',
      customerName: nameMap.get(row.customer_id) || 'Client REDGO',
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
