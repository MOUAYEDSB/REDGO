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
import { useCart } from '../../context/CartContext';
import { useRedgoAuth } from '../../context/RedgoAuthContext';
import { formatMillimes } from '../../services/cart';
import {
  CatalogBusiness,
  fetchPopularHomeItems,
  fetchProductVariants,
  fetchRestaurants,
  HomeFeaturedProduct,
} from '../../services/catalog';
import {
  FALLBACK_PROMOS,
  fetchPromoAnnouncements,
  PromoAnnouncement,
} from '../../services/promos';

const primaryServices = [
  {
    title: 'SCOOTER TAXI',
    subtitle: 'Déplacement express 1 place',
    action: 'Commander une course',
    icon: 'bicycle-outline' as const,
    route: '/booking/pickup',
    background: '#351417',
    tag: "M'Saken & Messaadine",
  },
  {
    title: 'REDGO FOOD',
    subtitle: 'Plats chauds & restaurants',
    action: 'Commander à manger',
    icon: 'restaurant-outline' as const,
    route: '/food',
    background: '#342118',
    tag: 'Menus variés',
  },
  {
    title: 'COURSES REDGO',
    subtitle: 'Alimentation, boissons, pharmacie',
    action: 'Faire mes courses',
    icon: 'basket-outline' as const,
    route: '/market',
    background: '#1A2922',
    tag: 'Prix fixes',
  },
];

const categories = [
  ['basket-outline', 'Courses', '/market'],
  ['pizza-outline', 'Pizzas', '/food'],
  ['fast-food-outline', 'Burgers', '/food'],
  ['restaurant-outline', 'Tunisien', '/food'],
  ['medkit-outline', 'Pharmacie', '/market'],
  ['cafe-outline', 'Boissons', '/market'],
];

const FALLBACK_POPULAR_PRODUCTS: HomeFeaturedProduct[] = [
  {
    id: 'margherita',
    type: 'food' as const,
    businessId: 'karma',
    businessName: 'Karma Kitchen',
    name: 'Pizza Margherita Di Bufala',
    priceMillimes: 14500,
    shop: 'Karma Kitchen',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=700',
  },
  {
    id: 'eau-minerale-pack',
    type: 'courses' as const,
    businessId: 'courses_hub_msaken',
    businessName: 'Courses REDGO',
    name: 'Pack Eau Safia (6x1.5L)',
    priceMillimes: 5200,
    shop: 'Courses REDGO · Prix fixe',
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=700',
  },
  {
    id: 'burger-special',
    type: 'food' as const,
    businessId: 'karma',
    businessName: 'Karma Kitchen',
    name: 'Smash Burger REDGO',
    priceMillimes: 16800,
    shop: 'Karma Kitchen',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=700',
  },
];

export default function Home() {
  const { profile, user } = useRedgoAuth();
  const { addProduct } = useCart();

  const [dbProducts, setDbProducts] = useState<HomeFeaturedProduct[]>([]);
  const [dbRestaurants, setDbRestaurants] = useState<CatalogBusiness[]>([]);
  const [promos, setPromos] = useState<PromoAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Nom dynamique utilisateur
  const userGreeting = useMemo(() => {
    if (profile?.full_name?.trim()) {
      return `Bonjour, ${profile.full_name.trim().split(' ')[0]}`;
    }
    if (user?.user_metadata?.full_name?.trim()) {
      return `Bonjour, ${(user.user_metadata.full_name as string).trim().split(' ')[0]}`;
    }
    return 'Bienvenue sur REDGO';
  }, [profile, user]);

  const userInitial = useMemo(() => {
    if (profile?.full_name?.trim()) {
      return profile.full_name.trim().charAt(0).toUpperCase();
    }
    if (user?.user_metadata?.full_name?.trim()) {
      return (user.user_metadata.full_name as string).trim().charAt(0).toUpperCase();
    }
    return 'R';
  }, [profile, user]);

  // Chargement des données réelles depuis Supabase
  const loadHomeData = useCallback(async () => {
    const [productsData, restaurantsData, promosData] = await Promise.all([
      fetchPopularHomeItems(),
      fetchRestaurants(),
      fetchPromoAnnouncements(),
    ]);
    setDbProducts(productsData);
    setDbRestaurants(restaurantsData);
    setPromos(promosData.length > 0 ? promosData : FALLBACK_PROMOS);
    setIsLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadHomeData();
  }, [loadHomeData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadHomeData();
  }, [loadHomeData]);

  const products = useMemo(() => {
    if (dbProducts.length > 0) return dbProducts;
    return FALLBACK_POPULAR_PRODUCTS;
  }, [dbProducts]);

  const handleQuickAdd = async (product: HomeFeaturedProduct) => {
    try {
      const vars = await fetchProductVariants(product.id);
      if (vars.length > 0) {
        const firstVariant = vars[0];
        addProduct({
          productId: product.id,
          variantId: firstVariant.id,
          variantName: firstVariant.name,
          productType: product.type,
          businessId: product.businessId,
          businessName: product.businessName,
          productName: product.name,
          productImage: product.image,
          unitPriceMillimes: firstVariant.priceMillimes,
          quantity: 1,
        });
        return;
      }
    } catch {}
    addProduct({
      productId: product.id,
      productType: product.type,
      businessId: product.businessId,
      businessName: product.businessName,
      productName: product.name,
      productImage: product.image,
      unitPriceMillimes: product.priceMillimes,
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.identity}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            contentFit="cover"
          />
          <View>
            <Text style={styles.brand}>REDGO</Text>
            <Text style={styles.greeting}>{userGreeting}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <CartBadge />
          <Pressable
            style={styles.iconButton}
            onPress={() => router.push('/(tabs)/notifications')}
          >
            <Ionicons name="notifications-outline" size={21} color={colors.text} />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>2</Text>
            </View>
          </Pressable>
          <Pressable
            style={styles.avatar}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.avatarText}>{userInitial}</Text>
          </Pressable>
        </View>
      </View>

      {/* Location Bar */}
      <Pressable style={styles.location} onPress={() => router.push('/booking/map')}>
        <Ionicons name="location" size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.locationLabel}>Zone de service couverte</Text>
          <Text style={styles.locationText}>M'Saken & Messaadine, Tunisie</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </Pressable>

      {/* Annonces Promotionnelles */}
      {promos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bannerTrack}
        >
          {promos.map((promo) => (
            <Pressable
              key={promo.id}
              style={({ pressed }) => [styles.banner, pressed && { opacity: 0.88 }]}
              onPress={() => router.push(promo.targetRoute as any)}
            >
              <Image
                source={{ uri: promo.imageUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
              <View style={styles.bannerOverlay} />
              <View style={styles.bannerCopy}>
                {promo.badgeText ? (
                  <Text style={styles.bannerLabel}>{promo.badgeText}</Text>
                ) : null}
                <Text
                  style={[
                    styles.bannerTitle,
                    promo.titleAr ? { textAlign: 'right' } : undefined,
                  ]}
                >
                  {promo.titleAr ?? promo.title}
                </Text>
                {(promo.subtitleAr ?? promo.subtitle) ? (
                  <Text
                    style={[
                      styles.bannerSubtitle,
                      promo.subtitleAr ? { textAlign: 'right' } : undefined,
                    ]}
                  >
                    {promo.subtitleAr ?? promo.subtitle}
                  </Text>
                ) : null}
                <Pressable
                  style={styles.bannerCta}
                  onPress={() => router.push(promo.targetRoute as any)}
                >
                  <Text style={styles.bannerCtaText}>
                    {promo.ctaTextAr ?? promo.ctaText ?? 'Découvrir'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* 3 Core Services */}
      <Text style={styles.sectionTitle}>Nos 3 Services Dédiés</Text>
      <View style={styles.servicesGrid}>
        {primaryServices.map((service) => (
          <Pressable
            key={service.title}
            style={[styles.serviceCard, { backgroundColor: service.background }]}
            onPress={() => router.push(service.route as any)}
          >
            <View style={styles.serviceTop}>
              <View style={styles.serviceIcon}>
                <Ionicons name={service.icon} size={24} color="#FFFFFF" />
              </View>
              <View style={styles.serviceTagBadge}>
                <Text style={styles.serviceTagText}>{service.tag}</Text>
              </View>
            </View>

            <View>
              <Text style={styles.serviceName}>{service.title}</Text>
              <Text style={styles.serviceSubtitle}>{service.subtitle}</Text>
            </View>

            <View style={styles.serviceAction}>
              <Text style={styles.serviceActionText}>{service.action}</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
        ))}
      </View>

      {/* Catégories populaires */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitleInline}>Catégories populaires</Text>
          <Text style={styles.sectionSubtitle}>À M'Saken et Messaadine</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      >
        {categories.map(([icon, label, route]) => (
          <Pressable
            key={label}
            style={styles.category}
            onPress={() => router.push(route as any)}
          >
            <View style={styles.categoryIcon}>
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={23}
                color={colors.primary}
              />
            </View>
            <Text style={styles.categoryText}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* RESTAURANTS PARTENAIRES EN DIRECT */}
      {dbRestaurants.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitleInline}>Restaurants partenaires</Text>
              <Text style={styles.sectionSubtitle}>
                {dbRestaurants.length} restaurant{dbRestaurants.length > 1 ? 's' : ''} ouverts à M'Saken
              </Text>
            </View>
            <Pressable onPress={() => router.push('/food')}>
              <Text style={styles.seeAll}>Voir tout ({dbRestaurants.length})</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.restaurantsTrack}
          >
            {dbRestaurants.map((resto) => (
              <Pressable
                key={resto.id}
                style={({ pressed }) => [
                  styles.restaurantHomeCard,
                  pressed && { borderColor: colors.primary },
                ]}
                onPress={() => router.push(`/food/restaurant/${resto.id}`)}
              >
                <Image
                  source={{
                    uri:
                      resto.coverImageUrl ||
                      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600',
                  }}
                  style={styles.restaurantHomeImage}
                  contentFit="cover"
                />
                <View style={styles.restaurantHomeBody}>
                  <Text style={styles.restaurantHomeName} numberOfLines={1}>
                    {resto.name}
                  </Text>
                  <Text style={styles.restaurantHomeFood} numberOfLines={1}>
                    {resto.description || 'Restaurant partenaire REDGO'}
                  </Text>
                  <View style={styles.restaurantHomeMeta}>
                    <View style={styles.restaurantHomeBadge}>
                      <Ionicons name="time-outline" size={11} color={colors.success} />
                      <Text style={styles.restaurantHomeBadgeText}>20–35 min</Text>
                    </View>
                    <View style={styles.restaurantHomeBadge}>
                      <Ionicons name="bicycle-outline" size={11} color={colors.primary} />
                      <Text style={styles.restaurantHomeBadgeText}>2.500 DT</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {/* SÉLECTION DU MOMENT (Plats & Courses Réels) */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitleInline}>Sélection du moment</Text>
          <Text style={styles.sectionSubtitle}>
            {isLoading ? 'Synchronisation…' : 'Ajoutez en 1 clic à votre panier partagé'}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/market')}>
          <Text style={styles.seeAll}>Faire mes courses</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement des produits…</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.products}
        >
          {products.map((product) => (
            <Pressable
              key={product.id}
              style={({ pressed }) => [
                styles.productCard,
                pressed && { borderColor: colors.primary },
              ]}
              onPress={() =>
                router.push(
                  product.type === 'food'
                    ? `/food/product/${product.id}`
                    : `/market/product/${product.id}`
                )
              }
            >
              <Image
                source={{ uri: product.image }}
                style={styles.productImage}
                contentFit="cover"
              />
              <View style={styles.productBody}>
                <Text style={styles.productName} numberOfLines={1}>
                  {product.name}
                </Text>
                <Text style={styles.productShop} numberOfLines={1}>
                  {product.shop}
                </Text>
                <View style={styles.productFooter}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productPrice}>
                      {formatMillimes(product.priceMillimes)}
                    </Text>
                    {product.defaultVariantName ? (
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginTop: 1 }}>
                        {product.defaultVariantName}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.quickAdd,
                      pressed && { transform: [{ scale: 0.9 }] },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleQuickAdd(product);
                    }}
                    hitSlop={8}
                    accessibilityLabel={`Ajouter ${product.name}`}
                  >
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#000',
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 24,
  },
  brand: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    position: 'absolute',
    right: 4,
    top: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#3A3A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 16,
  },
  location: {
    marginHorizontal: 20,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#181820',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D2D3D',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  locationLabel: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  locationText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  bannerTrack: {
    paddingLeft: 20,
    paddingRight: 20,
  },
  banner: {
    width: 350,
    height: 175,
    borderRadius: 22,
    overflow: 'hidden',
    marginTop: 18,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(9,9,11,0.68)',
  },
  bannerCopy: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
  },
  bannerLabel: {
    color: '#FFB3BA',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    marginTop: 6,
  },
  bannerSubtitle: {
    color: '#D4D4D8',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  bannerCta: {
    alignSelf: 'flex-start',
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    justifyContent: 'center',
    marginTop: 12,
  },
  bannerCtaText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginHorizontal: 20,
    marginTop: 26,
    marginBottom: 14,
  },
  servicesGrid: {
    paddingHorizontal: 20,
    gap: 12,
  },
  serviceCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  serviceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTagBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  serviceTagText: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '700',
  },
  serviceName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  serviceSubtitle: {
    color: '#E4E4E7',
    fontSize: 12,
    marginTop: 3,
  },
  serviceAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  serviceActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginHorizontal: 20,
    marginTop: 26,
    marginBottom: 14,
  },
  sectionTitleInline: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  seeAll: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  categories: {
    gap: 12,
    paddingHorizontal: 20,
  },
  category: {
    width: 74,
    alignItems: 'center',
  },
  categoryIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  /* Restaurants Track */
  restaurantsTrack: {
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  restaurantHomeCard: {
    width: 240,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#181822',
    borderWidth: 1,
    borderColor: '#2D2D3D',
  },
  restaurantHomeImage: {
    width: '100%',
    height: 125,
    backgroundColor: '#121218',
  },
  restaurantHomeBody: {
    padding: 12,
  },
  restaurantHomeName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  restaurantHomeFood: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  restaurantHomeMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  restaurantHomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#121218',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  restaurantHomeBadgeText: {
    color: '#D4D4D8',
    fontSize: 10,
    fontWeight: '700',
  },
  /* Products Track */
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  products: {
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  productCard: {
    width: 190,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#121218',
  },
  productBody: {
    padding: 12,
  },
  productName: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 13,
  },
  productShop: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  productPrice: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 14,
  },
  quickAdd: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});