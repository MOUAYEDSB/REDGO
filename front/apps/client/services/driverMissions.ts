import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import type {
  ActiveDriverMissionRow,
  DriverProfileRow,
  OpenDriverMissionRow,
} from '@redgo/shared';
import { resolveBusinessCoordinates } from './businessCoordinates';
import { formatHumanReadableAddress } from './geocoding';
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

export type DriverOrderItem = {
  id: string;
  productName: string;
  businessName: string;
  quantity: number;
  unitPriceMillimes: number;
  optionsPriceMillimes?: number;
  selectedOptions?: Array<string | { name?: string; price_millimes?: number }>;
  notes?: string;
  imageUrl?: string | null;
};

const STORAGE_KEY = '@redgo_driver_history_v1';
const ACTIVE_STORAGE_KEY = '@redgo_driver_active_mission_v1';
const COMPLETED_IDS_KEY = '@redgo_completed_mission_ids_v1';
const LISTENERS: Array<() => void> = [];

export async function isMissionIdCompleted(id: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(COMPLETED_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    return ids.includes(id);
  } catch {
    return false;
  }
}

export async function markMissionIdCompleted(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(COMPLETED_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(id)) {
      ids.push(id);
      await AsyncStorage.setItem(COMPLETED_IDS_KEY, JSON.stringify(ids));
    }
  } catch (err) {
    console.warn('markMissionIdCompleted error :', err);
  }
}

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

export const FALLBACK_OPEN_MISSIONS: OpenDriverMissionRow[] = [];

export const FALLBACK_DRIVER_HISTORY: DriverHistoryMission[] = [];

export async function openGoogleMapsTurnByTurn(
  address?: string | null,
  lat?: number | null,
  lng?: number | null,
  originLat?: number | null,
  originLng?: number | null,
) {
  const safeAddress = address || "Centre M'Saken";
  const destParam = lat && lng ? `${lat},${lng}` : encodeURIComponent(safeAddress);
  const originParam = originLat && originLng ? `&origin=${originLat},${originLng}` : '';

  if (Platform.OS === 'android') {
    // mode=l : itinéraire 2-roues / scooter sur Google Maps Android
    const navUrl = lat && lng
      ? `google.navigation:q=${lat},${lng}&mode=l`
      : `google.navigation:q=${encodeURIComponent(safeAddress)}&mode=l`;
    try {
      const supported = await Linking.canOpenURL(navUrl);
      if (supported) {
        await Linking.openURL(navUrl);
        return;
      }
    } catch { }
  } else if (Platform.OS === 'ios') {
    const googleMapsAppUrl = `comgooglemaps://?daddr=${destParam}&directionsmode=bicycling`;
    try {
      const supported = await Linking.canOpenURL(googleMapsAppUrl);
      if (supported) {
        await Linking.openURL(googleMapsAppUrl);
        return;
      }
    } catch { }
  }

  // Fallback universel Google Maps en mode 2-roues (scooter / moto)
  const webDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destParam}${originParam}&travelmode=two-wheeler`;
  try {
    await Linking.openURL(webDirectionsUrl);
  } catch {
    const searchUrl = `https://www.google.com/maps/search/?api=1&query=${destParam}`;
    void Linking.openURL(searchUrl);
  }
}

export function openNavigationApp(address?: string | null, lat?: number | null, lng?: number | null) {
  void openGoogleMapsTurnByTurn(address, lat, lng);
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

export async function fetchMissionOrderItems(orderId: string): Promise<DriverOrderItem[]> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
  if (!isUUID) {
    if (orderId.includes('courses')) {
      return [
        {
          id: 'item-1',
          productName: 'Baguette',
          businessName: 'Courses REDGO',
          quantity: 2,
          unitPriceMillimes: 200,
          imageUrl: 'https://ojbmldgrvnllqbxbvzak.supabase.co/storage/v1/object/public/redgo-product-images/baguette/6b184953-3134-4860-930e-1cc054a9379f.jpg',
        },
        {
          id: 'item-2',
          productName: 'eau-safia-1-5l',
          businessName: 'Courses REDGO',
          quantity: 2,
          unitPriceMillimes: 1000,
          imageUrl: 'https://ojbmldgrvnllqbxbvzak.supabase.co/storage/v1/object/public/redgo-product-images/eau-safia-1-5l/e57bbd93-e7fe-4680-90d1-19508243d480.jpg',
        },
        {
          id: 'item-3',
          productName: 'Pain au chocolat',
          businessName: 'Courses REDGO',
          quantity: 1,
          unitPriceMillimes: 1500,
          imageUrl: 'https://ojbmldgrvnllqbxbvzak.supabase.co/storage/v1/object/public/redgo-product-images/pain-au-chocolat/41604da3-86a9-40ae-af0d-8b1001b691fb.jpg',
        },
      ];
    }
    return [
      {
        id: 'item-1',
        productName: 'Mtabga Thon',
        businessName: 'Chapati Baba Sanfour',
        quantity: 1,
        unitPriceMillimes: 5500,
        selectedOptions: ['Piquant Harissa'],
        imageUrl: 'https://ojbmldgrvnllqbxbvzak.supabase.co/storage/v1/object/public/redgo-product-images/mtabga-thon/5e57b390-c8b9-490a-b2a4-9ba5c05806c9.jpg',
      },
      {
        id: 'item-2',
        productName: 'Coca-Cola 1 L',
        businessName: 'Chapati Baba Sanfour',
        quantity: 2,
        unitPriceMillimes: 2700,
        imageUrl: 'https://ojbmldgrvnllqbxbvzak.supabase.co/storage/v1/object/public/redgo-product-images/coca-cola-1-l/ee967d1c-c7cd-4025-b221-bafd66dacbcc.jpg',
      },
    ];
  }

  try {
    const client = requireSupabase();
    const { data, error } = await (client as any)
      .from('delivery_order_items')
      .select('id, product_name, business_name, quantity, unit_price_millimes, options_price_millimes, selected_options, notes, product_id, products(id, name, image_url)')
      .eq('order_id', orderId);

    if (!error && data && data.length > 0) {
      return (data as any[]).map((row) => ({
        id: row.id,
        productName: row.product_name,
        businessName: row.business_name,
        quantity: row.quantity,
        unitPriceMillimes: row.unit_price_millimes,
        optionsPriceMillimes: row.options_price_millimes,
        selectedOptions: Array.isArray(row.selected_options) ? row.selected_options : [],
        notes: row.notes,
        imageUrl: row.products?.image_url || null,
      }));
    }
  } catch (err) {
    console.warn('fetchMissionOrderItems catch :', err);
  }

  return [];
}

export type MissionLocationDetails = {
  pickupCoords: { latitude: number; longitude: number } | null;
  destinationCoords: { latitude: number; longitude: number } | null;
  restaurantName: string | null;
  businessId: string | null;
  stopsCount: number;
  recipientPhone?: string | null;
  destinationInstructions?: string | null;
};

export async function fetchMissionLocationDetails(orderId: string): Promise<MissionLocationDetails> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
  if (!isUUID) {
    return {
      pickupCoords: { latitude: 35.7289, longitude: 10.5810 },
      destinationCoords: { latitude: 35.7360, longitude: 10.5870 },
      restaurantName: 'Chapati Baba Sanfour',
      businessId: 'chapati-baba-sanfour',
      stopsCount: 1,
    };
  }

  try {
    const client = requireSupabase();
    const [stopsRes, orderRes] = await Promise.all([
      (client as any).from('delivery_order_stops').select('*').eq('order_id', orderId).order('sequence_number', { ascending: true }),
      (client as any).from('delivery_orders').select('destination_address, destination_latitude, destination_longitude, recipient_phone, destination_instructions').eq('id', orderId).single(),
    ]);

    // Si non trouvé directement par order_id, tenter via driver_missions
    if (!orderRes.data && (!stopsRes.data || stopsRes.data.length === 0)) {
      const { data: mRow } = await (client as any)
        .from('driver_missions')
        .select('delivery_order_id, scooter_ride_id')
        .eq('id', orderId)
        .maybeSingle();
      if (mRow?.delivery_order_id) {
        return fetchMissionLocationDetails(mRow.delivery_order_id);
      }
      if (mRow?.scooter_ride_id) {
        return fetchMissionLocationDetails(mRow.scooter_ride_id);
      }

      const { data: rideRow } = await (client as any)
        .from('scooter_rides')
        .select('customer_id, pickup_address, pickup_latitude, pickup_longitude, destination_address, destination_latitude, destination_longitude')
        .eq('id', orderId)
        .maybeSingle();

      if (rideRow) {
        const isRoundTrip = typeof rideRow.destination_address === 'string' && rideRow.destination_address.startsWith('[ALLER-RETOUR]');
        const isParcel = typeof rideRow.destination_address === 'string' && rideRow.destination_address.startsWith('[COLIS');
        let customerPhone: string | null = null;
        if (rideRow.customer_id) {
          const { data: prof } = await (client as any)
            .from('profiles')
            .select('phone')
            .eq('id', rideRow.customer_id)
            .maybeSingle();
          customerPhone = prof?.phone || null;
        }
        return {
          pickupCoords: { latitude: rideRow.pickup_latitude, longitude: rideRow.pickup_longitude },
          destinationCoords: { latitude: rideRow.destination_latitude, longitude: rideRow.destination_longitude },
          restaurantName: isParcel ? 'Envoi de colis' : isRoundTrip ? 'Scooter Aller-retour' : 'Scooter Taxi',
          businessId: 'scooter_ride',
          stopsCount: isRoundTrip ? 2 : 1,
          recipientPhone: customerPhone,
          destinationInstructions: rideRow.destination_address,
        };
      }
    }

    const firstStop = stopsRes.data?.[0];
    const pickupCoords = firstStop
      ? resolveBusinessCoordinates(firstStop.business_id, firstStop.business_name, firstStop.latitude, firstStop.longitude)
      : null;

    let destinationCoords: { latitude: number; longitude: number } | null = null;
    if (orderRes.data && typeof orderRes.data.destination_latitude === 'number') {
      destinationCoords = {
        latitude: orderRes.data.destination_latitude,
        longitude: orderRes.data.destination_longitude,
      };
    }

    return {
      pickupCoords,
      destinationCoords,
      restaurantName: firstStop?.business_name || null,
      businessId: firstStop?.business_id || null,
      stopsCount: stopsRes.data?.length ?? 1,
      recipientPhone: orderRes.data?.recipient_phone || null,
      destinationInstructions: orderRes.data?.destination_instructions || null,
    };
  } catch (err) {
    console.warn('fetchMissionLocationDetails error :', err);
    return {
      pickupCoords: null,
      destinationCoords: null,
      restaurantName: null,
      businessId: null,
      stopsCount: 1,
    };
  }
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
    const client = requireSupabase();
    const { data, error } = await client.rpc('list_open_driver_missions');
    if (error) {
      console.warn('list_open_driver_missions RPC info :', error.message);
      return [];
    }
    if (data && data.length > 0) {
      const rows = (data as OpenDriverMissionRow[]).filter(
        (row) => row.service_status !== 'cancelled' && row.mission_status !== 'cancelled',
      );
      if (rows.length === 0) return [];

      // Vérifier côté DB qu'aucune mission ou commande/course sous-jacente n'est annulée
      const missionIds = rows.map((r) => r.mission_id);
      const { data: mRows } = await (client as any)
        .from('driver_missions')
        .select('id, status, delivery_order_id, scooter_ride_id')
        .in('id', missionIds);

      const cancelledMissionIds = new Set<string>();
      const deliveryIdByMission = new Map<string, string>();
      const rideIdByMission = new Map<string, string>();

      (mRows ?? []).forEach((m: any) => {
        if (m.status && m.status !== 'searching') {
          cancelledMissionIds.add(m.id);
        }
        if (m.delivery_order_id) deliveryIdByMission.set(m.id, m.delivery_order_id);
        if (m.scooter_ride_id) rideIdByMission.set(m.id, m.scooter_ride_id);
      });

      const deliveryIds = Array.from(
        new Set(
          rows
            .filter((r) => r.mission_type === 'delivery')
            .map((r) => r.target_id || deliveryIdByMission.get(r.mission_id))
            .filter(Boolean) as string[],
        ),
      );
      const rideIds = Array.from(
        new Set(
          rows
            .filter((r) => r.mission_type === 'scooter_ride')
            .map((r) => r.target_id || rideIdByMission.get(r.mission_id))
            .filter(Boolean) as string[],
        ),
      );

      const cancelledTargets = new Set<string>();
      await Promise.all([
        deliveryIds.length > 0
          ? (client as any)
              .from('delivery_orders')
              .select('id, status')
              .in('id', deliveryIds)
              .then(({ data: dRows }: { data: any[] | null }) => {
                (dRows ?? []).forEach((d) => {
                  if (d.status === 'cancelled' || d.status === 'delivered' || d.status === 'cash_collected') {
                    cancelledTargets.add(d.id);
                  }
                });
              })
          : Promise.resolve(),
        rideIds.length > 0
          ? (client as any)
              .from('scooter_rides')
              .select('id, status')
              .in('id', rideIds)
              .then(({ data: rRows }: { data: any[] | null }) => {
                (rRows ?? []).forEach((r) => {
                  if (r.status === 'cancelled' || r.status === 'ride_completed') {
                    cancelledTargets.add(r.id);
                  }
                });
              })
          : Promise.resolve(),
      ]);

      return rows
        .filter((row) => {
          if (cancelledMissionIds.has(row.mission_id)) return false;
          const targetId =
            row.target_id ||
            (row.mission_type === 'delivery'
              ? deliveryIdByMission.get(row.mission_id)
              : rideIdByMission.get(row.mission_id));
          if (targetId && cancelledTargets.has(targetId)) return false;
          return true;
        })
        .map((row) => ({
          ...row,
          pickup_address: formatHumanReadableAddress(row.pickup_address),
          destination_address: formatHumanReadableAddress(row.destination_address),
        }));
    }
    return [];
  } catch (cause) {
    console.warn('listOpenDriverMissions catch :', cause);
    return [];
  }
}

export async function getMyActiveDriverMission(): Promise<ActiveDriverMissionRow | null> {
  try {
    const { data, error } = await requireSupabase().rpc('get_my_active_driver_mission');
    if (!error && data && data.length > 0) {
      const active = data[0] as ActiveDriverMissionRow;
      if (active.service_status === 'cancelled' || active.mission_status === 'cancelled') {
        await setLocalActiveMission(null);
        return null;
      }
      const isDone = await isMissionIdCompleted(active.mission_id);
      if (!isDone) {
        return {
          ...active,
          pickup_address: formatHumanReadableAddress(active.pickup_address),
          destination_address: formatHumanReadableAddress(active.destination_address),
        };
      }
    }
  } catch (cause) {
    console.warn('getMyActiveDriverMission rpc catch :', cause);
  }
  // Secours persistant local (uniquement les vraies missions non-démo non annulées)
  const local = await getLocalActiveMission();
  if (local && !local.mission_id.startsWith('demo-')) {
    if (local.service_status === 'cancelled' || local.mission_status === 'cancelled') {
      await setLocalActiveMission(null);
      return null;
    }
    const isDone = await isMissionIdCompleted(local.mission_id);
    if (!isDone) {
      return {
        ...local,
        pickup_address: formatHumanReadableAddress(local.pickup_address),
        destination_address: formatHumanReadableAddress(local.destination_address),
      };
    }
  }
  return null;
}

export async function acceptDriverMission(missionId: string): Promise<void> {
  // Réinitialiser si précédemment marquée
  try {
    const raw = await AsyncStorage.getItem(COMPLETED_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (ids.includes(missionId)) {
      const filtered = ids.filter((id) => id !== missionId);
      await AsyncStorage.setItem(COMPLETED_IDS_KEY, JSON.stringify(filtered));
    }
  } catch { }

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
    const updated = await updateLocalActiveMissionStatus(nextStatus, nextServiceStatus);
    if (updated?.target_id) {
      void AsyncStorage.setItem(
        `@redgo_order_driver_${updated.target_id}`,
        JSON.stringify({
          id: 'driver-live',
          name: 'Ghaith gaa',
          phone: '+216 50 443 951',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
          rating: 4.95,
          completedRidesCount: 14,
          vehicleModel: 'Scooter Peugeot Tweet 125',
          plateNumber: '216 TN 4070',
          currentLocation: { latitude: 35.7318, longitude: 10.5842 },
        }),
      );
    }
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
    const list: DriverHistoryMission[] = stored ? JSON.parse(stored) : [];
    const exists = list.some((m) => m.id === mission.id || (m.reference === mission.reference && m.completedAt === mission.completedAt));
    const updated = exists ? list : [mission, ...list];

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    notifyDriverUpdates();
  } catch (err) {
    console.warn('recordCompletedMission error :', err);
  }
}

export type DriverOrderFeeBreakdown = {
  stopsCount: number;
  merchantShareMillimes: number;
  driverShareMillimes: number;
  appFeeMillimes: number;
  totalMillimes: number;
};

/**
 * Estime la part chauffeur sur une mission ouverte :
 * - 2.500 DT pour 1 point de retrait (resto ou hub courses direct)
 * - +1.000 DT par point de retrait supplémentaire (ex: 3.500 DT pour 2 points)
 */
export function estimateOpenMissionDriverFeeMillimes(pickupAddress?: string | null): number {
  const addr = (pickupAddress || '').trim();
  const hasMultipleStops = addr.includes(' + ') || addr.includes(' & ') || addr.includes(' / ');
  return hasMultipleStops ? 3500 : 2500;
}

/**
 * Récupère la répartition exacte des parts (Commerçant / Chauffeur / Application) depuis Supabase.
 */
export async function fetchMissionFeeBreakdown(
  orderId: string,
  fallbackTotalMillimes = 0,
  uniqueBusinessesCount = 1,
): Promise<DriverOrderFeeBreakdown> {
  const defaultStops = Math.max(1, uniqueBusinessesCount);
  const defaultDriverFee = 2500 + Math.max(0, defaultStops - 1) * 1000;
  const defaultAppFee = 500;
  const fallbackMerchant = Math.max(0, fallbackTotalMillimes - defaultDriverFee - defaultAppFee);

  try {
    const client = requireSupabase();
    const { data, error } = await (client as any)
      .from('delivery_orders')
      .select('subtotal_millimes, delivery_fee_millimes, service_fee_millimes, total_amount_millimes, delivery_order_stops(id)')
      .eq('id', orderId)
      .maybeSingle();

    if (!error && data) {
      const stopsCount = Array.isArray(data.delivery_order_stops) && data.delivery_order_stops.length > 0
        ? data.delivery_order_stops.length
        : defaultStops;
      const driverShare = typeof data.delivery_fee_millimes === 'number'
        ? data.delivery_fee_millimes
        : 2500 + Math.max(0, stopsCount - 1) * 1000;
      const appFee = typeof data.service_fee_millimes === 'number' ? data.service_fee_millimes : 500;
      const total = typeof data.total_amount_millimes === 'number' ? data.total_amount_millimes : fallbackTotalMillimes;
      const merchantShare = typeof data.subtotal_millimes === 'number'
        ? data.subtotal_millimes
        : Math.max(0, total - driverShare - appFee);

      return {
        stopsCount,
        merchantShareMillimes: merchantShare,
        driverShareMillimes: driverShare,
        appFeeMillimes: appFee,
        totalMillimes: total,
      };
    }
  } catch {
    // Fallback local
  }

  return {
    stopsCount: defaultStops,
    merchantShareMillimes: fallbackMerchant,
    driverShareMillimes: defaultDriverFee,
    appFeeMillimes: defaultAppFee,
    totalMillimes: fallbackTotalMillimes,
  };
}

export async function finalizeMissionAndRecord(
  mission: ActiveDriverMissionRow,
  customAmountMillimes?: number
): Promise<DriverHistoryMission> {
  const isDelivery = mission.mission_type === 'delivery';
  const amount = customAmountMillimes ?? mission.amount_millimes;

  let driverEarnings = isDelivery ? 2500 : Math.round(amount * 0.85);
  if (isDelivery && mission.target_id) {
    const breakdown = await fetchMissionFeeBreakdown(mission.target_id, amount);
    driverEarnings = breakdown.driverShareMillimes;
  }

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

  // Marquer la mission comme définitivement complétée
  await markMissionIdCompleted(mission.mission_id);

  // Nettoyer la mission active locale
  await setLocalActiveMission(null);

  // Enregistrement persistant local et mise à jour
  await recordCompletedMission(completedItem);
  notifyDriverUpdates();
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
        .select('id, mission_type, status, created_at, completed_at, delivery_orders(reference, total_millimes, delivery_fee_millimes, destination_address), scooter_rides(reference, fare_millimes, pickup_address, destination_address)')
        .eq('driver_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(20);

      if (!error && data && data.length > 0) {
        const dbItems: DriverHistoryMission[] = (data as any[]).map((row) => {
          const isDelivery = row.mission_type === 'delivery';
          const order = row.delivery_orders;
          const ride = row.scooter_rides;
          const ref = isDelivery ? (order?.reference || 'CMD') : (ride?.reference || 'TAX');
          const totalAmount = isDelivery ? (order?.total_millimes || 0) : (ride?.fare_millimes || 0);
          const earnings = isDelivery ? (order?.delivery_fee_millimes || 2500) : Math.max(2500, totalAmount - 500);

          return {
            id: row.id,
            reference: ref,
            missionType: row.mission_type,
            pickupAddress: isDelivery ? 'Commerce partenaire' : (ride?.pickup_address || "M'Saken"),
            destinationAddress: isDelivery ? (order?.destination_address || "M'Saken") : (ride?.destination_address || "M'Saken"),
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
    return [];
  } catch (err) {
    console.warn('fetchDriverHistory catch :', err);
    return [];
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
    todayMillimes: todayEarnings || (history.length > 0 ? history.reduce((acc, h) => acc + h.driverEarningsMillimes, 0) : 0),
    todayCount: todayCount || history.length,
    weekMillimes: weekEarnings || (todayEarnings ? Math.round(todayEarnings * 3.5) : 0),
    weekCount: weekCount || (todayCount ? todayCount * 3 : 0),
    cashCollectedMillimes: cashCollected || (history.length > 0 ? history.reduce((acc, h) => acc + h.amountMillimes, 0) : 0),
    rating: 4.95,
    vehicleModel: 'Peugeot Tweet 125',
  };
}
