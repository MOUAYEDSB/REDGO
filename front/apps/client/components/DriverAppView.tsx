import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ActiveDriverMissionRow, DriverProfileRow, OpenDriverMissionRow } from '@redgo/shared';
import { colors } from '../constants/theme';
import { useRedgoAuth } from '../context/RedgoAuthContext';
import { authEnabled } from '../services/auth';
import {
  acceptDriverMission,
  getDriverProfile,
  getMyActiveDriverMission,
  listOpenDriverMissions,
  setDriverOnline,
  updateDriverMissionStatus,
} from '../services/driverMissions';
import { markMissionReadyForCash } from '../services/cashPayment';
import { formatMillimes } from '../services/cart';

type DriverAppViewProps = {
  userId: string | null;
  isPreview: boolean;
  isLoading: boolean;
  sessionError: string | null;
  canSwitchSpace: boolean;
  onSwitchSpace: () => void;
};

export default function DriverAppView({
  userId,
  isPreview,
  isLoading,
  sessionError,
  canSwitchSpace,
  onSwitchSpace,
}: DriverAppViewProps) {
  const [profile, setProfile] = useState<DriverProfileRow | null>(null);
  const [activeMission, setActiveMission] = useState<ActiveDriverMissionRow | null>(null);
  const [openMissions, setOpenMissions] = useState<OpenDriverMissionRow[]>([]);
  const [isLoadingMissions, setIsLoadingMissions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, profile: authProfile, signOut } = useRedgoAuth();
  const name = authProfile?.full_name || user?.user_metadata?.full_name || 'Chauffeur REDGO';
  const phone = authProfile?.phone || user?.phone || 'Téléphone non renseigné';
  const email = user?.email || 'E-mail non renseigné';

  const refresh = useCallback(async () => {
    if (isPreview || !userId) return;
    setError(null);
    setIsLoadingMissions(true);
    try {
      const [nextProfile, nextActive] = await Promise.all([
        getDriverProfile(userId),
        getMyActiveDriverMission(),
      ]);
      const nextOpen = nextProfile.is_online && !nextActive ? await listOpenDriverMissions() : [];
      setProfile(nextProfile);
      setActiveMission(nextActive);
      setOpenMissions(nextOpen);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setIsLoadingMissions(false);
    }
  }, [isPreview, userId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const perform = async (action: () => Promise<void>) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleOnline = async () => {
    if (!profile || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await setDriverOnline(profile.user_id, !profile.is_online);
      setProfile(updated);
      setOpenMissions(updated.is_online && !activeMission ? await listOpenDriverMissions() : []);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  };

  const performActiveMissionStep = () => {
    if (!activeMission) return;
    if (activeMission.mission_status === 'assigned') {
      void perform(() => acceptDriverMission(activeMission.mission_id));
    } else if (activeMission.mission_status === 'accepted') {
      void perform(() => updateDriverMissionStatus(activeMission.mission_id, 'in_progress'));
    } else if (isReadyForCash(activeMission)) {
      router.push('/driver/cash-payment');
    } else {
      void perform(() => markMissionReadyForCash(activeMission.mission_id));
    }
  };

  const isReady = activeMission ? isReadyForCash(activeMission) : false;

  const handleSignOut = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await signOut();
      router.replace('/welcome');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  };

  const summaryCards = [
    {
      label: 'Disponibilité',
      value: profile?.is_online ? 'En ligne' : 'Hors ligne',
      accent: profile?.is_online ? '#14532D' : '#3A3030',
    },
    {
      label: 'Missions',
      value: activeMission ? '1 active' : `${openMissions.length}`,
      accent: activeMission ? colors.primary : '#2B2A32',
    },
    {
      label: 'Zone',
      value: profile?.city || 'Msaken',
      accent: '#2D2342',
    },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={styles.logo}><Text style={styles.logoText}>R</Text></View>
          <View>
            <Text style={styles.title}>REDGO</Text>
            <Text style={styles.subtitle}>Bonjour, {name.split(' ')[0] || 'chauffeur'}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Actualiser les missions"
            onPress={() => void refresh()}
            style={styles.refreshButton}
          >
            <Ionicons name="refresh" size={18} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/driver/profile')}
            style={styles.avatarButton}
          >
            <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.locationBar}>
        <Ionicons name="location" size={16} color={colors.primary} />
        <View style={styles.locationTextWrap}>
          <Text style={styles.locationLabel}>Zone active</Text>
          <Text style={styles.locationValue}>{profile?.city || 'Msaken'} • M'saken & Messaadine</Text>
        </View>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{name}</Text>
          <Text style={styles.profileMeta}>{phone}</Text>
          <Text style={styles.profileMeta}>{email}</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        {summaryCards.map((item) => (
          <View key={item.label} style={[styles.summaryCard, { backgroundColor: item.accent }]}>
            <Text style={styles.summaryLabel}>{item.label}</Text>
            <Text style={styles.summaryValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      {isPreview ? (
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.noticeText}>
            Aperçu de l’interface uniquement. Connectez un compte chauffeur approuvé pour voir les missions réelles.
          </Text>
        </View>
      ) : null}

      {sessionError || error ? (
        <Text accessibilityRole="alert" style={styles.error}>{sessionError || error}</Text>
      ) : null}

      {!isPreview && !isLoading && !userId ? (
        <Text accessibilityRole="alert" style={styles.error}>Aucune session chauffeur authentifiée.</Text>
      ) : null}

      {isPreview || !userId ? null : (
        <View style={styles.statusCard}>
          <View style={styles.statusCopy}>
            <Text style={styles.cardTitle}>Disponibilité chauffeur</Text>
            <Text style={styles.cardDescription}>
              {profile?.is_online
                ? 'Vous êtes en ligne et pouvez recevoir des missions éligibles.'
                : 'Passez en ligne pour recevoir des missions.'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: profile?.is_online ?? false, disabled: !profile || isSubmitting }}
            disabled={!profile || isSubmitting}
            onPress={() => void toggleOnline()}
            style={[styles.onlineToggle, profile?.is_online && styles.onlineToggleActive, (!profile || isSubmitting) && styles.disabled]}
          >
            <Text style={styles.onlineToggleText}>{profile?.is_online ? 'EN LIGNE' : 'HORS LIGNE'}</Text>
          </Pressable>
        </View>
      )}

      {activeMission ? (
        <View style={styles.missionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mission en cours</Text>
            <Text style={styles.missionType}>{missionTypeLabel(activeMission.mission_type)}</Text>
          </View>
          <Text style={styles.reference}>{activeMission.reference}</Text>
          {activeMission.pickup_address ? <MissionAddress label="Départ" value={activeMission.pickup_address} /> : null}
          <MissionAddress label="Destination" value={activeMission.destination_address} />
          <View style={styles.amountRow}>
            <Text style={styles.muted}>À encaisser en espèces</Text>
            <Text style={styles.amount}>{formatMillimes(activeMission.amount_millimes)}</Text>
          </View>
          <Text style={styles.muted}>Étape : {activeMission.service_status.replaceAll('_', ' ')}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={performActiveMissionStep}
            style={[styles.primaryButton, isSubmitting && styles.disabled]}
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : null}
            <Text style={styles.primaryText}>{activeMissionAction(activeMission, isReady)}</Text>
          </Pressable>
          {isReady ? (
            <Text style={styles.hint}>Scannez le QR du client et confirmez seulement après réception de l’argent.</Text>
          ) : null}
        </View>
      ) : null}

      {!activeMission && !isPreview ? (
        <>
          <Text style={styles.sectionTitle}>Missions disponibles</Text>
          {isLoading || isLoadingMissions ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : !profile?.is_online ? (
            <Text style={styles.empty}>Passez en ligne pour consulter les missions correspondant à vos disponibilités.</Text>
          ) : openMissions.length === 0 ? (
            <Text style={styles.empty}>Aucune mission disponible pour le moment.</Text>
          ) : openMissions.map((mission) => (
            <View key={mission.mission_id} style={styles.missionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.reference}>{mission.reference}</Text>
                <Text style={styles.missionType}>{missionTypeLabel(mission.mission_type)}</Text>
              </View>
              <MissionAddress label="Départ" value={mission.pickup_address} />
              <MissionAddress label="Destination" value={mission.destination_address} />
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={() => void perform(() => acceptDriverMission(mission.mission_id))}
                style={[styles.primaryButton, isSubmitting && styles.disabled]}
              >
                <Text style={styles.primaryText}>Accepter la mission</Text>
              </Pressable>
            </View>
          ))}
        </>
      ) : null}

      {isLoading && !isPreview ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}

      {canSwitchSpace ? (
        <Pressable
          accessibilityRole="button"
          onPress={onSwitchSpace}
          style={({ pressed }) => [styles.switchButton, pressed && styles.pressed]}
        >
          <Ionicons name="swap-horizontal-outline" size={18} color={colors.text} />
          <Text style={styles.switchText}>Retour à l’espace client</Text>
        </Pressable>
      ) : null}

      {authEnabled ? (
        <Pressable accessibilityRole="button" disabled={isSubmitting} style={styles.logoutButton} onPress={() => void handleSignOut()}>
          <Text style={styles.logoutText}>{isSubmitting ? 'Déconnexion…' : 'Se déconnecter'}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function isReadyForCash(mission: ActiveDriverMissionRow) {
  return mission.mission_status === 'in_progress'
    && (mission.service_status === 'delivered' || mission.service_status === 'ride_completed');
}

function activeMissionAction(mission: ActiveDriverMissionRow, isReady: boolean) {
  if (mission.mission_status === 'assigned') return 'Accepter la mission';
  if (mission.mission_status === 'accepted') return 'Démarrer la mission';
  return isReady ? 'Scanner le QR de paiement' : 'Mission terminée, demander le paiement';
}

function missionTypeLabel(type: OpenDriverMissionRow['mission_type']) {
  return type === 'delivery' ? 'LIVRAISON' : 'SCOOTER TAXI';
}

function MissionAddress({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.addressRow}>
      <Text style={styles.addressLabel}>{label}</Text>
      <Text style={styles.addressValue}>{value}</Text>
    </View>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Impossible de charger ou mettre à jour les missions.';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 18, paddingTop: 26, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 16 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.text, fontSize: 25, fontWeight: '900' },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  refreshButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  avatarButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  locationBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1A1A1D', borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  locationTextWrap: { flex: 1 },
  locationLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  locationValue: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 2 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 14 },
  avatarWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  profileInfo: { flex: 1 },
  profileName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  profileMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 3 },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  navPill: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  navPillActive: { backgroundColor: '#1E1410', borderColor: colors.primary },
  navPillText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
  navPillTextActive: { color: colors.primary },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  summaryCard: { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, minHeight: 78, justifyContent: 'center' },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  summaryValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginTop: 8 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#271417', borderWidth: 1, borderColor: '#552127', borderRadius: 14, padding: 13, marginBottom: 16 },
  noticeText: { color: '#F2B7BB', fontSize: 12, lineHeight: 18, flex: 1 },
  error: { color: colors.error, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16 },
  statusCopy: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  cardDescription: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 5 },
  onlineToggle: { minHeight: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3A3030', borderRadius: 12, paddingHorizontal: 10 },
  onlineToggleActive: { backgroundColor: '#14532D' },
  onlineToggleText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  disabled: { opacity: 0.6 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 25, marginBottom: 11 },
  missionCard: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, marginTop: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  missionType: { color: colors.primary, fontSize: 9, fontWeight: '900' },
  reference: { color: colors.text, fontSize: 15, fontWeight: '900', marginBottom: 10 },
  addressRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 8 },
  addressLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  addressValue: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 4 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 13, marginBottom: 9 },
  amount: { color: colors.text, fontSize: 16, fontWeight: '900' },
  muted: { color: colors.textSecondary, fontSize: 11 },
  primaryButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 13, marginTop: 14, paddingHorizontal: 12 },
  primaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  hint: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 10 },
  empty: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, backgroundColor: colors.card, borderRadius: 14, padding: 14 },
  loader: { marginVertical: 20 },
  switchButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, marginTop: 23 },
  switchText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  logoutButton: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.error, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  logoutText: { color: colors.error, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
