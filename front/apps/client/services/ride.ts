import { ScooterTaxiOrder } from '../types/ride';
import { api } from './api';
import { MESSAADINE_CENTER, MSAKEN_CENTER } from './delivery';

export type CreateRideInput = {
  pickupAddress: string;
  pickupLocation: { latitude: number; longitude: number };
  destinationAddress: string;
  destinationLocation: { latitude: number; longitude: number };
  distanceKm: number;
  durationMinutes: number;
  fareMillimes: number;
};

export async function createScooterRide(input: CreateRideInput): Promise<ScooterTaxiOrder> {
  const reference = `TX-${Math.floor(1000 + Math.random() * 9000)}`;
  const rideId = `ride_${Date.now()}_${reference.toLowerCase()}`;

  const payload: ScooterTaxiOrder = {
    id: rideId,
    reference,
    createdAt: new Date().toISOString(),
    status: 'searching',
    pickup: {
      address: input.pickupAddress,
      location: input.pickupLocation,
    },
    destination: {
      address: input.destinationAddress,
      location: input.destinationLocation,
    },
    service: {
      id: 'scooter-taxi-single',
      name: 'Scooter Express (1 passager)',
      description: 'Déplacement rapide et économique · Casque désinfecté fourni',
      helmetProvided: true,
      passengerCapacity: 1,
    },
    metrics: {
      distanceKm: input.distanceKm,
      estimatedDurationMinutes: input.durationMinutes,
      fareMillimes: input.fareMillimes,
    },
    paymentMethod: 'cash',
    driver: null,
  };

  try {
    const response = await api.post<ScooterTaxiOrder>('/bookings/scooter', payload);
    return response.data;
  } catch (error) {
    console.warn('[REDGO API] Backend endpoint /bookings/scooter unavailable. Initializing local ride state.');
    return payload;
  }
}
