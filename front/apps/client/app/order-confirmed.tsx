import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { colors } from '../constants/theme';
import { formatMillimes } from '../services/cart';

  export default function OrderConfirmedScreen() {
    const {
      id = 'order_default',
      reference = 'RG-1048',
      total = '24500',
      address = 'M\'Saken Centre, Avenue Habib Bourguiba',
      hasCourses = '1',
      hasFood = '1',
    } = useLocalSearchParams<{
      id?: string;
      reference?: string;
      total?: string;
      address?: string;
      hasCourses?: string;
      hasFood?: string;
    }>();

    const totalMillimes = parseInt(total, 10) || 24500;

    const handleStartLiveTracking = () => {
      router.replace(`/order/${id}?reference=${reference}&hasCourses=${hasCourses}&hasFood=${hasFood}`);
    };

    return (
      <Screen style={styles.screen}>
        {/* Animated Success Badge */}
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={48} color="#FFFFFF" />
        </View>

        <Text style={styles.title}>Commande confirmée !</Text>
        <Text style={styles.subtitle}>
          Votre commande est prise en charge. Le paiement se fera intégralement en espèces à la livraison.
        </Text>

        {/* Details Card */}
        <View style={styles.summaryCard}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Numéro de référence</Text>
            <Text style={styles.referenceText}>{reference}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Montant en espèces</Text>
            <Text style={styles.totalText}>{formatMillimes(totalMillimes)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Adresse de livraison</Text>
            <Text style={styles.addressText} numberOfLines={2}>
              {address}
            </Text>
          </View>

          <View style={styles.cashNotice}>
            <Ionicons name="cash-outline" size={18} color={colors.success} />
            <Text style={styles.cashNoticeText}>
              Préparez l'appoint exact pour le livreur à son arrivée.
            </Text>
          </View>
        </View>

        {/* Live Searching Status Banner */}
        <View style={styles.searchingPill}>
          <View style={styles.pulseDot} />
          <Text style={styles.searchingPillText}>
            Attribution du livreur le plus proche en cours...
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.88 }]}
            onPress={handleStartLiveTracking}
          >
            <Ionicons name="map" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Suivre ma livraison en direct</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.8 }]}
            onPress={() => router.replace('/(tabs)/home')}
          >
            <Text style={styles.secondaryButtonText}>Retour à l'accueil</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const styles = StyleSheet.create({
    screen: {
      paddingHorizontal: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      shadowColor: colors.success,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.5,
      shadowRadius: 14,
      elevation: 8,
    },
    title: {
      color: '#FFFFFF',
      fontSize: 26,
      fontWeight: '900',
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
      marginTop: 8,
      paddingHorizontal: 10,
    },
    summaryCard: {
      width: '100%',
      backgroundColor: '#181822',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: '#2D2D3D',
      padding: 18,
      marginTop: 24,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    metaLabel: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    referenceText: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: '900',
    },
    totalText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '900',
    },
    addressText: {
      color: '#E4E4E7',
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'right',
      maxWidth: '55%',
    },
    divider: {
      height: 1,
      backgroundColor: '#262634',
      marginVertical: 10,
    },
    cashNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(34, 197, 94, 0.08)',
      borderRadius: 12,
      padding: 10,
      marginTop: 12,
    },
    cashNoticeText: {
      color: '#A1A1AA',
      fontSize: 11,
      flex: 1,
    },
    searchingPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(255, 38, 56, 0.1)',
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: 'rgba(255, 38, 56, 0.3)',
      marginTop: 18,
    },
    pulseDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    searchingPillText: {
      color: '#E4E4E7',
      fontSize: 12,
      fontWeight: '700',
    },
    actions: {
      width: '100%',
      gap: 12,
      marginTop: 26,
    },
    primaryButton: {
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
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900',
    },
    secondaryButton: {
      height: 50,
      borderRadius: 16,
      backgroundColor: '#181822',
      borderWidth: 1,
      borderColor: '#2F2F3D',
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      color: '#D4D4D8',
      fontSize: 14,
      fontWeight: '800',
    },
  });
