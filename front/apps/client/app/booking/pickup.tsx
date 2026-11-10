import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';

  const RECENT_PICKUPS = [
    { id: '1', title: 'M\'Saken Centre', subtitle: 'Avenue Habib Bourguiba, près de la Mosquée' },
    { id: '2', title: 'Messaadine Centre', subtitle: 'Route de Sousse, rond-point central' },
    { id: '3', title: 'Gare Ferroviaire de M\'Saken', subtitle: 'Place de la Gare' },
  ];

  export default function BookingPickupScreen() {
    const [search, setSearch] = useState('');
    const [selectedPickup, setSelectedPickup] = useState(RECENT_PICKUPS[0].title);

    const handleConfirmPickup = () => {
      const pickupValue = search.trim() || selectedPickup;
      router.push({
        pathname: '/booking/destination',
        params: { pickup: pickupValue },
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
          <Text style={styles.headerTitle}>Scooter Taxi REDGO</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.stepTitle}>Point de départ</Text>
        <Text style={styles.stepSubtitle}>
          Où doit vous retrouver votre chauffeur à M'Saken ou Messaadine ?
        </Text>

        {/* Search Input */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher une adresse ou un repère..."
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Map Interactive Selection Option */}
        <Pressable
          style={({ pressed }) => [styles.mapOption, pressed && { opacity: 0.8 }]}
          onPress={() => router.push({ pathname: '/booking/map', params: { mode: 'itinerary', flow: 'booking' } })}
        >
          <View style={styles.mapIconCircle}>
            <Ionicons name="map" size={20} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mapOptionTitle}>Choisir le trajet sur la carte</Text>
            <Text style={styles.mapOptionSubtitle}>Départ et arrivée, en quelques gestes</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>

        {/* Recent Locations */}
        <Text style={styles.sectionHeading}>Lieux fréquents à M'Saken & Messaadine</Text>

        <View style={styles.recentsList}>
          {RECENT_PICKUPS.map((place) => {
            const isSelected = selectedPickup === place.title && !search;
            return (
              <Pressable
                key={place.id}
                style={[styles.recentItem, isSelected && styles.recentItemActive]}
                onPress={() => {
                  setSelectedPickup(place.title);
                  setSearch('');
                }}
              >
                <Ionicons
                  name={isSelected ? 'radio-button-on' : 'location-outline'}
                  size={20}
                  color={isSelected ? colors.primary : colors.textSecondary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recentTitle, isSelected && styles.recentTitleActive]}>
                    {place.title}
                  </Text>
                  <Text style={styles.recentSubtitle}>{place.subtitle}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Footer Confirm */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.confirmButton, pressed && { opacity: 0.88 }]}
            onPress={handleConfirmPickup}
          >
            <Text style={styles.confirmButtonText}>Valider le départ</Text>
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
    stepTitle: {
      color: '#FFFFFF',
      fontSize: 26,
      fontWeight: '900',
      marginTop: 18,
    },
    stepSubtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 4,
      marginBottom: 20,
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
      marginBottom: 14,
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
      marginBottom: 24,
    },
    mapIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
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
      marginBottom: 12,
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
