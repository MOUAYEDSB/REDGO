import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CartBadge } from '../../components/CartBadge';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { useCart } from '../../context/CartContext';
import { formatMillimes } from '../../services/cart';
import { CatalogProduct, fetchCoursesProducts } from '../../services/catalog';

type MarketProductItem = {
  id: string;
  name: string;
  category: string;
  priceMillimes: number;
  image: string;
  unit: string;
};

// Produits par défaut au cas où la base de données est vide ou hors-ligne
const FALLBACK_PRODUCTS: MarketProductItem[] = [
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
];

export default function MarketScreen() {
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [dbProducts, setDbProducts] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addProduct } = useCart();

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchCoursesProducts();
    setDbProducts(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  // Si des produits ont été ajoutés via l'admin dans Supabase, on les utilise !
  // Sinon on affiche les produits de base.
  const allProducts: MarketProductItem[] = useMemo(() => {
    if (dbProducts.length > 0) {
      return dbProducts.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        priceMillimes: p.priceMillimes,
        image: p.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500',
        unit: 'REDGO Direct',
      }));
    }
    return FALLBACK_PRODUCTS;
  }, [dbProducts]);

  // Catégories dynamiques dérivées des produits réels enregistrés
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProducts) {
      if (p.category.trim()) set.add(p.category.trim());
    }
    return ['Tous', ...Array.from(set)];
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'Tous') return allProducts;
    return allProducts.filter((p) => p.category === selectedCategory);
  }, [allProducts, selectedCategory]);

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
            <Text style={styles.subtitle}>Direct par catégorie · M'Saken & Messaadine</Text>
          </View>
        </View>

        <CartBadge />
      </View>

      {/* Categories Filter Horizontal Scroll */}
      <View style={styles.categoriesRow}>
        {categories.map((cat) => {
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

      {/* Loading state */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Mise à jour des produits en direct…</Text>
        </View>
      ) : null}

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
    backgroundColor: '#0F1012',
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E2024',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#181A1F',
    borderWidth: 1,
    borderColor: '#262930',
  },
  categoryPillActive: {
    backgroundColor: '#FF2638',
    borderColor: '#FF2638',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  productCard: {
    width: '48%',
    backgroundColor: '#181A1F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#262930',
    overflow: 'hidden',
  },
  imageContainer: {
    height: 120,
    backgroundColor: '#20232A',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  productContent: {
    padding: 12,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 18,
    minHeight: 36,
  },
  productUnit: {
    fontSize: 11,
    color: '#757575',
    marginTop: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FF2638',
  },
  quickAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF2638',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
