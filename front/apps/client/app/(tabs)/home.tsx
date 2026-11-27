import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
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
import { useTheme } from '../../context/ThemeContext';
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
import { supabase } from '../../services/supabase';

const primaryServices = [
  {
    title: 'SCOOTER TAXI',
    subtitle: 'Se déplacer ou envoyer un colis',
    action: 'Commander une course',
    icon: 'bicycle-outline' as const,
    route: '/booking/pickup',
    background: '#351417',
    tag: "M'Saken & Messaadine",
    image: require('../../assets/services/service-scooter.jpg'),
    featured: true,
  },
  {
    title: 'REDGO FOOD',
    subtitle: 'Plats chauds & restaurants',
    action: 'Commander à manger',
    icon: 'restaurant-outline' as const,
    route: '/food',
    background: '#342118',
    tag: 'Menus variés',
    image: require('../../assets/services/service-food.jpg'),
    featured: false,
  },
  {
    title: 'COURSES REDGO',
    subtitle: 'Alimentation, boissons, pharmacie',
    action: 'Faire mes courses',
    icon: 'basket-outline' as const,
    route: '/market',
    background: '#1A2922',
    tag: 'Prix fixes',
    image: require('../../assets/services/service-courses.jpg'),
    featured: false,
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

export default function Home() {
  const { profile, user } = useRedgoAuth();
  const { addProduct } = useCart();
  const { palette, isDark } = useTheme();

  const [dbProducts, setDbProducts] = useState<HomeFeaturedProduct[]>([]);
  const [dbRestaurants, setDbRestaurants] = useState<CatalogBusiness[]>([]);
  const [promos, setPromos] = useState<PromoAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeOrder, setActiveOrder] = useState<{ id: string; reference: string } | null>(null);
  const [activeRide, setActiveRide] = useState<{ id: string; reference: string; status: string } | null>(null);

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

  const loadActiveTracking = useCallback(async () => {
    if (!supabase || !user?.id) {
      setActiveOrder(null);
      setActiveRide(null);
      return;
    }
    try {
      const [ordRes, rideRes] = await Promise.all([
        (supabase as any)
          .from('delivery_orders')
          .select('id, reference')
          .eq('customer_id', user.id)
          .not('status', 'in', '("delivered","cash_collected","cancelled")')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from('scooter_rides')
          .select('id, reference, status')
          .eq('customer_id', user.id)
          .not('status', 'in', '("ride_completed","cancelled")')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setActiveOrder(ordRes.data ?? null);
      setActiveRide(rideRes.data ?? null);
    } catch {
      // Ignorer
    }
  }, [user?.id]);

  useEffect(() => {
    void loadHomeData();
  }, [loadHomeData]);

  useFocusEffect(
    useCallback(() => {
      void loadActiveTracking();
    }, [loadActiveTracking]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadHomeData();
    void loadActiveTracking();
  }, [loadHomeData, loadActiveTracking]);

  const products = dbProducts;

  const handleQuickAdd = async (product: HomeFeaturedProduct) => {
    // Si le produit a des variantes, obliger le client à choisir la variante sur la page produit
    if (product.hasVariants) {
      router.push(
        product.type === 'food'
          ? `/food/product/${product.id}?restaurant=${product.businessId}`
          : `/market/product/${product.id}`
      );
      return;
    }
    try {
      const vars = await fetchProductVariants(product.id);
      if (vars.length > 0) {
        router.push(
          product.type === 'food'
            ? `/food/product/${product.id}?restaurant=${product.businessId}`
            : `/market/product/${product.id}`
        );
        return;
      }
    } catch { }
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
            source={isDark ? require('../../assets/logo-dark.png') : require('../../assets/logo-light.png')}
            style={styles.logoImage}
            contentFit="contain"
          />
          <View>
            <Text style={[styles.brand, { color: palette.text }]}>REDGO</Text>
            <Text style={[styles.greeting, { color: palette.textSecondary }]}>{userGreeting}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <CartBadge />
          <Pressable
            style={[styles.iconButton, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={() => router.push('/(tabs)/notifications')}
          >
            <Ionicons name="notifications-outline" size={21} color={palette.text} />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>2</Text>
            </View>
          </Pressable>
          <Pressable
            style={[styles.avatar, { overflow: 'hidden' }]}
            onPress={() => router.push('/(tabs)/profile')}
          >
            {profile?.avatar_path ? (
              <Image source={{ uri: profile.avatar_path }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{userInitial}</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Location Bar */}
      <Pressable
        style={[styles.location, { backgroundColor: palette.card, borderColor: palette.border }]}
        onPress={() => router.push('/booking/map')}
      >
        <Ionicons name="location" size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.locationLabel, { color: palette.textSecondary }]}>Zone de service couverte</Text>
          <Text style={[styles.locationText, { color: palette.text }]}>M'Saken & Messaadine, Tunisie</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={palette.textSecondary} />
      </Pressable>

      {/* Live Active Order / Ride Banner */}
      {activeOrder ? (
        <Pressable
          style={[
            styles.activeTrackingBanner,
            { borderColor: 'rgba(255, 32, 42, 0.55)', backgroundColor: 'rgba(255, 32, 42, 0.10)' },
          ]}
          onPress={() => router.push({ pathname: '/order/[id]', params: { id: activeOrder.id, reference: activeOrder.reference } })}
        >
          <Ionicons name="receipt" size={15} color={colors.primary} />
          <Text style={[styles.activeTrackingText, { color: palette.text }]} numberOfLines={1}>
            <Text style={[styles.activeTrackingBadge, { color: colors.primary }]}>Commande en cours · </Text>
            Suivre {activeOrder.reference}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      ) : null}

      {activeRide ? (
        <Pressable
          style={[
            styles.activeTrackingBanner,
            { borderColor: 'rgba(34, 197, 94, 0.55)', backgroundColor: 'rgba(34, 197, 94, 0.10)' },
          ]}
          onPress={() =>
            router.push({
              pathname: activeRide.status === 'searching' ? '/booking/searching' : `/ride/tracking/${activeRide.id}`,
              params: { id: activeRide.id, reference: activeRide.reference },
            })
          }
        >
          <Ionicons name="bicycle" size={15} color={colors.success} />
          <Text style={[styles.activeTrackingText, { color: palette.text }]} numberOfLines={1}>
            <Text style={[styles.activeTrackingBadge, { color: colors.success }]}>Course en cours · </Text>
            Suivre {activeRide.reference}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.success} />
        </Pressable>
      ) : null}

      {/* Annonces Promotionnelles */}
      {promos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bannerTrack}
        >
          {promos.map((promo) => {
            const isRtl = Boolean(promo.titleAr || promo.subtitleAr);
            return (
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
                  <View>
                    {promo.badgeText ? (
                      <Text style={[styles.bannerLabel, isRtl && { textAlign: 'right' }]} numberOfLines={1}>
                        {promo.badgeText}
                      </Text>
                    ) : null}
                    <Text
                      style={[
                        styles.bannerTitle,
                        promo.titleAr ? { textAlign: 'right' } : undefined,
                      ]}
                      numberOfLines={2}
                    >
                      {promo.titleAr ?? promo.title}
                    </Text>
                    {(promo.subtitleAr ?? promo.subtitle) ? (
                      <Text
                        style={[
                          styles.bannerSubtitle,
                          promo.subtitleAr ? { textAlign: 'right' } : undefined,
                        ]}
                        numberOfLines={2}
                      >
                        {promo.subtitleAr ?? promo.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={[styles.bannerCta, isRtl && { alignSelf: 'flex-end' }]}
                    onPress={() => router.push(promo.targetRoute as any)}
                  >
                    <Text style={styles.bannerCtaText}>
                      {promo.ctaTextAr ?? promo.ctaText ?? 'Découvrir'}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {/* 3 Core Services */}
      <Text style={[styles.sectionTitle, { color: palette.text }]}>Nos 3 Services Dédiés</Text>
      <View style={styles.servicesGrid}>
        {primaryServices.map((service) => (
          <Pressable
            key={service.title}
            style={({ pressed }) => [
              styles.serviceCard,
              service.featured && styles.serviceCardFeatured,
              { backgroundColor: service.background },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => router.push(service.route as any)}
          >
            <Image
              source={service.image}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition={service.featured ? { left: '35%', top: '50%' } : 'center'}
            />
            <View
              style={[
                styles.serviceOverlay,
                service.featured && styles.serviceOverlayLight,
              ]}
            />
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
          <Text style={[styles.sectionTitleInline, { color: palette.text }]}>Catégories populaires</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.textSecondary }]}>À M'Saken et Messaadine</Text>
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
              <Text style={[styles.sectionTitleInline, { color: palette.text }]}>Restaurants partenaires</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.textSecondary }]}>
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
                  { backgroundColor: palette.card, borderColor: palette.border },
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
                  <Text style={[styles.restaurantHomeName, { color: palette.text }]} numberOfLines={1}>
                    {resto.name}
                  </Text>
                  <Text style={[styles.restaurantHomeFood, { color: palette.textSecondary }]} numberOfLines={1}>
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

      {/* SÉLECTION DU MOMENT (Plats & Courses Réels) - Affiché uniquement si produits réels disponibles */}
      {isLoading || products.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitleInline, { color: palette.text }]}>Sélection du moment</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.textSecondary }]}>
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
                    { backgroundColor: palette.card, borderColor: palette.border },
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
                    <Text style={[styles.productName, { color: palette.text }]} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text style={[styles.productShop, { color: palette.textSecondary }]} numberOfLines={1}>
                      {product.shop}
                    </Text>
                    <View style={styles.productFooter}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          {product.hasVariants ? (
                            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary }}>
                              À partir de
                            </Text>
                          ) : null}
                          <Text style={styles.productPrice}>
                            {formatMillimes(product.priceMillimes)}
                          </Text>
                        </View>
                        {product.defaultVariantName ? (
                          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginTop: 1 }}>
                            {product.defaultVariantName}
                          </Text>
                        ) : product.hasVariants ? (
                          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, marginTop: 1 }}>
                            Choix requis
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
        </>
      ) : null}
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
    width: 48,
    height: 36,
    backgroundColor: 'transparent',
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
  activeTrackingBanner: {
    marginHorizontal: 20,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  activeTrackingText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  activeTrackingBadge: {
    fontSize: 11,
    fontWeight: '900',
  },
  bannerTrack: {
    paddingLeft: 20,
    paddingRight: 20,
    gap: 10,
  },
  banner: {
    width: 300,
    minHeight: 144,
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 12,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(9,9,11,0.68)',
  },
  bannerCopy: {
    padding: 13,
    flex: 1,
    justifyContent: 'space-between',
    gap: 6,
  },
  bannerLabel: {
    color: '#FFB3BA',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    marginTop: 3,
  },
  bannerSubtitle: {
    color: '#D4D4D8',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  bannerCta: {
    alignSelf: 'flex-start',
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 13,
    justifyContent: 'center',
  },
  bannerCtaText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 146,
    justifyContent: 'space-between',
  },
  serviceCardFeatured: {
    minHeight: 196,
    borderColor: 'rgba(255, 32, 42, 0.35)',
  },
  serviceOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(9, 9, 9, 0.42)',
  },
  serviceOverlayLight: {
    backgroundColor: 'rgba(9, 9, 9, 0.24)',
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