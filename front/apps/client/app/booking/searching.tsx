import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { RideSearchingAnimation } from '../../components/RideSearchingAnimation';
import { Screen } from '../../components/Screen';
import { colors } from '../../constants/theme';
import { formatMillimes } from '../../services/cart';
import { supabase } from '../../services/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

type SearchStatus = 'searching' | 'accepted' | 'cancelled' | 'error';

// ─── Component ───────────────────────────────────────────────────────────────

export default function BookingSearchingScreen() {
  const {
    id = '',
    reference = '',
    pickup = '',
    destination = '',
    fare = '2500',
  } = useLocalSearchParams<{
    id?: string;
    reference?: string;
    pickup?: string;
    destination?: string;
    fare?: string;
  }>();

  const fareMillimes = parseInt(fare, 10) || 2500;

  const [searchStatus, setSearchStatus] = useState<SearchStatus>('searching');
  const [statusMessage, setStatusMessage] = useState(
    'Recherche d\'un chauffeur disponible dans votre zone…',
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isNavigating = useRef(false);

  // ── Navigate to tracking screen once driver accepts ──────────────────────

  const goToTracking = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    router.replace({
      pathname: `/ride/tracking/${id}`,
      params: {
        reference,
        pickup,
        destination,
        fare: fareMillimes.toString(),
      },
    });
  };

  // ── Handle a row from scooter_rides and decide what to do ────────────────

  const handleRideRow = (row: Record<string, unknown>) => {
    const status = row.status as string | null;
    const driverId = row.driver_id as string | null;

    if (driverId || (status && status !== 'searching' && status !== 'pending')) {
      setSearchStatus('accepted');
      setStatusMessage('Chauffeur trouvé ! Redirection en cours…');
      goToTracking();
    }
  };

  // ── Elapsed timer (cosmetic) ─────────────────────────────────────────────

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Main polling + Realtime subscription ─────────────────────────────────

  useEffect(() => {
    if (!id) return;
    if (!supabase) {
      setStatusMessage('Configuration Supabase manquante. Vérifiez les variables d\'environnement.');
      setSearchStatus('error');
      return;
    }

    const client = supabase;
    let active = true;

    // ── 1. Poll scooter_rides every 2.5 s ──────────────────────────────────
    const pollRide = async () => {
      if (!active || isNavigating.current) return;
      try {
        const { data, error } = await (client as any)
          .from('scooter_rides')
          .select('id, status, driver_id')
          .eq('id', id)
          .maybeSingle();

        if (!active) return;
        if (error) {
          console.warn('[searching] poll error:', error.message);
          return;
        }
        if (data) handleRideRow(data as Record<string, unknown>);
      } catch (err) {
        console.warn('[searching] poll exception:', err);
      }
    };

    void pollRide(); // immediate first fetch
    const pollInterval = setInterval(() => void pollRide(), 2500);

    // ── 2. Realtime subscription on scooter_rides ──────────────────────────
    const channel = client
      .channel(`searching-ride:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scooter_rides',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          if (!active || isNavigating.current) return;
          const row = payload.new as Record<string, unknown>;
          handleRideRow(row);
        },
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') {
          setStatusMessage('En attente de l\'acceptation d\'un chauffeur…');
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Realtime failed — polling will still work
          setStatusMessage('Suivi en temps réel limité. Vérification toutes les 2s…');
        }
      });

    return () => {
      active = false;
      clearInterval(pollInterval);
      void client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Cancel ───────────────────────────────────────────────────────────────

  const handleCancelSearch = () => {
    Alert.alert(
      'Annuler la recherche ?',
      'Êtes-vous sûr de vouloir annuler la recherche de chauffeur ?',
      [
        { text: 'Poursuivre la recherche', style: 'cancel' },
        {
          text: 'Annuler la course',
          style: 'destructive',
          onPress: async () => {
            // Optionally mark ride as cancelled in DB
            if (id && supabase) {
              void (supabase as any)
                .from('scooter_rides')
                .update({ status: 'cancelled' })
                .eq('id', id);
            }
            router.replace('/(tabs)/home');
          },
        },
      ],
    );
  };

  // ── Format elapsed time ──────────────────────────────────────────────────

  const formatElapsed = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return mins > 0
      ? `${mins}m ${secs.toString().padStart(2, '0')}s`
      : `${secs}s`;
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const dotColor =
    searchStatus === 'accepted'
      ? colors.success
      : searchStatus === 'error'
        ? colors.error
        : colors.warning;

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

      <Text style={styles.title}>Recherche d&apos;un scooter disponible</Text>

      <Text style={styles.subtitle}>
        Dès qu&apos;un chauffeur accepte votre course, vous serez redirigé automatiquement.
      </Text>

      {/* Status pill */}
      <View style={styles.statusPill}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text style={styles.statusText}>{statusMessage}</Text>
      </View>

      {/* Elapsed */}
      <Text style={styles.elapsed}>⏱ {formatElapsed(elapsedSeconds)} d&apos;attente</Text>

      {/* Trip Recap Card */}
      <View style={styles.tripCard}>
        <View style={styles.tripRow}>
          <Ionicons name="radio-button-on" size={16} color={colors.success} />
          <Text style={styles.tripText} numberOfLines={2}>
            {pickup}
          </Text>
        </View>

        <View style={styles.tripDivider} />

        <View style={styles.tripRow}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={styles.tripText} numberOfLines={2}>
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

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 12,
    flexShrink: 1,
  },
  elapsed: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 6,
  },
  tripCard: {
    width: '100%',
    backgroundColor: '#181822',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D2D3D',
    padding: 16,
    marginVertical: 10,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
