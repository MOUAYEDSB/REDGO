import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CartBadge } from '../../../components/CartBadge';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../constants/theme';
import { useCart } from '../../../context/CartContext';
import { formatMillimes } from '../../../services/cart';

  type DishItem = {
    id: string;
    name: string;
    description: string;
    priceMillimes: number;
    image: string;
  };

  const RESTAURANTS: Record<string, { name: string; description: string; deliveryTime: string; cover: string; dishes: DishItem[] }> = {
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
    const restaurantKey = id && RESTAURANTS[id] ? id : 'karma';
    const restaurant = RESTAURANTS[restaurantKey];
    const { addProduct } = useCart();

    const handleQuickAdd = (dish: DishItem) => {
      addProduct({
        productId: dish.id,
        productType: 'food',
        businessId: restaurantKey,
        businessName: restaurant.name,
        productName: dish.name,
        productImage: dish.image,
        unitPriceMillimes: dish.priceMillimes,
        quantity: 1,
      });
    };

    return (
      <Screen scroll>
        {/* Cover & Navigation */}
        <View style={styles.coverWrapper}>
          <Image source={{ uri: restaurant.cover }} style={styles.cover} contentFit="cover" />
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
          <Text style={styles.name}>{restaurant.name}</Text>
          <Text style={styles.description}>{restaurant.description}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color={colors.success} />
              <Text style={styles.metaText}>{restaurant.deliveryTime}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={16} color={colors.primary} />
              <Text style={styles.metaText}>M'Saken & Messaadine</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="cash-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.metaText}>Espèces</Text>
            </View>
          </View>
        </View>

        {/* Dishes Section */}
        <Text style={styles.sectionTitle}>Plats & Menus</Text>

        <View style={styles.dishesList}>
          {restaurant.dishes.map((dish) => (
            <Pressable
              key={dish.id}
              style={({ pressed }) => [styles.productCard, pressed && { borderColor: colors.primary }]}
              onPress={() => router.push(`/food/product/${dish.id}?restaurant=${restaurantKey}`)}
            >
              <Image source={{ uri: dish.image }} style={styles.productImage} contentFit="cover" />

              <View style={styles.productBody}>
                <Text style={styles.productName} numberOfLines={1}>
                  {dish.name}
                </Text>
                <Text style={styles.productDesc} numberOfLines={2}>
                  {dish.description}
                </Text>
                <Text style={styles.productPrice}>{formatMillimes(dish.priceMillimes)}</Text>
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
    sectionTitle: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '900',
      marginHorizontal: 20,
      marginTop: 20,
      marginBottom: 12,
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
      marginTop: 6,
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
