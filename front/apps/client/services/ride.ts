import { ScooterTaxiOrder } from '../types/ride';
import { requireSupabase } from './supabase';

export type CreateRideInput = {
  pickupAddress: string;
  pickupLocation: { latitude: number; longitude: number };
  destinationAddress: string;
  destinationLocation: { latitude: number; longitude: number };
  fareMillimes: number;
  durationMinutes: number;
};

/**
 * Crée une course scooter directement dans la DB,
 * sans passer par la RPC `create_scooter_ride` qui dépend de `scooter_tariffs`.
 *
 * Le tarif est calculé côté client :
 *   - Aller simple / Colis = 2 500 millimes
 *   - Aller-retour         = 3 500 millimes
 */
export async function createScooterRide(input: CreateRideInput): Promise<ScooterTaxiOrder> {
  const client = requireSupabase();

  // --- Récupérer l'utilisateur courant ---
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) {
    throw new Error('Vous devez être connecté pour demander une course.');
  }

  // --- Calculer la distance à vol d'oiseau (Haversine) ---
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1 = toRad(input.pickupLocation.latitude);
  const lat2 = toRad(input.destinationLocation.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRad(input.destinationLocation.longitude - input.pickupLocation.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const distanceKm = Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * 100) / 100;

  // --- Générer une référence lisible ---
  const now = new Date();
  const dateStr = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(100000 + Math.random() * 900000));
  const reference = `TX-${dateStr}-${rand}`;

  // --- Insérer dans scooter_rides (avec fallback RPC si besoin) ---
  let row: any = null;
  const { data: insertedRow, error: insertError } = await (client as any)
    .from('scooter_rides')
    .insert({
      reference,
      customer_id: userId,
      status: 'searching',
      pickup_address: input.pickupAddress.trim(),
      pickup_latitude: input.pickupLocation.latitude,
      pickup_longitude: input.pickupLocation.longitude,
      destination_address: input.destinationAddress.trim(),
      destination_latitude: input.destinationLocation.latitude,
      destination_longitude: input.destinationLocation.longitude,
      estimated_distance_km: distanceKm,
      estimated_duration_minutes: input.durationMinutes,
      fare_millimes: input.fareMillimes,
    })
    .select('*')
    .single();

  if (insertError) {
    console.warn('[createScooterRide] direct insert failed, trying RPC:', insertError.message);
    const { data: rpcRideId, error: rpcError } = await client.rpc('create_scooter_ride', {
      pickup_address: input.pickupAddress.trim(),
      pickup_latitude: input.pickupLocation.latitude,
      pickup_longitude: input.pickupLocation.longitude,
      destination_address: input.destinationAddress.trim(),
      destination_latitude: input.destinationLocation.latitude,
      destination_longitude: input.destinationLocation.longitude,
    });

    if (rpcError || !rpcRideId) {
      console.warn('[createScooterRide] RPC error:', rpcError?.message, rpcError?.code, rpcError?.details);
      const msg = rpcError?.message || insertError.message || 'Erreur création course';
      throw new Error(`${msg} (code: ${rpcError?.code || insertError.code || 'unknown'})`);
    }

    const { data: rpcRow, error: readErr } = await (client as any)
      .from('scooter_rides')
      .select('*')
      .eq('id', rpcRideId)
      .single();

    if (readErr || !rpcRow) {
      throw new Error(readErr?.message || 'Course créée mais impossible à relire.');
    }
    row = rpcRow;
  } else {
    row = insertedRow;
  }

  if (!row) throw new Error('La course a été créée mais ne peut pas être relue.');

  // --- Créer aussi la mission pour que les chauffeurs la voient ---
  await (client as any)
    .from('driver_missions')
    .insert({
      mission_type: 'scooter_ride',
      scooter_ride_id: row.id,
      customer_id: userId,
    })
    .then(() => {})
    .catch((err: any) => {
      console.warn('[createScooterRide] driver_missions insert warning:', err?.message);
    });

  return {
    id: row.id,
    reference: row.reference ?? reference,
    createdAt: row.created_at ?? now.toISOString(),
    status: row.status ?? 'searching',
    pickup: {
      address: row.pickup_address,
      location: { latitude: row.pickup_latitude, longitude: row.pickup_longitude },
    },
    destination: {
      address: row.destination_address,
      location: { latitude: row.destination_latitude, longitude: row.destination_longitude },
    },
    service: {
      id: 'scooter_standard',
      name: 'Scooter Express (1 passager)',
      description: 'Déplacement rapide et économique · Casque désinfecté fourni',
      helmetProvided: true,
      passengerCapacity: 1,
    },
    metrics: {
      distanceKm: Number(row.estimated_distance_km ?? distanceKm),
      estimatedDurationMinutes: row.estimated_duration_minutes ?? input.durationMinutes,
      fareMillimes: row.fare_millimes ?? input.fareMillimes,
    },
    paymentMethod: 'cash',
    driver: null,
  };
}
