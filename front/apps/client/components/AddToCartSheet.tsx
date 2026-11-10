import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { colors } from '../constants/theme';
import { useCart } from '../context/CartContext';
import { formatMillimes, lineTotal } from '../services/cart';
import { QuantityStepper } from './QuantityStepper';

export function AddToCartSheet() {
  const {
    isAddSheetVisible,
    closeAddSheet,
    recentlyAddedItem,
    items,
    updateQuantity,
    pricing,
  } = useCart();

  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Retrieve current active item from cart state to keep live sync
  const currentCartItem = items.find((i) => i.key === recentlyAddedItem?.key) || recentlyAddedItem;

  useEffect(() => {
    if (isAddSheetVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isAddSheetVisible, fadeAnim, slideAnim]);

  if (!isAddSheetVisible && !currentCartItem) {
    return null;
  }

  const handleGoToCart = () => {
    closeAddSheet();
    router.push('/cart');
  };

  const itemTotal = currentCartItem ? lineTotal(currentCartItem) : 0;

  return (
    <Modal
      transparent
      visible={isAddSheetVisible}
      animationType="none"
      onRequestClose={closeAddSheet}
    >
      <TouchableWithoutFeedback onPress={closeAddSheet}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.sheetContainer,
                { transform: [{ translateY: slideAnim }] },
              ]}
            >
              {/* Drag Handle */}
              <View style={styles.handleContainer}>
                <View style={styles.handleBar} />
              </View>

              {/* Success Badge */}
              <View style={styles.headerRow}>
                <View style={styles.successBadge}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.successText}>Ajouté au panier !</Text>
                </View>
                <Pressable onPress={closeAddSheet} hitSlop={12}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* Product Preview */}
              {currentCartItem && (
                <View style={styles.productCard}>
                  <Image
                    source={{ uri: currentCartItem.productImage }}
                    style={styles.productImage}
                    contentFit="cover"
                  />
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {currentCartItem.productName}
                    </Text>
                    <Text style={styles.vendorName} numberOfLines={1}>
                      {currentCartItem.productType === 'courses'
                        ? 'Courses REDGO'
                        : currentCartItem.businessName}
                    </Text>

                    {currentCartItem.selectedOptions.length > 0 && (
                      <Text style={styles.optionsList} numberOfLines={1}>
                        {currentCartItem.selectedOptions.map((o) => o.name).join(', ')}
                      </Text>
                    )}

                    <Text style={styles.unitPrice}>
                      {formatMillimes(currentCartItem.unitPriceMillimes + currentCartItem.optionsPriceMillimes)}
                    </Text>
                  </View>

                  {/* Quantity Stepper */}
                  <View style={styles.stepperWrapper}>
                    <QuantityStepper
                      value={currentCartItem.quantity}
                      min={1}
                      max={currentCartItem.maxQuantity}
                      onChange={(newQty) => updateQuantity(currentCartItem.key, newQty)}
                      size="medium"
                    />
                    <Text style={styles.itemTotalText}>{formatMillimes(itemTotal)}</Text>
                  </View>
                </View>
              )}

              {/* Subtotal Banner */}
              <View style={styles.cartBanner}>
                <View>
                  <Text style={styles.bannerLabel}>Sous-total panier ({pricing.itemsCount} art.)</Text>
                  <Text style={styles.bannerSubtext}>Prix fixes garantis REDGO</Text>
                </View>
                <Text style={styles.bannerAmount}>
                  {formatMillimes(pricing.productsSubtotalMillimes)}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                <Pressable
                  style={({ pressed }) => [styles.continueButton, pressed && { opacity: 0.8 }]}
                  onPress={closeAddSheet}
                >
                  <Text style={styles.continueButtonText}>Continuer</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.cartButton, pressed && { opacity: 0.88 }]}
                  onPress={handleGoToCart}
                >
                  <Ionicons name="cart" size={18} color="#FFFFFF" />
                  <Text style={styles.cartButtonText}>Voir le panier</Text>
                </Pressable>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#141418',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#2D2D38',
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 10,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3F4E',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  successText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E26',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#30303E',
    gap: 12,
  },
  productImage: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: '#2A2A36',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  vendorName: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  optionsList: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  unitPrice: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  stepperWrapper: {
    alignItems: 'flex-end',
    gap: 6,
  },
  itemTotalText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  cartBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 38, 56, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 38, 56, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 14,
    marginBottom: 16,
  },
  bannerLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  bannerSubtext: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  bannerAmount: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '900',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  continueButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#272732',
    borderWidth: 1,
    borderColor: '#3E3E4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cartButton: {
    flex: 1.3,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  cartButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
