import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { formatMillimes } from '../../services/cart';

  const SERVICE = {
    id: 'scooter_standard',
    name: 'Scooter REDGO',
    description: 'Un scooter avec chauffeur pour vos déplacements à M’Saken et Messaadine.',
    estimatedDurationMinutes: 12,
    fareMillimes: 4500,
  };

  export default function BookingServiceScreen() {
    const {
      pickup = 'M\'Saken Centre',
      destination = 'Messaadine Centre',
      pickupLat,
      pickupLng,
      destinationLat,
      destinationLng,
    } = useLocalSearchParams<{
      pickup?: string;
      destination?: string;
      pickupLat?: string;
      pickupLng?: string;
      destinationLat?: string;
      destinationLng?: string;
    }>();

    const handleConfirmService = () => {
      router.push({
        pathname: '/booking/summary',
        params: {
          pickup,
          pickupLat,
          pickupLng,
          destination,
          destinationLat,
          destinationLng,
          serviceId: SERVICE.id,
          serviceName: SERVICE.name,
          fare: SERVICE.fareMillimes.toString(),
          duration: SERVICE.estimatedDurationMinutes.toString(),
        },
      });
    };

    return (
      <Screen style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Scooter Taxi</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.title}>Votre véhicule</Text>
        <Text style={styles.subtitle}>Un scooter avec chauffeur, prêt pour votre trajet.</Text>

        <View style={styles.vehicleCard}>
          <View style={styles.scooterIllustration}>
            <Text style={styles.scooterEmoji}>🛵</Text>
            <View style={styles.availableBadge}>
              <View style={styles.availableDot} />
              <Text style={styles.availableText}>Disponible</Text>
            </View>
          </View>
          <View style={styles.vehicleDetails}>
            <View style={styles.vehicleTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{SERVICE.name}</Text>
                <Text style={styles.etaText}>~{SERVICE.estimatedDurationMinutes} min estimées</Text>
              </View>
              <Text style={styles.fareText}>{formatMillimes(SERVICE.fareMillimes)}</Text>
            </View>
            <Text style={styles.description}>{SERVICE.description}</Text>
            <View style={styles.featureList}>
              <View style={styles.feature}>
                <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.featureText}>1 passager</Text>
              </View>
              <View style={styles.feature}>
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
                <Text style={styles.featureText}>Casque fourni</Text>
              </View>
              <View style={styles.feature}>
                <Ionicons name="cash-outline" size={16} color={colors.success} />
                <Text style={styles.featureText}>Paiement en espèces</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.routeCard}>
          <View style={styles.routeStop}>
            <View style={styles.pickupDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>DÉPART</Text>
              <Text style={styles.routeAddress} numberOfLines={1}>{pickup}</Text>
            </View>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routeStop}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>ARRIVÉE</Text>
              <Text style={styles.routeAddress} numberOfLines={1}>{destination}</Text>
            </View>
          </View>
        </View>

        {/* Footer Confirm */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.confirmButton, pressed && { opacity: 0.88 }]}
            onPress={handleConfirmService}
          >
            <Text style={styles.confirmButtonText}>
              Voir le résumé · {formatMillimes(SERVICE.fareMillimes)}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </Screen>
    );
  }

  const styles = StyleSheet.create({
    screen: {
      paddingHorizontal: 20,
      flex: 1,
    },
    header: {
      height: 60,
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
    headerTitle: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
    },
    title: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '900',
      marginTop: 18,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 4,
      marginBottom: 20,
    },
    vehicleCard: {
      backgroundColor: '#181822',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#2D2D3D',
      overflow: 'hidden',
    },
    scooterIllustration: {
      height: 150,
      backgroundColor: '#22222C',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    scooterEmoji: {
      fontSize: 82,
    },
    availableBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: '#121218',
    },
    availableDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.success,
    },
    availableText: {
      color: colors.success,
      fontSize: 10,
      fontWeight: '800',
    },
    vehicleDetails: {
      padding: 16,
    },
    vehicleTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    routeCard: {
      backgroundColor: '#181822',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#2D2D3D',
      padding: 14,
      marginTop: 16,
    },
    routeStop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    pickupDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.success,
    },
    routeDivider: {
      height: 16,
      borderLeftWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      marginLeft: 5,
    },
    routeLabel: {
      color: colors.textSecondary,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    routeAddress: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
      marginTop: 3,
    },
    featureList: {
      gap: 9,
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    feature: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    featureText: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    serviceName: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
    etaText: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    fareText: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: '900',
    },
    description: {
      color: '#A1A1AA',
      fontSize: 12,
      lineHeight: 17,
      marginTop: 10,
    },
    footer: {
      marginTop: 'auto',
      paddingBottom: 32,
      paddingTop: 16,
    },
    confirmButton: {
      height: 54,
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
    confirmButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },
  });
