import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { RideSearchingAnimation } from '../../components/RideSearchingAnimation';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { formatMillimes } from '../../services/cart';
import { LocationConnectionState, subscribeToDriverLocation } from '../../services/driverLocation';

  export default function BookingSearchingScreen() {
    const {
      id = 'ride_101',
      reference = 'TX-4091',
      pickup = 'M\'Saken Centre',
      destination = 'Messaadine Centre',
      fare = '4500',
    } = useLocalSearchParams<{
      id?: string;
      reference?: string;
      pickup?: string;
      destination?: string;
      fare?: string;
    }>();

    const [trackingState, setTrackingState] = useState<LocationConnectionState>('connecting');
    const [trackingMessage, setTrackingMessage] = useState('En attente d’un livreur affecté à cette course…');
    const fareMillimes = parseInt(fare, 10) || 4500;

    useEffect(() => {
      return subscribeToDriverLocation(
        String(id),
        () => {
          router.replace({
            pathname: `/ride/tracking/${id}`,
            params: {
              reference,
              pickup,
              destination,
              fare: fareMillimes.toString(),
            },
          });
        },
        (state, message) => {
          setTrackingState(state);
          if (message) setTrackingMessage(message);
        },
      );
    }, [id, reference, pickup, destination, fareMillimes]);

    const handleCancelSearch = () => {
      Alert.alert(
        'Annuler la recherche ?',
        'Êtes-vous sûr de vouloir annuler la recherche de chauffeur ?',
        [
          { text: 'Poursuivre la recherche', style: 'cancel' },
          {
            text: 'Annuler la course',
            style: 'destructive',
            onPress: () => router.replace('/(tabs)/home'),
          },
        ],
      );
    };

    return (
      <Screen style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>Recherche en cours</Text>
          <Pressable
            style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
            onPress={handleCancelSearch}
            hitSlop={8}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Animated Radar Pulse */}
        <RideSearchingAnimation />

        <Text style={styles.title}>Recherche d'un scooter disponible</Text>
        <Text style={styles.subtitle}>
          Le suivi s’ouvrira dès que le livreur affecté partagera sa position GPS.
        </Text>
        <View style={styles.connection}>
          <View style={[styles.connectionDot, trackingState === 'live' && styles.connectionLive]} />
          <Text style={styles.connectionText}>{trackingMessage}</Text>
        </View>

        {/* Trip Recap Card */}
        <View style={styles.tripCard}>
          <View style={styles.tripRow}>
            <Ionicons name="radio-button-on" size={16} color={colors.success} />
            <Text style={styles.tripText} numberOfLines={1}>
              {pickup}
            </Text>
          </View>

          <View style={styles.tripDivider} />

          <View style={styles.tripRow}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <Text style={styles.tripText} numberOfLines={1}>
              {destination}
            </Text>
          </View>

          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Tarif garanti :</Text>
            <Text style={styles.fareValue}>{formatMillimes(fareMillimes)} en espèces</Text>
          </View>
        </View>

        {/* Cancel Action */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.8 }]}
            onPress={handleCancelSearch}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.error} />
            <Text style={styles.cancelButtonText}>Annuler la recherche</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const styles = StyleSheet.create({
    screen: {
      paddingHorizontal: 22,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 34,
    },
    header: {
      width: '100%',
      height: 60,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 8,
    },
    headerTitle: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    closeButton: {
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
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
      marginTop: 8,
      paddingHorizontal: 16,
    },
    connection: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    connectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning },
    connectionLive: { backgroundColor: colors.success },
    connectionText: { color: colors.textSecondary, fontSize: 12, flexShrink: 1 },
    tripCard: {
      width: '100%',
      backgroundColor: '#181822',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#2D2D3D',
      padding: 16,
      marginVertical: 18,
    },
    tripRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    tripText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
      flex: 1,
    },
    tripDivider: {
      height: 14,
      width: 2,
      backgroundColor: '#2F2F3E',
      marginLeft: 7,
      marginVertical: 2,
    },
    fareRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: '#262634',
      paddingTop: 12,
      marginTop: 12,
    },
    fareLabel: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    fareValue: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '900',
    },
    footer: {
      width: '100%',
    },
    cancelButton: {
      height: 52,
      borderRadius: 16,
      backgroundColor: '#181822',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.35)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    cancelButtonText: {
      color: colors.error,
      fontSize: 15,
      fontWeight: '800',
    },
  });
