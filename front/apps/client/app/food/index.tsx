import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CartBadge } from '../../components/CartBadge';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import {
  CatalogBusinessWithCategories,
  CatalogCategory,
  fetchAllActiveCategories,
  fetchRestaurantsWithCategories,
  getCategoryFallbackOrder,
} from '../../services/catalog';

type DisplayRestaurant = {
  id: string;
  name: string;
  food: string;
  deliveryTime: string;
  deliveryFee: string;
  rating: string;
  image: string;
  categoryIds: string[];
  categoryNames: string[];
};

  type CategoryFilter = {
    id: string;
    name: string;
    sortOrder: number;
    count: number;
  };

// Filtres majeurs rapides dans l'ordre canonique (Pizzas d'abord -> Boissons à la fin)
const CANONICAL_FOOD_FILTERS = [
  { id: 'all', name: 'Tous', sortOrder: 0 },
  { id: 'pizzas', name: 'Pizzas', sortOrder: 10 },
  { id: 'ma9loub', name: 'Makloub', sortOrder: 20 },
  { id: 'burgers', name: 'Burgers', sortOrder: 30 },
  { id: 'tacos', name: 'Tacos', sortOrder: 40 },
  { id: 'baquette-farcie', name: 'Baguette farcie', sortOrder: 50 },
  { id: 'chappati', name: 'Chapati', sortOrder: 60 },
  { id: 'mtabga', name: 'Mtabga', sortOrder: 65 },
  { id: 'tabouna', name: 'Tabouna', sortOrder: 70 },
  { id: 'panini', name: 'Panini', sortOrder: 80 },
  { id: 'plats-tunisiens', name: 'Plats Tunisiens', sortOrder: 100 },
  { id: 'desserts', name: 'Desserts', sortOrder: 110 },
  { id: 'boissons-eaux', name: 'Boissons', sortOrder: 120 },
];

// Vérifie si un restaurant correspond à une catégorie donnée
function matchesRestaurantCategory(
  restaurant: DisplayRestaurant,
  targetId: string,
  targetName: string
): boolean {
  if (targetId === 'all' || targetName === 'Tous') return true;

  const targetIdLower = targetId.toLowerCase().trim();
  const targetNameLower = targetName.toLowerCase().trim();

  // 1. Correspondance directe par ID
  if (restaurant.categoryIds.some((cid) => cid.toLowerCase() === targetIdLower)) {
    return true;
  }

  // 2. Correspondance par alias d'identifiants
  for (const cId of restaurant.categoryIds) {
    const cidNorm = cId.toLowerCase();
    if (targetIdLower === 'ma9loub' && (cidNorm.includes('makloub') || cidNorm.includes('ma9loub') || cidNorm.includes('sandwich'))) return true;
    if (targetIdLower === 'chappati' && (cidNorm.includes('chapati') || cidNorm.includes('chappati'))) return true;
    if (targetIdLower === 'baquette-farcie' && (cidNorm.includes('baguette') || cidNorm.includes('baquette'))) return true;
    if (targetIdLower === 'desserts' && (cidNorm.includes('dessert') || cidNorm.includes('sucre'))) return true;
    if (targetIdLower === 'boissons-eaux' && (cidNorm.includes('boisson') || cidNorm.includes('eau'))) return true;
    if (targetIdLower === 'plats-tunisiens' && (cidNorm.includes('plat') || cidNorm.includes('grillade'))) return true;
  }

  // 3. Correspondance textuelle souple sur les noms de catégories assignées
  for (const cn of restaurant.categoryNames) {
    const cnLower = cn.toLowerCase().trim();
    if (cnLower === targetNameLower) return true;
    if (cnLower.includes(targetNameLower) || targetNameLower.includes(cnLower)) return true;

    // Synonymes tunisiens courants
    if (targetNameLower === 'chapati' && (cnLower.includes('chapati') || cnLower.includes('chappati'))) return true;
    if (targetNameLower === 'makloub' && (cnLower.includes('makloub') || cnLower.includes('ma9loub') || cnLower.includes('sandwich'))) return true;
    if (targetNameLower === 'baguette farcie' && (cnLower.includes('baguette') || cnLower.includes('baquette'))) return true;
    if (targetNameLower === 'tabouna' && cnLower.includes('tabouna')) return true;
    if (targetNameLower === 'mtabga' && cnLower.includes('mtabga')) return true;
    if (targetNameLower === 'desserts' && (cnLower.includes('dessert') || cnLower.includes('sucré'))) return true;
    if (targetNameLower === 'boissons' && (cnLower.includes('boisson') || cnLower.includes('eau'))) return true;
    if (targetNameLower === 'plats tunisiens' && (cnLower.includes('plat') || cnLower.includes('grillade') || cnLower.includes('tunisien'))) return true;
  }

  // 4. Fallback sur le titre ou la description du restaurant
  const fullText = `${restaurant.name} ${restaurant.food}`.toLowerCase();
  if (targetNameLower === 'chapati' && (fullText.includes('chapati') || fullText.includes('chappati'))) return true;
  if (targetNameLower === 'mtabga' && fullText.includes('mtabga')) return true;
  if (targetNameLower === 'tabouna' && fullText.includes('tabouna')) return true;
  if (targetNameLower === 'makloub' && (fullText.includes('makloub') || fullText.includes('ma9loub'))) return true;
  if (targetNameLower === 'pizzas' && fullText.includes('pizza')) return true;
  if (targetNameLower === 'burgers' && fullText.includes('burger')) return true;

  return false;
}

// Calcul d'une note dynamique basée sur l'identifiant pour chaque restaurant
function getRestaurantRating(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const ratings = ['4.8', '4.9', '4.7', '4.8', '4.9'];
  const index = Math.abs(hash) % ratings.length;
  return ratings[index];
}

export default function FoodHome() {
  const [selectedCatId, setSelectedCatId] = useState('all');
  const [dbRestaurants, setDbRestaurants] = useState<CatalogBusinessWithCategories[]>([]);
  const [dbCategories, setDbCategories] = useState<CatalogCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [restaurantsList, categoriesList] = await Promise.all([
      fetchRestaurantsWithCategories(),
      fetchAllActiveCategories('restaurant'),
    ]);
    setDbRestaurants(restaurantsList);
    setDbCategories(categoriesList);
    setIsLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  // Restaurants réels mappés en DisplayRestaurant (avec note dynamique compacte)
  const restaurants: DisplayRestaurant[] = useMemo(() => {
    return dbRestaurants.map((b) => ({
      id: b.id,
      name: b.name,
      food: b.description || 'Restaurant partenaire REDGO',
      deliveryTime: '20–35 min',
      deliveryFee: '2.500 DT',
      rating: getRestaurantRating(b.id),
      image:
        b.coverImageUrl ||
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
      categoryIds: b.categoryIds || [],
      categoryNames: b.categoryNames || [],
    }));
  }, [dbRestaurants]);

    // Catégories dynamiques : fusion de la base de données et des filtres canoniques
    const categories: CategoryFilter[] = useMemo(() => {
      const baseList: { id: string; name: string; sortOrder: number }[] = CANONICAL_FOOD_FILTERS.map((f) => ({
        id: f.id,
        name: f.name,
        sortOrder: f.sortOrder,
      }));

          // Intégrer les catégories supplémentaires de la base qui ne sont pas encore dans baseList
          for (const dbCat of dbCategories) {
            const alreadyRepresented = baseList.some(
              (f) =>
                f.id === dbCat.id ||
                f.name.toLowerCase() === dbCat.name.toLowerCase() ||
                (f.id === 'chappati' && dbCat.id === 'chappati') ||
                (f.id === 'ma9loub' && dbCat.id === 'ma9loub') ||
                (f.id === 'baquette-farcie' && dbCat.id === 'baquette-farcie') ||
                (f.id === 'boissons-eaux' && dbCat.id === 'boissons-eaux')
            );
            if (!alreadyRepresented) {
              baseList.push({
                id: dbCat.id,
                name: dbCat.name,
                sortOrder: typeof dbCat.sortOrder === 'number' && dbCat.sortOrder > 0 ? dbCat.sortOrder : getCategoryFallbackOrder(dbCat.name),
              });
            }
          }

    // Calculer le nombre de restaurants correspondants pour chaque filtre
    const withCounts = baseList.map((cat) => {
      const count =
        cat.id === 'all'
          ? restaurants.length
          : restaurants.filter((r) => matchesRestaurantCategory(r, cat.id, cat.name)).length;
      return { ...cat, count };
    });

    // Garder seulement les catégories qui ont au moins 1 restaurant (plus 'Tous')
    const activeFilters = withCounts.filter((c) => c.id === 'all' || c.count > 0);

    // Ordonner : Pizzas d'abord (10), Makloub (20), Burgers (30)... Boissons à la fin (120)
    activeFilters.sort((a, b) => a.sortOrder - b.sortOrder);

    return activeFilters;
  }, [dbCategories, restaurants]);

  // Filtre par catégorie réelle (table business_categories)
  const filteredRestaurants = useMemo(() => {
  if (selectedCatId === 'all') return restaurants;
  const cat = categories.find((c) => c.id === selectedCatId);
  if (!cat) return restaurants;
  return restaurants.filter((r) => matchesRestaurantCategory(r, cat.id, cat.name));
}, [restaurants, selectedCatId, categories]);

const currentCategory = useMemo(() => {
  return categories.find((c) => c.id === selectedCatId) || categories[0] || { id: 'all', name: 'Tous', count: 0, sortOrder: 0 };
}, [categories, selectedCatId]);

return (
  <Screen
    scroll
    style={styles.screen}
    refreshControl={
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor={colors.primary}
        colors={[colors.primary]}
      />
    }
  >
    {/* Top Header */}
    <View style={styles.topHeader}>
      <View style={styles.headerLeft}>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View>
          <Text style={styles.title}>REDGO Food</Text>
          <Text style={styles.subtitle}>Restaurants partenaires · M&apos;Saken & Messaadine</Text>
        </View>
      </View>

      <CartBadge />
    </View>

    {/* Categories Filter — ligne horizontale scrollable ordonnée */}
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoryScroll}
      contentContainerStyle={styles.categoryRow}
    >
        {
          categories.map((cat) => {
            const isActive = selectedCatId === cat.id;
            return (
              <Pressable
                key={cat.id}
                style={[styles.category, isActive && styles.categoryActive]}
                onPress={() => setSelectedCatId(cat.id)}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {cat.name}
                </Text>
                {cat.id !== 'all' && cat.count > 0 && (
                  <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                    <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                      {cat.count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })
        }
      </ScrollView>

    {/* Loading state */}
    {isLoading ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Synchronisation des restaurants…</Text>
      </View>
    ) : null}

    {/* Section Restaurants */}
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.section}>
        {selectedCatId === 'all' ? 'Restaurants ouverts' : `Restaurants : ${currentCategory.name}`}
      </Text>
      <Text style={styles.countBadge}>
        {filteredRestaurants.length} disponible{filteredRestaurants.length > 1 ? 's' : ''}
      </Text>
    </View>

    {filteredRestaurants.length === 0 && !isLoading ? (
      <View style={styles.emptyContainer}>
        <Ionicons name="restaurant-outline" size={44} color="#71717A" />
        <Text style={styles.emptyTitle}>
          {selectedCatId === 'all'
            ? 'Aucun restaurant pour le moment'
            : `Aucun restaurant dans "${currentCategory.name}"`}
        </Text>
        <Text style={styles.emptySubtitle}>
          Les restaurants partenaires arrivent très bientôt sur REDGO !
        </Text>
        {selectedCatId !== 'all' && (
          <Pressable style={styles.resetFilterButton} onPress={() => setSelectedCatId('all')}>
            <Text style={styles.resetFilterText}>Voir tous les restaurants</Text>
          </Pressable>
        )}
      </View>
    ) : (
      filteredRestaurants.map((restaurant) => (
        <Pressable
          key={restaurant.id}
          style={({ pressed }) => [styles.restaurant, pressed && { borderColor: colors.primary }]}
          onPress={() => router.push(`/food/restaurant/${restaurant.id}`)}
        >
          <Image
            source={{ uri: restaurant.image }}
            style={styles.restaurantImage}
            contentFit="cover"
          />
          <View style={styles.restaurantCopy}>
            <View style={styles.nameRow}>
              <Text style={styles.restaurantName} numberOfLines={1}>
                {restaurant.name}
              </Text>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#FBBF24" />
                <Text style={styles.ratingText}>{restaurant.rating}</Text>
              </View>
            </View>
            <Text style={styles.restaurantFood} numberOfLines={2}>
              {restaurant.food}
            </Text>

            {/* Tags catégories du restaurant */}
            {restaurant.categoryNames.length > 0 && (
              <View style={styles.catTagsRow}>
                {restaurant.categoryNames.slice(0, 3).map((cn) => (
                  <View key={cn} style={styles.catTag}>
                    <Text style={styles.catTagText}>{cn}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.meta}>
              <View style={styles.metaPill}>
                <Ionicons name="time-outline" size={13} color={colors.success} />
                <Text style={styles.metaText}>{restaurant.deliveryTime}</Text>
              </View>
              <View style={styles.metaPill}>
                <Ionicons name="bicycle-outline" size={13} color={colors.primary} />
                <Text style={styles.metaText}>{restaurant.deliveryFee}</Text>
              </View>
              <View style={styles.metaPill}>
                <Ionicons name="location-outline" size={13} color="#9CA3AF" />
                <Text style={styles.metaText}>M'Saken</Text>
              </View>
            </View>
          </View>
        </Pressable>
      ))
    )}
  </Screen >
);
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 18,
    paddingBottom: 36,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#181822',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2F2F3D',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  categoryScroll: {
    marginVertical: 14,
    marginHorizontal: -18,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 2,
  },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2A38',
    backgroundColor: '#181822',
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  categoryActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    backgroundColor: '#272738',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterBadgeText: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '800',
  },
  filterBadgeTextActive: {
    color: '#FFFFFF',
  },
  resetFilterButton: {
    marginTop: 14,
    backgroundColor: '#272738',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  resetFilterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 12,
  },
  section: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  countBadge: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },
  restaurant: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#181822',
    borderWidth: 1,
    borderColor: '#2D2D3D',
    marginBottom: 16,
  },
  restaurantImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#121218',
  },
  restaurantCopy: {
    padding: 14,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  restaurantName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    flex: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E1E2E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D2D3D',
  },
  ratingText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '800',
  },
  restaurantFood: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  catTagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  catTag: {
    backgroundColor: '#1E1E2E',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#2D2D3D',
  },
  catTagText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  meta: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#121218',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaText: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '700',
  },
});
