import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/ui';
import { colors } from '../../constants/theme';

  export default function RideDetailsScreen() {
    const { id = 'TX-4091' } = useLocalSearchParams<{ id?: string }>();

    return (
      <Screen scroll style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Détails de la course</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.statusBadge}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.statusText}>Course terminée</Text>
        </View>

        <Text style={styles.reference}>Référence #{id}</Text>

        {/* Itinerary */}
        <View style={styles.itineraryCard}>
          <Text style={styles.label}>TRAJET SCOOTER TAXI</Text>
          <Text style={styles.address}>M'Saken Centre, Avenue Habib Bourguiba</Text>
          <View style={styles.line} />
          <Text style={styles.address}>Messaadine Centre, Route de Sousse</Text>
        </View>

        {/* Metrics breakdown */}
        <View style={styles.row}>
          <View>
            <Text style={styles.rowLabel}>Date</Text>
            <Text style={styles.rowValue}>Aujourd'hui</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.rowLabel}>Montant réglé</Text>
            <Text style={styles.rowValueHighlight}>4.500 DT</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View>
            <Text style={styles.rowLabel}>Distance</Text>
            <Text style={styles.rowValue}>4.8 km</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.rowLabel}>Mode de paiement</Text>
            <Text style={styles.rowValue}>Espèces</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            title="Suivre en direct (GPS)"
            onPress={() => router.push(`/ride/tracking/${id}`)}
          />
          <View style={{ height: 10 }} />
          <Pressable
            style={styles.rebookButton}
            onPress={() => router.push('/booking/pickup')}
          >
            <Text style={styles.rebookButtonText}>Commander un autre trajet</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const styles = StyleSheet.create({
    screen: {
      paddingHorizontal: 20,
      paddingBottom: 40,
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
      fontSize: 18,
      fontWeight: '800',
    },
    statusBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(34, 197, 94, 0.12)',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginTop: 18,
    },
    statusText: {
      color: colors.success,
      fontSize: 12,
      fontWeight: '800',
    },
    reference: {
      color: colors.textSecondary,
      fontSize: 13,
      marginVertical: 14,
    },
    itineraryCard: {
      backgroundColor: '#181822',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#2D2D3D',
      padding: 18,
      marginBottom: 10,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    address: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    line: {
      height: 20,
      width: 2,
      backgroundColor: '#323244',
      marginLeft: 6,
      marginVertical: 4,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: '#252533',
    },
    rowLabel: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    rowValue: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 14,
      marginTop: 4,
    },
    rowValueHighlight: {
      color: colors.primary,
      fontWeight: '900',
      fontSize: 16,
      marginTop: 2,
    },
    actions: {
      marginTop: 24,
    },
    rebookButton: {
      height: 50,
      borderRadius: 16,
      backgroundColor: '#181822',
      borderWidth: 1,
      borderColor: '#2D2D3D',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rebookButtonText: {
      color: '#D4D4D8',
      fontSize: 14,
      fontWeight: '800',
    },
  });
