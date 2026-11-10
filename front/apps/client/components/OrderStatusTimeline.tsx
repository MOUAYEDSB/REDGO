import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { DeliveryStage } from '../types/delivery';

type TimelineStep = {
  key: DeliveryStage;
  title: string;
  description: string;
};

type OrderStatusTimelineProps = {
  currentStage: DeliveryStage;
  hasCourses: boolean;
  hasFood: boolean;
};

export function OrderStatusTimeline({
  currentStage,
  hasCourses,
  hasFood,
}: OrderStatusTimelineProps) {
  // Build only relevant steps based on order composition
  const steps: TimelineStep[] = [
    {
      key: 'confirmed',
      title: 'Commande confirmée',
      description: 'Reçue et validée par REDGO',
    },
    {
      key: 'searching_driver',
      title: 'Recherche d’un livreur',
      description: 'Attribution du livreur le plus proche',
    },
    {
      key: 'driver_assigned',
      title: 'Livreur assigné',
      description: 'Le livreur démarre sa tournée',
    },
  ];

  if (hasCourses) {
    steps.push({
      key: 'driver_shopping_courses',
      title: 'Courses en préparation',
      description: 'Collecte des articles du hub REDGO',
    });
  }

  if (hasFood) {
    steps.push({
      key: 'collecting_restaurant',
      title: 'Récupération restaurant',
      description: 'Collecte des repas chauds au commerce',
    });
  }

  steps.push(
    {
      key: 'on_the_way',
      title: 'En route vers vous',
      description: 'Le livreur approche de votre adresse',
    },
    {
      key: 'delivered',
      title: 'Commande livrée',
      description: 'Le livreur est arrivé à destination',
    },
    {
      key: 'cash_collected',
      title: 'Espèces réglées',
      description: 'Paiement perçu · Commande terminée',
    },
  );

  const stageKeys = steps.map((s) => s.key);
  const activeIndex = stageKeys.indexOf(currentStage);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Statut de la livraison</Text>

      {steps.map((step, index) => {
        const isPast = index < activeIndex;
        const isCurrent = index === activeIndex;
        const isFuture = index > activeIndex;
        const isLast = index === steps.length - 1;

        return (
          <View key={step.key} style={styles.stepRow}>
            {/* Left Indicator Column */}
            <View style={styles.indicatorCol}>
              <View
                style={[
                  styles.circle,
                  isPast && styles.circlePast,
                  isCurrent && styles.circleCurrent,
                  isFuture && styles.circleFuture,
                ]}
              >
                {isPast ? (
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                ) : isCurrent ? (
                  <View style={styles.pulseInner} />
                ) : (
                  <View style={styles.dotFuture} />
                )}
              </View>

              {!isLast && (
                <View
                  style={[
                    styles.connectorLine,
                    isPast && styles.connectorLinePast,
                    isCurrent && styles.connectorLineCurrent,
                  ]}
                />
              )}
            </View>

            {/* Content Column */}
            <View style={[styles.contentCol, isCurrent && styles.contentColActive]}>
              <Text
                style={[
                  styles.stepTitle,
                  isPast && styles.stepTitlePast,
                  isCurrent && styles.stepTitleCurrent,
                  isFuture && styles.stepTitleFuture,
                ]}
              >
                {step.title}
              </Text>
              <Text
                style={[
                  styles.stepDesc,
                  isCurrent && styles.stepDescCurrent,
                  isFuture && styles.stepDescFuture,
                ]}
              >
                {step.description}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#181820',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D2D3B',
    padding: 18,
    marginVertical: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
  },
  indicatorCol: {
    alignItems: 'center',
    width: 28,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  circlePast: {
    backgroundColor: colors.success,
  },
  circleCurrent: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  circleFuture: {
    backgroundColor: '#262632',
    borderWidth: 1,
    borderColor: '#3D3D4E',
  },
  pulseInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  dotFuture: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#525262',
  },
  connectorLine: {
    width: 2,
    flex: 1,
    minHeight: 26,
    backgroundColor: '#2A2A38',
    marginVertical: 2,
  },
  connectorLinePast: {
    backgroundColor: colors.success,
  },
  connectorLineCurrent: {
    backgroundColor: colors.primary,
  },
  contentCol: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 20,
  },
  contentColActive: {
    // slightly highlighted
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  stepTitlePast: {
    color: '#D4D4D8',
  },
  stepTitleCurrent: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  stepTitleFuture: {
    color: '#71717A',
  },
  stepDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  stepDescCurrent: {
    color: '#E4E4E7',
  },
  stepDescFuture: {
    color: '#52525B',
  },
});
