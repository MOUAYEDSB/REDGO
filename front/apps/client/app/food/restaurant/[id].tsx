import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CartBadge } from '../../../components/CartBadge';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../constants/theme';
import { useCart } from '../../../context/CartContext';
import { formatMillimes } from '../../../services/cart';
import {
  CatalogBusiness,
  CatalogProduct,
  fetchBusinessById,
  fetchProductVariants,
  fetchRestaurantProducts,
} from '../../../services/catalog';

type DishItem = {
  id: string;
  name: string;
  description: string;
  priceMillimes: number;
  image: string;
  hasVariants?: boolean;
  defaultVariantName?: string;
};

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
        priceMillimes: 14500,
        image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=500',
      },
      {
        id: 'burger-special',
        name: 'Smash Burger REDGO',
        description: 'Double steak haché pur bœuf, cheddar fondant, sauce secrète.',
        priceMillimes: 16800,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
      },
      {
        id: 'pasta-carbonara',
        name: 'Pâtes Carbonara Traditionnelles',
        description: 'Guanciale croustillant, pecorino romano, jaunes d\'œufs frais.',
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
        priceMillimes: 19500,
        image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500',
      },
      {
        id: 'ojja-merguez',
        name: 'Ojja Traditionnelle aux Merguez',
        description: 'Tomates fraîches, poivrons, œufs pochés et merguez artisanales épicées.',
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
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { addProduct } = useCart();

    const loadData = useCallback(async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }
      const [biz, dishes] = await Promise.all([
        fetchBusinessById(id),
        fetchRestaurantProducts(id),
      ]);
      setDbBusiness(biz);
      setDbDishes(dishes);
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

                  {/* Dishes Section */}
                  <View style={styles.dishesHeader}>
                    <Text style={styles.sectionTitle}>Plats & Menus</Text>
                    <Text style={styles.dishesCountBadge}>
                      {dishes.length} plat{dishes.length > 1 ? 's' : ''}
                    </Text>
                  </View>

                      <View style={styles.dishesList}>
                        {dishes.map((dish) => (
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
        ))}
                </View>
            </Screen>
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
            shadowOffset: {width: 0, height: 2 },
            shadowOpacity: 0.4,
            shadowRadius: 6,
            elevation: 3,
  },
});