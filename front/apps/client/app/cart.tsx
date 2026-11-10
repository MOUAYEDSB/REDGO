import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CartSummary } from '../components/CartSummary';
import { QuantityStepper } from '../components/QuantityStepper';
import { Screen } from '../components/Screen';
import { colors } from '../constants/theme';
import { useCart } from '../context/CartContext';
import { formatMillimes, lineTotal } from '../services/cart';

  export default function CartScreen() {
    const {
      items,
      groups,
      pricing,
      updateQuantity,
      removeItem,
      clearCart,
    } = useCart();

    const handleClearCart = () => {
      Alert.alert(
        'Vider le panier ?',
        'Êtes-vous sûr de vouloir supprimer tous les articles de votre panier ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Vider', style: 'destructive', onPress: clearCart },
        ],
      );
    };

    const handleProceedToCheckout = () => {
      router.push('/checkout');
    };

    return (
      <Screen scroll style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title}>Mon Panier</Text>
          {items.length > 0 ? (
            <Pressable onPress={handleClearCart} hitSlop={8}>
              <Text style={styles.clearText}>Vider</Text>
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Empty State */}
        {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="cart-outline" size={56} color={colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>Votre panier est vide</Text>
          <Text style={styles.emptySubtitle}>
            Ajoutez des courses ou des plats de vos restaurants préférés pour commencer votre commande.
          </Text>

          <View style={styles.emptyActions}>
            <Pressable
              style={styles.emptyDiscoverButton}
              onPress={() => router.push('/food')}
            >
              <Ionicons name="restaurant-outline" size={20} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Découvrir les Restaurants</Text>
            </Pressable>

            <Pressable
              style={styles.emptyCoursesButton}
              onPress={() => router.push('/market')}
            >
              <Ionicons name="basket-outline" size={20} color={colors.primary} />
              <Text style={styles.emptyCoursesButtonText}>Faire mes Courses</Text>
            </Pressable>
          </View>
        </View>
        ) : (
          <>
                {/* Active Groups (Courses & Restaurants) */}
                <View style={styles.groupsContainer}>
                  {groups.map((group) => {
                    const isCourses = group.type === 'courses';
                    return (
                      <View key={group.businessId} style={styles.groupCard}>
                        {/* Group Header */}
                        <View style={styles.groupHeader}>
                          <View style={styles.groupHeaderLeft}>
                            <View
                              style={[
                                styles.groupIconPill,
                                isCourses ? styles.coursesPill : styles.restaurantPill,
                              ]}
                            >
                              <Ionicons
                                name={isCourses ? 'basket' : 'restaurant'}
                                size={15}
                                color="#FFFFFF"
                              />
                            </View>
                            <View>
                              <Text style={styles.groupName}>{group.businessName}</Text>
                              <Text style={styles.groupTag}>
                                {isCourses ? 'Prix fixes gérés par REDGO' : 'Menu restaurant · M\'Saken'}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.groupSubtotal}>
                            {formatMillimes(group.subtotalMillimes)}
                          </Text>
                        </View>

                        {/* Group Items */}
                        <View style={styles.itemsList}>
                          {group.items.map((item) => (
                            <View key={item.key} style={styles.itemRow}>
                              <Image
                                source={{ uri: item.productImage }}
                                style={styles.itemImage}
                                contentFit="cover"
                              />

                              <View style={styles.itemDetails}>
                                <Text style={styles.itemName} numberOfLines={2}>
                                  {item.productName}
                                </Text>

                                {item.selectedOptions.length > 0 && (
                                  <Text style={styles.itemOptions} numberOfLines={1}>
                                    {item.selectedOptions.map((o) => o.name).join(', ')}
                                  </Text>
                                )}

                                <Text style={styles.itemUnitPrice}>
                                  {formatMillimes(item.unitPriceMillimes + item.optionsPriceMillimes)}
                                </Text>
                              </View>

                              {/* Quantity and Actions */}
                              <View style={styles.itemActionsCol}>
                                <Pressable
                                  onPress={() => removeItem(item.key)}
                                  style={styles.deleteButton}
                                  hitSlop={8}
                                  accessibilityLabel={`Supprimer ${item.productName}`}
                                >
                                  <Ionicons name="trash-outline" size={17} color={colors.error} />
                                </Pressable>

                                <QuantityStepper
                                  value={item.quantity}
                                  min={1}
                                  max={item.maxQuantity}
                                  onChange={(newQty) => updateQuantity(item.key, newQty)}
                                  size="small"
                                />

                                <Text style={styles.itemLineTotal}>
                                  {formatMillimes(lineTotal(item))}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Pricing Breakdown Summary */}
                <CartSummary pricing={pricing} showStopsDetails={true} />

                {/* Sticky Checkout CTA Bar */}
                <View style={styles.checkoutBar}>
                  <View style={styles.checkoutBarInfo}>
                    <Text style={styles.checkoutBarCount}>
                      {pricing.itemsCount} article{pricing.itemsCount > 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.checkoutBarTotal}>
                      {formatMillimes(pricing.finalTotalMillimes)}
                    </Text>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.checkoutButton,
                      pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={handleProceedToCheckout}
                  >
                    <Text style={styles.checkoutButtonText}>Commander</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
              </>
            )}
          </Screen>
        );
}

        const styles = StyleSheet.create({
        screen: {
          paddingHorizontal: 18,
        paddingBottom: 40,
  },
        header: {
          height: 64,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
  },
        backButton: {
          width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#181822',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#2F2F3D',
  },
        title: {
          color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '900',
  },
        clearText: {
          color: colors.error,
        fontSize: 14,
        fontWeight: '800',
  },
        emptyContainer: {
          alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        paddingHorizontal: 20,
  },
        emptyIconCircle: {
          width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: '#181822',
        borderWidth: 1,
        borderColor: '#2F2F3D',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
  },
        emptyTitle: {
          color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '900',
        textAlign: 'center',
  },
        emptySubtitle: {
          color: colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginTop: 8,
        marginBottom: 28,
  },
        emptyActions: {
          width: '100%',
        gap: 12,
  },
        emptyDiscoverButton: {
          height: 54,
        borderRadius: 16,
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
  },
        emptyButtonText: {
          color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
  },
        emptyCoursesButton: {
          height: 54,
        borderRadius: 16,
        backgroundColor: '#181822',
        borderWidth: 1,
        borderColor: '#2F2F3D',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
  },
        emptyCoursesButtonText: {
          color: colors.primary,
        fontSize: 15,
        fontWeight: '800',
  },
        groupsContainer: {
          gap: 16,
        marginTop: 10,
  },
        groupCard: {
          backgroundColor: '#181822',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#2A2A38',
        padding: 16,
  },
        groupHeader: {
          flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#262634',
  },
        groupHeaderLeft: {
          flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
  },
        groupIconPill: {
          width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
  },
        coursesPill: {
          backgroundColor: '#F59E0B',
  },
        restaurantPill: {
          backgroundColor: '#EC4899',
  },
        groupName: {
          color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
  },
        groupTag: {
          color: colors.textSecondary,
        fontSize: 11,
        marginTop: 1,
  },
        groupSubtotal: {
          color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
  },
        itemsList: {
          paddingTop: 10,
        gap: 14,
  },
        itemRow: {
          flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 4,
  },
        itemImage: {
          width: 60,
        height: 60,
        borderRadius: 12,
        backgroundColor: '#262634',
  },
        itemDetails: {
          flex: 1,
  },
        itemName: {
          color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 18,
  },
        itemOptions: {
          color: colors.textSecondary,
        fontSize: 11,
        marginTop: 2,
  },
        itemUnitPrice: {
          color: '#A1A1AA',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
  },
        itemActionsCol: {
          alignItems: 'flex-end',
        gap: 6,
  },
        deleteButton: {
          padding: 4,
  },
        itemLineTotal: {
          color: colors.primary,
        fontSize: 13,
        fontWeight: '900',
  },
        checkoutBar: {
          backgroundColor: '#1E1E28',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#363648',
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
  },
        checkoutBarInfo: {
          gap: 2,
  },
        checkoutBarCount: {
          color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
  },
        checkoutBarTotal: {
          color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '900',
  },
        checkoutButton: {
          height: 50,
        backgroundColor: colors.primary,
        borderRadius: 16,
        paddingHorizontal: 22,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        shadowColor: colors.primary,
        shadowOffset: {width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 4,
  },
        checkoutButtonText: {
          color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
  },
});
