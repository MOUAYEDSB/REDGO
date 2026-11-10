import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';

  const DESTINATION_PRESETS = [
    { id: '1', title: 'Messaadine Centre', subtitle: 'Zone industrielle / Route de Sousse', distanceKm: 4.8 },
    { id: '2', title: 'Hôpital Régional de M\'Saken', subtitle: 'Route de Kairouan', distanceKm: 3.2 },
    { id: '3', title: 'Marché Central de M\'Saken', subtitle: 'Rue Ali Belhouane', distanceKm: 1.8 },
    { id: '4', title: 'Zone Universitaire / ISET', subtitle: 'Périphérie Messaadine', distanceKm: 6.2 },
  ];

  export default function BookingDestinationScreen() {
    const { pickup = 'M\'Saken Centre', pickupLat, pickupLng } = useLocalSearchParams<{
      pickup?: string;
      pickupLat?: string;
      pickupLng?: string;
    }>();
    const [destination, setDestination] = useState(DESTINATION_PRESETS[0].title);
    const [customDestination, setCustomDestination] = useState('');

    const finalDestination = customDestination.trim() || destination;

    const handleProceed = () => {
      router.push({
        pathname: '/booking/service',
        params: {
          pickup,
          pickupLat,
          pickupLng,
          destination: finalDestination,
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
          <Text style={styles.headerTitle}>Destination</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Pickup summary pill */}
        <View style={styles.pickupPill}>
          <Ionicons name="radio-button-on" size={16} color={colors.success} />
          <Text style={styles.pickupPillText} numberOfLines={1}>
            Départ : {pickup}
          </Text>
        </View>

        <Text style={styles.stepTitle}>Où allez-vous ?</Text>
        <Text style={styles.stepSubtitle}>
          Sélectionnez votre lieu d'arrivée à M'Saken ou Messaadine
        </Text>

        {/* Input */}
        <View style={styles.searchBox}>
          <Ionicons name="location" size={20} color={colors.primary} />
          <TextInput
            value={customDestination}
            onChangeText={setCustomDestination}
            placeholder="Saisir une destination..."
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
          />
          {customDestination.length > 0 && (
            <Pressable onPress={() => setCustomDestination('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Interactive Map Picker Option */}
        <Pressable
          style={({ pressed }) => [styles.mapOption, pressed && { opacity: 0.8 }]}
          onPress={() => router.push({
            pathname: '/booking/map',
            params: {
              mode: 'itinerary',
              flow: 'booking',
              pickup,
              pickupLat,
              pickupLng,
              address: finalDestination,
            },
          })}
        >
          <View style={styles.mapIconCircle}>
            <Ionicons name="map" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mapOptionTitle}>Choisir librement sur la carte</Text>
            <Text style={styles.mapOptionSubtitle}>Départ GPS et arrivée à l'endroit de votre choix</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>

        {/* Suggestions */}
        <Text style={styles.sectionHeading}>Destinations courantes</Text>

        <View style={styles.recentsList}>
          {DESTINATION_PRESETS.map((item) => {
            const isSelected = destination === item.title && !customDestination;
            return (
              <Pressable
                key={item.id}
                style={[styles.recentItem, isSelected && styles.recentItemActive]}
                onPress={() => {
                  setDestination(item.title);
                  setCustomDestination('');
                }}
              >
                <Ionicons
                  name={isSelected ? 'radio-button-on' : 'location-outline'}
                  size={20}
                  color={isSelected ? colors.primary : colors.textSecondary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recentTitle, isSelected && styles.recentTitleActive]}>
                    {item.title}
                  </Text>
                  <Text style={styles.recentSubtitle}>{item.subtitle}</Text>
                </View>
                <Text style={styles.distanceBadge}>~{item.distanceKm} km</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Footer Confirm */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.confirmButton, pressed && { opacity: 0.88 }]}
            onPress={handleProceed}
          >
            <Text style={styles.confirmButtonText}>Choisir la formule</Text>
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
    pickupPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#181822',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#2A2A38',
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginTop: 12,
    },
    pickupPillText: {
      color: '#D4D4D8',
      fontSize: 12,
      fontWeight: '700',
      flex: 1,
    },
    stepTitle: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '900',
      marginTop: 16,
    },
    stepSubtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 4,
      marginBottom: 18,
    },
    searchBox: {
      height: 56,
      borderRadius: 16,
      backgroundColor: '#181822',
      borderWidth: 1,
      borderColor: '#2D2D3C',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 10,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: 14,
    },
    mapOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#181822',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#2D2D3C',
      padding: 14,
      marginBottom: 20,
    },
    mapIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(255, 38, 56, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapOptionTitle: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
    mapOptionSubtitle: {
      color: colors.textSecondary,
      fontSize: 11,
      marginTop: 2,
    },
    sectionHeading: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    recentsList: {
      gap: 8,
    },
    recentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#181822',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#2A2A38',
      padding: 14,
    },
    recentItemActive: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(255, 38, 56, 0.08)',
    },
    recentTitle: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    recentTitleActive: {
      color: colors.primary,
      fontWeight: '800',
    },
    recentSubtitle: {
      color: colors.textSecondary,
      fontSize: 11,
      marginTop: 2,
    },
    distanceBadge: {
      color: '#A1A1AA',
      fontSize: 11,
      fontWeight: '700',
      backgroundColor: '#121218',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
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
