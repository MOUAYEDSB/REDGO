import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CartBadge } from '../../../components/CartBadge';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../constants/theme';
import { useCart } from '../../../context/CartContext';
import { formatMillimes } from '../../../services/cart';
import {
  CatalogBusiness,
  CatalogCategory,
  CatalogProduct,
  fetchBusinessById,
  fetchBusinessCategories,
  fetchProductVariants,
  fetchRestaurantProducts,
} from '../../../services/catalog';

type DishItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  priceMillimes: number;
  image: string;
  hasVariants?: boolean;
  defaultVariantName?: string;
};

function getRestaurantCategoryIcon(cat: string): keyof typeof Ionicons.glyphMap {
  const lower = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (lower === 'tous') return 'restaurant-outline';
  if (lower.includes('pizza')) return 'pizza-outline';
  if (lower.includes('burger')) return 'fast-food-outline';
  if (
    lower.includes('sandwich') ||
    lower.includes('makloub') ||
    lower.includes('mlawi') ||
    lower.includes('cornet') ||
    lower.includes('baguette') ||
    lower.includes('chapati')
  ) {
    return 'nutrition-outline';
  }
  if (lower.includes('pate') || lower.includes('pasta') || lower.includes('spaghetti')) {
    return 'restaurant-outline';
  }
  if (lower.includes('salade')) return 'leaf-outline';
  if (
    lower.includes('plat') ||
    lower.includes('couscous') ||
    lower.includes('ojja') ||
    lower.includes('grillade') ||
    lower.includes('viande') ||
    lower.includes('poisson')
  ) {
    return 'flame-outline';
  }
  if (lower.includes('boisson') || lower.includes('jus') || lower.includes('eau') || lower.includes('soda')) {
    return 'wine-outline';
  }
  if (lower.includes('dessert') || lower.includes('sucre') || lower.includes('glace') || lower.includes('crepe')) {
    return 'ice-cream-outline';
  }
  return 'pricetag-outline';
}

const FALLBACK_RESTAURANTS: Record<
  string,
  { name: string; description: string; deliveryTime: string; cover: string; dishes: DishItem[] }
> = {
  karma: {
    name: 'Karma Kitchen',
    description: 'Pizzas artisanales, burgers gourmets et spécialités italiennes.',
    deliveryTime: '20–30 min',
    cover: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900',
    dishes: [
      {
        id: 'margherita',
        name: 'Pizza Margherita Di Bufala',
        description: 'Sauce tomate San Marzano, mozzarella fior di latte et basilic frais.',
        category: 'Pizzas',
        priceMillimes: 14500,
        image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=500',
      },
      {
        id: 'burger-special',
        name: 'Smash Burger REDGO',
        description: 'Double steak haché pur bœuf, cheddar fondant, sauce secrète.',
        category: 'Burgers',
        priceMillimes: 16800,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
      },
      {
        id: 'pasta-carbonara',
        name: 'Pâtes Carbonara Traditionnelles',
        description: 'Guanciale croustillant, pecorino romano, jaunes d\'œufs frais.',
        category: 'Pâtes',
        priceMillimes: 18500,
        image: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=500',
      },
    ],
  },
  traditional: {
    name: 'Saveurs de M\'Saken',
    description: 'Cuisine tunisienne authentique, couscous et grillades au feu de bois.',
    deliveryTime: '25–40 min',
    cover: 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=900',
    dishes: [
      {
        id: 'couscous-agneau',
        name: 'Couscous à l\'Agneau de M\'Saken',
        description: 'Semoule fine cuite à la vapeur, légumes fondants et agneau mijoté.',
        category: 'Plats Tunisiens',
        priceMillimes: 19500,
        image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500',
      },
      {
        id: 'ojja-merguez',
        name: 'Ojja Traditionnelle aux Merguez',
        description: 'Tomates fraîches, poivrons, œufs pochés et merguez artisanales épicées.',
        category: 'Plats Tunisiens',
        priceMillimes: 13500,
        image: 'https://images.unsplash.com/photo-1590577976322-3d2d6e2130d5?w=500',
      },
    ],
  },
};

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [dbBusiness, setDbBusiness] = useState<CatalogBusiness | null>(null);
  const [dbDishes, setDbDishes] = useState<CatalogProduct[]>([]);
  const [dbCategories, setDbCategories] = useState<CatalogCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { addProduct } = useCart();

  const loadData = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    const [biz, dishes, bizCats] = await Promise.all([
      fetchBusinessById(id),
      fetchRestaurantProducts(id),
      fetchBusinessCategories(id),
    ]);
    setDbBusiness(biz);
    setDbDishes(dishes);
    setDbCategories(bizCats);
    setIsLoading(false);
    setRefreshing(false);
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  const fallback = id && FALLBACK_RESTAURANTS[id] ? FALLBACK_RESTAURANTS[id] : FALLBACK_RESTAURANTS.karma;

  const restaurantName = dbBusiness?.name || fallback.name;
  const restaurantDesc = dbBusiness?.description || fallback.description;
  const restaurantCover =
    dbBusiness?.coverImageUrl ||
    fallback.cover;

  const dishes: DishItem[] = useMemo(() => {
    if (dbDishes.length > 0) {
      return dbDishes.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || 'Préparé à la commande avec des produits frais.',
        category: p.category?.trim() || 'Plats',
        priceMillimes: p.priceMillimes,
        image:
          p.imageUrl ||
          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
        hasVariants: Boolean(p.hasVariants),
        defaultVariantName: p.defaultVariantName,
      }));
    }
    return fallback.dishes;
  }, [dbDishes, fallback.dishes]);

  // Dynamic category list computed from DB assigned categories and dishes
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dishes) {
      const cat = d.category?.trim() || 'Plats';
      map.set(cat, (map.get(cat) ?? 0) + 1);
    }

    if (dbCategories.length > 0) {
      // Use configured categories from DB for this restaurant
      const list = dbCategories.map((c) => ({
        id: c.id,
        name: c.name,
        count: map.get(c.name) ?? 0,
        imageUrl: c.imageUrl,
      }));

      // Add any dish categories that might not be in dbCategories (fallback safeguard)
      for (const [catName, count] of map.entries()) {
        if (!list.some((c) => c.name.toLowerCase() === catName.toLowerCase())) {
          list.push({ id: catName, name: catName, count, imageUrl: null });
        }
      }

      return [
        { id: 'all', name: 'Tous', count: dishes.length, imageUrl: null },
        ...list,
      ];
    }

    // Fallback: derived directly from dishes
    const list = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, 'fr'));
    return [
      { id: 'all', name: 'Tous', count: dishes.length, imageUrl: null },
      ...list.map((c) => ({ id: c, name: c, count: map.get(c) ?? 0, imageUrl: null })),
    ];
  }, [dbCategories, dishes]);

  // Filtered dishes according to active category and search input
  const filteredDishes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dishes.filter((dish) => {
      const matchesCategory =
        selectedCategory === 'Tous' ||
        dish.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        !q ||
        dish.name.toLowerCase().includes(q) ||
        dish.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [dishes, selectedCategory, searchQuery]);

  const handleQuickAdd = async (dish: DishItem) => {
    if (dish.hasVariants) {
      try {
        const vars = await fetchProductVariants(dish.id);
        if (vars.length > 0) {
          const firstVariant = vars[0];
          addProduct({
            productId: dish.id,
            variantId: firstVariant.id,
            variantName: firstVariant.name,
            productType: 'food',
            businessId: id || 'restaurant_item',
            businessName: restaurantName,
            productName: dish.name,
            productImage: dish.image,
            unitPriceMillimes: firstVariant.priceMillimes,
            quantity: 1,
          });
          return;
        }
      } catch (err) {
        console.warn('Erreur handleQuickAdd variants:', err);
      }
    }
    addProduct({
      productId: dish.id,
      productType: 'food',
      businessId: id || 'restaurant_item',
      businessName: restaurantName,
      productName: dish.name,
      productImage: dish.image,
      unitPriceMillimes: dish.priceMillimes,
      quantity: 1,
    });
  };

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Cover & Navigation */}
      <View style={styles.coverWrapper}>
        <Image source={{ uri: restaurantCover }} style={styles.cover} contentFit="cover" />
        <View style={styles.topNav}>
          <Pressable
            style={({ pressed }) => [styles.navCircle, pressed && { opacity: 0.8 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={styles.navCircle}>
            <CartBadge tintColor="#FFFFFF" />
          </View>
        </View>
      </View>

      {/* Restaurant Header */}
      <View style={styles.header}>
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Synchronisation du restaurant…</Text>
          </View>
        ) : null}

        <Text style={styles.name}>{restaurantName}</Text>
        <Text style={styles.description}>{restaurantDesc}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color={colors.success} />
            <Text style={styles.metaText}>20–35 min</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={16} color={colors.primary} />
            <Text style={styles.metaText}>M'Saken & Messaadine</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.metaText}>Paiement Espèces</Text>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#71717A" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un plat, boisson..."
            placeholderTextColor="#71717A"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#A1A1AA" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Category Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesScrollContent}
        style={styles.categoriesScroll}
      >
        {categories.map((cat) => {
          const isSelected =
            selectedCategory.toLowerCase() === cat.name.toLowerCase();
          const iconName = getRestaurantCategoryIcon(cat.name);
          return (
            <Pressable
              key={cat.name}
              style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
              onPress={() => setSelectedCategory(cat.name)}
            >
              <Ionicons
                name={iconName}
                size={16}
                color={isSelected ? '#FFFFFF' : '#A1A1AA'}
              />
              <Text
                style={[
                  styles.categoryPillText,
                  isSelected && styles.categoryPillTextActive,
                ]}
              >
                {cat.name}
              </Text>
              <View
                style={[
                  styles.categoryCountBadge,
                  isSelected && styles.categoryCountBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryCountText,
                    isSelected && styles.categoryCountTextActive,
                  ]}
                >
                  {cat.count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Dishes Section Header */}
      <View style={styles.dishesHeader}>
        <Text style={styles.sectionTitle}>
          {selectedCategory === 'Tous' ? 'Plats & Menus' : selectedCategory}
        </Text>
        <Text style={styles.dishesCountBadge}>
          {filteredDishes.length} plat{filteredDishes.length > 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.dishesList}>
        {filteredDishes.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="restaurant-outline" size={32} color="#71717A" />
            </View>
            <Text style={styles.emptyTitle}>Aucun plat trouvé</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? `Aucun plat ne correspond à "${searchQuery}".`
                : `Aucun plat disponible dans la catégorie "${selectedCategory}".`}
            </Text>
            {(searchQuery || selectedCategory !== 'Tous') && (
              <Pressable
                style={styles.resetFilterButton}
                onPress={() => {
                  setSearchQuery('');
                  setSelectedCategory('Tous');
                }}
              >
                <Ionicons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.resetFilterText}>Voir tout le menu</Text>
              </Pressable>
            )}
          </View>
        ) : (
          filteredDishes.map((dish) => (
            <Pressable
              key={dish.id}
              style={({ pressed }) => [styles.productCard, pressed && { borderColor: colors.primary }]}
              onPress={() => router.push(`/food/product/${dish.id}?restaurant=${id || 'karma'}`)}
            >
              <Image source={{ uri: dish.image }} style={styles.productImage} contentFit="cover" />

              <View style={styles.productBody}>
                <Text style={styles.productName} numberOfLines={1}>
                  {dish.name}
                </Text>
                <Text style={styles.productDesc} numberOfLines={2}>
                  {dish.description}
                </Text>
                <View style={styles.productPriceRow}>
                  <Text style={styles.productPrice}>
                    {formatMillimes(dish.priceMillimes)}
                  </Text>
                  {dish.defaultVariantName ? (
                    <View style={styles.defaultVariantBadge}>
                      <Text style={styles.defaultVariantBadgeText}>
                        {dish.defaultVariantName}
                      </Text>
                    </View>
                  ) : dish.hasVariants ? (
                    <View style={styles.defaultVariantBadge}>
                      <Text style={styles.defaultVariantBadgeText}>
                        Format standard
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Quick Add Button */}
              <Pressable
                style={({ pressed }) => [styles.addButton, pressed && { transform: [{ scale: 0.9 }] }]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleQuickAdd(dish);
                }}
                hitSlop={10}
                accessibilityLabel={`Ajouter ${dish.name} au panier`}
              >
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </Pressable>
            </Pressable>
          ))
        )}
    </View >
  </Screen >
);
}

const styles = StyleSheet.create({
  coverWrapper: {
    position: 'relative',
    width: '100%',
    height: 220,
    backgroundColor: '#121218',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  topNav: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(18, 18, 24, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: '#09090B',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '700',
  },
  searchWrapper: {
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181820',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2D2D3B',
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchIcon: {
    marginRight: 2,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    height: '100%',
  },
  categoriesScroll: {
    marginBottom: 4,
  },
  categoriesScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181820',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D2D3B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryPillText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  categoryCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  categoryCountBadgeActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  categoryCountText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
  },
  categoryCountTextActive: {
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#181820',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D2D3B',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  resetFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  resetFilterText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dishesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  dishesCountBadge: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  dishesList: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181820',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2D2D3B',
    padding: 12,
    gap: 12,
  },
  productImage: {
    width: 82,
    height: 82,
    borderRadius: 14,
    backgroundColor: '#262633',
  },
  productBody: {
    flex: 1,
  },
  productName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  productDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  productPrice: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  defaultVariantBadge: {
    backgroundColor: 'rgba(255, 38, 56, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 38, 56, 0.3)',
  },
  defaultVariantBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
});