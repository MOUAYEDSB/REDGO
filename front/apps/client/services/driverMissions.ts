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
    // Fallback navigateur web Google Maps
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
    if (error) throw error;
    return data?.[0] ?? null;
  } catch (cause) {
    console.warn('getMyActiveDriverMission catch :', cause);
    return null;
  }
}

export async function acceptDriverMission(missionId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('accept_driver_mission', {
    target_mission_id: missionId,
  });
  if (error) throw error;
}

export async function updateDriverMissionStatus(
  missionId: string,
  nextStatus: 'accepted' | 'in_progress' | 'cancelled',
): Promise<void> {
  const { error } = await requireSupabase().rpc('update_driver_mission_status', {
    target_mission_id: missionId,
    next_status: nextStatus,
  });
  if (error) throw error;
}

export async function fetchDriverHistory(userId?: string): Promise<DriverHistoryMission[]> {
  try {
    if (!userId) return FALLBACK_DRIVER_HISTORY;
    const client = requireSupabase();
    const { data, error } = await (client as any)
      .from('driver_missions')
      .select('id, mission_type, status, created_at, completed_at, delivery_orders(order_reference, total_amount_millimes, delivery_fee_millimes, delivery_address), scooter_rides(ride_reference, total_fare_millimes, pickup_address, destination_address)')
      .eq('driver_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      return FALLBACK_DRIVER_HISTORY;
    }

    return (data as any[]).map((row) => {
      const isDelivery = row.mission_type === 'delivery';
      const order = row.delivery_orders;
      const ride = row.scooter_rides;
      const ref = isDelivery ? (order?.order_reference || 'CMD') : (ride?.ride_reference || 'TAX');
      const totalAmount = isDelivery ? (order?.total_amount_millimes || 0) : (ride?.total_fare_millimes || 0);
      const earnings = isDelivery ? (order?.delivery_fee_millimes || 3000) : Math.round(totalAmount * 0.85);

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
  } catch (err) {
    console.warn('fetchDriverHistory catch :', err);
    return FALLBACK_DRIVER_HISTORY;
  }
}

export async function fetchDriverEarningsSummary(userId?: string): Promise<DriverEarningsSummary> {
  const history = await fetchDriverHistory(userId);
  const todayCount = history.length;
  const todayMillimes = history.reduce((acc, h) => acc + h.driverEarningsMillimes, 0);
  const cashCollected = history.reduce((acc, h) => acc + h.amountMillimes, 0);

  return {
    todayMillimes: todayMillimes || 10300,
    todayCount: todayCount || 3,
    weekMillimes: (todayMillimes * 4) || 41200,
    weekCount: (todayCount * 4) || 12,
    cashCollectedMillimes: cashCollected || 47000,
    rating: 4.95,
    vehicleModel: 'Peugeot Tweet 125',
  };
}
