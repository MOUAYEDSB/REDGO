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
import { getCategoryFoodImage, getCategoryIconImage } from '../../components/FoodCategoryNeonIcon';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { useCart } from '../../context/CartContext';
import { formatMillimes } from '../../services/cart';
import {
  CatalogBusinessWithCategories,
  CatalogProduct,
  fetchAllActiveFoodDishes,
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
  categoryIds: string[];
  categoryNames: string[];
};

type CategoryFilter = {
  id: string;
  name: string;
  sortOrder: number;
  count: number;
};

// Filtres majeurs rapides dans l'ordre canonique (les 12 catégories de l'image de référence)
const CANONICAL_FOOD_FILTERS = [
  { id: 'all', name: 'Tous', sortOrder: 0 },
  { id: 'pizzas', name: 'Pizzas', sortOrder: 10 },
  { id: 'ma9loub', name: 'Makloub', sortOrder: 20 },
  { id: 'burgers', name: 'Burgers', sortOrder: 30 },
  { id: 'tacos', name: 'Tacos', sortOrder: 40 },
  { id: 'baquette-farcie', name: 'Baguette farcie', sortOrder: 50 },
  { id: 'chappati', name: 'Chapati', sortOrder: 60 },
  { id: 'mtabga', name: 'Mtabga', sortOrder: 65 },
  { id: 'tabouna', name: 'Tabouna', sortOrder: 70 },
  { id: 'panini', name: 'Panini / Calzones', sortOrder: 80 },
  { id: 'plats-tunisiens', name: 'Plats Tunisiens & Grillades', sortOrder: 100 },
  { id: 'desserts', name: 'Desserts & Sucré', sortOrder: 110 },
  { id: 'boissons-eaux', name: 'Boissons & Eaux', sortOrder: 120 },
];

// Vérifie si un restaurant correspond à une catégorie donnée
function matchesRestaurantCategory(
  restaurant: DisplayRestaurant,
  targetId: string,
  targetName: string,
  allDishes: CatalogProduct[] = []
): boolean {
  if (targetId === 'all' || targetName === 'Tous') return true;

  const targetIdLower = targetId.toLowerCase().trim();
  const targetNameLower = targetName.toLowerCase().trim();

  // 1. Correspondance directe par les plats enregistrés sous ce restaurant
  const restaurantDishes = allDishes.filter((d) => d.businessId === restaurant.id);
  for (const d of restaurantDishes) {
    const dCat = (d.category || '').toLowerCase();
    const dName = (d.name || '').toLowerCase();
    if (targetIdLower === 'pizzas' && (dCat.includes('pizza') || dName.includes('pizza'))) return true;
    if (targetIdLower === 'ma9loub' && (dCat.includes('makloub') || dCat.includes('ma9loub') || dCat.includes('sandwich'))) return true;
    if (targetIdLower === 'burgers' && (dCat.includes('burger') || dName.includes('burger'))) return true;
    if (targetIdLower === 'tacos' && (dCat.includes('tacos') || dName.includes('tacos'))) return true;
    if (targetIdLower === 'baquette-farcie' && (dCat.includes('baguette') || dCat.includes('baquette'))) return true;
    if (targetIdLower === 'chappati' && (dCat.includes('chapati') || dCat.includes('chappati'))) return true;
    if (targetIdLower === 'mtabga' && (dCat.includes('mtabga') || dName.includes('mtabga'))) return true;
    if (targetIdLower === 'tabouna' && (dCat.includes('tabouna') || dName.includes('tabouna'))) return true;
    if (targetIdLower === 'panini' && (dCat.includes('panini') || dCat.includes('cornet') || dCat.includes('calzone') || dCat.includes('fleur'))) return true;
    if (targetIdLower === 'plats-tunisiens' && (dCat.includes('plat') || dCat.includes('grillade') || dCat.includes('tunisien') || dCat.includes('dorade') || dCat.includes('escalope'))) return true;
    if (targetIdLower === 'desserts' && (dCat.includes('dessert') || dCat.includes('sucre') || dCat.includes('sucré'))) return true;
    if (targetIdLower === 'boissons-eaux' && (dCat.includes('boisson') || dCat.includes('eau') || dCat.includes('jus') || dCat.includes('soda'))) return true;
  }

  // 2. Correspondance directe par ID
  if (restaurant.categoryIds.some((cid) => cid.toLowerCase() === targetIdLower)) {
    return true;
  }

  // 3. Correspondance par alias d'identifiants
  for (const cId of restaurant.categoryIds) {
    const cidNorm = cId.toLowerCase();
    if (targetIdLower === 'pizzas' && cidNorm.includes('pizza')) return true;
    if (targetIdLower === 'ma9loub' && (cidNorm.includes('makloub') || cidNorm.includes('ma9loub') || cidNorm.includes('sandwich'))) return true;
    if (targetIdLower === 'burgers' && cidNorm.includes('burger')) return true;
    if (targetIdLower === 'tacos' && cidNorm.includes('tacos')) return true;
    if (targetIdLower === 'chappati' && (cidNorm.includes('chapati') || cidNorm.includes('chappati'))) return true;
    if (targetIdLower === 'baquette-farcie' && (cidNorm.includes('baguette') || cidNorm.includes('baquette'))) return true;
    if (targetIdLower === 'mtabga' && cidNorm.includes('mtabga')) return true;
    if (targetIdLower === 'tabouna' && cidNorm.includes('tabouna')) return true;
    if (targetIdLower === 'panini' && (cidNorm.includes('panini') || cidNorm.includes('cornet') || cidNorm.includes('calzone') || cidNorm.includes('fleur'))) return true;
    if (targetIdLower === 'desserts' && (cidNorm.includes('dessert') || cidNorm.includes('sucre'))) return true;
    if (targetIdLower === 'boissons-eaux' && (cidNorm.includes('boisson') || cidNorm.includes('eau'))) return true;
    if (targetIdLower === 'plats-tunisiens' && (cidNorm.includes('plat') || cidNorm.includes('grillade'))) return true;
  }

  // 4. Correspondance textuelle souple sur les noms de catégories assignées
  for (const cn of restaurant.categoryNames) {
    const cnLower = cn.toLowerCase().trim();
    if (cnLower === targetNameLower) return true;
    if (cnLower.includes(targetNameLower) || targetNameLower.includes(cnLower)) return true;

    // Synonymes tunisiens courants
    if (targetIdLower === 'chappati' && (cnLower.includes('chapati') || cnLower.includes('chappati'))) return true;
    if (targetIdLower === 'ma9loub' && (cnLower.includes('makloub') || cnLower.includes('ma9loub') || cnLower.includes('sandwich'))) return true;
    if (targetIdLower === 'baquette-farcie' && (cnLower.includes('baguette') || cnLower.includes('baquette'))) return true;
    if (targetIdLower === 'tabouna' && cnLower.includes('tabouna')) return true;
    if (targetIdLower === 'mtabga' && cnLower.includes('mtabga')) return true;
    if (targetIdLower === 'panini' && (cnLower.includes('panini') || cnLower.includes('cornet') || cnLower.includes('calzone'))) return true;
    if (targetIdLower === 'desserts' && (cnLower.includes('dessert') || cnLower.includes('sucré'))) return true;
    if (targetIdLower === 'boissons-eaux' && (cnLower.includes('boisson') || cnLower.includes('eau'))) return true;
    if (targetIdLower === 'plats-tunisiens' && (cnLower.includes('plat') || cnLower.includes('grillade') || cnLower.includes('tunisien'))) return true;
  }

  // 5. Fallback sur le titre ou la description du restaurant
  const fullText = `${restaurant.name} ${restaurant.food}`.toLowerCase();
  if (targetIdLower === 'chappati' && (fullText.includes('chapati') || fullText.includes('chappati'))) return true;
  if (targetIdLower === 'mtabga' && fullText.includes('mtabga')) return true;
  if (targetIdLower === 'tabouna' && fullText.includes('tabouna')) return true;
  if (targetIdLower === 'ma9loub' && (fullText.includes('makloub') || fullText.includes('ma9loub'))) return true;
  if (targetIdLower === 'pizzas' && fullText.includes('pizza')) return true;
  if (targetIdLower === 'burgers' && fullText.includes('burger')) return true;
  if (targetIdLower === 'tacos' && fullText.includes('tacos')) return true;

  return false;
}

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

/**
 * Carte de plat moderne, arrondie & interactive avec image, restaurant et bouton d'ajout
 */
function FoodDishCard({
  dish,
  onPress,
  onQuickAdd,
}: {
  dish: CatalogProduct;
  onPress: () => void;
  onQuickAdd: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.dishCard,
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
      ]}
      onPress={onPress}
    >
      <View style={styles.dishImageWrapper}>
        <Image
          source={{
            uri:
              dish.imageUrl ||
              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
          }}
          style={styles.dishImage}
          contentFit="cover"
        />
        {dish.businessName ? (
          <View style={styles.dishRestaurantBadge}>
            <Text style={styles.dishRestaurantText} numberOfLines={1}>
              {dish.businessName}
            </Text>
          </View>
        ) : null}
        {dish.hasVariants ? (
          <View style={styles.dishVariantsBadge}>
            <Text style={styles.dishVariantsText}>Tailles</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.dishContent}>
        <Text style={styles.dishName} numberOfLines={1}>
          {dish.name}
        </Text>
        <Text style={styles.dishCategory} numberOfLines={1}>
          {dish.category || 'Spécialité'}
        </Text>

        <View style={styles.dishFooter}>
          <Text style={styles.dishPrice}>{formatMillimes(dish.priceMillimes)}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.dishAddBtn,
              dish.hasVariants && styles.dishOptionsBtn,
              pressed && { opacity: 0.7, transform: [{ scale: 0.9 }] },
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onQuickAdd();
            }}
            hitSlop={8}
          >
            <Ionicons
              name={dish.hasVariants ? 'arrow-forward' : 'add'}
              size={16}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export default function FoodHome() {
  const [selectedCatId, setSelectedCatId] = useState('all');
  const [dbRestaurants, setDbRestaurants] = useState<CatalogBusinessWithCategories[]>([]);
  const [dbDishes, setDbDishes] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { addProduct } = useCart();

  const loadData = useCallback(async () => {
    const [restaurantsList, dishesList] = await Promise.all([
      fetchRestaurantsWithCategories(),
      fetchAllActiveFoodDishes(),
    ]);
    setDbRestaurants(restaurantsList);
    setDbDishes(dishesList);
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
      categoryIds: b.categoryIds || [],
      categoryNames: b.categoryNames || [],
    }));
  }, [dbRestaurants]);

  // Exactement et uniquement les 12 catégories de l'image de référence (aucune répétition d'image)
  const categories: CategoryFilter[] = useMemo(() => {
      return CANONICAL_FOOD_FILTERS.map((cat) => {
        const count =
          cat.id === 'all'
            ? restaurants.length
            : restaurants.filter((r) => matchesRestaurantCategory(r, cat.id, cat.name, dbDishes)).length;
        return {
          id: cat.id,
          name: cat.name,
          sortOrder: cat.sortOrder,
          count,
        };
      });
    }, [restaurants, dbDishes]);

  // Filtre par catégorie réelle (table business_categories ou plats servis)
  const filteredRestaurants = useMemo(() => {
    if (selectedCatId === 'all') return restaurants;
    const cat = categories.find((c) => c.id === selectedCatId);
    if (!cat) return restaurants;
    return restaurants.filter((r) => matchesRestaurantCategory(r, cat.id, cat.name, dbDishes));
  }, [restaurants, selectedCatId, categories, dbDishes]);

  const currentCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCatId) || categories[0] || { id: 'all', name: 'Tous', count: 0, sortOrder: 0 };
  }, [categories, selectedCatId]);

  // Sections de plats thématiques filtrées depuis la base Supabase
  // 1. Nos Pizzas phares
  const popularPizzas = useMemo(() => {
    return dbDishes.filter((d) => {
      const cat = (d.category || '').toLowerCase();
      const name = (d.name || '').toLowerCase();
      return cat.includes('pizza') || name.includes('pizza');
    });
  }, [dbDishes]);

  // 2. Les Incontournables Fast-Food (Makloub, Baguette farcie, Tacos, Chapati, Burgers...)
  const popularFastFood = useMemo(() => {
    return dbDishes.filter((d) => {
      const cat = (d.category || '').toLowerCase();
      const name = (d.name || '').toLowerCase();
      return (
        cat.includes('makloub') || cat.includes('ma9loub') || name.includes('makloub') ||
        cat.includes('chapati') || cat.includes('chappati') || name.includes('chapati') ||
        cat.includes('baguette') || cat.includes('baquette') || name.includes('baguette') ||
        cat.includes('tacos') || name.includes('tacos') ||
        cat.includes('burger') || name.includes('burger') ||
        cat.includes('calzone') || cat.includes('cornet') || cat.includes('panini') ||
        cat.includes('tabouna') || cat.includes('mtabga')
      );
    });
  }, [dbDishes]);

  // 3. Plats Tunisiens & Grillades
  const popularPlats = useMemo(() => {
    return dbDishes.filter((d) => {
      const cat = (d.category || '').toLowerCase();
      return cat.includes('plat') || cat.includes('grillade') || cat.includes('tunisien') || cat.includes('dorade') || cat.includes('escalope');
    });
  }, [dbDishes]);

  // 4. Plats de la catégorie sélectionnée (quand != 'all')
  const categoryDishes = useMemo(() => {
    if (selectedCatId === 'all') return [];
    const targetIdLower = selectedCatId.toLowerCase();
    const targetNameLower = currentCategory.name.toLowerCase();

    return dbDishes.filter((d) => {
      const dCat = (d.category || '').toLowerCase();
      const dName = (d.name || '').toLowerCase();
      if (dCat === targetIdLower || dCat === targetNameLower) return true;
      if (targetIdLower === 'pizzas' && (dCat.includes('pizza') || dName.includes('pizza'))) return true;
      if (targetIdLower === 'ma9loub' && (dCat.includes('makloub') || dCat.includes('ma9loub') || dCat.includes('sandwich'))) return true;
      if (targetIdLower === 'chappati' && (dCat.includes('chapati') || dCat.includes('chappati'))) return true;
      if (targetIdLower === 'baquette-farcie' && (dCat.includes('baguette') || dCat.includes('baquette'))) return true;
      if (targetIdLower === 'tacos' && (dCat.includes('tacos') || dName.includes('tacos'))) return true;
      if (targetIdLower === 'burgers' && (dCat.includes('burger') || dName.includes('burger'))) return true;
      if (targetIdLower === 'tabouna' && (dCat.includes('tabouna') || dName.includes('tabouna'))) return true;
      if (targetIdLower === 'mtabga' && (dCat.includes('mtabga') || dName.includes('mtabga'))) return true;
      if (targetIdLower === 'panini' && (dCat.includes('panini') || dCat.includes('cornet') || dCat.includes('calzone'))) return true;
      if (targetIdLower === 'plats-tunisiens' && (dCat.includes('plat') || dCat.includes('grillade') || dCat.includes('tunisien'))) return true;
      if (targetIdLower === 'desserts' && (dCat.includes('dessert') || dCat.includes('sucre') || dCat.includes('sucré'))) return true;
      if (targetIdLower === 'boissons-eaux' && (dCat.includes('boisson') || dCat.includes('eau') || dCat.includes('jus'))) return true;
      return false;
    });
  }, [dbDishes, selectedCatId, currentCategory]);

  const handleQuickAddDish = (dish: CatalogProduct) => {
    if (dish.hasVariants) {
      // Produit avec variantes (tailles/options) -> rediriger vers la page produit pour choisir
      router.push(`/food/product/${dish.id}?restaurant=${dish.businessId}`);
      return;
    }
    addProduct({
      productId: dish.id,
      productType: 'food',
      businessId: dish.businessId,
      businessName: dish.businessName || 'Restaurant partenaire',
      productName: dish.name,
      productImage: dish.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
      unitPriceMillimes: dish.priceMillimes,
      quantity: 1,
    });
  };

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
            <Text style={styles.subtitle}>M&apos;Saken & Messaadine · Livraison rapide</Text>
          </View>
        </View>

        <CartBadge />
      </View>

      {/* Categories Rounded Filter — bulles rondes élégantes & fluides */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.roundCategoriesScroll}
        contentContainerStyle={styles.roundCategoriesRow}
      >
        {categories.map((cat) => {
          const isActive = selectedCatId === cat.id;
          const foodImg = getCategoryFoodImage(cat.id);
          const iconImg = getCategoryIconImage(cat.id);
          return (
            <Pressable
              key={cat.id}
              style={({ pressed }) => [
                styles.roundCatItem,
                pressed && { opacity: 0.8, transform: [{ scale: 0.94 }] },
              ]}
              onPress={() => setSelectedCatId(cat.id)}
            >
              <View style={styles.roundCatCircleContainer}>
                <View
                  style={[
                    styles.roundCatCircle,
                    isActive && styles.roundCatCircleActive,
                  ]}
                >
                  {foodImg ? (
                    <Image
                      source={foodImg as any}
                      style={styles.roundCatFoodImage}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.allCatWrapper}>
                      <Image
                        source={iconImg as any}
                        style={styles.roundCatAllIcon}
                        contentFit="contain"
                      />
                    </View>
                  )}
                </View>

                {/* Badge miniature néon en superposition */}
                {foodImg && (
                  <View style={[styles.miniIconBadge, isActive && styles.miniIconBadgeActive]}>
                    <Image
                      source={iconImg as any}
                      style={styles.miniIconImg}
                      contentFit="contain"
                    />
                  </View>
                )}
              </View>

              <Text
                style={[styles.roundCatLabel, isActive && styles.roundCatLabelActive]}
                numberOfLines={2}
              >
                {cat.name}
              </Text>
              {isActive ? <View style={styles.roundCatActiveDot} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Loading state */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Synchronisation du menu et des restaurants…</Text>
        </View>
      ) : null}

      {/* MODE VUE GLOBALE ('Tous') : Sections Food dédiées (Pizzas, Incontournables, etc.) */}
      {selectedCatId === 'all' && !isLoading && (
        <>
          {/* SECTION : Nos meilleures Pizzas 🍕 */}
          {popularPizzas.length > 0 && (
            <View style={styles.foodSection}>
              <View style={styles.foodSectionHeader}>
                <View>
                  <Text style={styles.foodSectionTitle}>Nos Meilleures Pizzas 🍕</Text>
                  <Text style={styles.foodSectionSub}>Pâte fine, croustillante & généreuse</Text>
                </View>
                <Pressable
                  style={styles.seeAllBtn}
                  onPress={() => setSelectedCatId('pizzas')}
                >
                  <Text style={styles.seeAllText}>Voir tout</Text>
                  <Ionicons name="chevron-forward" size={14} color="#FF2638" />
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.foodSectionScroll}
              >
                {popularPizzas.slice(0, 8).map((dish) => (
                  <FoodDishCard
                    key={dish.id}
                    dish={dish}
                    onPress={() =>
                      router.push(`/food/product/${dish.id}?restaurant=${dish.businessId}`)
                    }
                    onQuickAdd={() => handleQuickAddDish(dish)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* SECTION : Incontournables Fast-Food 🔥 */}
          {popularFastFood.length > 0 && (
            <View style={styles.foodSection}>
              <View style={styles.foodSectionHeader}>
                <View>
                  <Text style={styles.foodSectionTitle}>Incontournables Fast-Food 🔥</Text>
                  <Text style={styles.foodSectionSub}>Makloub, Baguette farcie, Tacos & Burgers</Text>
                </View>
                <Pressable
                  style={styles.seeAllBtn}
                  onPress={() => setSelectedCatId('ma9loub')}
                >
                  <Text style={styles.seeAllText}>Explorer</Text>
                  <Ionicons name="chevron-forward" size={14} color="#FF2638" />
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.foodSectionScroll}
              >
                {popularFastFood.slice(0, 8).map((dish) => (
                  <FoodDishCard
                    key={dish.id}
                    dish={dish}
                    onPress={() =>
                      router.push(`/food/product/${dish.id}?restaurant=${dish.businessId}`)
                    }
                    onQuickAdd={() => handleQuickAddDish(dish)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* SECTION : Plats Tunisiens & Grillades 🍲 */}
          {popularPlats.length > 0 && (
            <View style={styles.foodSection}>
              <View style={styles.foodSectionHeader}>
                <View>
                  <Text style={styles.foodSectionTitle}>Plats & Grillades 🍲</Text>
                  <Text style={styles.foodSectionSub}>Saveurs traditionnelles & plats chauds</Text>
                </View>
                <Pressable
                  style={styles.seeAllBtn}
                  onPress={() => setSelectedCatId('plats-tunisiens')}
                >
                  <Text style={styles.seeAllText}>Voir tout</Text>
                  <Ionicons name="chevron-forward" size={14} color="#FF2638" />
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.foodSectionScroll}
              >
                {popularPlats.slice(0, 8).map((dish) => (
                  <FoodDishCard
                    key={dish.id}
                    dish={dish}
                    onPress={() =>
                      router.push(`/food/product/${dish.id}?restaurant=${dish.businessId}`)
                    }
                    onQuickAdd={() => handleQuickAddDish(dish)}
                  />
                ))}
              </ScrollView>
            </View>
          )}
        </>
      )}

      {/* MODE CATÉGORIE SPÉCIFIQUE (quand selectedCatId !== 'all') : Plats de la catégorie */}
      {selectedCatId !== 'all' && categoryDishes.length > 0 && !isLoading && (
        <View style={styles.foodSection}>
          <View style={styles.foodSectionHeader}>
            <View>
              <Text style={styles.foodSectionTitle}>Nos plats : {currentCategory.name}</Text>
              <Text style={styles.foodSectionSub}>{categoryDishes.length} plat{categoryDishes.length > 1 ? 's' : ''} disponible{categoryDishes.length > 1 ? 's' : ''}</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.foodSectionScroll}
          >
            {categoryDishes.map((dish) => (
              <FoodDishCard
                key={dish.id}
                dish={dish}
                onPress={() =>
                  router.push(`/food/product/${dish.id}?restaurant=${dish.businessId}`)
                }
                onQuickAdd={() => handleQuickAddDish(dish)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Section Restaurants */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.section}>
            {selectedCatId === 'all' ? 'Restaurants ouverts' : `Restaurants : ${currentCategory.name}`}
          </Text>
          <Text style={styles.sectionSub}>M&apos;Saken & Messaadine</Text>
        </View>
        <Text style={styles.countBadge}>
          {filteredRestaurants.length} disponible{filteredRestaurants.length > 1 ? 's' : ''}
        </Text>
      </View>

      {filteredRestaurants.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={44} color="#71717A" />
          <Text style={styles.emptyTitle}>
            {selectedCatId === 'all'
              ? 'Aucun restaurant pour le moment'
              : `Aucun restaurant dans "${currentCategory.name}"`}
          </Text>
          <Text style={styles.emptySubtitle}>
            Les restaurants partenaires arrivent très bientôt sur REDGO !
          </Text>
          {selectedCatId !== 'all' && (
            <Pressable style={styles.resetFilterButton} onPress={() => setSelectedCatId('all')}>
              <Text style={styles.resetFilterText}>Voir tous les restaurants</Text>
            </Pressable>
          )}
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
            <View style={styles.restaurantContent}>
              <View style={styles.restaurantHeaderRow}>
                <Text style={styles.restaurantName} numberOfLines={1}>
                  {restaurant.name}
                </Text>
                {/* Note dynamique compacte avec étoile */}
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={13} color="#FBBF24" />
                  <Text style={styles.ratingText}>{restaurant.rating}</Text>
                </View>
              </View>

              <Text style={styles.restaurantFood} numberOfLines={2}>
                {restaurant.food}
              </Text>

              {/* Tags de catégories réelles de l'établissement */}
              {restaurant.categoryNames.length > 0 && (
                <View style={styles.catTagsRow}>
                  {restaurant.categoryNames.slice(0, 3).map((cn) => (
                    <View key={cn} style={styles.catTag}>
                      <Text style={styles.catTagText}>{cn}</Text>
                    </View>
                  ))}
                  {restaurant.categoryNames.length > 3 && (
                    <View style={styles.catTag}>
                      <Text style={styles.catTagText}>+{restaurant.categoryNames.length - 3}</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.meta}>
                <View style={styles.metaPill}>
                  <Ionicons name="time-outline" size={13} color="#9CA3AF" />
                  <Text style={styles.metaText}>{restaurant.deliveryTime}</Text>
                </View>
                <View style={styles.metaPill}>
                  <Ionicons name="bicycle-outline" size={13} color="#9CA3AF" />
                  <Text style={styles.metaText}>{restaurant.deliveryFee}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 10,
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
    backgroundColor: '#1E1E2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },

  // Bulles rondes de catégories (modernes & "smoothly")
  roundCategoriesScroll: {
    marginVertical: 12,
    marginHorizontal: -18,
  },
  roundCategoriesRow: {
    paddingHorizontal: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  roundCatItem: {
    alignItems: 'center',
    width: 78,
  },
  roundCatCircleContainer: {
    position: 'relative',
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundCatCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#161622',
    borderWidth: 2,
    borderColor: '#262638',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  roundCatCircleActive: {
    backgroundColor: '#260B10',
    borderColor: '#FF2638',
    borderWidth: 2.5,
    shadowColor: '#FF2638',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.85,
    shadowRadius: 8,
    elevation: 6,
  },
  roundCatFoodImage: {
    width: '100%',
    height: '100%',
  },
  allCatWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A28',
  },
  roundCatAllIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  miniIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0A0A12',
    borderWidth: 1.5,
    borderColor: '#FF2638',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF2638',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
    elevation: 4,
  },
  miniIconBadgeActive: {
    backgroundColor: '#FF2638',
    borderColor: '#FFFFFF',
    borderWidth: 2,
  },
  miniIconImg: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  roundCatLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 14,
    height: 28,
  },
  roundCatLabelActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  roundCatActiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FF2638',
    marginTop: 3,
  },

  // Sections Food horizontales (Pizzas, Fast-Food, etc.)
  foodSection: {
    marginTop: 14,
    marginBottom: 8,
  },
  foodSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  foodSectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  foodSectionSub: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  seeAllText: {
    color: '#FF2638',
    fontSize: 12,
    fontWeight: '800',
  },
  foodSectionScroll: {
    paddingRight: 18,
    gap: 12,
    paddingVertical: 2,
  },

  // Carte de plat moderne & arrondie
  dishCard: {
    width: 165,
    backgroundColor: '#161622',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#262638',
    overflow: 'hidden',
  },
  dishImageWrapper: {
    width: '100%',
    height: 110,
    backgroundColor: '#0F0F16',
    position: 'relative',
  },
  dishImage: {
    width: '100%',
    height: '100%',
  },
  dishRestaurantBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    maxWidth: 115,
    backgroundColor: 'rgba(10, 10, 16, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dishRestaurantText: {
    color: '#E4E4E7',
    fontSize: 9,
    fontWeight: '800',
  },
  dishVariantsBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(255, 38, 56, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dishVariantsText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  dishContent: {
    padding: 10,
  },
  dishName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  dishCategory: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 8,
  },
  dishFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dishPrice: {
    color: '#FF4D5E',
    fontSize: 13,
    fontWeight: '900',
  },
  dishAddBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF2638',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF2638',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  dishOptionsBtn: {
    backgroundColor: '#272738',
    borderWidth: 1,
    borderColor: '#3F3F56',
    shadowOpacity: 0.1,
  },

  // Loading
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

  // Section Restaurants
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 12,
  },
  section: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionSub: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  countBadge: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  // Empty state
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
  resetFilterButton: {
    marginTop: 14,
    backgroundColor: '#272738',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  resetFilterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Cartes restaurants
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
  restaurantContent: {
    padding: 14,
  },
  restaurantHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  restaurantName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    flex: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#201A10',
    borderWidth: 1,
    borderColor: '#4A3B18',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
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
    lineHeight: 16,
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
