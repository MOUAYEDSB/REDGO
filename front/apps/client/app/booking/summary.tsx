import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { formatMillimes } from '../../services/cart';
import { createScooterRide } from '../../services/ride';
import { MESSAADINE_CENTER, MSAKEN_CENTER } from '../../services/delivery';

  export default function BookingSummaryScreen() {
    const {
      pickup = 'M\'Saken Centre, Avenue Habib Bourguiba',
      destination = 'Messaadine Centre',
      serviceName = 'Scooter Express (1 passager)',
      fare = '4500',
      duration = '12',
      pickupLat,
      pickupLng,
      destinationLat,
      destinationLng,
    } = useLocalSearchParams<{
      pickup?: string;
      destination?: string;
      serviceName?: string;
      fare?: string;
      duration?: string;
      pickupLat?: string;
      pickupLng?: string;
      destinationLat?: string;
      destinationLng?: string;
    }>();

    const fareMillimes = parseInt(fare, 10) || 4500;
    const durationMinutes = parseInt(duration, 10) || 12;
    const distanceKm = 4.8;
    const latitude = Number(pickupLat);
    const longitude = Number(pickupLng);
    const pickupLocation = Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : MSAKEN_CENTER;
    const destinationLatitude = Number(destinationLat);
    const destinationLongitude = Number(destinationLng);
    const destinationLocation = Number.isFinite(destinationLatitude) && Number.isFinite(destinationLongitude)
      ? { latitude: destinationLatitude, longitude: destinationLongitude }
      : MESSAADINE_CENTER;

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirmRide = async () => {
      if (isSubmitting) return;
      setIsSubmitting(true);

      try {
        const ride = await createScooterRide({
          pickupAddress: pickup,
          pickupLocation,
          destinationAddress: destination,
          destinationLocation,
          durationMinutes,
        });

        router.replace({
          pathname: '/booking/searching',
          params: {
            id: ride.id,
            reference: ride.reference,
            pickup,
            destination,
            fare: ride.metrics.fareMillimes.toString(),
          },
        });
      } catch (error: any) {
        Alert.alert(
          'Erreur',
          error?.message || 'Impossible de créer la réservation. Veuillez réessayer.',
        );
        setIsSubmitting(false);
      }
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
          <Text style={styles.headerTitle}>Résumé de la course</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.title}>Détails de votre trajet</Text>

        {/* Itinerary Card */}
        <View style={styles.itineraryCard}>
          {/* Pickup Row */}
          <View style={styles.stopRow}>
            <View style={styles.dotGreen} />
            <View style={styles.stopTextWrap}>
              <Text style={styles.stopLabel}>POINT DE DÉPART</Text>
              <Text style={styles.stopAddress}>{pickup}</Text>
            </View>
          </View>

          {/* Vertical dotted connector */}
          <View style={styles.connectorLine} />

          {/* Destination Row */}
          <View style={styles.stopRow}>
            <View style={styles.dotRed} />
            <View style={styles.stopTextWrap}>
              <Text style={styles.stopLabel}>DESTINATION</Text>
              <Text style={styles.stopAddress}>{destination}</Text>
            </View>
          </View>
        </View>

        {/* Metrics Row */}
        <View style={styles.metricsCard}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{distanceKm} km</Text>
            <Text style={styles.metricLabel}>Distance</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>~{durationMinutes} min</Text>
            <Text style={styles.metricLabel}>Durée estimée</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, { color: colors.primary }]}>
              {formatMillimes(fareMillimes)}
            </Text>
            <Text style={styles.metricLabel}>Tarif indicatif</Text>
          </View>
        </View>
        <Text style={styles.tariffNotice}>
          Le tarif final est calculé et confirmé par le serveur lors de la réservation.
        </Text>

        {/* Service Details Card */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="bicycle" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>{serviceName}</Text>
              <Text style={styles.detailSubtitle}>1 passager · Casque protecteur fourni</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="cash" size={18} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>Paiement en espèces</Text>
              <Text style={styles.detailSubtitle}>À régler directement au chauffeur à l'arrivée</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          </View>
        </View>

        {/* Footer Confirm */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.confirmButton,
              isSubmitting && styles.buttonDisabled,
              pressed && !isSubmitting && { opacity: 0.88 },
            ]}
            onPress={handleConfirmRide}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.confirmButtonText}>Confirmation de la course...</Text>
              </View>
            ) : (
              <View style={styles.buttonInner}>
                <Text style={styles.confirmButtonText}>
                  Confirmer la course · {formatMillimes(fareMillimes)}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
            )}
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
      marginBottom: 16,
    },
    itineraryCard: {
      backgroundColor: '#181822',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: '#2D2D3D',
      padding: 18,
    },
    stopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    dotGreen: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.success,
      marginTop: 4,
    },
    dotRed: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.primary,
      marginTop: 4,
    },
    connectorLine: {
      width: 2,
      height: 24,
      backgroundColor: '#323244',
      marginLeft: 6,
      marginVertical: 2,
    },
    stopTextWrap: {
      flex: 1,
    },
    stopLabel: {
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    stopAddress: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
      marginTop: 2,
    },
    metricsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      backgroundColor: '#181822',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#2A2A38',
      paddingVertical: 14,
      marginTop: 14,
    },
    tariffNotice: {
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 7,
    },
    metricItem: {
      alignItems: 'center',
    },
    metricValue: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },
    metricLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      marginTop: 2,
    },
    metricDivider: {
      width: 1,
      height: 28,
      backgroundColor: '#2D2D3E',
    },
    detailsCard: {
      backgroundColor: '#181822',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#2D2D3D',
      padding: 16,
      marginTop: 14,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: '#121218',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#2F2F3D',
    },
    detailTitle: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
    detailSubtitle: {
      color: colors.textSecondary,
      fontSize: 11,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: '#262634',
      marginVertical: 12,
    },
    footer: {
      marginTop: 'auto',
      paddingBottom: 32,
      paddingTop: 16,
    },
    confirmButton: {
      height: 56,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    confirmButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },
  });
