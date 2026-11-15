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
  fetchProductById,
  fetchProductOptions,
  ProductOption,
} from '../../../services/catalog';
import { SelectedCartOption } from '../../../types/cart';

const FALLBACK_OPTIONS: SelectedCartOption[] = [
  { id: 'opt_extra_cheese', name: 'Supplément Mozzarella (+2.000 DT)', priceMillimes: 2000 },
  { id: 'opt_harissa', name: 'Harissa artisanale piquante (+0.500 DT)', priceMillimes: 500 },
  { id: 'opt_olives', name: 'Olives noires de M\'Saken (+1.000 DT)', priceMillimes: 1000 },
];

  export default function FoodProductScreen() {
    const { id, restaurant = 'karma' } = useLocalSearchParams<{ id?: string; restaurant?: string }>();
    const [quantity, setQuantity] = useState(1);
    const [dbProduct, setDbProduct] = useState<CatalogProduct | null>(null);
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

      const loadProd = fetchProductById(id)
        .then((prod) => {
          if (!active) return;
          setDbProduct(prod);
        })
        .catch(() => { });

      const loadOpts = fetchProductOptions(id)
        .then((opts) => {
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
            setOptions(FALLBACK_OPTIONS);
          }
        })
        .catch(() => {
          if (active) setOptions(FALLBACK_OPTIONS);
        });

      Promise.all([loadProd, loadOpts]).finally(() => {
        if (active) setIsLoading(false);
      });

        return () => {
          active = false;
        };
      }, [id]);

        const basePriceMillimes = dbProduct
        ? dbProduct.priceMillimes
        : id === 'burger-special'
        ? 16800
        : id === 'couscous-agneau'
        ? 19500
        : 14500;

          const productName = dbProduct
          ? dbProduct.name
          : id === 'burger-special'
          ? 'Smash Burger REDGO'
          : id === 'couscous-agneau'
          ? 'Couscous à l\'Agneau de M\'Saken'
          : 'Pizza Margherita Di Bufala';

          const productImage = dbProduct?.imageUrl
          ? dbProduct.imageUrl
          : id === 'burger-special'
          ? 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=900'
          : id === 'couscous-agneau'
          ? 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=900'
          : 'https://images.unsplash.com/photo-1547592180-85f173990554?w=900';

          const restaurantName = restaurant === 'traditional' ? 'Saveurs de M\'Saken' : 'Karma Kitchen';

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
          const unitTotalMillimes = basePriceMillimes + optionsTotalMillimes;
          const lineTotalMillimes = unitTotalMillimes * quantity;

  const handleAddToCart = () => {
            addProduct({
              productId: id || 'food_item',
              productType: 'food',
              businessId: restaurant,
              businessName: restaurantName,
              productName,
              productImage,
              unitPriceMillimes: basePriceMillimes,
              selectedOptions,
              quantity,
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
              <Text style={styles.loadingText}>Chargement du plat et suppléments…</Text>
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
            <Text style={styles.price}>{formatMillimes(basePriceMillimes)}</Text>
            <Text style={styles.fixedPriceBadge}>Prix fixe garanti</Text>
          </View>

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
              max={20}
              onChange={setQuantity}
              size="large"
            />
          </View>

          {/* Sticky Action Button */}
          <Pressable
            style={({ pressed }) => [styles.submitButton, pressed && { opacity: 0.9 }]}
            onPress={handleAddToCart}
          >
            <Ionicons name="cart" size={20} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>
              Ajouter au panier · {formatMillimes(lineTotalMillimes)}
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
    fixedPriceBadge: {
      color: colors.success,
      fontSize: 12,
      fontWeight: '700',
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
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
  });
