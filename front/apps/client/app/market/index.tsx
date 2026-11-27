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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CartBadge } from '../../components/CartBadge';
import { colors } from '../../constants/theme';
import { useCart } from '../../context/CartContext';
import { ThemePalette, useTheme } from '../../context/ThemeContext';
import { formatMillimes } from '../../services/cart';
import { CatalogProduct, fetchCoursesProducts } from '../../services/catalog';

type MarketProductItem = {
  id: string;
  name: string;
  category: string;
  priceMillimes: number;
  image: string;
  unit: string;
  hasVariants?: boolean;
};

function getCategoryIcon(cat: string): keyof typeof Ionicons.glyphMap {
  const lower = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (lower === 'tous') return 'apps-outline';
  if (lower.includes('boisson') || lower.includes('eau') || lower.includes('jus') || lower.includes('soda')) return 'water-outline';
  if (lower.includes('epicerie') || lower.includes('course') || lower.includes('aliment')) return 'basket-outline';
  if (lower.includes('pharmac') || lower.includes('sante') || lower.includes('medicament')) return 'medkit-outline';
  if (lower.includes('hygiene') || lower.includes('beaute') || lower.includes('soin')) return 'sparkles-outline';
  if (lower.includes('local') || lower.includes('terroir') || lower.includes('huile') || lower.includes('bio')) return 'leaf-outline';
  if (lower.includes('boulangerie') || lower.includes('pain') || lower.includes('patisserie') || lower.includes('croissant')) return 'nutrition-outline';
  if (lower.includes('fruit') || lower.includes('legume') || lower.includes('primeur')) return 'nutrition-outline';
  if (lower.includes('snack') || lower.includes('biscuit') || lower.includes('chocolat') || lower.includes('bonbon')) return 'fast-food-outline';
  if (lower.includes('lait') || lower.includes('fromage') || lower.includes('cremerie') || lower.includes('yaourt')) return 'cafe-outline';
  if (lower.includes('bebe') || lower.includes('enfant')) return 'happy-outline';
  if (lower.includes('animal') || lower.includes('animaux')) return 'paw-outline';
  if (lower.includes('maison') || lower.includes('entretien') || lower.includes('nettoyage')) return 'home-outline';
  return 'pricetag-outline';
}

export default function MarketScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [dbProducts, setDbProducts] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { items, addProduct, updateQuantity, removeItem, totalItemsCount, subtotalMillimes } = useCart();

  const loadProducts = useCallback(async () => {
    const data = await fetchCoursesProducts();
    setDbProducts(data);
    setIsLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadProducts();
  }, [loadProducts]);

  // Map des quantités déjà présentes dans le panier par productId
  const cartQuantities = useMemo(() => {
    const map = new Map<string, { key: string; quantity: number }>();
    for (const item of items) {
      if (item.productType === 'courses') {
        map.set(item.productId, { key: item.key, quantity: item.quantity });
      }
    }
    return map;
  }, [items]);

  const allProducts: MarketProductItem[] = useMemo(() => {
    return dbProducts.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category || 'Courses',
      priceMillimes: p.priceMillimes,
      image: p.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500',
      unit: 'REDGO Direct',
    }));
  }, [dbProducts]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProducts) {
      if (p.category.trim()) set.add(p.category.trim());
    }
    return ['Tous', ...Array.from(set)];
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    let result = allProducts;
    if (selectedCategory !== 'Tous') {
      result = result.filter((p) => p.category === selectedCategory);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allProducts, searchQuery, selectedCategory]);

  const handleAdd = (product: MarketProductItem) => {
    const existing = cartQuantities.get(product.id);
    if (existing) {
      updateQuantity(existing.key, existing.quantity + 1);
    } else {
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
    }
  };

  const handleMinus = (product: MarketProductItem) => {
    const existing = cartQuantities.get(product.id);
    if (!existing) return;
    if (existing.quantity > 1) {
      updateQuantity(existing.key, existing.quantity - 1);
    } else {
      removeItem(existing.key);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <View>
            <Text style={styles.title}>Courses REDGO</Text>
            <Text style={styles.subtitle}>Direct par catégorie · M'Saken & Messaadine</Text>
          </View>
        </View>

        <CartBadge />
      </View>

      {/* Barre de Recherche Interactive */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Rechercher eau, lait, pharmacie, biscuits…"
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, totalItemsCount > 0 && { paddingBottom: 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Banner Info Livraison Express REDGO */}
        <View style={styles.expressBanner}>
          <View style={styles.expressBannerLeft}>
            <View style={styles.expressBannerIconWrap}>
              <Ionicons name="flash" size={16} color="#FFFFFF" />
            </View>
            <View style={styles.expressBannerContent}>
              <View style={styles.expressBannerTagRow}>
                <Text style={styles.expressBannerTag}>LIVRAISON DIRECTE</Text>
                <View style={styles.expressDot} />
                <Text style={styles.expressTimerText}>20–30 MIN</Text>
              </View>
              <Text style={styles.expressBannerTitle}>Courses Express en Scooter</Text>
              <Text style={styles.expressBannerText}>
                Prix fixes sans intermédiaire · M'Saken & Messaadine
              </Text>
            </View>
          </View>
          <View style={styles.expressBadgeFee}>
            <Text style={styles.expressBadgeFeeVal}>2.500</Text>
            <Text style={styles.expressBadgeFeeCur}>DT</Text>
          </View>
        </View>

        {/* Categories Horizontal Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            const iconName = getCategoryIcon(cat);
            return (
              <Pressable
                key={cat}
                style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Ionicons
                  name={iconName}
                  size={14}
                  color={isActive ? '#FFFFFF' : colors.textSecondary}
                />
                <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Loading Indicator */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Synchronisation des produits…</Text>
          </View>
        ) : null}

        {/* Empty Search Result */}
        {!isLoading && filteredProducts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={44} color={colors.border} />
            <Text style={styles.emptyTitle}>Aucun produit trouvé</Text>
            <Text style={styles.emptyText}>
              Aucun résultat pour « {searchQuery || selectedCategory} ». Essayez un autre mot-clé.
            </Text>
            {searchQuery ? (
              <Pressable style={styles.resetButton} onPress={() => setSearchQuery('')}>
                <Text style={styles.resetButtonText}>Effacer la recherche</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Products Grid */}
        <View style={styles.grid}>
          {filteredProducts.map((product) => {
            const cartItem = cartQuantities.get(product.id);
            const qty = cartItem ? cartItem.quantity : 0;

            return (
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
                    <Text style={styles.productPrice}>
                      {product.hasVariants ? 'À partir de ' : ''}{formatMillimes(product.priceMillimes)}
                    </Text>

                    {qty > 0 ? (
                      /* Stepper compact quand l'article est déjà au panier */
                      <View style={styles.cartStepper}>
                        <Pressable
                          style={styles.cartStepperBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleMinus(product);
                          }}
                          hitSlop={6}
                        >
                          <Ionicons name="remove" size={14} color="#FFFFFF" />
                        </Pressable>
                        <Text style={styles.cartStepperQty}>{qty}</Text>
                        <Pressable
                          style={styles.cartStepperBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleAdd(product);
                          }}
                          hitSlop={6}
                        >
                          <Ionicons name="add" size={14} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    ) : (
                      /* Bouton rapide + */
                      <Pressable
                        style={({ pressed }) => [
                          styles.quickAddButton,
                          pressed && { transform: [{ scale: 0.92 }] },
                        ]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleAdd(product);
                        }}
                        hitSlop={8}
                        accessibilityLabel={`Ajouter ${product.name} au panier`}
                      >
                        <Ionicons name="add" size={18} color="#FFFFFF" />
                      </Pressable>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating Bottom Bar (Sticky Cart CTA) */}
      {totalItemsCount > 0 ? (
        <View style={styles.bottomBarContainer}>
          <Pressable
            style={({ pressed }) => [styles.bottomBarButton, pressed && { opacity: 0.92 }]}
            onPress={() => router.push('/cart')}
          >
            <View style={styles.bottomBarLeft}>
              <View style={styles.bottomBarBadge}>
                <Text style={styles.bottomBarBadgeText}>{totalItemsCount}</Text>
              </View>
              <Text style={styles.bottomBarText}>Voir le panier</Text>
            </View>
            <View style={styles.bottomBarRight}>
              <Text style={styles.bottomBarTotal}>{formatMillimes(subtotalMillimes)}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemePalette) {
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 0,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  expressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161012',
    borderWidth: 1,
    borderColor: '#3D1B1E',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  expressBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  expressBannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  expressBannerContent: {
    flex: 1,
  },
  expressBannerTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  expressBannerTag: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.8,
  },
  expressDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textSecondary,
  },
  expressTimerText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  expressBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  expressBannerText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  expressBadgeFee: {
    backgroundColor: '#241416',
    borderWidth: 1,
    borderColor: '#4A1E22',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expressBadgeFeeVal: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  expressBadgeFeeCur: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textSecondary,
    marginTop: -1,
  },
  categoriesRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 14,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  resetButton: {
    marginTop: 16,
    backgroundColor: colors.elevated,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
  },
  productCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 120,
    backgroundColor: colors.secondary,
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  productContent: {
    padding: 10,
  },
  productName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 17,
    minHeight: 34,
  },
  productUnit: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  quickAddButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 15,
    paddingHorizontal: 4,
    height: 28,
    gap: 6,
  },
  cartStepperBtn: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartStepperQty: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomBarContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  bottomBarButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  bottomBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bottomBarBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBarBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  bottomBarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  bottomBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomBarTotal: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
}
