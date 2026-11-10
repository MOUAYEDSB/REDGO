import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CartBadge } from '../../components/CartBadge';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { useCart } from '../../context/CartContext';
import { formatMillimes } from '../../services/cart';

  type MarketProductItem = {
    id: string;
    name: string;
    category: string;
    priceMillimes: number;
    image: string;
    unit: string;
  };

const MARKET_PRODUCTS: MarketProductItem[] = [
  {
    id: 'eau-minerale-pack',
    name: 'Pack Eau Minérale Safia (6x1.5L)',
    category: 'Boissons',
    priceMillimes: 5200,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500',
    unit: 'Pack 6 bouteilles',
  },
  {
    id: 'lait-demi-ecreme',
    name: 'Lait Vitalait Demi-Écrémé 1L',
    category: 'Épicerie',
    priceMillimes: 1450,
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500',
    unit: 'Brique 1L',
  },
  {
    id: 'doliprane-1000',
    name: 'Paracétamol 1000mg (Boîte)',
    category: 'Pharmacie',
    priceMillimes: 3800,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500',
    unit: 'Pharmacie autorisée',
  },
  {
    id: 'gel-douche',
    name: 'Gel Douche Hydratant 400ml',
    category: 'Hygiène',
    priceMillimes: 7900,
    image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=500',
    unit: 'Flacon 400ml',
  },
  {
    id: 'huile-olive-bio',
    name: 'Huile d’Olive Extra Vierge de M\'Saken',
    category: 'Produits locaux',
    priceMillimes: 18500,
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500',
    unit: 'Bouteille 1L',
  },
  {
    id: 'lessive-liquide',
    name: 'Lessive Liquide Concentrée',
    category: 'Hygiène',
    priceMillimes: 12500,
    image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=500',
    unit: 'Bidon 2.5L',
  },
];

  const CATEGORIES = ['Tous', 'Boissons', 'Épicerie', 'Pharmacie', 'Hygiène', 'Produits locaux'];

  export default function MarketScreen() {
    const [selectedCategory, setSelectedCategory] = useState('Tous');
    const { addProduct } = useCart();

    const filteredProducts =
      selectedCategory === 'Tous'
        ? MARKET_PRODUCTS
        : MARKET_PRODUCTS.filter((p) => p.category === selectedCategory);

    const handleQuickAdd = (product: MarketProductItem) => {
      addProduct({
        productId: product.id,
        productType: 'courses',
        businessId: 'courses_hub_msaken',
        businessName: 'Courses REDGO',
        productName: product.name,
        productImage: product.image,
        unitPriceMillimes: product.priceMillimes,
        quantity: 1,
      });
    };

    return (
      <Screen scroll style={styles.screen}>
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
              <Text style={styles.title}>Courses REDGO</Text>
              <Text style={styles.subtitle}>Prix fixes gérés par REDGO · M'Saken & Messaadine</Text>
            </View>
          </View>

          <CartBadge />
        </View>

        {/* Categories Filter Horizontal Scroll */}
        <View style={styles.categoriesRow}>
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Products Grid */}
        <View style={styles.grid}>
          {filteredProducts.map((product) => (
            <Pressable
              key={product.id}
              style={({ pressed }) => [styles.productCard, pressed && { borderColor: colors.primary }]}
              onPress={() => router.push(`/market/product/${product.id}`)}
            >
              <View style={styles.imageContainer}>
                <Image source={{ uri: product.image }} style={styles.productImage} contentFit="cover" />
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{product.category}</Text>
                </View>
              </View>

              <View style={styles.productContent}>
                <Text style={styles.productName} numberOfLines={2}>
                  {product.name}
                </Text>
                <Text style={styles.productUnit}>{product.unit}</Text>

                <View style={styles.priceRow}>
                  <Text style={styles.productPrice}>{formatMillimes(product.priceMillimes)}</Text>

                  <Pressable
                    style={({ pressed }) => [styles.quickAddButton, pressed && { transform: [{ scale: 0.9 }] }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleQuickAdd(product);
                    }}
                    hitSlop={8}
                    accessibilityLabel={`Ajouter ${product.name} au panier`}
                  >
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
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
      paddingBottom: 12,
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
      backgroundColor: '#1E1E28',
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
    categoriesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginVertical: 14,
    },
    categoryPill: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 18,
      backgroundColor: '#181822',
      borderWidth: 1,
      borderColor: '#2A2A38',
    },
    categoryPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryText: {
      color: '#A1A1AA',
      fontSize: 12,
      fontWeight: '700',
    },
    categoryTextActive: {
      color: '#FFFFFF',
      fontWeight: '800',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 6,
    },
    productCard: {
      width: '48%',
      backgroundColor: '#181822',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#2A2A38',
      overflow: 'hidden',
    },
    imageContainer: {
      position: 'relative',
      width: '100%',
      height: 125,
      backgroundColor: '#22222E',
    },
    productImage: {
      width: '100%',
      height: '100%',
    },
    categoryBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: 'rgba(18, 18, 24, 0.85)',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#3A3A4A',
    },
    categoryBadgeText: {
      color: '#D4D4D8',
      fontSize: 9,
      fontWeight: '700',
    },
    productContent: {
      padding: 10,
    },
    productName: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
      minHeight: 34,
      lineHeight: 17,
    },
    productUnit: {
      color: colors.textSecondary,
      fontSize: 10,
      marginTop: 3,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    productPrice: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '900',
    },
    quickAddButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 3,
    },
  });
