import { requireSupabase } from './supabase';

export type PromoAnnouncement = {
  id: string;
  title: string;
  titleAr?: string | null;
  subtitle: string;
  subtitleAr?: string | null;
  badgeText: string;
  imageUrl: string;
  targetRoute: string;
  ctaText: string;
  ctaTextAr?: string | null;
  isActive: boolean;
  sortOrder: number;
};

export const FALLBACK_PROMOS: PromoAnnouncement[] = [
  {
    id: 'promo_weekend_msaken',
    title: 'Offre Spéciale Restos & Fast-Food',
    titleAr: 'عروض خاصة لنهاية الأسبوع في مساكن ومصادين',
    subtitle: 'Commandez vos plats préférés et profitez de la livraison express.',
    subtitleAr: 'أشهى البيتزا والبرغر والمأكولات التونسية لباب دارك في أقل من 30 دقيقة',
    badgeText: 'تخفيض 20% · عرض خاص',
    imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900',
    targetRoute: '/food',
    ctaText: 'Commander',
    ctaTextAr: 'اطلب توا',
    isActive: true,
    sortOrder: 0,
  },
  {
    id: 'promo_courses_direct',
    title: 'Courses REDGO à Prix Fixes',
    titleAr: 'قضية الدار لباب الدار بدون تعب',
    subtitle: 'Eau, lait, produits locaux et pharmacie livrés chez vous sans majoration.',
    subtitleAr: 'ماء، حليب، مواد غذائية وصيدلية بأسعار قارة وتوصيل بـ 2.500 دت فقط',
    badgeText: 'قضية سريعة · 2.500 DT',
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=900',
    targetRoute: '/market',
    ctaText: 'Faire mes courses',
    ctaTextAr: 'قضي توا',
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'promo_scooter_taxi',
    title: 'Scooter Taxi Express M\'Saken',
    titleAr: 'أسرع تاكسي سكوتر في مساكن',
    subtitle: 'Déplacez-vous rapidement à M\'Saken et Messaadine sans embouteillages.',
    subtitleAr: 'تنقل سريع واقتصادي لشخص واحد مع خوذة معقمة وسائق محترف',
    badgeText: 'سريع · بدون زحمة',
    imageUrl: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=900',
    targetRoute: '/booking/pickup',
    ctaText: 'Réserver une course',
    ctaTextAr: 'اطلب كورس',
    isActive: true,
    sortOrder: 2,
  },
];

export async function fetchPromoAnnouncements(): Promise<PromoAnnouncement[]> {
  try {
    const client = requireSupabase();
    const { data, error } = await (client as any)
      .from('promo_announcements')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code !== 'PGRST205' && !String(error.message || '').includes('schema cache')) {
        console.warn('Erreur fetchPromoAnnouncements Supabase :', error.message);
      }
      return FALLBACK_PROMOS;
    }
    if (!data || data.length === 0) return FALLBACK_PROMOS;

    return (data as any[]).map((row) => ({
      id: row.id,
      title: row.title,
      titleAr: row.title_ar,
      subtitle: row.subtitle,
      subtitleAr: row.subtitle_ar,
      badgeText: row.badge_text,
      imageUrl: row.image_url,
      targetRoute: row.target_route || '/food',
      ctaText: row.cta_text || 'Découvrir',
      ctaTextAr: row.cta_text_ar,
      isActive: row.is_active,
      sortOrder: row.sort_order ?? 0,
    }));
  } catch (err) {
    console.warn('fetchPromoAnnouncements catch :', err);
    return FALLBACK_PROMOS;
  }
}
