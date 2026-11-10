import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { useCart } from '../context/CartContext';

type CartBadgeProps = {
  tintColor?: string;
};

export function CartBadge({ tintColor = colors.text }: CartBadgeProps) {
  const { totalItemsCount } = useCart();

  return (
    <Pressable
      onPress={() => router.push('/cart')}
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.75 }]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Panier, ${totalItemsCount} articles`}
    >
      <Ionicons name="cart-outline" size={26} color={tintColor} />
      {totalItemsCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {totalItemsCount > 99 ? '99+' : totalItemsCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 2,
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#09090B',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
