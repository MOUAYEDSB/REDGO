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
import { CatalogBusiness, fetchRestaurants } from '../../services/catalog';

type DisplayRestaurant = {
  id: string;
  name: string;
  food: string;
  deliveryTime: string;
  deliveryFee: string;
  rating: string;
  image: string;
};

const CATEGORIES = ['Tous', 'Pizzas', 'Burgers', 'Tunisien', 'Pâtes', 'Grillades'];

const FALLBACK_RESTAURANTS: DisplayRestaurant[] = [
  {
    id: 'karma',
    name: 'Karma Kitchen',
    food: 'Pizzas au feu de bois & Burgers gourmets',
    deliveryTime: '20–30 min',
    deliveryFee: '2.500 DT',
    rating: '4.9 ★ (320+ avis)',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
  },
  {
    id: 'traditional',
    name: 'Saveurs de M\'Saken',
    food: 'Plats tunisiens authentiques & Grillades',
    deliveryTime: '25–40 min',
    deliveryFee: '2.500 DT',
    rating: '4.8 ★ (190+ avis)',
    image: 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=800',
  },
];

export default function FoodHome() {
  const [selectedCat, setSelectedCat] = useState('Tous');
  const [dbRestaurants, setDbRestaurants] = useState<CatalogBusiness[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const list = await fetchRestaurants();
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

  const restaurants: DisplayRestaurant[] = useMemo(() => {
    if (dbRestaurants.length > 0) {
      return dbRestaurants.map((b) => ({
        id: b.id,
        name: b.name,
        food: b.description || 'Restaurant partenaire REDGO',
        deliveryTime: '20–35 min',
        deliveryFee: '2.500 DT',
        rating: '4.9 ★ (Partenaire vérifié)',
        image:
          b.coverImageUrl ||
          'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
      }));
    }
    return FALLBACK_RESTAURANTS;
  }, [dbRestaurants]);

  const filteredRestaurants = useMemo(() => {
    if (selectedCat === 'Tous') return restaurants;
    const cat = selectedCat.toLowerCase();
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(cat) ||
        r.food.toLowerCase().includes(cat)
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

        {/* Categories Filter */}
        <View style={styles.categoryRow}>
          {CATEGORIES.map((category) => {
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
        </View>

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

          {
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
                    <Text style={styles.restaurantName}>{restaurant.name}</Text>
                    <Text style={styles.ratingText}>{restaurant.rating}</Text>
                  </View>
                  <Text style={styles.restaurantFood} numberOfLines={2}>
                    {restaurant.food}
                  </Text>

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
          }
    </Screen>
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
      categoryRow: {
        flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginVertical: 14,
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
  },
      restaurantName: {
        color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '900',
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