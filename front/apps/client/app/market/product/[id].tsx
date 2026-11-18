import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CartBadge } from '../../../components/CartBadge';
import { QuantityStepper } from '../../../components/QuantityStepper';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../constants/theme';
import { useCart } from '../../../context/CartContext';
import { formatMillimes } from '../../../services/cart';
import {
  CatalogProduct,
  fetchCoursesProducts,
  fetchProductById,
  fetchProductOptions,
  fetchProductVariants,
  ProductOption,
  ProductVariant,
} from '../../../services/catalog';
import { SelectedCartOption } from '../../../types/cart';

type ProductDisplay = {
  id: string;
  name: string;
  category: string;
  priceMillimes: number;
  image: string;
  description: string;
  maxQuantity: number;
};

const FALLBACK_DETAILS: Record<string, ProductDisplay> = {
  'eau-minerale-pack': {
    id: 'eau-minerale-pack',
    name: 'Pack Eau Minérale Safia (6x1.5L)',
    category: 'Boissons',
    priceMillimes: 5200,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=900',
    description: 'Eau minérale naturelle gazeuse ou plate, idéale pour le foyer. Pack de 6 bouteilles de 1.5 Litre.',
    maxQuantity: 30,
  },
  'doliprane-1000': {
    id: 'doliprane-1000',
    name: 'Paracétamol 1000mg (Boîte)',
    category: 'Pharmacie autorisée',
    priceMillimes: 3800,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=900',
    description: 'Médicament d\'urgence de pharmacie de garde. Livré sous scellé directement à domicile à M\'Saken et Messaadine.',
    maxQuantity: 10,
  },
  'huile-olive-bio': {
    id: 'huile-olive-bio',
    name: 'Huile d’Olive Extra Vierge de M\'Saken',
    category: 'Produits locaux',
    priceMillimes: 18500,
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=900',
    description: 'Première pression à froid, terroir tunisien authentique des oliveraies du Sahel.',
    maxQuantity: 15,
  },
};

const FALLBACK_OPTIONS: Record<string, ProductOption[]> = {
  'eau-minerale-pack': [
    {
      id: 'opt_eau_refrigere',
      productId: 'eau-minerale-pack',
      name: 'Pack fraîchement réfrigéré',
      priceMillimes: 500,
      isAvailable: true,
      sortOrder: 0,
    },
    {
      id: 'opt_eau_glacons',
      productId: 'eau-minerale-pack',
      name: 'Poche de glaçons d\'accompagnement',
      priceMillimes: 1200,
      isAvailable: true,
      sortOrder: 1,
    },
  ],
  'huile-olive-bio': [
    {
      id: 'opt_huile_emballage',
      productId: 'huile-olive-bio',
      name: 'Emballage isotherme protecteur anti-choc',
      priceMillimes: 1000,
      isAvailable: true,
      sortOrder: 0,
    },
  ],
};

function getCategoryIcon(cat: string): keyof typeof Ionicons.glyphMap {
  const lower = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (lower.includes('boisson') || lower.includes('eau')) return 'water-outline';
  if (lower.includes('epicerie') || lower.includes('course')) return 'basket-outline';
  if (lower.includes('pharmac') || lower.includes('sante')) return 'medkit-outline';
  if (lower.includes('hygiene') || lower.includes('beaute')) return 'sparkles-outline';
  if (lower.includes('local') || lower.includes('terroir')) return 'leaf-outline';
  return 'pricetag-outline';
}

export default function MarketProductScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [quantity, setQuantity] = useState(1);
  const [dbProduct, setDbProduct] = useState<CatalogProduct | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<SelectedCartOption[]>([]);
  const [similarProducts, setSimilarProducts] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [justAdded, setJustAdded] = useState(false);
  const { addProduct, totalItemsCount } = useCart();

  useEffect(() => {
    let active = true;
    if (!id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // 1. Charger les détails du produit
    const loadProd = fetchProductById(id)
      .then((prod) => {
        if (!active) return null;
        setDbProduct(prod);

        // Charger des produits similaires de la même catégorie
        if (prod?.category) {
          fetchCoursesProducts().then((all) => {
            if (!active) return;
            const related = all
              .filter((item) => item.id !== prod.id && item.category === prod.category)
              .slice(0, 3);
            setSimilarProducts(related);
          });
        }
        return prod;
      })
      .catch(() => null);

    // 2. Charger les suppléments / options du produit depuis Supabase
    const loadOpts = fetchProductOptions(id)
      .then((opts) => {
        if (!active) return;
        if (opts.length > 0) {
          setOptions(opts);
        } else if (FALLBACK_OPTIONS[id]) {
          setOptions(FALLBACK_OPTIONS[id]);
        } else {
          setOptions([]);
        }
      })
      .catch(() => {
        if (active && FALLBACK_OPTIONS[id]) {
          setOptions(FALLBACK_OPTIONS[id]);
        }
      });

    Promise.all([loadProd, loadOpts]).finally(() => {
      if (active) setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [id]);

  const product: ProductDisplay = dbProduct
    ? {
      id: dbProduct.id,
      name: dbProduct.name,
      category: dbProduct.category || 'Courses',
      priceMillimes: dbProduct.priceMillimes,
      image: dbProduct.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=900',
      description:
        dbProduct.description ||
      'Produit direct REDGO sans intermédiaire, stocké au Hub Central et livré chez vous en express.',
      maxQuantity: dbProduct.maxQuantity || 30,
    }
    : id && FALLBACK_DETAILS[id]
      ? FALLBACK_DETAILS[id]
      : {
        id: id || 'courses_item',
        name: 'Produit Essentiel REDGO',
        category: 'Courses',
        priceMillimes: 7900,
        image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=900',
        description: 'Produit contrôlé et stocké au Hub Central REDGO avec prix fixe garanti sans majoration.',
        maxQuantity: 30,
      };

  const toggleOption = (option: ProductOption) => {
    setSelectedOptions((current) => {
      const exists = current.some((o) => o.id === option.id);
      if (exists) {
        return current.filter((o) => o.id !== option.id);
      }
      return [
        ...current,
        {
          id: option.id,
          name: option.name,
          priceMillimes: option.priceMillimes,
        },
      ];
    });
  };

  const optionsTotalMillimes = selectedOptions.reduce((acc, opt) => acc + opt.priceMillimes, 0);
  const unitTotalMillimes = product.priceMillimes + optionsTotalMillimes;
  const lineTotalMillimes = unitTotalMillimes * quantity;

  const handleAddToCart = () => {
    addProduct({
      productId: product.id,
      productType: 'courses',
      businessId: dbProduct?.businessId || 'courses_hub_msaken',
      businessName: 'Courses REDGO',
      productName: product.name,
      productImage: product.image,
      unitPriceMillimes: product.priceMillimes,
      selectedOptions,
      quantity,
      maxQuantity: product.maxQuantity,
    });

    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
    }, 2000);
  };

  return (
    <Screen scroll>
      {/* Hero Media & Navigation flotante */}
      <View style={styles.imageWrapper}>
        <Image source={{ uri: product.image }} style={styles.image} contentFit="cover" />
        <View style={styles.imageOverlay} />
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

      <View style={styles.body}>
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Synchronisation des détails et options…</Text>
          </View>
        ) : null}

          {/* Badges d'en-tête : Catégorie & Origine Hub */}
          <View style={styles.badgeRow}>
            <View style={styles.categoryBadge}>
              <Ionicons name={getCategoryIcon(product.category)} size={13} color={colors.primary} />
              <Text style={styles.categoryBadgeText}>{product.category}</Text>
            </View>
            <View style={styles.directHubBadge}>
              <Ionicons name="shield-checkmark" size={12} color={colors.success} />
              <Text style={styles.directHubText}>Direct Hub Central</Text>
            </View>
          </View>

          {/* Titre et description */}
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.description}>{product.description}</Text>

            {/* Bloc Tarif & Zone de desserte */}
            <View style={styles.priceSection}>
              <View>
                <Text style={styles.priceLabel}>Prix unitaire de base</Text>
                <Text style={styles.price}>{formatMillimes(product.priceMillimes)}</Text>
              </View>
              <View style={styles.zoneNotice}>
                <View style={styles.zoneDot} />
                <Text style={styles.zoneText}>M'Saken & Messaadine</Text>
              </View>
            </View>

            {/* Garanties Express REDGO */}
            <View style={styles.guaranteeBox}>
              <View style={styles.guaranteeItem}>
                <Ionicons name="flash" size={14} color="#FF9800" />
                <Text style={styles.guaranteeText}>20–30 min</Text>
              </View>
              <View style={styles.guaranteeDivider} />
              <View style={styles.guaranteeItem}>
                <Ionicons name="cash" size={14} color={colors.success} />
                <Text style={styles.guaranteeText}>Espèces</Text>
              </View>
              <View style={styles.guaranteeDivider} />
              <View style={styles.guaranteeItem}>
                <Ionicons name="shield-checkmark" size={14} color="#42A5F5" />
                <Text style={styles.guaranteeText}>Prix Garanti</Text>
              </View>
            </View>

            {/* SECTION SUPPLÉMENTS & OPTIONS (En direct de l'admin Supabase) */}
            {options.length > 0 ? (
              <View style={styles.optionsSection}>
                <View style={styles.optionsHeader}>
                  <View style={styles.optionsHeaderTitleRow}>
                    <Ionicons name="sparkles" size={16} color={colors.primary} />
                    <Text style={styles.optionsTitle}>Options & Suppléments</Text>
                  </View>
                  <Text style={styles.optionsSubtitle}>
                    Personnalisez cet article selon vos préférences
                  </Text>
                </View>

                <View style={styles.optionsList}>
                  {options.map((option) => {
                    const isSelected = selectedOptions.some((o) => o.id === option.id);
                    return (
                      <Pressable
                        key={option.id}
                        style={({ pressed }) => [
                          styles.optionCard,
                          isSelected && styles.optionCardSelected,
                          pressed && { opacity: 0.85 },
                        ]}
                        onPress={() => toggleOption(option)}
                      >
                        <View style={styles.optionLeft}>
                          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                            {isSelected ? (
                              <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                            ) : null}
                          </View>
                          <Text
                            style={[styles.optionName, isSelected && styles.optionNameSelected]}
                            numberOfLines={2}
                          >
                            {option.name}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.optionPriceBadge,
                            isSelected && styles.optionPriceBadgeSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.optionPriceText,
                              isSelected && styles.optionPriceTextSelected,
                            ]}
                          >
                            {option.priceMillimes > 0
                              ? `+${formatMillimes(option.priceMillimes)}`
                              : 'Inclus'}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Sélecteur de Quantité */}
            <View style={styles.quantitySection}>
              <View>
                <Text style={styles.quantityLabel}>Quantité</Text>
                <Text style={styles.quantitySub}>Max. {product.maxQuantity} par commande</Text>
              </View>
              <QuantityStepper
                value={quantity}
                min={1}
                max={product.maxQuantity}
                onChange={setQuantity}
                size="large"
              />
            </View>

            {/* Récapitulatif Suppléments si sélectionnés */}
            {selectedOptions.length > 0 ? (
              <View style={styles.summaryBreakdown}>
                <Text style={styles.summaryBreakdownText}>
                  Base : {formatMillimes(product.priceMillimes)} + Suppléments ({selectedOptions.length}) :{' '}
                  {formatMillimes(optionsTotalMillimes)} ={' '}
                  <Text style={styles.summaryBreakdownBold}>{formatMillimes(unitTotalMillimes)}/u</Text>
                </Text>
              </View>
            ) : null}

            {/* Bouton CTA d'Ajout */}
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                justAdded && styles.submitButtonSuccess,
                pressed && { opacity: 0.9 },
              ]}
              onPress={handleAddToCart}
            >
              <Ionicons
                name={justAdded ? 'checkmark-circle' : 'cart'}
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.submitButtonText}>
                {justAdded
                    ? 'Ajouté au panier !'
                    : `Ajouter au panier · ${formatMillimes(lineTotalMillimes)}`}
              </Text>
            </Pressable>

            {/* Accès rapide au Panier si des articles y sont déjà */}
            {totalItemsCount > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.viewCartButton, pressed && { opacity: 0.8 }]}
                onPress={() => router.push('/cart')}
              >
                <Text style={styles.viewCartButtonText}>
                  Voir mon panier ({totalItemsCount} article{totalItemsCount > 1 ? 's' : ''})
                </Text>
                <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
              </Pressable>
            ) : null}

            {/* Produits Similaires / Même Catégorie */}
            {similarProducts.length > 0 ? (
              <View style={styles.similarSection}>
                <Text style={styles.similarSectionTitle}>Dans la même catégorie</Text>
                <View style={styles.similarGrid}>
                  {similarProducts.map((item) => (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [styles.similarCard, pressed && { opacity: 0.85 }]}
                      onPress={() => router.push(`/market/product/${item.id}`)}
                    >
                      <Image
                        source={{
                          uri: item.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500',
                        }}
                        style={styles.similarImage}
                        contentFit="cover"
                      />
                      <Text style={styles.similarName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.similarPrice}>{formatMillimes(item.priceMillimes)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </Screen>
        );
}

        const styles = StyleSheet.create({
          imageWrapper: {
          position: 'relative',
        width: '100%',
        height: 290,
        backgroundColor: colors.secondary,
  },
        image: {
          width: '100%',
        height: '100%',
  },
        imageOverlay: {
          ...StyleSheet.absoluteFill,
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
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
          width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(9, 9, 9, 0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
  },
        body: {
          padding: 20,
        paddingBottom: 40,
  },
        loadingRow: {
          flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
  },
        loadingText: {
          fontSize: 12,
        color: colors.textSecondary,
  },
        badgeRow: {
          flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
  },
        categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#261214',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: '#4A1D22',
  },
        categoryBadgeText: {
          color: colors.primary,
        fontSize: 11,
        fontWeight: '800',
  },
        directHubBadge: {
          flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.25)',
  },
          directHubText: {
          color: colors.success,
        fontSize: 11,
        fontWeight: '700',
  },
        name: {
          color: colors.text,
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: -0.3,
        lineHeight: 28,
  },
        description: {
          color: colors.textSecondary,
        fontSize: 13,
        lineHeight: 20,
        marginTop: 8,
  },
          priceSection: {
          flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginTop: 18,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
  },
        priceLabel: {
          fontSize: 11,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 2,
  },
        price: {
          color: colors.primary,
        fontSize: 26,
        fontWeight: '900',
        letterSpacing: -0.5,
  },
        zoneNotice: {
          flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.card,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
  },
        zoneDot: {
          width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.primary,
  },
        zoneText: {
          color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
  },
        guaranteeBox: {
          flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginTop: 16,
  },
        guaranteeItem: {
          flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
  },
        guaranteeDivider: {
          width: 1,
        height: 18,
        backgroundColor: colors.border,
  },
        guaranteeText: {
          fontSize: 11,
        fontWeight: '700',
        color: colors.text,
  },
        /* OPTIONS & SUPPLÉMENTS */
        optionsSection: {
          marginTop: 22,
  },
        optionsHeader: {
          marginBottom: 12,
  },
        optionsHeaderTitleRow: {
          flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
  },
        optionsTitle: {
          fontSize: 15,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.2,
  },
        optionsSubtitle: {
          fontSize: 11,
        color: colors.textSecondary,
        marginTop: 2,
  },
        optionsList: {
          gap: 8,
  },
        optionCard: {
          flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
  },
        optionCardSelected: {
          borderColor: colors.primary,
        backgroundColor: '#1E1214',
  },
        optionLeft: {
          flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
        paddingRight: 10,
  },
        checkbox: {
          width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: '#121212',
        alignItems: 'center',
        justifyContent: 'center',
  },
        checkboxSelected: {
          borderColor: colors.primary,
        backgroundColor: colors.primary,
  },
        optionName: {
          fontSize: 13,
        fontWeight: '600',
        color: colors.text,
        flex: 1,
  },
        optionNameSelected: {
          color: '#FFFFFF',
        fontWeight: '700',
  },
        optionPriceBadge: {
          paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#27272A',
  },
        optionPriceBadgeSelected: {
          backgroundColor: '#351619',
        borderWidth: 1,
        borderColor: '#542026',
  },
        optionPriceText: {
          fontSize: 11,
        fontWeight: '700',
        color: colors.textSecondary,
  },
        optionPriceTextSelected: {
          color: colors.primary,
        fontWeight: '800',
  },
        /* QUANTITÉ */
        quantitySection: {
          flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginTop: 18,
        borderWidth: 1,
        borderColor: colors.border,
  },
        quantityLabel: {
          color: colors.text,
        fontSize: 15,
        fontWeight: '800',
  },
        quantitySub: {
          color: colors.textSecondary,
        fontSize: 11,
        marginTop: 2,
  },
        summaryBreakdown: {
          marginTop: 12,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#161618',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
  },
        summaryBreakdownText: {
          fontSize: 11,
        color: colors.textSecondary,
        textAlign: 'center',
  },
        summaryBreakdownBold: {
          color: colors.text,
        fontWeight: '800',
  },
        /* CTA */
        variantsSection: {
    backgroundColor: '#161620',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D2D3D',
    padding: 16,
    marginTop: 18,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  variantsTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  requiredBadge: {
    backgroundColor: '#3E1014',
    color: '#FF6370',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7A1C24',
  },
  variantsSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  variantsList: {
    gap: 8,
    marginTop: 4,
  },
  variantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1D1D28',
    borderWidth: 1,
    borderColor: '#2F2F3F',
    borderRadius: 12,
    padding: 12,
  },
  variantCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 38, 56, 0.08)',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4E4E60',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  variantInfo: {
    flex: 1,
  },
  variantName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  variantNameSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  variantAvailable: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  variantPrice: {
    color: '#D4D4D8',
    fontSize: 13,
    fontWeight: '700',
  },
  variantPriceSelected: {
    color: colors.primary,
    fontWeight: '900',
  },
  submitButtonDisabled: {
    backgroundColor: '#3F3F46',
    opacity: 0.7,
  },
  submitButton: {
          height: 54,
        borderRadius: 16,
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 20,
        shadowColor: colors.primary,
        shadowOffset: {width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 4,
  },
        submitButtonSuccess: {
          backgroundColor: colors.success,
        shadowColor: colors.success,
  },
        submitButtonText: {
          color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
  },
        viewCartButton: {
          flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
        paddingVertical: 10,
  },
        viewCartButtonText: {
          color: colors.textSecondary,
        fontSize: 13,
        fontWeight: '600',
  },
        /* SIMILAIRES */
        similarSection: {
          marginTop: 28,
  },
        similarSectionTitle: {
          fontSize: 15,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 12,
  },
        similarGrid: {
          flexDirection: 'row',
        gap: 10,
  },
        similarCard: {
          flex: 1,
        backgroundColor: colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 8,
  },
        similarImage: {
          width: '100%',
        height: 70,
        borderRadius: 8,
        backgroundColor: colors.secondary,
        marginBottom: 6,
  },
        similarName: {
          fontSize: 11,
        fontWeight: '700',
        color: colors.text,
  },
        similarPrice: {
          fontSize: 12,
        fontWeight: '800',
        color: colors.primary,
        marginTop: 4,
  },
});
