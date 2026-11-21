import { requireSupabase } from './supabase';

export type CatalogProduct = {
  id: string;
  businessId: string;
  businessName?: string;
  name: string;
  description: string;
  category: string;
  priceMillimes: number;
  imageUrl: string | null;
  maxQuantity: number;
  isAvailable: boolean;
  sortOrder: number;
  hasVariants?: boolean;
  defaultVariantName?: string;
  defaultVariantPriceMillimes?: number;
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



export type ProductVariant = {
  id: string;
  productId: string;
  name: string;
  priceMillimes: number;
  isAvailable: boolean;
  maxQuantity: number;
  sortOrder: number;
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
      hasVariants: Boolean((row as any).has_variants),
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
 * Récupère un établissement par son ID (restaurant ou hub courses).
 */
export async function fetchBusinessById(businessId: string): Promise<CatalogBusiness | null> {
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      kind: data.kind as 'restaurant' | 'courses',
      name: data.name,
      description: data.description,
      phone: data.phone,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      coverImageUrl: data.cover_image_url,
      isActive: data.is_active,
    };
  } catch (err) {
    console.warn('fetchBusinessById catch :', err);
    return null;
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
      .select('*, product_variants(id, name, price_millimes, is_available, sort_order)')
      .eq('business_id', businessId)
      .eq('is_available', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.warn('Erreur fetchRestaurantProducts Supabase :', error.message);
      return [];
    }

    return (data ?? []).map((row) => {
      const variantsList = ((row as any).product_variants ?? []).filter((v: any) => v.is_available !== false);
      variantsList.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const firstVariant = variantsList[0];

      return {
        id: row.id,
        businessId: row.business_id,
        name: row.name,
        description: row.description,
        category: row.category || 'Plats',
        priceMillimes: firstVariant ? Number(firstVariant.price_millimes) : row.price_millimes,
        imageUrl: row.image_url,
        maxQuantity: row.max_quantity,
        isAvailable: row.is_available,
        sortOrder: row.sort_order,
        hasVariants: Boolean((row as any).has_variants || variantsList.length > 0),
        defaultVariantName: firstVariant?.name,
        defaultVariantPriceMillimes: firstVariant ? Number(firstVariant.price_millimes) : undefined,
      };
    });
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
      .select('*, businesses(name)')
      .eq('id', productId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      businessId: data.business_id,
      businessName: (data as any).businesses?.name || undefined,
      name: data.name,
      description: data.description,
      category: data.category || 'Courses',
      priceMillimes: data.price_millimes,
      imageUrl: data.image_url,
      maxQuantity: data.max_quantity,
      isAvailable: data.is_available,
      sortOrder: data.sort_order,
      hasVariants: Boolean((data as any).has_variants),
    };
  } catch {
    return null;
  }
}

/**
 * Récupère les suppléments configurés au niveau d'un restaurant (business_supplements).
 */
export async function fetchBusinessSupplements(businessId: string): Promise<ProductOption[]> {
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('business_supplements' as any)
      .select('*')
      .eq('business_id', businessId)
      .eq('is_available', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.warn('Erreur fetchBusinessSupplements Supabase :', error.message);
      return [];
    }
    if (!data) return [];

    return (data as any[]).map((sup) => ({
      id: sup.id,
      productId: sup.business_id,
      name: sup.name,
      priceMillimes: Number(sup.price_millimes),
      isAvailable: Boolean(sup.is_available),
      sortOrder: Number(sup.sort_order) || 0,
    }));
  } catch (err) {
    console.warn('fetchBusinessSupplements catch :', err);
    return [];
  }
}

/**
 * Récupère les options et suppléments d'un produit (suppléments).
 * Fusionne automatiquement les suppléments du restaurant et les options du produit.
 */
export async function fetchProductOptions(productId: string, businessId?: string): Promise<ProductOption[]> {
  try {
    const client = requireSupabase();
    let actualBusinessId = businessId;

    if (!actualBusinessId) {
      const { data: prodData } = await client
        .from('products')
        .select('business_id')
        .eq('id', productId)
        .maybeSingle();
      if (prodData?.business_id) {
        actualBusinessId = prodData.business_id;
      }
    }

    const [businessSupplements, productOptions] = await Promise.all([
      actualBusinessId ? fetchBusinessSupplements(actualBusinessId) : Promise.resolve([]),
      client
        .from('product_options')
        .select('*')
        .eq('product_id', productId)
        .eq('is_available', true)
        .order('sort_order', { ascending: true })
        .then(({ data, error }) => {
          if (error || !data) return [];
          return (data as any[]).map((opt) => ({
            id: opt.id,
            productId: opt.product_id,
            name: opt.name,
            priceMillimes: Number(opt.price_millimes),
            isAvailable: Boolean(opt.is_available),
            sortOrder: Number(opt.sort_order) || 0,
          }));
        }),
    ]);

    // Combiner les suppléments du restaurant et les options du produit sans doublons d'id
    const combined = [...businessSupplements];
    for (const opt of productOptions) {
      if (!combined.some((c) => c.id === opt.id)) {
        combined.push(opt);
      }
    }
    return combined;
  } catch (err) {
    console.warn('fetchProductOptions catch :', err);
    return [];
  }
}

export type HomeFeaturedProduct = {
  id: string;
  type: 'courses' | 'food';
  businessId: string;
  businessName: string;
  name: string;
  priceMillimes: number;
  shop: string;
  image: string;
  hasVariants?: boolean;
  defaultVariantName?: string;
};

/**
 * Récupère une sélection d'articles populaires (Courses & Plats) pour l'accueil client.
 */
export async function fetchPopularHomeItems(): Promise<HomeFeaturedProduct[]> {
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('products')
      .select('*, businesses!inner(id, name, kind, is_active), product_variants(id, name, price_millimes, is_available, sort_order)')
      .eq('is_available', true)
      .eq('businesses.is_active', true)
      .order('sort_order', { ascending: true })
      .limit(8);

    if (error) {
      console.warn('Erreur fetchPopularHomeItems Supabase :', error.message);
      return [];
    }
    if (!data) return [];

    return (data as any[]).map((p) => {
      const isCourses = p.businesses?.kind === 'courses';
      const variantsList = (p.product_variants ?? []).filter((v: any) => v.is_available !== false);
      variantsList.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const firstVariant = variantsList[0];

      return {
        id: p.id,
        type: isCourses ? ('courses' as const) : ('food' as const),
        businessId: p.business_id,
        businessName: isCourses ? 'Courses REDGO' : p.businesses?.name || 'Restaurant',
        name: p.name,
        priceMillimes: firstVariant ? Number(firstVariant.price_millimes) : p.price_millimes,
        shop: isCourses ? 'Courses REDGO · Prix fixe' : p.businesses?.name || 'Restaurant',
        image:
          p.image_url ||
          (isCourses
            ? 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500'
            : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'),
        hasVariants: Boolean(p.has_variants || variantsList.length > 0),
        defaultVariantName: firstVariant?.name,
      };
    });
  } catch (err) {
    console.warn('fetchPopularHomeItems catch :', err);
    return [];
  }
}


/**
 * Recupere les variantes actives d'un produit depuis Supabase.
 */
export async function fetchProductVariants(productId: string): Promise<ProductVariant[]> {
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('product_variants' as any)
      .select('*')
      .eq('product_id', productId)
      .eq('is_available', true)
      .order('sort_order', { ascending: true })
      .order('price_millimes', { ascending: true });

    if (error) {
      console.warn('Erreur fetchProductVariants Supabase :', error.message);
      return [];
    }
    if (!data) return [];

    return (data as any[]).map((v) => ({
      id: v.id,
      productId: v.product_id,
      name: v.name,
      priceMillimes: Number(v.price_millimes),
      isAvailable: Boolean(v.is_available),
      maxQuantity: Number(v.max_quantity) || 30,
      sortOrder: Number(v.sort_order) || 0,
    }));
  } catch (err) {
    console.warn('fetchProductVariants catch :', err);
    return [];
  }
}

/**
 * Restaurant enrichi avec ses catégories assignées (business_categories).
 */
export type CatalogBusinessWithCategories = CatalogBusiness & {
  categoryIds: string[];     // ids des catégories assignées
  categoryNames: string[];   // noms des catégories assignées
};

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  activityTypes: string[];
  sortOrder: number;
  isActive: boolean;
};

/**
 * Récupère les catégories assignées au menu d'un restaurant spécifique.
 */
export async function fetchBusinessCategories(businessId: string): Promise<CatalogCategory[]> {
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('business_categories')
      .select('category_id, sort_order, is_active, categories(*)')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.warn('Erreur fetchBusinessCategories Supabase :', error.message);
      return [];
    }

    if (!data) return [];

    const categories: CatalogCategory[] = [];
    for (const row of data) {
      const cat = (row as any).categories;
      if (cat && cat.is_active !== false) {
        categories.push({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          imageUrl: cat.image_url,
          parentId: cat.parent_id,
          activityTypes: cat.activity_types || [],
          sortOrder: row.sort_order ?? cat.sort_order ?? 0,
          isActive: true,
        });
      }
    }

    return categories.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fr'));
  } catch (err) {
    console.warn('fetchBusinessCategories catch :', err);
    return [];
  }
}

/**
 * Récupère toutes les catégories actives globales (facultativement filtrées par type d'activité).
 */
export async function fetchAllActiveCategories(activityType?: string): Promise<CatalogCategory[]> {
  try {
    const client = requireSupabase();
    let query = client
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (activityType) {
      query = query.contains('activity_types', [activityType]);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imageUrl: cat.image_url,
      parentId: cat.parent_id,
      activityTypes: cat.activity_types || [],
      sortOrder: cat.sort_order ?? 0,
      isActive: Boolean(cat.is_active),
    }));
  } catch (err) {
    console.warn('fetchAllActiveCategories catch :', err);
    return [];
  }
}

/**
 * Récupère les restaurants actifs avec leurs catégories assignées (via business_categories).
 * Utilisé sur l'écran d'accueil Food pour filtrer par vraie catégorie DB.
 */
export async function fetchRestaurantsWithCategories(): Promise<CatalogBusinessWithCategories[]> {
  try {
    const client = requireSupabase();

    // Récupère les restaurants actifs + leurs business_categories avec le nom de la catégorie
    const { data, error } = await client
      .from('businesses')
      .select(`
        *,
        business_categories(
          category_id,
          is_active,
          categories(id, name, slug, is_active)
        )
      `)
      .eq('kind', 'restaurant')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.warn('Erreur fetchRestaurantsWithCategories Supabase :', error.message);
      return [];
    }

    return (data ?? []).map((b: any) => {
      const bizCats: any[] = b.business_categories ?? [];
      const activeCats = bizCats
        .filter((bc: any) => bc.is_active !== false && bc.categories?.is_active !== false)
        .map((bc: any) => bc.categories)
        .filter(Boolean);

      return {
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
        categoryIds: activeCats.map((c: any) => c.id as string),
        categoryNames: activeCats.map((c: any) => c.name as string),
      };
    });
  } catch (err) {
    console.warn('fetchRestaurantsWithCategories catch :', err);
    return [];
  }
}

