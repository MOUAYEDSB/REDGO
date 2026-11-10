import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CartBadge } from '../../../components/CartBadge';
import { QuantityStepper } from '../../../components/QuantityStepper';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../constants/theme';
import { useCart } from '../../../context/CartContext';
import { formatMillimes } from '../../../services/cart';
import { SelectedCartOption } from '../../../types/cart';

  const AVAILABLE_OPTIONS: SelectedCartOption[] = [
    { id: 'opt_extra_cheese', name: 'Supplément Mozzarella (+2.000 DT)', priceMillimes: 2000 },
    { id: 'opt_harissa', name: 'Harissa artisanale piquante (+0.500 DT)', priceMillimes: 500 },
    { id: 'opt_olives', name: 'Olives noires de M\'Saken (+1.000 DT)', priceMillimes: 1000 },
  ];

  export default function FoodProductScreen() {
    const { id, restaurant = 'karma' } = useLocalSearchParams<{ id?: string; restaurant?: string }>();
    const [quantity, setQuantity] = useState(1);
    const [selectedOptions, setSelectedOptions] = useState<SelectedCartOption[]>([]);
    const { addProduct } = useCart();

        const basePriceMillimes = id === 'burger-special' ? 16800 : id === 'couscous-agneau' ? 19500 : 14500;
        const productName =
          id === 'burger-special'
            ? 'Smash Burger REDGO'
            : id === 'couscous-agneau'
              ? 'Couscous à l\'Agneau de M\'Saken'
              : 'Pizza Margherita Di Bufala';

        const productImage =
          id === 'burger-special'
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
          {/* Vendor Tag */}
          <View style={styles.vendorPill}>
            <Ionicons name="restaurant" size={13} color={colors.primary} />
            <Text style={styles.vendorText}>{restaurantName}</Text>
          </View>

          <Text style={styles.name}>{productName}</Text>
          <Text style={styles.description}>
            Préparé à la minute avec des ingrédients rigoureusement sélectionnés. Livraison chaude et rapide par coursier REDGO.
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatMillimes(basePriceMillimes)}</Text>
            <Text style={styles.fixedPriceBadge}>Prix fixe garanti</Text>
          </View>

          {/* Options List */}
          <Text style={styles.optionsTitle}>Personnalisez votre plat</Text>
          <View style={styles.optionsList}>
            {AVAILABLE_OPTIONS.map((option) => {
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
      fontWeight: '800',
    },
    name: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '900',
    },
    description: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 8,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 16,
    },
    price: {
      color: colors.primary,
      fontSize: 22,
      fontWeight: '900',
    },
    fixedPriceBadge: {
      backgroundColor: '#1E1E28',
      color: '#A1A1AA',
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#303040',
    },
    optionsTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
      marginTop: 24,
      marginBottom: 12,
    },
    optionsList: {
      gap: 10,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#181820',
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: '#2A2A38',
    },
    optionCardSelected: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(255, 38, 56, 0.08)',
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: '#4A4A5E',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionName: {
      color: '#D4D4D8',
      fontSize: 13,
      fontWeight: '700',
      flex: 1,
    },
    optionNameSelected: {
      color: '#FFFFFF',
    },
    quantitySection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#181820',
      borderRadius: 18,
      padding: 16,
      marginTop: 22,
      borderWidth: 1,
      borderColor: '#2A2A38',
    },
    quantityLabel: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
    submitButton: {
      height: 56,
      borderRadius: 18,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 24,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 4,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },
  });
