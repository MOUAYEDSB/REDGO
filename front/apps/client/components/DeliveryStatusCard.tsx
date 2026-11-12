import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { formatMillimes } from '../services/cart';
import { DeliveryOrder } from '../types/delivery';

type DeliveryStatusCardProps = {
  order: DeliveryOrder;
};

export function DeliveryStatusCard({ order }: DeliveryStatusCardProps) {
  const getStatusPresentation = () => {
    switch (order.status) {
      case 'confirmed':
        return {
          title: 'Commande validée',
          subtitle: 'Recherche du coursier le plus proche...',
          icon: 'time' as const,
          color: '#F59E0B',
        };
      case 'searching_driver':
        return {
          title: 'Attribution du coursier',
          subtitle: 'Recherche active sur le secteur M\'Saken / Messaadine',
          icon: 'search' as const,
          color: colors.primary,
        };
      case 'driver_assigned':
        return {
          title: 'Coursier assigné',
          subtitle: `${order.driver?.name || 'Votre coursier'} a accepté la course`,
          icon: 'person' as const,
          color: colors.success,
        };
      case 'driver_shopping_courses':
        return {
          title: 'Collecte des Courses',
          subtitle: 'Préparation au Hub Central REDGO',
          icon: 'basket' as const,
          color: '#F59E0B',
        };
      case 'collecting_restaurant':
        return {
          title: 'Collecte Restaurant',
          subtitle: 'Récupération de vos plats en cuisine',
          icon: 'restaurant' as const,
          color: '#EC4899',
        };
      case 'on_the_way':
        return {
          title: 'En route vers vous !',
          subtitle: `Arrivée estimée dans ~${order.estimatedArrivalMinutes || 8} min`,
          icon: 'bicycle' as const,
          color: colors.primary,
        };
      case 'delivered':
        return {
          title: 'Livreur sur place',
          subtitle: 'Votre livreur vous attend à votre porte',
          icon: 'checkmark-circle' as const,
          color: colors.success,
        };
      case 'cash_collected':
        return {
          title: 'Livraison effectuée',
          subtitle: 'Paiement en espèces réglé avec succès. Merci !',
          icon: 'checkmark-done-circle' as const,
          color: colors.success,
        };
      case 'cancelled':
        return {
          title: 'Commande annulée',
          subtitle: 'Cette commande a été annulée.',
          icon: 'close-circle' as const,
          color: colors.error,
        };
    }
  };

  const presentation = getStatusPresentation();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.statusIconWrap, { backgroundColor: `${presentation.color}20` }]}>
          <Ionicons name={presentation.icon} size={22} color={presentation.color} />
        </View>

        <View style={styles.titleWrap}>
          <Text style={styles.statusTitle}>{presentation.title}</Text>
          <Text style={styles.statusSubtitle}>{presentation.subtitle}</Text>
        </View>

        {order.estimatedArrivalMinutes && order.status !== 'cash_collected' && (
          <View style={styles.etaPill}>
            <Text style={styles.etaNumber}>{order.estimatedArrivalMinutes}</Text>
            <Text style={styles.etaUnit}>min</Text>
          </View>
        )}
      </View>

      <View style={styles.footerRow}>
        <View>
          <Text style={styles.metaLabel}>Référence</Text>
          <Text style={styles.refText}>{order.reference}</Text>
        </View>

        <View style={styles.rightMeta}>
          <Text style={styles.metaLabel}>Montant espèces à régler</Text>
          <Text style={styles.priceText}>
            {formatMillimes(order.pricing.finalTotalMillimes)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#181822',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2F2F3D',
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  statusSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  etaPill: {
    backgroundColor: 'rgba(255, 38, 56, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 38, 56, 0.4)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaNumber: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  etaUnit: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#262633',
    paddingTop: 12,
    marginTop: 14,
  },
  metaLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  refText: {
    color: '#E4E4E7',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  rightMeta: {
    alignItems: 'flex-end',
  },
  priceText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
});
