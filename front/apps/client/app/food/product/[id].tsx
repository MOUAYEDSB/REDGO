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
  CatalogProduct,
  fetchProductById,
  fetchProductOptions,
  fetchProductVariants,
  ProductOption,
  ProductVariant,
} from '../../../services/catalog';
import { SelectedCartOption } from '../../../types/cart';

const FALLBACK_OPTIONS: SelectedCartOption[] = [
  { id: 'opt_extra_cheese', name: 'Supplément Mozzarella (+2.000 DT)', priceMillimes: 2000 },
  { id: 'opt_harissa', name: 'Harissa artisanale piquante (+0.500 DT)', priceMillimes: 500 },
  { id: 'opt_olives', name: "Olives noires de M'Saken (+1.000 DT)", priceMillimes: 1000 },
];

export default function FoodProductScreen() {
  const { id, restaurant = 'karma' } = useLocalSearchParams<{ id?: string; restaurant?: string }>();
  const [quantity, setQuantity] = useState(1);
  const [dbProduct, setDbProduct] = useState<CatalogProduct | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [options, setOptions] = useState<SelectedCartOption[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<SelectedCartOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addProduct } = useCart();

  useEffect(() => {
    let active = true;
    if (!id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const loadProdAndOpts = fetchProductById(id)
      .then(async (prod) => {
        if (!active) return;
        setDbProduct(prod);
        const bId = prod?.businessId || restaurant;
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
        } else if (!prod) {
          setOptions(FALLBACK_OPTIONS);
        } else {
          setOptions([]);
        }
      })
      .catch(() => {
        if (active) setOptions(FALLBACK_OPTIONS);
      });

    const loadVariants = fetchProductVariants(id)
      .then((vars) => {
        if (!active) return;
        setVariants(vars);
        if (vars.length > 0) {
          setSelectedVariant(vars[0]);
        }
      })
      .catch(() => {});

    Promise.all([loadProdAndOpts, loadVariants]).finally(() => {
      if (active) setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [id]);

  const hasVariants = variants.length > 0;

  const minVariantPriceMillimes = useMemo(() => {
    if (!hasVariants) return 0;
    return Math.min(...variants.map((v) => v.priceMillimes));
  }, [hasVariants, variants]);

  const defaultBasePriceMillimes = dbProduct
    ? dbProduct.priceMillimes
    : id === 'burger-special'
    ? 16800
    : id === 'couscous-agneau'
    ? 19500
    : 14500;

  const effectiveBasePriceMillimes = selectedVariant
    ? selectedVariant.priceMillimes
    : hasVariants
    ? minVariantPriceMillimes
    : defaultBasePriceMillimes;

  const productName = dbProduct
    ? dbProduct.name
    : id === 'burger-special'
    ? 'Smash Burger REDGO'
    : id === 'couscous-agneau'
    ? "Couscous à l'Agneau de M'Saken"
    : 'Pizza Margherita Di Bufala';

  const productImage = dbProduct?.imageUrl
    ? dbProduct.imageUrl
    : id === 'burger-special'
    ? 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=900'
    : id === 'couscous-agneau'
    ? 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=900'
    : 'https://images.unsplash.com/photo-1547592180-85f173990554?w=900';

  const restaurantName = restaurant === 'traditional' ? "Saveurs de M'Saken" : 'Karma Kitchen';

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
      businessId: restaurant,
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
  };

  return (
    <Screen scroll>
      {/* Top Media & Navigation */}
      <View style={styles.imageWrapper}>
        <Image source={{ uri: productImage }} style={styles.image} contentFit="cover" />
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
              <Text style={styles.price}>
                {formatMillimes(effectiveBasePriceMillimes)}
              </Text>
              {selectedVariant ? (
                <View style={styles.selectedVariantBadge}>
                  <Text style={styles.selectedVariantBadgeText}>{selectedVariant.name}</Text>
                </View>
              ) : null}
            </View>
            {hasVariants && selectedVariant ? (
              <Text style={styles.priceHint}>Format sélectionné : {selectedVariant.name}</Text>
            ) : null}
          </View>
          <Text style={styles.fixedPriceBadge}>Prix fixe garanti</Text>
        </View>

        {/* Variants Selection Section (if product has variants) */}
        {hasVariants && (
          <View style={styles.variantsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Variante / Format *</Text>
              <Text style={styles.requiredBadge}>Obligatoire</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Sélectionnez une option pour commander cet article :
            </Text>

            <View style={styles.variantsList}>
              {variants.map((v, index) => {
                const isSelected = selectedVariant?.id === v.id;
                const isFirst = index === 0;
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.variantName, isSelected && styles.variantNameSelected]}>
                          {v.name}
                        </Text>
                        {isFirst ? (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Par défaut</Text>
                          </View>
                        ) : null}
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

        {/* Action Button */}
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            !canAddToCart && styles.submitButtonDisabled,
            pressed && canAddToCart && { opacity: 0.9 },
          ]}
          disabled={!canAddToCart}
          onPress={handleAddToCart}
        >
          <Ionicons
            name={canAddToCart ? 'cart' : 'alert-circle-outline'}
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.submitButtonText}>
            {!canAddToCart
              ? 'Sélectionnez une variante'
              : selectedVariant
              ? `Ajouter (${selectedVariant.name}) · ${formatMillimes(lineTotalMillimes)}`
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
    height: 280,
  },
  image: {
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
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
