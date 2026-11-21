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
  fetchRestaurantsWithCategories,
} from '../../services/catalog';

type DisplayRestaurant = {
  id: string;
  name: string;
  food: string;
  deliveryTime: string;
  deliveryFee: string;
  rating: string;
  image: string;
  categoryNames: string[]; // catégories réelles assignées dans la DB
};

// Catégories populaires affichées sur l'écran d'accueil Food
// Seules celles qui ont au moins 1 restaurant assigné seront visibles
const POPULAR_CATEGORY_SLUGS = [
  'Tous',
  'Pizzas',
  'Burgers',
  'Sandwichs',
  'Plats Tunisiens',
  'Grillades',
  'Pâtes',
  'Desserts',
  'Boissons',
];

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
  const [selectedCat, setSelectedCat] = useState('Tous');
  const [dbRestaurants, setDbRestaurants] = useState<CatalogBusinessWithCategories[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const list = await fetchRestaurantsWithCategories();
    setDbRestaurants(list);
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
      categoryNames: b.categoryNames,
    }));
  }, [dbRestaurants]);

  // Catégories populaires : on garde uniquement celles qui ont au moins 1 restaurant assigné
  const categories = useMemo(() => {
    if (dbRestaurants.length === 0) return POPULAR_CATEGORY_SLUGS;

    const usedCatNames = new Set<string>();
    for (const r of restaurants) {
      for (const cn of r.categoryNames) {
        usedCatNames.add(cn);
      }
    }

    const filtered = POPULAR_CATEGORY_SLUGS.filter(
      (c) => c === 'Tous' || usedCatNames.has(c)
    );
    // Si aucune catégorie trouvée (restaus sans catégories assignées), afficher la liste complète
    return filtered.length > 1 ? filtered : POPULAR_CATEGORY_SLUGS;
  }, [dbRestaurants, restaurants]);

  // Filtre par catégorie réelle (table business_categories)
  const filteredRestaurants = useMemo(() => {
    if (selectedCat === 'Tous') return restaurants;
    return restaurants.filter((r) =>
          r.categoryNames.some(
            (cn) => cn.toLowerCase() === selectedCat.toLowerCase()
          )
        );
  }, [restaurants, selectedCat]);

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
            <Text style={styles.subtitle}>Restaurants partenaires · M'Saken & Messaadine</Text>
          </View>
        </View>

        <CartBadge />
      </View>

      {/* Categories Filter — ligne horizontale scrollable */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryRow}
      >
        {categories.map((category) => {
          const isActive = selectedCat === category;
          return (
            <Pressable
              key={category}
              style={[styles.category, isActive && styles.categoryActive]}
              onPress={() => setSelectedCat(category)}
            >
              <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                {category}
              </Text>
            </Pressable>
          );
        })}
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
        <Text style={styles.section}>Restaurants ouverts</Text>
        <Text style={styles.countBadge}>
          {filteredRestaurants.length} disponible{filteredRestaurants.length > 1 ? 's' : ''}
        </Text>
      </View>

      {filteredRestaurants.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={44} color="#71717A" />
          <Text style={styles.emptyTitle}>
            {selectedCat === 'Tous' ? 'Aucun restaurant pour le moment' : `Aucun restaurant dans "${selectedCat}"`}
          </Text>
          <Text style={styles.emptySubtitle}>
            Les restaurants partenaires arrivent très bientôt sur REDGO !
          </Text>
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
