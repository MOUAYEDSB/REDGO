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
import { CartBadge } from '../../components/CartBadge';
import { getCategoryIconImage } from '../../components/FoodCategoryNeonIcon';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { useCart } from '../../context/CartContext';
import { formatMillimes } from '../../services/cart';
import {
  CatalogBusinessWithCategories,
  CatalogProduct,
  fetchAllActiveFoodDishes,
  fetchCoursesProducts,
  fetchProductVariants,
  fetchRestaurantsWithCategories,
} from '../../services/catalog';
import {
  FALLBACK_PROMOS,
  fetchPromoAnnouncements,
  PromoAnnouncement,
} from '../../services/promos';

type ExploreTab = 'all' | 'restaurants' | 'food' | 'market';

const UNIVERSE_TABS: { id: ExploreTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all', label: 'Tout', icon: 'apps-outline' },
  { id: 'restaurants', label: 'Restaurants', icon: 'restaurant-outline' },
  { id: 'food', label: 'Plats', icon: 'fast-food-outline' },
  { id: 'market', label: 'Courses', icon: 'basket-outline' },
];

const QUICK_SERVICES = [
  {
    id: 'taxi',
    title: 'Scooter Taxi',
    subtitle: 'Trajet express',
    icon: 'bicycle-outline' as const,
    route: '/booking/pickup',
    accent: colors.primary,
  },
  {
    id: 'food',
    title: 'REDGO Food',
    subtitle: 'Restos & menus',
    icon: 'restaurant-outline' as const,
    route: '/food',
    accent: colors.warning,
  },
  {
    id: 'market',
    title: 'Courses',
    subtitle: 'Prix fixes',
    icon: 'basket-outline' as const,
    route: '/market',
    accent: colors.success,
  },
  {
    id: 'orders',
    title: 'Commandes',
    subtitle: 'Suivi en direct',
    icon: 'receipt-outline' as const,
    route: '/(tabs)/orders',
    accent: colors.textSecondary,
  },
];

const POPULAR_FOOD_CATEGORIES = [
  { id: 'all', label: 'Tous' },
  { id: 'pizzas', label: 'Pizzas' },
  { id: 'ma9loub', label: 'Makloub' },
  { id: 'burgers', label: 'Burgers' },
  { id: 'tacos', label: 'Tacos' },
  { id: 'chappati', label: 'Chapati' },
  { id: 'baquette-farcie', label: 'Baguette farcie' },
  { id: 'plats-tunisiens', label: 'Plats Tunisiens' },
  { id: 'desserts', label: 'Desserts' },
  { id: 'boissons-eaux', label: 'Boissons' },
];

function matchesFoodCategory(dish: CatalogProduct, catId: string): boolean {
  if (catId === 'all') return true;
  const cat = (dish.category || '').toLowerCase();
  const name = (dish.name || '').toLowerCase();

  switch (catId) {
    case 'pizzas':
      return cat.includes('pizza') || name.includes('pizza');
    case 'ma9loub':
      return cat.includes('makloub') || cat.includes('ma9loub') || name.includes('makloub');
    case 'burgers':
      return cat.includes('burger') || name.includes('burger');
    case 'tacos':
      return cat.includes('tacos') || name.includes('tacos');
    case 'chappati':
      return cat.includes('chapati') || cat.includes('chappati') || name.includes('chapati');
    case 'baquette-farcie':
      return cat.includes('baguette') || cat.includes('baquette') || name.includes('baguette');
    case 'plats-tunisiens':
      return (
        cat.includes('plat') ||
        cat.includes('grillade') ||
        cat.includes('tunisien') ||
        name.includes('escalope')
      );
    case 'desserts':
      return cat.includes('dessert') || cat.includes('sucre') || cat.includes('sucré');
    case 'boissons-eaux':
      return cat.includes('boisson') || cat.includes('eau') || cat.includes('jus');
    default:
      return true;
  }
}

export default function Explore() {
  const { addProduct } = useCart();

  const [restaurants, setRestaurants] = useState<CatalogBusinessWithCategories[]>([]);
  const [foodDishes, setFoodDishes] = useState<CatalogProduct[]>([]);
  const [marketProducts, setMarketProducts] = useState<CatalogProduct[]>([]);
  const [promos, setPromos] = useState<PromoAnnouncement[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ExploreTab>('all');
  const [selectedFoodCategory, setSelectedFoodCategory] = useState('all');

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const loadExploreData = useCallback(async () => {
    try {
      const [restosData, dishesData, coursesData, promosData] = await Promise.all([
        fetchRestaurantsWithCategories(),
        fetchAllActiveFoodDishes(),
        fetchCoursesProducts(),
        fetchPromoAnnouncements(),
      ]);

      setRestaurants(restosData);
      setFoodDishes(dishesData);
      setMarketProducts(coursesData);
      setPromos(promosData.length > 0 ? promosData : FALLBACK_PROMOS);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadExploreData();
  }, [loadExploreData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadExploreData();
  }, [loadExploreData]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredRestaurants = useMemo(() => {
    if (!normalizedQuery) return restaurants;
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(normalizedQuery) ||
        (r.description || '').toLowerCase().includes(normalizedQuery) ||
        (r.address || '').toLowerCase().includes(normalizedQuery) ||
        r.categoryNames.some((c: string) => c.toLowerCase().includes(normalizedQuery))
    );
  }, [restaurants, normalizedQuery]);

  const filteredFoodDishes = useMemo(() => {
    return foodDishes.filter((d) => {
      const matchesCat = matchesFoodCategory(d, selectedFoodCategory);
      if (!matchesCat) return false;
      if (!normalizedQuery) return true;
      return (
        d.name.toLowerCase().includes(normalizedQuery) ||
        (d.description || '').toLowerCase().includes(normalizedQuery) ||
        (d.category || '').toLowerCase().includes(normalizedQuery) ||
        (d.businessName || '').toLowerCase().includes(normalizedQuery)
      );
    });
  }, [foodDishes, selectedFoodCategory, normalizedQuery]);

  const filteredMarketProducts = useMemo(() => {
    if (!normalizedQuery) return marketProducts;
    return marketProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(normalizedQuery) ||
        (p.description || '').toLowerCase().includes(normalizedQuery) ||
        (p.category || '').toLowerCase().includes(normalizedQuery)
    );
  }, [marketProducts, normalizedQuery]);

  const handleQuickAdd = async (product: CatalogProduct, type: 'food' | 'courses') => {
    if (product.hasVariants) {
      router.push(
        type === 'food'
          ? (`/food/product/${product.id}?restaurant=${product.businessId}` as never)
          : (`/market/product/${product.id}` as never)
      );
      return;
    }

    setAddingId(product.id);
    try {
      const variants = await fetchProductVariants(product.id);
      if (variants.length > 0) {
        router.push(
          type === 'food'
            ? (`/food/product/${product.id}?restaurant=${product.businessId}` as never)
            : (`/market/product/${product.id}` as never)
        );
        return;
      }

      addProduct({
        productId: product.id,
        productType: type,
        businessId: product.businessId,
        businessName: product.businessName || (type === 'food' ? 'Restaurant REDGO' : 'Courses REDGO'),
        productName: product.name,
        productImage: product.imageUrl || '',
        unitPriceMillimes: product.priceMillimes,
        quantity: 1,
      });
    } finally {
      setAddingId(null);
    }
  };

  const showRestaurants = activeTab === 'all' || activeTab === 'restaurants';
  const showFood = activeTab === 'all' || activeTab === 'food';
  const showMarket =
    (activeTab === 'all' || activeTab === 'market') && selectedFoodCategory === 'all';

  const hasNoResults =
    !isLoading &&
    (showRestaurants ? filteredRestaurants.length === 0 : true) &&
    (showFood ? filteredFoodDishes.length === 0 : true) &&
    (showMarket ? filteredMarketProducts.length === 0 : true);

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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Explorer</Text>
          <Text style={styles.subtitle}>M'Saken & Messaadine · Tout en direct</Text>
        </View>
        <CartBadge />
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={19} color={colors.textSecondary} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Restaurants, plats, produits, courses..."
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchQuery.length > 0 ? (
          <Pressable
            onPress={() => setSearchQuery('')}
            hitSlop={10}
            accessibilityLabel="Effacer la recherche"
          >
            <Ionicons name="close-circle" size={19} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {/* Universe Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {UNIVERSE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabChip, isActive && styles.tabChipActive]}
            >
              <Ionicons
                name={tab.icon}
                size={15}
                color={isActive ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.tabChipText, isActive && styles.tabChipTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Quick Services (visible when viewing all & not searching) */}
      {activeTab === 'all' && !normalizedQuery && selectedFoodCategory === 'all' ? (
        <View style={styles.servicesGrid}>
          {QUICK_SERVICES.map((service) => (
            <Pressable
              key={service.id}
              onPress={() => router.push(service.route as never)}
              style={({ pressed }) => [styles.serviceCard, pressed && styles.pressed]}
            >
              <View style={[styles.serviceIconBox, { borderColor: service.accent }]}>
                <Ionicons name={service.icon} size={20} color={service.accent} />
              </View>
              <View style={styles.serviceMeta}>
                <Text style={styles.serviceTitle} numberOfLines={1}>
                  {service.title}
                </Text>
                <Text style={styles.serviceSub} numberOfLines={1}>
                  {service.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Dynamic Promos Carousel */}
      {activeTab === 'all' && !normalizedQuery && promos.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Offres du moment</Text>
            <Text style={styles.sectionCount}>{promos.length} actives</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.promosRow}
          >
            {promos.map((promo) => (
              <Pressable
                key={promo.id}
                onPress={() => router.push((promo.targetRoute || '/food') as never)}
                style={({ pressed }) => [styles.promoCard, pressed && styles.pressed]}
              >
                <Image
                  source={{ uri: promo.imageUrl }}
                  style={styles.promoImage}
                  contentFit="cover"
                />
                <View style={styles.promoOverlay} />
                <View style={styles.promoContent}>
                  <View style={styles.promoBadge}>
                    <Text style={styles.promoBadgeText} numberOfLines={1}>
                      {promo.badgeText}
                    </Text>
                  </View>
                  <Text style={styles.promoTitle} numberOfLines={1}>
                    {promo.title}
                  </Text>
                  <Text style={styles.promoSub} numberOfLines={2}>
                    {promo.subtitle}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Food Categories Strip */}
      {showFood ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Catégories Food</Text>
            <Pressable onPress={() => router.push('/food' as never)}>
              <Text style={styles.sectionAction}>Tout voir</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.foodCatsRow}
          >
            {POPULAR_FOOD_CATEGORIES.map((cat) => {
              const isSelected = selectedFoodCategory === cat.id;
              const iconImg = cat.id !== 'all' ? getCategoryIconImage(cat.id) : null;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedFoodCategory(cat.id)}
                  style={[styles.foodCatPill, isSelected && styles.foodCatPillActive]}
                >
                  {iconImg ? (
                    <Image source={iconImg as any} style={styles.foodCatImg} contentFit="cover" />
                  ) : (
                    <View style={styles.foodCatAllIcon}>
                      <Ionicons
                        name="grid-outline"
                        size={14}
                        color={isSelected ? colors.primary : colors.text}
                      />
                    </View>
                  )}
                  <Text
                    style={[styles.foodCatText, isSelected && styles.foodCatTextActive]}
                    numberOfLines={1}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Loading State */}
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement du catalogue en direct…</Text>
        </View>
      ) : null}

      {/* Empty Search / Filter State */}
      {hasNoResults ? (
        <View style={styles.emptyCard}>
          <Ionicons name="search-outline" size={34} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>Aucun résultat trouvé</Text>
          <Text style={styles.emptySub}>
            Essayez un autre mot-clé ou réinitialisez les filtres.
          </Text>
          <Pressable
            onPress={() => {
              setSearchQuery('');
              setActiveTab('all');
              setSelectedFoodCategory('all');
            }}
            style={styles.resetButton}
          >
            <Text style={styles.resetButtonText}>Réinitialiser</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Restaurants Section */}
      {!isLoading && showRestaurants && filteredRestaurants.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Restaurants partenaires ({filteredRestaurants.length})
            </Text>
            <Pressable onPress={() => router.push('/food' as never)}>
              <Text style={styles.sectionAction}>REDGO Food</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {filteredRestaurants.map((resto) => (
              <Pressable
                key={resto.id}
                onPress={() => router.push(`/food/restaurant/${resto.id}` as never)}
                style={({ pressed }) => [styles.restoCard, pressed && styles.pressed]}
              >
                <View style={styles.restoCoverWrap}>
                  {resto.coverImageUrl ? (
                    <Image
                      source={{ uri: resto.coverImageUrl }}
                      style={styles.restoCover}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.restoCoverFallback}>
                      <Ionicons name="restaurant" size={28} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={styles.restoStatusBadge}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.restoStatusText}>Ouvert</Text>
                  </View>
                </View>

                <View style={styles.restoBody}>
                  <Text style={styles.restoName} numberOfLines={1}>
                    {resto.name}
                  </Text>
                  <Text style={styles.restoCategories} numberOfLines={1}>
                    {resto.categoryNames.length > 0
                      ? resto.categoryNames.join(' · ')
                      : resto.description || 'Cuisine & Fast-Food'}
                  </Text>
                  <View style={styles.restoFooter}>
                    <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                    <Text style={styles.restoAddress} numberOfLines={1}>
                      {resto.address || "M'Saken"}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Popular Food Dishes */}
      {!isLoading && showFood && filteredFoodDishes.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Plats populaires ({filteredFoodDishes.length})
            </Text>
            <Pressable onPress={() => router.push('/food' as never)}>
              <Text style={styles.sectionAction}>Voir menu</Text>
            </Pressable>
          </View>
          <View style={styles.productsGrid}>
            {filteredFoodDishes.slice(0, activeTab === 'food' || normalizedQuery ? 24 : 8).map((dish) => (
              <Pressable
                key={dish.id}
                onPress={() =>
                  router.push(`/food/product/${dish.id}?restaurant=${dish.businessId}` as never)
                }
                style={({ pressed }) => [styles.productCard, pressed && styles.pressed]}
              >
                <View style={styles.productImageWrap}>
                  {dish.imageUrl ? (
                    <Image
                      source={{ uri: dish.imageUrl }}
                      style={styles.productImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.productImageFallback}>
                      <Ionicons name="fast-food-outline" size={26} color={colors.textSecondary} />
                    </View>
                  )}
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      void handleQuickAdd(dish, 'food');
                    }}
                    style={styles.quickAddBtn}
                    accessibilityLabel={`Ajouter ${dish.name}`}
                  >
                    {addingId === dish.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons
                        name={dish.hasVariants ? 'options-outline' : 'add'}
                        size={17}
                        color="#fff"
                      />
                    )}
                  </Pressable>
                </View>

                <View style={styles.productBody}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {dish.name}
                  </Text>
                  <Text style={styles.productMeta} numberOfLines={1}>
                    {dish.businessName || dish.category}
                  </Text>
                  <Text style={styles.productPrice}>{formatMillimes(dish.priceMillimes)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Market / Courses Products */}
      {!isLoading && showMarket && filteredMarketProducts.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Courses & Essentiels ({filteredMarketProducts.length})
            </Text>
            <Pressable onPress={() => router.push('/market' as never)}>
              <Text style={styles.sectionAction}>Marché</Text>
            </Pressable>
          </View>
          <View style={styles.productsGrid}>
            {filteredMarketProducts
              .slice(0, activeTab === 'market' || normalizedQuery ? 24 : 6)
              .map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/market/product/${item.id}` as never)}
                  style={({ pressed }) => [styles.productCard, pressed && styles.pressed]}
                >
                  <View style={styles.productImageWrap}>
                    {item.imageUrl ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.productImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.productImageFallback}>
                        <Ionicons name="basket-outline" size={26} color={colors.textSecondary} />
                      </View>
                    )}
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        void handleQuickAdd(item, 'courses');
                      }}
                      style={styles.quickAddBtn}
                      accessibilityLabel={`Ajouter ${item.name}`}
                    >
                      {addingId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="add" size={18} color="#fff" />
                      )}
                    </Pressable>
                  </View>

                  <View style={styles.productBody}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.productMeta} numberOfLines={1}>
                      {item.category}
                    </Text>
                    <Text style={styles.productPrice}>{formatMillimes(item.priceMillimes)}</Text>
                  </View>
                </Pressable>
              ))}
          </View>
        </View>
      ) : null}

      <View style={styles.bottomSpacer} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 18,
  },
  pressed: {
    opacity: 0.82,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 16,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  searchBar: {
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChipActive: {
    backgroundColor: 'rgba(255, 32, 42, 0.14)',
    borderColor: colors.primary,
  },
  tabChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  tabChipTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  serviceCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
  },
  serviceIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceMeta: {
    flex: 1,
  },
  serviceTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  serviceSub: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionBlock: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionCount: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionAction: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  promosRow: {
    gap: 12,
  },
  promoCard: {
    width: 270,
    height: 136,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  promoImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  promoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(9, 9, 9, 0.62)',
  },
  promoContent: {
    padding: 14,
  },
  promoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  promoBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  promoTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  promoSub: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  foodCatsRow: {
    gap: 8,
  },
  foodCatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingLeft: 6,
    paddingRight: 13,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  foodCatPillActive: {
    backgroundColor: 'rgba(255, 32, 42, 0.14)',
    borderColor: colors.primary,
  },
  foodCatImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.elevated,
  },
  foodCatAllIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodCatText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  foodCatTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  horizontalList: {
    gap: 12,
  },
  restoCard: {
    width: 220,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  restoCoverWrap: {
    height: 110,
    backgroundColor: colors.elevated,
    position: 'relative',
  },
  restoCover: {
    width: '100%',
    height: '100%',
  },
  restoCoverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoStatusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(9, 9, 9, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  restoStatusText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  restoBody: {
    padding: 12,
  },
  restoName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  restoCategories: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  restoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  restoAddress: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  productCard: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  productImageWrap: {
    height: 116,
    backgroundColor: colors.elevated,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddBtn: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  productBody: {
    padding: 10,
  },
  productName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  productMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  productPrice: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    marginTop: 24,
    padding: 28,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  emptySub: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  resetButton: {
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  bottomSpacer: {
    height: 36,
  },
});
