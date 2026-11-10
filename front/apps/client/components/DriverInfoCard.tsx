import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { DriverInfo } from '../types/delivery';

type DriverInfoCardProps = {
  driver: DriverInfo | null;
  roleDescription?: string;
  isAssigned?: boolean;
};

export function DriverInfoCard({
  driver,
  roleDescription = 'Votre coursier attitré',
  isAssigned = false,
}: DriverInfoCardProps) {
  if (!driver) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.searchingPulse}>
          <Ionicons name="search" size={24} color={colors.primary} />
        </View>
        <View style={styles.emptyTextWrapper}>
          <Text style={styles.searchingTitle}>{isAssigned ? 'Coursier affecté' : "Recherche d'un coursier..."}</Text>
          <Text style={styles.searchingDesc}>
            {isAssigned
              ? 'Sa position GPS est partagée avec vous en direct.'
              : 'Attribution automatique du meilleur coursier disponible à proximité.'}
          </Text>
        </View>
      </View>
    );
  }

  const handleCall = () => {
    if (driver.phone) {
      Linking.openURL(`tel:${driver.phone}`).catch(() => {
        Alert.alert('Appel direct', `Numéro du livreur : ${driver.phone}`);
      });
    }
  };

  const handleMessage = () => {
    if (driver.phone) {
      Linking.openURL(`sms:${driver.phone}`).catch(() => {
        Alert.alert('SMS direct', `Numéro du livreur : ${driver.phone}`);
      });
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Image
          source={{
            uri:
              driver.avatarUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
          }}
          style={styles.avatar}
          contentFit="cover"
        />

        <View style={styles.info}>
          <Text style={styles.driverName}>{driver.name}</Text>
          <Text style={styles.role}>{roleDescription}</Text>

          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#FBBF24" />
            <Text style={styles.ratingText}>{driver.rating.toFixed(1)}</Text>
            <Text style={styles.completedCount}>
              ({driver.completedRidesCount} courses)
            </Text>
          </View>
        </View>

        {/* Contact actions */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.75 }]}
            onPress={handleCall}
            accessibilityLabel="Appeler le coursier"
          >
            <Ionicons name="call" size={18} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.75 }]}
            onPress={handleMessage}
            accessibilityLabel="Envoyer un message au coursier"
          >
            <Ionicons name="chatbubble" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* Vehicle Info pill */}
      <View style={styles.vehicleRow}>
        <Ionicons name="bicycle" size={16} color={colors.primary} />
        <Text style={styles.vehicleModel}>{driver.vehicleModel}</Text>
        <View style={styles.plateBadge}>
          <Text style={styles.plateText}>{driver.plateNumber}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#181820',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2E2E3C',
    padding: 16,
    marginVertical: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#272733',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  info: {
    flex: 1,
  },
  driverName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  role: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  completedCount: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#262633',
    borderWidth: 1,
    borderColor: '#3D3D4E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#121216',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#262633',
  },
  vehicleModel: {
    color: '#D4D4D8',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  plateBadge: {
    backgroundColor: '#252533',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#3B3B4C',
  },
  plateText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#181820',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2E2E3C',
    padding: 18,
    marginVertical: 10,
  },
  searchingPulse: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 38, 56, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 38, 56, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTextWrapper: {
    flex: 1,
  },
  searchingTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  searchingDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
});
