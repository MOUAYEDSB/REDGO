import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CartBadge } from '../../../components/CartBadge';
import { QuantityStepper } from '../../../components/QuantityStepper';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../constants/theme';
import { useCart } from '../../../context/CartContext';
import { formatMillimes } from '../../../services/cart';
import {
  CatalogBusiness,
  CatalogProduct,
  fetchBusinessById,
  fetchProductById,
  fetchProductOptions,
  fetchProductVariants,
  ProductOption,
  ProductVariant,
} from '../../../services/catalog';
import { SelectedCartOption } from '../../../types/cart';

export default function FoodProductScreen() {
  const { id, restaurant } = useLocalSearchParams<{ id?: string; restaurant?: string }>();
  const [quantity, setQuantity] = useState(1);
  const [dbProduct, setDbProduct] = useState<CatalogProduct | null>(null);
  const [dbBusiness, setDbBusiness] = useState<CatalogBusiness | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [options, setOptions] = useState<SelectedCartOption[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<SelectedCartOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Feedback "Ajouté !" après chaque ajout au panier
  const [justAdded, setJustAdded] = useState(false);
  const { addProduct, items } = useCart();

  // Articles de ce produit présents dans le panier
  const itemsInCartForThisProduct = useMemo(() => {
    return items.filter((item) => item.productId === id);
  }, [items, id]);

  const totalThisProductInCart = useMemo(() => {
    return itemsInCartForThisProduct.reduce((sum, item) => sum + item.quantity, 0);
  }, [itemsInCartForThisProduct]);

  useEffect(() => {
    let active = true;
    if (!id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Charger le restaurant si passé en paramètre
      if (restaurant) {
        fetchBusinessById(restaurant).then((biz) => {
          if (active && biz) setDbBusiness(biz);
        });
      }

      const loadProdAndOpts = fetchProductById(id)
        .then(async (prod) => {
          if (!active) return;
          setDbProduct(prod);
          const bId = prod?.businessId || restaurant;
            if (bId) {
              fetchBusinessById(bId).then((biz) => {
                if (active && biz) setDbBusiness(biz);
              });
            }
            if (bId) {
              const opts = await fetchProductOptions(id, bId);
              if (!active) return;
              if (opts.length > 0) {
                setOptions(
                  opts.map((o) => ({
                    id: o.id,
                    name: o.priceMillimes > 0 ? `${o.name} (+${formatMillimes(o.priceMillimes)})` : o.name,
                    priceMillimes: o.priceMillimes,
                  }))
                );
              } else {
                setOptions([]);
              }
            } else {
              setOptions([]);
            }
          })
        .catch(() => {
          if (active) setOptions([]);
        });

      const loadVariants = fetchProductVariants(id)
        .then((vars) => {
          if (!active) return;
          setVariants(vars);
        })
        .catch(() => { });

      Promise.all([loadProdAndOpts, loadVariants]).finally(() => {
        if (active) setIsLoading(false);
      });

      return () => {
        active = false;
      };
    }, [id, restaurant]);

  const hasVariants = variants.length > 0;

  const minVariantPriceMillimes = useMemo(() => {
    if (!hasVariants) return 0;
    return Math.min(...variants.map((v) => v.priceMillimes));
  }, [hasVariants, variants]);

  const defaultBasePriceMillimes = dbProduct ? dbProduct.priceMillimes : 0;

  const effectiveBasePriceMillimes = selectedVariant
    ? selectedVariant.priceMillimes
    : hasVariants
      ? minVariantPriceMillimes
      : defaultBasePriceMillimes;

  const productName = dbProduct ? dbProduct.name : 'Plat';

  const productImage = dbProduct?.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900';

  const restaurantName = useMemo(() => {
    if (dbBusiness?.name) return dbBusiness.name;
    if (dbProduct?.businessName) return dbProduct.businessName;
  return 'Restaurant';
}, [dbBusiness, dbProduct]);

const toggleOption = (option: SelectedCartOption) => {
  setSelectedOptions((current) => {
    const exists = current.some((o) => o.id === option.id);
    if (exists) {
      return current.filter((o) => o.id !== option.id);
    }
    return [...current, option];
  });
};

const optionsTotalMillimes = selectedOptions.reduce((acc, opt) => acc + opt.priceMillimes, 0);
const unitTotalMillimes = effectiveBasePriceMillimes + optionsTotalMillimes;
const lineTotalMillimes = unitTotalMillimes * quantity;

const canAddToCart = !hasVariants || selectedVariant !== null;

const handleAddToCart = () => {
  if (!canAddToCart) return;

  addProduct({
    productId: id || 'food_item',
    productType: 'food',
    businessId: dbProduct?.businessId || restaurant || 'restaurant_item',
    businessName: restaurantName,
    productName,
    productImage,
    unitPriceMillimes: effectiveBasePriceMillimes,
    variantId: selectedVariant?.id,
    variantName: selectedVariant?.name,
    selectedOptions,
    quantity,
    maxQuantity: selectedVariant?.maxQuantity ?? dbProduct?.maxQuantity ?? 30,
  });

  // Feedback visuel + réinitialisation pour permettre un autre variant
  setJustAdded(true);
  setSelectedVariant(null);
  setSelectedOptions([]);
  setQuantity(1);
  setTimeout(() => setJustAdded(false), 2000);
};

if (!dbProduct && !isLoading) {
  return (
    <Screen style={styles.notFoundContainer}>
      <Ionicons name="alert-circle-outline" size={52} color={colors.primary} />
      <Text style={styles.notFoundTitle}>Plat introuvable</Text>
      <Text style={styles.notFoundSubtitle}>
        Ce plat n'est pas encore disponible ou a été retiré de la carte.
      </Text>
      <Pressable style={styles.notFoundBackBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
        <Text style={styles.notFoundBackBtnText}>Retour au restaurant</Text>
      </Pressable>
    </Screen>
  );
}

return (
  <Screen scroll>
    {/* Top Media & Navigation */}
    <View style={styles.imageWrapper}>
      {/* Arrière-plan flouté pour ambiance si l'image est de format particulier */}
      <Image
        source={{ uri: productImage }}
        style={styles.imageBlurBg}
        contentFit="cover"
        blurRadius={25}
      />
      <View style={styles.imageDimOverlay} />

      {/* Image complète du plat 100% visible (aucun rognage) */}
      <Image
        source={{ uri: productImage }}
        style={styles.image}
        contentFit="contain"
      />

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
          <Text style={styles.loadingText}>Chargement du plat et des variantes…</Text>
        </View>
      ) : null}

      {/* Vendor Tag */}
      <View style={styles.vendorPill}>
        <Ionicons name="restaurant" size={13} color={colors.primary} />
        <Text style={styles.vendorText}>{restaurantName}</Text>
      </View>

      <Text style={styles.name}>{productName}</Text>
      <Text style={styles.description}>
        {dbProduct?.description ||
          'Préparé à la minute avec des ingrédients rigoureusement sélectionnés. Livraison chaude et rapide par coursier REDGO.'}
      </Text>

      <View style={styles.priceRow}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {hasVariants && !selectedVariant && (
              <Text style={styles.priceFrom}>À partir de</Text>
            )}
            <Text style={styles.price}>
              {formatMillimes(effectiveBasePriceMillimes)}
            </Text>
            {selectedVariant ? (
              <View style={styles.selectedVariantBadge}>
                <Text style={styles.selectedVariantBadgeText}>{selectedVariant.name}</Text>
              </View>
            ) : null}
          </View>
          {hasVariants && !selectedVariant ? (
            <Text style={styles.priceHint}>Sélectionnez une variante ci-dessous ↓</Text>
          ) : hasVariants && selectedVariant ? (
            <Text style={styles.priceHint}>Variante sélectionnée : {selectedVariant.name}</Text>
          ) : null}
        </View>
        <Text style={styles.fixedPriceBadge}>Prix fixe garanti</Text>
      </View>

      {/* Badge récapitulatif des articles déjà dans le panier pour ce produit */}
      {totalThisProductInCart > 0 && (
        <View style={styles.inCartSummaryCard}>
          <View style={styles.inCartIconCircle}>
            <Ionicons name="cart" size={15} color="#22C55E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inCartSummaryTitle}>
              {totalThisProductInCart} dans votre panier
            </Text>
            <Text style={styles.inCartSummaryText}>
              {itemsInCartForThisProduct
                .map((it) => `${it.quantity}× ${it.variantName || 'Standard'}`)
                .join(' · ')}
            </Text>
          </View>
          <Pressable
            style={styles.inCartViewCartBtn}
            onPress={() => router.push('/cart')}
          >
            <Text style={styles.inCartViewCartText}>Voir panier</Text>
            <Ionicons name="chevron-forward" size={13} color="#22C55E" />
          </Pressable>
        </View>
      )}

      {hasVariants && (
        <View style={styles.variantsSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Choisissez votre variante *</Text>
            <Text style={styles.requiredBadge}>Obligatoire</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Touchez une option pour la sélectionner :
          </Text>

          <View style={styles.variantsList}>
            {variants.map((v) => {
              const isSelected = selectedVariant?.id === v.id;
              const inCartQty = itemsInCartForThisProduct
                .filter((it) => it.variantId === v.id)
                .reduce((sum, it) => sum + it.quantity, 0);

                return (
                <Pressable
                  key={v.id}
                  style={[styles.variantCard, isSelected && styles.variantCardSelected]}
                  onPress={() => setSelectedVariant(v)}
                >
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.variantInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[styles.variantName, isSelected && styles.variantNameSelected]}>
                        {v.name}
                      </Text>
                      {inCartQty > 0 && (
                        <View style={styles.variantCartBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
                          <Text style={styles.variantCartBadgeText}>
                            {inCartQty} dans le panier
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.variantAvailable}>Disponible</Text>
                  </View>
                  <Text style={[styles.variantPrice, isSelected && styles.variantPriceSelected]}>
                    {formatMillimes(v.priceMillimes)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Options / Suppléments List */}
      {options.length > 0 ? (
        <>
          <Text style={styles.optionsTitle}>Personnalisez votre plat</Text>
          <View style={styles.optionsList}>
            {options.map((option) => {
              const isSelected = selectedOptions.some((o) => o.id === option.id);
              if (!dbProduct && !isLoading) {
                return (
                  <Screen style={styles.notFoundContainer}>
                    <Ionicons name="alert-circle-outline" size={52} color={colors.primary} />
                    <Text style={styles.notFoundTitle}>Plat introuvable</Text>
                    <Text style={styles.notFoundSubtitle}>
                      Ce plat n'est pas encore disponible ou a été retiré de la carte.
                    </Text>
                    <Pressable style={styles.notFoundBackBtn} onPress={() => router.back()}>
                      <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
                      <Text style={styles.notFoundBackBtnText}>Retour au restaurant</Text>
                    </Pressable>
                  </Screen>
                );
              }

              return (
                <Pressable
                  key={option.id}
                  style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                  onPress={() => toggleOption(option)}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={[styles.optionName, isSelected && styles.optionNameSelected]}>
                    {option.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {/* Quantity Controls */}
      <View style={styles.quantitySection}>
        <Text style={styles.quantityLabel}>Quantité</Text>
        <QuantityStepper
          value={quantity}
          min={1}
          max={selectedVariant?.maxQuantity ?? 20}
          onChange={setQuantity}
          size="large"
        />
      </View>

      {/* Info : comment ajouter plusieurs variants */}
      {hasVariants && (
        <View style={styles.multiVariantHint}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.multiVariantHintText}>
            Pour commander plusieurs variantes différentes (ex: 2 Thon + 1 Shawarma), ajoutez-les une par une en changeant la sélection à chaque fois.
          </Text>
        </View>
      )}

      {/* Bouton Ajouter au panier */}
      <Pressable
        style={({ pressed }) => [
          styles.submitButton,
          !canAddToCart && styles.submitButtonDisabled,
          justAdded && styles.submitButtonSuccess,
          pressed && canAddToCart && { opacity: 0.9 },
        ]}
        disabled={!canAddToCart}
        onPress={handleAddToCart}
      >
        <Ionicons
          name={justAdded ? 'checkmark-circle' : canAddToCart ? 'cart' : 'alert-circle-outline'}
          size={20}
          color="#FFFFFF"
        />
        <Text style={styles.submitButtonText}>
          {justAdded
            ? `✓ Ajouté au panier ! (${totalThisProductInCart} au total)`
            : !canAddToCart
              ? 'Choisissez une variante ↑'
              : selectedVariant
                ? `Ajouter · ${selectedVariant.name} · ${formatMillimes(lineTotalMillimes)}`
                : `Ajouter au panier · ${formatMillimes(lineTotalMillimes)}`}
        </Text>
      </Pressable>
    </View>
  </Screen>
);
}

const styles = StyleSheet.create({
  imageWrapper: {
    position: 'relative',
    width: '100%',
    height: 300,
    backgroundColor: '#09090B',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBlurBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.35,
  },
  imageDimOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(9, 9, 11, 0.45)',
  },
  image: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    overflow: 'visible',
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
  vendorPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 38, 56, 0.12)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 38, 56, 0.3)',
    marginBottom: 10,
  },
  vendorText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  price: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  priceFrom: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  priceHint: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  fixedPriceBadge: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  variantsSection: {
    marginTop: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
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
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  variantsList: {
    gap: 8,
  },
  variantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#181820',
    borderWidth: 1,
    borderColor: '#2F2F3D',
    borderRadius: 14,
    padding: 14,
  },
  variantCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 38, 56, 0.08)',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
  selectedVariantBadge: {
    backgroundColor: 'rgba(255, 38, 56, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 38, 56, 0.35)',
  },
  selectedVariantBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  defaultBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  defaultBadgeText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '600',
  },
  multiVariantHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#141420',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D2D3B',
    padding: 12,
    marginTop: 16,
  },
  multiVariantHintText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  variantInfo: {
    flex: 1,
  },
  variantName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  variantNameSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  variantAvailable: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  variantPrice: {
    color: '#D4D4D8',
    fontSize: 14,
    fontWeight: '700',
  },
  variantPriceSelected: {
    color: colors.primary,
    fontWeight: '900',
  },
  optionsTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  optionsList: {
    gap: 8,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#1E1214',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  optionName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  optionNameSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  quantityLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
  },
  submitButtonDisabled: {
    backgroundColor: '#3F3F46',
    opacity: 0.7,
  },
  submitButtonSuccess: {
    backgroundColor: colors.success,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  inCartSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#142018',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1D3B26',
    padding: 12,
    marginTop: 14,
  },
  inCartIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCartSummaryTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  inCartSummaryText: {
    color: '#86EFAC',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  inCartViewCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  inCartViewCartText: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '700',
  },
  variantCartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  variantCartBadgeText: {
    color: '#22C55E',
    fontSize: 10,
    fontWeight: '800',
  },
  notFoundContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    flex: 1,
  },
  notFoundTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 16,
    marginBottom: 8,
  },
  notFoundSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  notFoundBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  notFoundBackBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
