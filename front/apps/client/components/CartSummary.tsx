import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { formatMillimes } from '../services/cart';
import { CartPricing } from '../types/cart';

type CartSummaryProps = {
  pricing: CartPricing;
  showStopsDetails?: boolean;
};

export function CartSummary({ pricing, showStopsDetails = true }: CartSummaryProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Détail du montant</Text>

      {/* Courses Subtotal */}
      {pricing.coursesSubtotalMillimes > 0 && (
        <View style={styles.row}>
          <View style={styles.labelWithIcon}>
            <Ionicons name="basket-outline" size={16} color={colors.primary} />
            <Text style={styles.rowLabel}>Sous-total Courses REDGO</Text>
          </View>
          <Text style={styles.rowValue}>
            {formatMillimes(pricing.coursesSubtotalMillimes)}
          </Text>
        </View>
      )}

      {/* Food Subtotal */}
      {pricing.foodSubtotalMillimes > 0 && (
        <View style={styles.row}>
          <View style={styles.labelWithIcon}>
            <Ionicons name="restaurant-outline" size={16} color={colors.primary} />
            <Text style={styles.rowLabel}>Sous-total Restaurants</Text>
          </View>
          <Text style={styles.rowValue}>
            {formatMillimes(pricing.foodSubtotalMillimes)}
          </Text>
        </View>
      )}

      {/* Total Fixed Products Price */}
      <View style={[styles.row, styles.highlightRow]}>
        <Text style={styles.subtotalProductLabel}>Prix des produits (fixes)</Text>
        <Text style={styles.subtotalProductValue}>
          {formatMillimes(pricing.productsSubtotalMillimes)}
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Delivery Fee */}
      <View style={styles.row}>
        <View style={styles.labelWithIcon}>
          <Ionicons name="bicycle-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>Frais de livraison</Text>
        </View>
        <Text style={styles.rowValue}>
          {formatMillimes(pricing.totalDeliveryFeeMillimes)}
        </Text>
      </View>

      {showStopsDetails && pricing.vendorStopsCount > 1 && (
        <Text style={styles.stopsExplanation}>
          Inclut {pricing.vendorStopsCount} points de collecte ({pricing.vendorStopsCount - 1} arrêt(s) suppl. +{formatMillimes(pricing.additionalVendorFeeMillimes)})
        </Text>
      )}

      {/* Service Fee */}
      <View style={styles.row}>
        <View style={styles.labelWithIcon}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>Frais de service plateforme</Text>
        </View>
        <Text style={styles.rowValue}>
          {formatMillimes(pricing.serviceFeeMillimes)}
        </Text>
      </View>

      {/* Final Total */}
      <View style={[styles.row, styles.totalRow]}>
        <View>
          <Text style={styles.totalLabel}>Total à payer</Text>
          <Text style={styles.totalPaymentType}>En espèces à la livraison</Text>
        </View>
        <Text style={styles.totalValue}>
          {formatMillimes(pricing.finalTotalMillimes)}
        </Text>
      </View>

      {/* Cash Notice */}
      <View style={styles.cashNotice}>
        <Ionicons name="cash-outline" size={20} color={colors.success} />
        <Text style={styles.cashNoticeText}>
          Paiement 100% en espèces. Prévoyez l'appoint exact pour votre livreur.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#18181E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2F2F3B',
    padding: 18,
    marginVertical: 14,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
  },
  highlightRow: {
    marginTop: 6,
    paddingTop: 6,
  },
  subtotalProductLabel: {
    color: '#E4E4E7',
    fontSize: 13,
    fontWeight: '700',
  },
  subtotalProductValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  rowValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  stopsExplanation: {
    color: colors.textSecondary,
    fontSize: 11,
    marginLeft: 24,
    marginBottom: 6,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#272733',
    marginVertical: 10,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#383848',
    paddingTop: 14,
    marginTop: 10,
    alignItems: 'flex-start',
  },
  totalLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  totalPaymentType: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  totalValue: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  cashNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.22)',
  },
  cashNoticeText: {
    color: '#A1A1AA',
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
});
