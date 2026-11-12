import { ScooterTaxiOrder } from '../types/ride';
import { requireSupabase } from './supabase';

export type CreateRideInput = {
  pickupAddress: string;
  pickupLocation: { latitude: number; longitude: number };
  destinationAddress: string;
  destinationLocation: { latitude: number; longitude: number };
  durationMinutes: number;
};

export async function createScooterRide(input: CreateRideInput): Promise<ScooterTaxiOrder> {
  const client = requireSupabase();
  const { data: rideId, error: createError } = await client.rpc('create_scooter_ride', {
    pickup_address: input.pickupAddress,
    pickup_latitude: input.pickupLocation.latitude,
    pickup_longitude: input.pickupLocation.longitude,
    destination_address: input.destinationAddress,
    destination_latitude: input.destinationLocation.latitude,
    destination_longitude: input.destinationLocation.longitude,
  });
  if (createError) throw createError;
  if (!rideId) throw new Error('La base REDGO n’a retourné aucun identifiant de course.');

  const { data: row, error: readError } = await client
    .from('scooter_rides')
    .select('*')
    .eq('id', rideId)
    .single();
  if (readError) throw readError;
  if (!row) throw new Error('La course a été créée mais ne peut pas être relue avec cette session.');

  return {
    id: row.id,
    reference: row.reference,
    createdAt: row.created_at,
    status: row.status,
    pickup: {
      address: row.pickup_address,
      location: { latitude: row.pickup_latitude, longitude: row.pickup_longitude },
    },
    destination: {
      address: row.destination_address,
      location: { latitude: row.destination_latitude, longitude: row.destination_longitude },
    },
    service: {
      id: row.tariff_id ?? 'scooter-taxi',
      name: 'Scooter Express (1 passager)',
      description: 'Déplacement rapide et économique · Casque désinfecté fourni',
      helmetProvided: true,
      passengerCapacity: 1,
    },
    metrics: {
      distanceKm: Number(row.estimated_distance_km),
      estimatedDurationMinutes: row.estimated_duration_minutes ?? input.durationMinutes,
      fareMillimes: row.fare_millimes,
    },
    paymentMethod: 'cash',
    driver: null,
  };
}
