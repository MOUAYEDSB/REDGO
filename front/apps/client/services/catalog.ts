import { requireSupabase } from './supabase';

export type CatalogProduct = {
  id: string;
  businessId: string;
  name: string;
  description: string;
  category: string;
  priceMillimes: number;
  imageUrl: string | null;
  maxQuantity: number;
  isAvailable: boolean;
  sortOrder: number;
};

export type CatalogBusiness = {
  id: string;
  kind: 'courses' | 'restaurant';
  name: string;
  description: string;
  phone: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  coverImageUrl: string | null;
  isActive: boolean;
};

export type ProductOption = {
  id: string;
  productId: string;
  name: string;
  priceMillimes: number;
  isAvailable: boolean;
  sortOrder: number;
};

/**
 * Récupère les articles de courses en direct depuis Supabase.
 * Seuls les produits disponibles dont l'établissement est actif sont retournés.
 */
export async function fetchCoursesProducts(): Promise<CatalogProduct[]> {
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('products')
      .select('*, businesses!inner(kind, is_active)')
      .eq('businesses.kind', 'courses')
      .eq('is_available', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.warn('Erreur fetchCoursesProducts Supabase :', error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      description: row.description,
      category: row.category || 'Courses',
      priceMillimes: row.price_millimes,
      imageUrl: row.image_url,
      maxQuantity: row.max_quantity,
      isAvailable: row.is_available,
      sortOrder: row.sort_order,
    }));
  } catch (err) {
    console.warn('fetchCoursesProducts catch :', err);
    return [];
  }
}

/**
 * Récupère les restaurants partenaires actifs depuis Supabase.
 */
export async function fetchRestaurants(): Promise<CatalogBusiness[]> {
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('businesses')
      .select('*')
      .eq('kind', 'restaurant')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.warn('Erreur fetchRestaurants Supabase :', error.message);
      return [];
    }

    return (data ?? []).map((b) => ({
      id: b.id,
      kind: b.kind as 'restaurant',
      name: b.name,
      description: b.description,
      phone: b.phone,
      address: b.address,
      latitude: b.latitude,
      longitude: b.longitude,
      coverImageUrl: b.cover_image_url,
      isActive: b.is_active,
    }));
  } catch (err) {
    console.warn('fetchRestaurants catch :', err);
    return [];
  }
}

/**
 * Récupère les plats d'un restaurant spécifique avec leurs options.
 */
export async function fetchRestaurantProducts(businessId: string): Promise<CatalogProduct[]> {
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_available', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.warn('Erreur fetchRestaurantProducts Supabase :', error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      description: row.description,
      category: row.category || 'Plats',
      priceMillimes: row.price_millimes,
      imageUrl: row.image_url,
      maxQuantity: row.max_quantity,
      isAvailable: row.is_available,
      sortOrder: row.sort_order,
    }));
  } catch (err) {
    console.warn('fetchRestaurantProducts catch :', err);
    return [];
  }
}

/**
 * Récupère un produit unique par son identifiant.
 */
export async function fetchProductById(productId: string): Promise<CatalogProduct | null> {
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      businessId: data.business_id,
      name: data.name,
      description: data.description,
      category: data.category || 'Courses',
      priceMillimes: data.price_millimes,
      imageUrl: data.image_url,
      maxQuantity: data.max_quantity,
      isAvailable: data.is_available,
      sortOrder: data.sort_order,
    };
  } catch {
    return null;
  }
}

/**
 * Récupère les options d'un produit (suppléments).
 */
export async function fetchProductOptions(productId: string): Promise<ProductOption[]> {
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('product_options')
      .select('*')
      .eq('product_id', productId)
      .eq('is_available', true)
      .order('sort_order', { ascending: true });

    if (error || !data) return [];

    return data.map((opt) => ({
      id: opt.id,
      productId: opt.product_id,
      name: opt.name,
      priceMillimes: opt.price_millimes,
      isAvailable: opt.is_available,
      sortOrder: opt.sort_order,
    }));
  } catch {
    return [];
  }
}

