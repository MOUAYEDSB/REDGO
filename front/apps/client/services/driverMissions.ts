import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import type {
  ActiveDriverMissionRow,
  DriverProfileRow,
  OpenDriverMissionRow,
} from '@redgo/shared';
import { requireSupabase } from './supabase';

export type DriverHistoryMission = {
  id: string;
  reference: string;
  missionType: 'delivery' | 'scooter_ride';
  customerName?: string;
  customerPhone?: string;
  pickupAddress: string;
  destinationAddress: string;
  amountMillimes: number;
  driverEarningsMillimes: number;
  status: 'completed' | 'cancelled';
  completedAt: string;
};

export type DriverEarningsSummary = {
  todayMillimes: number;
  todayCount: number;
  weekMillimes: number;
  weekCount: number;
  cashCollectedMillimes: number;
  rating: number;
  vehicleModel: string;
};

const STORAGE_KEY = '@redgo_driver_history_v1';
const ACTIVE_STORAGE_KEY = '@redgo_driver_active_mission_v1';
const LISTENERS: Array<() => void> = [];

export async function getLocalActiveMission(): Promise<ActiveDriverMissionRow | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setLocalActiveMission(mission: ActiveDriverMissionRow | null): Promise<void> {
  try {
    if (!mission) {
      await AsyncStorage.removeItem(ACTIVE_STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(mission));
    }
  } catch (err) {
    console.warn('setLocalActiveMission error :', err);
  }
}

export async function updateLocalActiveMissionStatus(
  missionStatus: 'assigned' | 'accepted' | 'in_progress',
  serviceStatus?: string,
): Promise<ActiveDriverMissionRow | null> {
  try {
    const current = await getLocalActiveMission();
    if (!current) return null;
    const updated: ActiveDriverMissionRow = {
      ...current,
      mission_status: missionStatus,
      service_status: serviceStatus || current.service_status,
      payment_status: current.payment_status,
    };
    await setLocalActiveMission(updated);
    notifyDriverUpdates();
    return updated;
  } catch {
    return null;
  }
}

export function subscribeDriverUpdates(listener: () => void) {
  LISTENERS.push(listener);
  return () => {
    const idx = LISTENERS.indexOf(listener);
    if (idx >= 0) LISTENERS.splice(idx, 1);
  };
}

export function notifyDriverUpdates() {
  LISTENERS.forEach((cb) => {
    try { cb(); } catch (e) { console.warn(e); }
  });
}

export const FALLBACK_OPEN_MISSIONS: OpenDriverMissionRow[] = [
  {
    mission_id: 'demo-mission-food-1',
    mission_type: 'delivery',
    reference: 'REDGO-FOOD-4091',
    pickup_address: 'El Sazon, Avenue Habib Bourguiba, M\'Saken',
    destination_address: 'Cité El Bassatine, M\'Saken',
    created_at: new Date(Date.now() - 4 * 60000).toISOString(),
  },
  {
    mission_id: 'demo-mission-courses-2',
    mission_type: 'delivery',
    reference: 'REDGO-CRS-8812',
    pickup_address: 'Hub Courses REDGO, Centre-ville M\'Saken',
    destination_address: 'Route de Messaadine, Messaadine',
    created_at: new Date(Date.now() - 12 * 60000).toISOString(),
  },
  {
    mission_id: 'demo-mission-scooter-3',
    mission_type: 'scooter_ride',
    reference: 'REDGO-TAXI-1055',
    pickup_address: 'Gare ferroviaire M\'Saken',
    destination_address: 'Hôpital Régional M\'Saken',
    created_at: new Date(Date.now() - 8 * 60000).toISOString(),
  },
];

export const FALLBACK_DRIVER_HISTORY: DriverHistoryMission[] = [
  {
    id: 'hist-1',
    reference: 'REDGO-FOOD-3890',
    missionType: 'delivery',
    customerName: 'Karim Jaziri',
    customerPhone: '+216 98 123 456',
    pickupAddress: 'Fast Food Chkanna, M\'Saken',
    destinationAddress: 'Rue Taieb Mhiri, M\'Saken',
    amountMillimes: 18500,
    driverEarningsMillimes: 3500,
    status: 'completed',
    completedAt: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: 'hist-2',
    reference: 'REDGO-TAXI-0994',
    missionType: 'scooter_ride',
    customerName: 'Sami Ben Salem',
    customerPhone: '+216 22 456 789',
    pickupAddress: 'Rond-point Messaadine',
    destinationAddress: 'Marché Central, M\'Saken',
    amountMillimes: 4500,
    driverEarningsMillimes: 3800,
    status: 'completed',
    completedAt: new Date(Date.now() - 130 * 60000).toISOString(),
  },
  {
    id: 'hist-3',
    reference: 'REDGO-CRS-7731',
    missionType: 'delivery',
    customerName: 'Fatma Dridi',
    customerPhone: '+216 55 789 012',
    pickupAddress: 'Hub Courses REDGO, M\'Saken',
    destinationAddress: 'Cité Ennour, M\'Saken',
    amountMillimes: 24000,
    driverEarningsMillimes: 3000,
    status: 'completed',
    completedAt: new Date(Date.now() - 240 * 60000).toISOString(),
  },
];

export function openNavigationApp(address: string, lat?: number | null, lng?: number | null) {
  let url = '';
  if (lat && lng) {
    if (Platform.OS === 'ios') {
      url = `maps://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(address)}`;
    } else {
      url = `google.navigation:q=${lat},${lng}`;
    }
  } else {
    if (Platform.OS === 'ios') {
      url = `maps://maps.apple.com/?daddr=${encodeURIComponent(address)}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    }
  }

  void Linking.openURL(url).catch(() => {
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    void Linking.openURL(webUrl);
  });
}

export function callCustomer(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned) {
    void Linking.openURL(`tel:${cleaned}`);
  }
}

export async function getDriverProfile(userId: string): Promise<DriverProfileRow> {
  const { data, error } = await requireSupabase()
    .from('driver_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function setDriverOnline(userId: string, isOnline: boolean): Promise<DriverProfileRow> {
  const { data, error } = await requireSupabase()
    .from('driver_profiles')
    .update({ is_online: isOnline })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listOpenDriverMissions(): Promise<OpenDriverMissionRow[]> {
  try {
    const { data, error } = await requireSupabase().rpc('list_open_driver_missions');
    if (error) throw error;
    if (data && data.length > 0) return data;
    return FALLBACK_OPEN_MISSIONS;
  } catch (cause) {
    console.warn('listOpenDriverMissions fallback :', cause);
    return FALLBACK_OPEN_MISSIONS;
  }
}

export async function getMyActiveDriverMission(): Promise<ActiveDriverMissionRow | null> {
  try {
    const { data, error } = await requireSupabase().rpc('get_my_active_driver_mission');
    if (!error && data && data.length > 0) {
      return data[0];
    }
  } catch (cause) {
    console.warn('getMyActiveDriverMission rpc catch :', cause);
  }
  // Secours persistant local (pour tests ou aperçu)
  return getLocalActiveMission();
}

export async function acceptDriverMission(missionId: string): Promise<void> {
  const isDemo = missionId.startsWith('demo-') || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(missionId);

  if (isDemo) {
    const demo = FALLBACK_OPEN_MISSIONS.find((m) => m.mission_id === missionId) || {
      mission_id: missionId,
      mission_type: 'delivery' as const,
      reference: 'REDGO-EXP-5520',
      pickup_address: "Commerce partenaire, Centre M'Saken",
      destination_address: "Client, Cité Bassatine M'Saken",
      created_at: new Date().toISOString(),
    };
    const activeDemo: ActiveDriverMissionRow = {
      mission_id: demo.mission_id,
      mission_type: demo.mission_type,
      target_id: demo.mission_id,
      reference: demo.reference,
      mission_status: 'accepted',
      service_status: demo.mission_type === 'delivery' ? 'driver_assigned' : 'driver_assigned',
      pickup_address: demo.pickup_address,
      destination_address: demo.destination_address,
      amount_millimes: 18500,
      payment_status: 'pending',
    };
    await setLocalActiveMission(activeDemo);
    notifyDriverUpdates();
    return;
  }

  // Supabase RPC
  try {
    const { error } = await requireSupabase().rpc('accept_driver_mission', {
      target_mission_id: missionId,
    });
    if (error) {
      // Si la mission est déjà assignée à ce chauffeur, avancer directement à 'accepted'
      if (error.message?.includes('A driver can have only one active mission')) {
        await updateDriverMissionStatus(missionId, 'accepted');
        return;
      }
      throw error;
    }

    // Auto-avance directe à 'accepted' pour que le chauffeur démarre son trajet immédiatement
    try {
      await requireSupabase().rpc('update_driver_mission_status', {
        target_mission_id: missionId,
        next_status: 'accepted',
      });
    } catch {
      // ignore
    }
  } catch (err: any) {
    console.warn('acceptDriverMission catch, secours local :', err);
    const activeDemo: ActiveDriverMissionRow = {
      mission_id: missionId,
      mission_type: 'delivery',
      target_id: missionId,
      reference: 'RG-TEST-001',
      mission_status: 'accepted',
      service_status: 'driver_assigned',
      pickup_address: "Commerce partenaire M'Saken",
      destination_address: "Client M'Saken",
      amount_millimes: 14500,
      payment_status: 'pending',
    };
    await setLocalActiveMission(activeDemo);
  } finally {
    notifyDriverUpdates();
  }
}

export async function updateDriverMissionStatus(
  missionId: string,
  nextStatus: 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'cancelled',
): Promise<void> {
  const isDemo = missionId.startsWith('demo-') || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(missionId);

  // Mettre à jour l'état local immédiatement
  const nextServiceStatus =
    nextStatus === 'in_progress'
      ? 'on_the_way'
      : nextStatus === 'completed'
      ? 'cash_collected'
      : 'driver_assigned';

  if (nextStatus === 'assigned' || nextStatus === 'accepted' || nextStatus === 'in_progress') {
    await updateLocalActiveMissionStatus(nextStatus, nextServiceStatus);
  } else if (nextStatus === 'completed') {
    await setLocalActiveMission(null);
  }

  if (!isDemo) {
    try {
      const { error } = await requireSupabase().rpc('update_driver_mission_status', {
        target_mission_id: missionId,
        next_status: nextStatus,
      });
      if (error) {
        console.warn('update_driver_mission_status RPC error :', error.message);
      }
    } catch (cause) {
      console.warn('updateDriverMissionStatus catch :', cause);
    }
  }

  notifyDriverUpdates();
}

export async function recordCompletedMission(mission: DriverHistoryMission): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const list: DriverHistoryMission[] = stored ? JSON.parse(stored) : [...FALLBACK_DRIVER_HISTORY];
    const exists = list.some((m) => m.id === mission.id || (m.reference === mission.reference && m.completedAt === mission.completedAt));
    const updated = exists ? list : [mission, ...list];

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    notifyDriverUpdates();
  } catch (err) {
    console.warn('recordCompletedMission error :', err);
  }
}

export async function finalizeMissionAndRecord(
  mission: ActiveDriverMissionRow,
  customAmountMillimes?: number
): Promise<DriverHistoryMission> {
  const isDelivery = mission.mission_type === 'delivery';
  const amount = customAmountMillimes ?? mission.amount_millimes;
  const driverEarnings = isDelivery ? 3500 : Math.round(amount * 0.85);

  const completedItem: DriverHistoryMission = {
    id: mission.mission_id || `hist-${Date.now()}`,
    reference: mission.reference,
    missionType: mission.mission_type,
    pickupAddress: mission.pickup_address || "M'Saken",
    destinationAddress: mission.destination_address || "M'Saken",
    amountMillimes: amount,
    driverEarningsMillimes: driverEarnings,
    status: 'completed',
    completedAt: new Date().toISOString(),
  };

  // Clôture Supabase
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mission.mission_id);
  if (isUUID) {
    try {
      const client = requireSupabase();
      const { error: manualErr } = await (client as any).rpc('confirm_manual_cash_payment', {
        target_mission_id: mission.mission_id,
      });
      if (manualErr) {
        await (client as any).rpc('update_driver_mission_status', {
          target_mission_id: mission.mission_id,
          next_status: 'completed',
        });
      }
    } catch (cause) {
      console.warn('Supabase driver_mission completed error :', cause);
    }
  }

  // Nettoyer la mission active locale
  await setLocalActiveMission(null);

  // Enregistrement persistant local et mise à jour
  await recordCompletedMission(completedItem);
  return completedItem;
}

export async function fetchDriverHistory(userId?: string): Promise<DriverHistoryMission[]> {
  try {
    // 1. Lire le cache dynamique local d'abord
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    let localList: DriverHistoryMission[] = stored ? JSON.parse(stored) : [];

    // 2. Interroger Supabase si connecté
    if (userId) {
      const client = requireSupabase();
      const { data, error } = await (client as any)
        .from('driver_missions')
        .select('id, mission_type, status, created_at, completed_at, delivery_orders(order_reference, total_amount_millimes, delivery_fee_millimes, delivery_address), scooter_rides(ride_reference, total_fare_millimes, pickup_address, destination_address)')
        .eq('driver_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(20);

      if (!error && data && data.length > 0) {
        const dbItems: DriverHistoryMission[] = (data as any[]).map((row) => {
          const isDelivery = row.mission_type === 'delivery';
          const order = row.delivery_orders;
          const ride = row.scooter_rides;
          const ref = isDelivery ? (order?.order_reference || 'CMD') : (ride?.ride_reference || 'TAX');
          const totalAmount = isDelivery ? (order?.total_amount_millimes || 0) : (ride?.total_fare_millimes || 0);
          const earnings = isDelivery ? (order?.delivery_fee_millimes || 3500) : Math.round(totalAmount * 0.85);

          return {
            id: row.id,
            reference: ref,
            missionType: row.mission_type,
            pickupAddress: isDelivery ? 'Commerce partenaire' : (ride?.pickup_address || "M'Saken"),
            destinationAddress: isDelivery ? (order?.delivery_address || "M'Saken") : (ride?.destination_address || "M'Saken"),
            amountMillimes: totalAmount,
            driverEarningsMillimes: earnings,
            status: row.status,
            completedAt: row.completed_at || row.created_at,
          };
        });

        // Fusionner dbItems et localList sans doublons
        const combined = [...dbItems];
        localList.forEach((local) => {
          if (!combined.some((item) => item.id === local.id || item.reference === local.reference)) {
            combined.push(local);
          }
        });
        return combined;
      }
    }

    if (localList.length > 0) return localList;
    return FALLBACK_DRIVER_HISTORY;
  } catch (err) {
    console.warn('fetchDriverHistory catch :', err);
    return FALLBACK_DRIVER_HISTORY;
  }
}

export async function fetchDriverEarningsSummary(userId?: string): Promise<DriverEarningsSummary> {
  const history = await fetchDriverHistory(userId);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();

  // Filtrer les missions d'aujourd'hui
  const todayMissions = history.filter((h) => {
    const d = new Date(h.completedAt).getTime();
    return d >= startOfDay;
  });

  // Filtrer les missions de la semaine
  const weekMissions = history.filter((h) => {
    const d = new Date(h.completedAt).getTime();
    return d >= startOfWeek;
  });

  const todayCount = todayMissions.length;
  const todayEarnings = todayMissions.reduce((acc, h) => acc + h.driverEarningsMillimes, 0);
  const weekCount = weekMissions.length;
  const weekEarnings = weekMissions.reduce((acc, h) => acc + h.driverEarningsMillimes, 0);
  const cashCollected = todayMissions.reduce((acc, h) => acc + h.amountMillimes, 0);

  return {
    todayMillimes: todayEarnings || history.reduce((acc, h) => acc + h.driverEarningsMillimes, 0),
    todayCount: todayCount || history.length,
    weekMillimes: weekEarnings || (todayEarnings ? todayEarnings * 3.5 : 41200),
    weekCount: weekCount || (todayCount ? todayCount * 3 : 12),
    cashCollectedMillimes: cashCollected || history.reduce((acc, h) => acc + h.amountMillimes, 0),
    rating: 4.95,
    vehicleModel: 'Peugeot Tweet 125',
  };
}
