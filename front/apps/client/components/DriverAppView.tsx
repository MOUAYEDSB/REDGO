import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ActiveDriverMissionRow, DriverProfileRow, OpenDriverMissionRow } from '@redgo/shared';
import { colors } from '../constants/theme';
import { useRedgoAuth } from '../context/RedgoAuthContext';
import { authEnabled } from '../services/auth';
import {
  acceptDriverMission,
  callCustomer,
  FALLBACK_OPEN_MISSIONS,
  fetchDriverEarningsSummary,
  getDriverProfile,
  getMyActiveDriverMission,
  listOpenDriverMissions,
  openNavigationApp,
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
  const [todayEarnings, setTodayEarnings] = useState({ todayMillimes: 10300, todayCount: 3, rating: 4.95 });
  const [isLoadingMissions, setIsLoadingMissions] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { user, profile: authProfile, signOut } = useRedgoAuth();
  const name = authProfile?.full_name || (user?.user_metadata?.full_name as string) || 'Chauffeur REDGO';
  const phone = authProfile?.phone || user?.phone || '+216 98 000 000';
  const vehicle = profile?.vehicle_model || 'Peugeot Tweet 125';

  const refresh = useCallback(async () => {
    if (isPreview || !userId) {
      setOpenMissions(FALLBACK_OPEN_MISSIONS);
      return;
    }
    setError(null);
    setIsLoadingMissions(true);
    try {
      const [nextProfile, nextActive, earningsSummary] = await Promise.all([
          getDriverProfile(userId).catch(() => null),
          getMyActiveDriverMission().catch(() => null),
          fetchDriverEarningsSummary(userId).catch(() => null),
        ]);
      const nextOpen = nextProfile.is_online && !nextActive ? await listOpenDriverMissions() : [];
      setProfile(nextProfile);

      if (nextProfile) setProfile(nextProfile);
      setActiveMission(nextActive);
      setOpenMissions(nextOpen);
      if (earningsSummary) setTodayEarnings(earningsSummary);

      const isOnline = nextProfile ? nextProfile.is_online : true;
      if (isOnline && !nextActive) {
        const nextOpen = await listOpenDriverMissions();
        setOpenMissions(nextOpen);
      } else {
        setOpenMissions([]);
      }
    } catch (cause) {
      setError(errorMessage(cause));
      setOpenMissions(FALLBACK_OPEN_MISSIONS);
    } finally {
      setIsLoadingMissions(false);
      setIsRefreshing(false);
    }
  }, [isPreview, userId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onPullRefresh = useCallback(() => {
    setIsRefreshing(true);
    void refresh();
  }, [refresh]);

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
      setNotice(updated.is_online ? 'Vous êtes maintenant EN LIGNE. Les missions disponibles s’affichent.' : 'Vous êtes HORS LIGNE.');
      setTimeout(() => setNotice(null), 3500);

      if (updated.is_online && !activeMission) {
        const missions = await listOpenDriverMissions();
        setOpenMissions(missions);
      } else {
        setOpenMissions([]);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOnline = profile?.is_online ?? true;

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
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onPullRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header Chauffeur */}
        <View style={styles.header}>
          <View style={styles.identity}>
            <View style={styles.logo}><Text style={styles.logoText}>R</Text></View>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logoImage}
              contentFit="contain"
            />
            <View>
              <Text style={styles.title}>REDGO</Text>
              <Text style={styles.subtitle}>Bonjour, {name.split(' ')[0] || 'chauffeur'}</Text>
              <View style={styles.brandRow}>
                <Text style={styles.brandTitle}>REDGO</Text>
                <View style={styles.driverBadge}>
                  <Text style={styles.driverBadgeText}>CHAUFFEUR</Text>
                </View>
              </View>
              <Text style={styles.driverName}>Bonjour, {name.split(' ')[0]}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Actualiser les missions"
              accessibilityLabel="Actualiser"
              onPress={() => void refresh()}
              style={styles.refreshButton}
              style={styles.actionBtn}
            >
              <Ionicons name="refresh" size={18} color={colors.text} />
              <Ionicons name="refresh" size={19} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/driver/profile')}
              style={styles.avatarButton}
              style={styles.avatarBtn}
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
            {/* Barre statut EN LIGNE / HORS LIGNE interactive */}
            <View style={[styles.statusBanner, isOnline ? styles.statusBannerOnline : styles.statusBannerOffline]}>
              <View style={styles.statusLeft}>
                <View style={[styles.statusDot, isOnline ? styles.statusDotOnline : styles.statusDotOffline]} />
                <View>
                  <Text style={styles.statusTitle}>
                    {isOnline ? 'VOUS ÊTES EN LIGNE' : 'VOUS ÊTES HORS LIGNE'}
                  </Text>
                  <Text style={styles.statusSubtitle}>
                    {isOnline
                      ? 'Prêt à recevoir des courses et livraisons à M\'Saken'
                      : 'Passez en ligne pour recevoir des missions'}
                  </Text>
                </View>
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
              <Pressable
                accessibilityRole="switch"
                disabled={isSubmitting}
                onPress={() => void toggleOnline()}
                style={[styles.switchToggleBtn, isOnline ? styles.switchToggleOnline : styles.switchToggleOffline]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.switchToggleText}>{isOnline ? 'Pause' : 'Activer'}</Text>
                )}
              </Pressable>
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
                {/* Notifications et alertes */}
                {notice ? (
                  <View style={styles.noticeBanner}>
                    <Ionicons name="checkmark-circle" size={18} color="#34D399" />
                    <Text style={styles.noticeBannerText}>{notice}</Text>
                  </View>
                ) : null}

                {sessionError || error ? (
        <Text accessibilityRole="alert" style={styles.error}>{sessionError || error}</Text>
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color="#F87171" />
          <Text style={styles.errorBannerText}>{sessionError || error}</Text>
        </View>
                ) : null}

                {!isPreview && !isLoading && !userId ? (
                  <Text accessibilityRole="alert" style={styles.error}>Aucune session chauffeur authentifiée.</Text>
                ) : null}
                {/* Statistiques clés du jour */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricCard}>
                    <View style={styles.metricIconWrap}>
                      <Ionicons name="wallet-outline" size={18} color="#34D399" />
                    </View>
                    <Text style={styles.metricLabel}>Gains aujourd’hui</Text>
                    <Text style={styles.metricValue}>{formatMillimes(todayEarnings.todayMillimes)}</Text>
                  </View>

                  {isPreview || !userId ? null : (
                    <View style={styles.statusCard}>
                      <View style={styles.statusCopy}>
                        <Text style={styles.cardTitle}>Disponibilité chauffeur</Text>
                        <Text style={styles.cardDescription}>
                          {profile?.is_online
                            ? 'Vous êtes en ligne et pouvez recevoir des missions éligibles.'
                            : 'Passez en ligne pour recevoir des missions.'}
                        </Text>
                        <View style={styles.metricCard}>
                          <View style={styles.metricIconWrap}>
                            <Ionicons name="bicycle-outline" size={18} color={colors.primary} />
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
                          <Text style={styles.metricLabel}>Missions du jour</Text>
                          <Text style={styles.metricValue}>{todayEarnings.todayCount} courses</Text>
                        </View>
      )}

                        <View style={styles.metricCard}>
                          <View style={styles.metricIconWrap}>
                            <Ionicons name="star" size={18} color="#FBBF24" />
                          </View>
                          <Text style={styles.metricLabel}>Note chauffeur</Text>
                          <Text style={styles.metricValue}>{todayEarnings.rating} ★</Text>
                        </View>
                      </View>

                      {/* Mission en cours (Priorité absolue) */}
                      {activeMission ? (
                        <View style={styles.missionCard}>
                          <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Mission en cours</Text>
                            <Text style={styles.missionType}>{missionTypeLabel(activeMission.mission_type)}</Text>
                            <View style={styles.activeCard}>
                              <View style={styles.activeCardHeader}>
                                <View style={styles.activePulse}>
                                  <View style={styles.pulseInner} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.activeHeaderBadge}>MISSION EN COURS</Text>
                                  <Text style={styles.activeRef}>{activeMission.reference}</Text>
                                </View>
                                <View style={styles.typeBadge}>
                                  <Text style={styles.typeBadgeText}>
                                    {activeMission.mission_type === 'delivery' ? 'LIVRAISON FOOD/COURSES' : 'SCOOTER TAXI'}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.reference}>{activeMission.reference}</Text>
                              {activeMission.pickup_address ? <MissionAddress label="Départ" value={activeMission.pickup_address} /> : null}
                              <MissionAddress label="Destination" value={activeMission.destination_address} />
                              <View style={styles.amountRow}>
                                <Text style={styles.muted}>À encaisser en espèces</Text>
                                <Text style={styles.amount}>{formatMillimes(activeMission.amount_millimes)}</Text>

                                {/* Stepper de progression de la mission */}
                                <View style={styles.stepperContainer}>
                                  <View style={styles.stepItem}>
                                    <View style={[styles.stepCircle, styles.stepCircleDone]}>
                                      <Ionicons name="checkmark" size={14} color="#fff" />
                                    </View>
                                    <Text style={styles.stepLabelActive}>Accepté</Text>
                                  </View>
                                  <View style={styles.stepLineActive} />
                                  <View style={styles.stepItem}>
                                    <View style={[styles.stepCircle, activeMission.mission_status === 'in_progress' ? styles.stepCircleDone : styles.stepCircleCurrent]}>
                                      <Ionicons name="arrow-forward" size={14} color="#fff" />
                                    </View>
                                    <Text style={styles.stepLabelActive}>Retrait</Text>
                                  </View>
                                  <View style={activeMission.mission_status === 'in_progress' ? styles.stepLineActive : styles.stepLineInactive} />
                                  <View style={styles.stepItem}>
                                    <View style={[styles.stepCircle, isReady ? styles.stepCircleDone : styles.stepCircleInactive]}>
                                      <Ionicons name="flag-outline" size={14} color={isReady ? '#fff' : '#71717A'} />
                                    </View>
                                    <Text style={isReady ? styles.stepLabelActive : styles.stepLabelInactive}>Livraison</Text>
                                  </View>
                                </View>
                                <Text style={styles.muted}>Étape : {activeMission.service_status.replaceAll('_', ' ')}</Text>

                                {/* Points d'adresses */}
                                <View style={styles.addressesWrap}>
                                  {activeMission.pickup_address ? (
                                    <View style={styles.addressBlock}>
                                      <View style={styles.addressIconWrapStart}>
                                        <Ionicons name="location" size={16} color="#34D399" />
                                      </View>
                                      <View style={{ flex: 1 }}>
                                        <Text style={styles.addressRoleLabel}>POINT DE RETRAIT (DÉPART)</Text>
                                        <Text style={styles.addressValueText}>{activeMission.pickup_address}</Text>
                                      </View>
                                      <Pressable
                                        onPress={() => openNavigationApp(activeMission.pickup_address || "M'Saken")}
                                        style={styles.gpsSmallBtn}
                                      >
                                        <Ionicons name="navigate-outline" size={14} color="#fff" />
                                        <Text style={styles.gpsSmallBtnText}>GPS</Text>
                                      </Pressable>
                                    </View>
                                  ) : null}

                                  <View style={styles.addressBlock}>
                                    <View style={styles.addressIconWrapEnd}>
                                      <Ionicons name="flag" size={16} color={colors.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.addressRoleLabel}>DESTINATION (CLIENT)</Text>
                                      <Text style={styles.addressValueText}>{activeMission.destination_address}</Text>
                                    </View>
                                    <Pressable
                                      onPress={() => openNavigationApp(activeMission.destination_address)}
                                      style={styles.gpsSmallBtn}
                                    >
                                      <Ionicons name="navigate-outline" size={14} color="#fff" />
                                      <Text style={styles.gpsSmallBtnText}>GPS</Text>
                                    </Pressable>
                                  </View>
                                </View>

                                {/* Contact client & Montant à encaisser */}
                                <View style={styles.activeFooter}>
                                  <View>
                                    <Text style={styles.amountPrompt}>À ENCAISSER EN ESPÈCES</Text>
                                    <Text style={styles.amountBig}>{formatMillimes(activeMission.amount_millimes)}</Text>
                                  </View>

                                  <Pressable
                                    onPress={() => callCustomer(phone)}
                                    style={styles.callClientBtn}
                                  >
                                    <Ionicons name="call" size={16} color="#fff" />
                                    <Text style={styles.callClientBtnText}>Appeler client</Text>
                                  </Pressable>
                                </View>

                                {/* Bouton d'action principale d'avancement */}
                                <Pressable
                                  accessibilityRole="button"
                                  disabled={isSubmitting}
                                  onPress={performActiveMissionStep}
                                  style={[styles.primaryButton, isSubmitting && styles.disabled]}
                                  style={[styles.mainStepBtn, isSubmitting && styles.disabled]}
                                >
                                  {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : null}
                                  <Text style={styles.primaryText}>{activeMissionAction(activeMission, isReady)}</Text>
                                  {isSubmitting ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                  ) : (
                                    <>
                                      <Ionicons
                                        name={isReady ? 'qr-code-outline' : 'arrow-forward-circle'}
                                        size={20}
                                        color="#fff"
                                      />
                                      <Text style={styles.mainStepBtnText}>{activeMissionAction(activeMission, isReady)}</Text>
                                    </>
                                  )}
                                </Pressable>

                                {isReady ? (
            <Text style={styles.hint}>Scannez le QR du client et confirmez seulement après réception de l’argent.</Text>
            <Text style={styles.cashWarningHint}>
              ⚠️ Demandez au client son QR code ou confirmez seulement après réception physique des espèces.
            </Text>
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
                                        {/* Radar des missions disponibles */}
                                        {!activeMission ? (
                                          <View style={styles.feedSection}>
                                            <View style={styles.feedHeader}>
                                              <View>
                                                <Text style={styles.feedTitle}>Missions disponibles</Text>
                                                <Text style={styles.feedSubtitle}>
                                                  {openMissions.length > 0
                                                    ? `${openMissions.length} mission(s) prête(s) à être acceptée(s)`
                                                    : 'En attente de nouvelles commandes…'}
                                                </Text>
                                              </View>
                                              <View style={styles.liveRadarBadge}>
                                                <View style={styles.radarDot} />
                                                <Text style={styles.liveRadarText}>LIVE</Text>
                                              </View>
                                            </View>

                                            {isLoadingMissions ? (
                                              <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
                                            ) : !isOnline ? (
                                              <View style={styles.offlineBox}>
                                                <Ionicons name="pause-circle-outline" size={34} color={colors.textSecondary} />
                                                <Text style={styles.offlineBoxTitle}>Vous êtes en pause</Text>
                                                <Text style={styles.offlineBoxSubtitle}>
                                                  Activez votre statut « En ligne » en haut pour voir les missions en direct dans votre zone.
                                                </Text>
                                                <Pressable onPress={() => void toggleOnline()} style={styles.activateQuickBtn}>
                                                  <Text style={styles.activateQuickBtnText}>Passer en ligne maintenant</Text>
                                                </Pressable>
                                              </View>
                                            ))}
                                          </>
                                        ) : openMissions.length === 0 ? (
                                          <View style={styles.emptyBox}>
                                            <Ionicons name="bicycle-outline" size={38} color={colors.textSecondary} />
                                            <Text style={styles.emptyBoxTitle}>Aucune course en attente</Text>
                                            <Text style={styles.emptyBoxSubtitle}>
                                              Restez connecté ! Les nouvelles commandes de M'Saken et Messaadine apparaîtront ici automatiquement.
                                            </Text>
                                          </View>
                                        ) : (
                                          openMissions.map((mission) => {
                                            const isFood = mission.mission_type === 'delivery';
                                            return (
                                              <View key={mission.mission_id} style={styles.feedCard}>
                                                <View style={styles.feedCardTop}>
                                                  <View style={styles.feedCardIconWrap}>
                                                    <Ionicons
                                                      name={isFood ? 'restaurant' : 'bicycle'}
                                                      size={20}
                                                      color={colors.primary}
                                                    />
                                                  </View>
                                                  <View style={{ flex: 1 }}>
                                                    <Text style={styles.feedRef}>{mission.reference}</Text>
                                                    <Text style={styles.feedTypeLabel}>
                                                      {isFood ? 'LIVRAISON EXPRESS FOOD / HUB' : 'COURSE SCOOTER TAXI'}
                                                    </Text>
                                                  </View>
                                                  <View style={styles.rewardBadge}>
                                                    <Text style={styles.rewardText}>3.500 DT</Text>
                                                  </View>
                                                </View>

                                                <View style={styles.feedAddresses}>
                                                  <View style={styles.feedAddressRow}>
                                                    <Ionicons name="radio-button-on" size={14} color="#34D399" />
                                                    <Text style={styles.feedAddressText} numberOfLines={1}>
                                                      {mission.pickup_address}
                                                    </Text>
                                                  </View>
                                                  <View style={styles.feedAddressRow}>
                                                    <Ionicons name="location" size={14} color={colors.primary} />
                                                    <Text style={styles.feedAddressText} numberOfLines={1}>
                                                      {mission.destination_address}
                                                    </Text>
                                                  </View>
                                                </View>

                                                <View style={styles.feedActions}>
                                                  <Pressable
                                                    onPress={() => openNavigationApp(mission.pickup_address)}
                                                    style={styles.feedNavBtn}
                                                  >
                                                    <Ionicons name="navigate-outline" size={16} color={colors.textSecondary} />
                                                    <Text style={styles.feedNavBtnText}>Voir itinéraire</Text>
                                                  </Pressable>

                                                  <Pressable
                                                    accessibilityRole="button"
                                                    disabled={isSubmitting}
                                                    onPress={() => void perform(() => acceptDriverMission(mission.mission_id))}
                                                    style={[styles.acceptBtn, isSubmitting && styles.disabled]}
                                                  >
                                                    <Ionicons name="checkmark-sharp" size={17} color="#fff" />
                                                    <Text style={styles.acceptBtnText}>Accepter la course</Text>
                                                  </Pressable>
                                                </View>
                                              </View>
                                            );
                                          })
                                        )}
                                    </View>
                                  ) : null}

                                  {isLoading && !isPreview ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
                                  {/* Raccourcis Chauffeur & Gestion */}
                                  <View style={styles.shortcutsSection}>
                                    <Text style={styles.shortcutsTitle}>Outils & Paramètres Chauffeur</Text>

                                    {canSwitchSpace ? (
                                      <Pressable
                                        accessibilityRole="button"
                                        onPress={onSwitchSpace}
                                        style={({ pressed }) => [styles.switchButton, pressed && styles.pressed]}
                                        style={styles.shortcutRow}
                                        onPress={() => router.push('/driver/cash-payment')}
                                      >
                                        <Ionicons name="swap-horizontal-outline" size={18} color={colors.text} />
                                        <Text style={styles.switchText}>Retour à l’espace client</Text>
                                        <View style={styles.shortcutIconWrap}>
                                          <Ionicons name="qr-code-outline" size={20} color={colors.primary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                          <Text style={styles.shortcutName}>Scanner un paiement QR</Text>
                                          <Text style={styles.shortcutDesc}>Valider un encaissement espèces direct</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                                      </Pressable>
                                    ) : null}

                                    {authEnabled ? (
                                      <Pressable accessibilityRole="button" disabled={isSubmitting} style={styles.logoutButton} onPress={() => void handleSignOut()}>
                                        <Text style={styles.logoutText}>{isSubmitting ? 'Déconnexion…' : 'Se déconnecter'}</Text>
                                        <Pressable
                                          style={styles.shortcutRow}
                                          onPress={() => router.push('/driver/history')}
                                        >
                                          <View style={styles.shortcutIconWrap}>
                                            <Ionicons name="time-outline" size={20} color="#60A5FA" />
                                          </View>
                                          <View style={{ flex: 1 }}>
                                            <Text style={styles.shortcutName}>Historique des courses</Text>
                                            <Text style={styles.shortcutDesc}>Voir toutes vos missions terminées</Text>
                                          </View>
                                          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                                        </Pressable>
      ) : null}

                                        <Pressable
                                          style={styles.shortcutRow}
                                          onPress={() => router.push('/driver/earnings')}
                                        >
                                          <View style={styles.shortcutIconWrap}>
                                            <Ionicons name="cash-outline" size={20} color="#34D399" />
                                          </View>
                                          <View style={{ flex: 1 }}>
                                            <Text style={styles.shortcutName}>Mes gains & relevés</Text>
                                            <Text style={styles.shortcutDesc}>Suivi des encaissements et commissions</Text>
                                          </View>
                                          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                                        </Pressable>

                                        {canSwitchSpace ? (
                                          <Pressable
                                            accessibilityRole="button"
                                            onPress={onSwitchSpace}
                                            style={styles.switchSpaceBtn}
                                          >
                                            <Ionicons name="swap-horizontal-outline" size={19} color={colors.primary} />
                                            <Text style={styles.switchSpaceText}>Passer à l’espace client</Text>
                                          </Pressable>
                                        ) : null}

                                        {authEnabled ? (
                                          <Pressable
                                            accessibilityRole="button"
                                            disabled={isSubmitting}
                                            style={styles.logoutBtn}
                                            onPress={() => void signOut()}
                                          >
                                            <Text style={styles.logoutBtnText}>Se déconnecter</Text>
                                          </Pressable>
                                        ) : null}
                                      </View>
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
                                  if (mission.mission_status === 'assigned') return 'Confirmer & accepter';
                                  if (mission.mission_status === 'accepted') return 'Démarrer le trajet vers le point';
                                  return isReady ? 'Scanner QR & Confirmer encaissement' : 'Arrivé chez le client · Demander paiement';
}

                                  function missionTypeLabel(type: OpenDriverMissionRow['mission_type']) {
  return type === 'delivery' ? 'LIVRAISON' : 'SCOOTER TAXI';
}

                                  function MissionAddress({label, value}: {label: string; value: string }) {
  return (
                                  <View style={styles.addressRow}>
                                    <Text style={styles.addressLabel}>{label}</Text>
                                    <Text style={styles.addressValue}>{value}</Text>
                                  </View>
                                  );
}

                                  function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Impossible de charger ou mettre à jour les missions.';
                                  return error instanceof Error ? error.message : 'Impossible de mettre à jour le statut chauffeur.';
}

                                  const styles = StyleSheet.create({
                                    screen: {flex: 1, backgroundColor: colors.background },
                                  content: {paddingHorizontal: 18, paddingTop: 26, paddingBottom: 36 },
                                  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 16 },
                                  screen: {flex: 1, backgroundColor: '#0B0B0E' },
                                  content: {paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
                                  header: {
                                    flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: 16,
  },
                                  identity: {flexDirection: 'row', alignItems: 'center', gap: 12 },
                                  logo: {width: 48, height: 48, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
                                  logoText: {color: colors.text, fontSize: 25, fontWeight: '900' },
                                  title: {color: colors.text, fontSize: 22, fontWeight: '900' },
                                  subtitle: {color: colors.textSecondary, fontSize: 12, marginTop: 2 },
                                  headerActions: {flexDirection: 'row', alignItems: 'center', gap: 10 },
                                  refreshButton: {width: 40, height: 40, borderRadius: 13, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
                                  avatarButton: {width: 40, height: 40, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
                                  locationBar: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1A1A1D', borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
                                  locationTextWrap: {flex: 1 },
                                  locationLabel: {color: colors.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
                                  locationValue: {color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 2 },
                                  profileCard: {flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 14 },
                                  avatarWrap: {width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
                                  avatarText: {color: '#fff', fontSize: 22, fontWeight: '900' },
                                  profileInfo: {flex: 1 },
                                  profileName: {color: colors.text, fontSize: 16, fontWeight: '900' },
                                  profileMeta: {color: colors.textSecondary, fontSize: 11, marginTop: 3 },
                                  navRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
                                  navPill: {paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
                                  navPillActive: {backgroundColor: '#1E1410', borderColor: colors.primary },
                                  navPillText: {color: colors.textSecondary, fontSize: 11, fontWeight: '800' },
                                  navPillTextActive: {color: colors.primary },
                                  summaryRow: {flexDirection: 'row', gap: 10, marginBottom: 18 },
                                  summaryCard: {flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, minHeight: 78, justifyContent: 'center' },
                                  summaryLabel: {color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
                                  summaryValue: {color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginTop: 8 },
                                  notice: {flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#271417', borderWidth: 1, borderColor: '#552127', borderRadius: 14, padding: 13, marginBottom: 16 },
                                  noticeText: {color: '#F2B7BB', fontSize: 12, lineHeight: 18, flex: 1 },
                                  error: {color: colors.error, fontSize: 12, lineHeight: 18, marginBottom: 14 },
                                  statusCard: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16 },
                                  statusCopy: {flex: 1 },
                                  cardTitle: {color: colors.text, fontSize: 14, fontWeight: '900' },
                                  cardDescription: {color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 5 },
                                  onlineToggle: {minHeight: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3A3030', borderRadius: 12, paddingHorizontal: 10 },
                                  onlineToggleActive: {backgroundColor: '#14532D' },
                                  onlineToggleText: {color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
                                  logoImage: {width: 44, height: 44, borderRadius: 13, backgroundColor: '#000' },
                                  brandRow: {flexDirection: 'row', alignItems: 'center', gap: 8 },
                                  brandTitle: {color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1.5 },
                                  driverBadge: {
                                    backgroundColor: 'rgba(255, 32, 42, 0.2)',
                                  paddingHorizontal: 7,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                  borderWidth: 1,
                                  borderColor: colors.primary,
  },
                                  driverBadgeText: {color: colors.primary, fontSize: 9, fontWeight: '900' },
                                  driverName: {color: colors.textSecondary, fontSize: 12, marginTop: 2 },
                                  headerActions: {flexDirection: 'row', alignItems: 'center', gap: 8 },
                                  actionBtn: {
                                    width: 40,
                                  height: 40,
                                  borderRadius: 13,
                                  backgroundColor: '#18181E',
                                  borderWidth: 1,
                                  borderColor: '#26262F',
                                  alignItems: 'center',
                                  justifyContent: 'center',
  },
                                  avatarBtn: {
                                    width: 40,
                                  height: 40,
                                  borderRadius: 13,
                                  backgroundColor: colors.primary,
                                  alignItems: 'center',
                                  justifyContent: 'center',
  },
                                  avatarText: {color: '#fff', fontSize: 16, fontWeight: '900' },

                                  // Status Banner
                                  statusBanner: {
                                    flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: 14,
                                  borderRadius: 16,
                                  borderWidth: 1,
                                  marginBottom: 16,
  },
                                  statusBannerOnline: {
                                    backgroundColor: '#0E2419',
                                  borderColor: '#10B981',
  },
                                  statusBannerOffline: {
                                    backgroundColor: '#1E1618',
                                  borderColor: '#3F2226',
  },
                                  statusLeft: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
                                  statusDot: {width: 12, height: 12, borderRadius: 6 },
                                  statusDotOnline: {backgroundColor: '#10B981', shadowColor: '#10B981', shadowRadius: 6, shadowOpacity: 0.8 },
                                  statusDotOffline: {backgroundColor: '#EF4444' },
                                  statusTitle: {color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
                                  statusSubtitle: {color: '#9CA3AF', fontSize: 11, marginTop: 2 },
                                  switchToggleBtn: {
                                    paddingHorizontal: 16,
                                  paddingVertical: 9,
                                  borderRadius: 12,
  },
                                  switchToggleOnline: {backgroundColor: '#EF4444' },
                                  switchToggleOffline: {backgroundColor: '#10B981' },
                                  switchToggleText: {color: '#fff', fontSize: 12, fontWeight: '900' },

                                  noticeBanner: {
                                    flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 8,
                                  backgroundColor: '#0F291E',
                                  borderColor: '#1E4A35',
                                  borderWidth: 1,
                                  borderRadius: 12,
                                  padding: 12,
                                  marginBottom: 14,
  },
                                  noticeBannerText: {color: '#6EE7B7', fontSize: 12, fontWeight: '700' },
                                  errorBanner: {
                                    flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 8,
                                  backgroundColor: '#2A1417',
                                  borderColor: '#552127',
                                  borderWidth: 1,
                                  borderRadius: 12,
                                  padding: 12,
                                  marginBottom: 14,
  },
                                  errorBannerText: {color: '#FCA5A5', fontSize: 12, fontWeight: '700' },

                                  // Metrics
                                  metricsRow: {flexDirection: 'row', gap: 10, marginBottom: 18 },
                                  metricCard: {
                                    flex: 1,
                                  backgroundColor: '#141419',
                                  borderRadius: 16,
                                  borderWidth: 1,
                                  borderColor: '#24242E',
                                  padding: 12,
  },
                                  metricIconWrap: {
                                    width: 32,
                                  height: 32,
                                  borderRadius: 10,
                                  backgroundColor: '#1C1C24',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginBottom: 8,
  },
                                  metricLabel: {color: '#71717A', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
                                  metricValue: {color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 4 },

                                  // Active Mission Card
                                  activeCard: {
                                    backgroundColor: '#16161D',
                                  borderRadius: 20,
                                  borderWidth: 2,
                                  borderColor: colors.primary,
                                  padding: 16,
                                  marginBottom: 20,
                                  shadowColor: colors.primary,
                                  shadowOpacity: 0.25,
                                  shadowRadius: 15,
  },
                                  activeCardHeader: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
                                  activePulse: {
                                    width: 24,
                                  height: 24,
                                  borderRadius: 12,
                                  backgroundColor: 'rgba(255, 32, 42, 0.25)',
                                  alignItems: 'center',
                                  justifyContent: 'center',
  },
                                  pulseInner: {width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
                                  activeHeaderBadge: {color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
                                  activeRef: {color: '#fff', fontSize: 15, fontWeight: '900', marginTop: 2 },
                                  typeBadge: {
                                    backgroundColor: '#261416',
                                  borderRadius: 8,
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  borderWidth: 1,
                                  borderColor: '#4A1D20',
  },
                                  typeBadgeText: {color: '#FFB3BA', fontSize: 9, fontWeight: '800' },

                                  // Stepper
                                  stepperContainer: {
                                    flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  backgroundColor: '#101015',
                                  borderRadius: 14,
                                  padding: 12,
                                  marginBottom: 14,
  },
                                  stepItem: {alignItems: 'center', gap: 4 },
                                  stepCircle: {
                                    width: 26,
                                  height: 26,
                                  borderRadius: 13,
                                  alignItems: 'center',
                                  justifyContent: 'center',
  },
                                  stepCircleDone: {backgroundColor: '#10B981' },
                                  stepCircleCurrent: {backgroundColor: colors.primary },
                                  stepCircleInactive: {backgroundColor: '#26262F' },
                                  stepLineActive: {flex: 1, height: 2, backgroundColor: '#10B981', marginHorizontal: 8 },
                                  stepLineInactive: {flex: 1, height: 2, backgroundColor: '#26262F', marginHorizontal: 8 },
                                  stepLabelActive: {color: '#fff', fontSize: 10, fontWeight: '800' },
                                  stepLabelInactive: {color: '#71717A', fontSize: 10 },

                                  // Addresses
                                  addressesWrap: {gap: 10, marginBottom: 14 },
                                  addressBlock: {
                                    flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 10,
                                  backgroundColor: '#111116',
                                  borderRadius: 14,
                                  padding: 10,
                                  borderWidth: 1,
                                  borderColor: '#22222B',
  },
                                  addressIconWrapStart: {
                                    width: 32,
                                  height: 32,
                                  borderRadius: 10,
                                  backgroundColor: '#102B1D',
                                  alignItems: 'center',
                                  justifyContent: 'center',
  },
                                  addressIconWrapEnd: {
                                    width: 32,
                                  height: 32,
                                  borderRadius: 10,
                                  backgroundColor: '#2B1316',
                                  alignItems: 'center',
                                  justifyContent: 'center',
  },
                                  addressRoleLabel: {color: '#71717A', fontSize: 9, fontWeight: '800' },
                                  addressValueText: {color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 2 },
                                  gpsSmallBtn: {
                                    flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                  backgroundColor: '#2563EB',
                                  paddingHorizontal: 10,
                                  paddingVertical: 7,
                                  borderRadius: 10,
  },
                                  gpsSmallBtnText: {color: '#fff', fontSize: 11, fontWeight: '900' },

                                  // Footer & Steps
                                  activeFooter: {
                                    flexDirection: 'row',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  backgroundColor: '#1B1416',
                                  borderRadius: 14,
                                  padding: 12,
                                  borderWidth: 1,
                                  borderColor: '#3D2024',
                                  marginBottom: 14,
  },
                                  amountPrompt: {color: '#FFAAB1', fontSize: 9, fontWeight: '800' },
                                  amountBig: {color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 2 },
                                  callClientBtn: {
                                    flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 6,
                                  backgroundColor: '#10B981',
                                  paddingHorizontal: 14,
                                  paddingVertical: 9,
                                  borderRadius: 12,
  },
                                  callClientBtnText: {color: '#fff', fontSize: 12, fontWeight: '800' },
                                  mainStepBtn: {
                                    minHeight: 50,
                                  backgroundColor: colors.primary,
                                  borderRadius: 15,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 10,
  },
                                  mainStepBtnText: {color: '#fff', fontSize: 14, fontWeight: '900' },
                                  cashWarningHint: {
                                    color: '#D4D4D8',
                                  fontSize: 11,
                                  textAlign: 'center',
                                  marginTop: 10,
                                  lineHeight: 16,
  },

                                  // Feed Section
                                  feedSection: {marginBottom: 24 },
                                  feedHeader: {
                                    flexDirection: 'row',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginBottom: 14,
  },
                                  feedTitle: {color: '#fff', fontSize: 16, fontWeight: '900' },
                                  feedSubtitle: {color: '#71717A', fontSize: 11, marginTop: 2 },
                                  liveRadarBadge: {
                                    flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 6,
                                  backgroundColor: '#1A1112',
                                  borderWidth: 1,
                                  borderColor: colors.primary,
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  borderRadius: 8,
  },
                                  radarDot: {width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
                                  liveRadarText: {color: colors.primary, fontSize: 10, fontWeight: '900' },

                                  offlineBox: {
                                    backgroundColor: '#131318',
                                  borderRadius: 18,
                                  borderWidth: 1,
                                  borderColor: '#22222B',
                                  padding: 24,
                                  alignItems: 'center',
                                  gap: 8,
  },
                                  offlineBoxTitle: {color: '#fff', fontSize: 16, fontWeight: '800' },
                                  offlineBoxSubtitle: {
                                    color: '#71717A',
                                  fontSize: 12,
                                  textAlign: 'center',
                                  lineHeight: 18,
                                  maxWidth: 280,
  },
                                  activateQuickBtn: {
                                    backgroundColor: '#10B981',
                                  borderRadius: 12,
                                  paddingHorizontal: 18,
                                  paddingVertical: 10,
                                  marginTop: 8,
  },
                                  activateQuickBtnText: {color: '#fff', fontSize: 12, fontWeight: '900' },

                                  emptyBox: {
                                    backgroundColor: '#131318',
                                  borderRadius: 18,
                                  borderWidth: 1,
                                  borderColor: '#22222B',
                                  padding: 24,
                                  alignItems: 'center',
                                  gap: 8,
  },
                                  emptyBoxTitle: {color: '#fff', fontSize: 15, fontWeight: '800' },
                                  emptyBoxSubtitle: {
                                    color: '#71717A',
                                  fontSize: 12,
                                  textAlign: 'center',
                                  lineHeight: 18,
  },

                                  feedCard: {
                                    backgroundColor: '#141419',
                                  borderRadius: 18,
                                  borderWidth: 1,
                                  borderColor: '#24242E',
                                  padding: 14,
                                  marginBottom: 12,
  },
                                  feedCardTop: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
                                  feedCardIconWrap: {
                                    width: 38,
                                  height: 38,
                                  borderRadius: 12,
                                  backgroundColor: 'rgba(255, 32, 42, 0.15)',
                                  alignItems: 'center',
                                  justifyContent: 'center',
  },
                                  feedRef: {color: '#fff', fontSize: 14, fontWeight: '900' },
                                  feedTypeLabel: {color: '#71717A', fontSize: 10, fontWeight: '700', marginTop: 2 },
                                  rewardBadge: {
                                    backgroundColor: '#102B1D',
                                  borderWidth: 1,
                                  borderColor: '#155E38',
                                  borderRadius: 10,
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
  },
                                  rewardText: {color: '#34D399', fontSize: 13, fontWeight: '900' },
                                  feedAddresses: {
                                    backgroundColor: '#0F0F13',
                                  borderRadius: 12,
                                  padding: 10,
                                  gap: 8,
                                  marginBottom: 12,
  },
                                  feedAddressRow: {flexDirection: 'row', alignItems: 'center', gap: 8 },
                                  feedAddressText: {color: '#D4D4D8', fontSize: 12, flex: 1 },
                                  feedActions: {flexDirection: 'row', gap: 10 },
                                  feedNavBtn: {
                                    flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 6,
                                  backgroundColor: '#1C1C24',
                                  borderRadius: 12,
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                  borderWidth: 1,
                                  borderColor: '#292936',
  },
                                  feedNavBtnText: {color: '#D4D4D8', fontSize: 11, fontWeight: '700' },
                                  acceptBtn: {
                                    flex: 1,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  backgroundColor: colors.primary,
                                  borderRadius: 12,
                                  paddingVertical: 10,
  },
                                  acceptBtnText: {color: '#fff', fontSize: 12, fontWeight: '900' },

                                  // Shortcuts
                                  shortcutsSection: {
                                    backgroundColor: '#121217',
                                  borderRadius: 20,
                                  borderWidth: 1,
                                  borderColor: '#22222B',
                                  padding: 16,
                                  gap: 12,
  },
                                  shortcutsTitle: {color: '#fff', fontSize: 14, fontWeight: '900', marginBottom: 4 },
                                  shortcutRow: {
                                    flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 12,
                                  backgroundColor: '#181820',
                                  borderRadius: 14,
                                  padding: 12,
                                  borderWidth: 1,
                                  borderColor: '#292938',
  },
                                  shortcutIconWrap: {
                                    width: 38,
                                  height: 38,
                                  borderRadius: 12,
                                  backgroundColor: '#101015',
                                  alignItems: 'center',
                                  justifyContent: 'center',
  },
                                  shortcutName: {color: '#fff', fontSize: 13, fontWeight: '800' },
                                  shortcutDesc: {color: '#71717A', fontSize: 11, marginTop: 2 },
                                  switchSpaceBtn: {
                                    flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 8,
                                  backgroundColor: '#1E1416',
                                  borderWidth: 1,
                                  borderColor: colors.primary,
                                  borderRadius: 14,
                                  paddingVertical: 13,
                                  marginTop: 6,
  },
                                  switchSpaceText: {color: colors.primary, fontSize: 13, fontWeight: '800' },
                                  logoutBtn: {
                                    borderWidth: 1,
                                  borderColor: '#7F1D1D',
                                  borderRadius: 14,
                                  paddingVertical: 12,
                                  alignItems: 'center',
                                  marginTop: 2,
  },
                                  logoutBtnText: {color: '#EF4444', fontSize: 12, fontWeight: '800' },
                                  disabled: {opacity: 0.6 },
                                  sectionTitle: {color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 25, marginBottom: 11 },
                                  missionCard: {backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 16, marginTop: 12 },
                                  sectionHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
                                  missionType: {color: colors.primary, fontSize: 9, fontWeight: '900' },
                                  reference: {color: colors.text, fontSize: 15, fontWeight: '900', marginBottom: 10 },
                                  addressRow: {borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 8 },
                                  addressLabel: {color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
                                  addressValue: {color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 4 },
                                  amountRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 13, marginBottom: 9 },
                                  amount: {color: colors.text, fontSize: 16, fontWeight: '900' },
                                  muted: {color: colors.textSecondary, fontSize: 11 },
                                  primaryButton: {minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 13, marginTop: 14, paddingHorizontal: 12 },
                                  primaryText: {color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
                                  hint: {color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 10 },
                                  empty: {color: colors.textSecondary, fontSize: 12, lineHeight: 18, backgroundColor: colors.card, borderRadius: 14, padding: 14 },
                                  loader: {marginVertical: 20 },
                                  switchButton: {minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, marginTop: 23 },
                                  switchText: {color: colors.text, fontSize: 12, fontWeight: '800' },
                                  logoutButton: {minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.error, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
                                  logoutText: {color: colors.error, fontWeight: '800' },
});
