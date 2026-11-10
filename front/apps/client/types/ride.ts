import { Coordinates, DriverInfo } from './delivery';

export type RideStage =
  | 'searching'
  | 'driver_assigned'
  | 'approaching_pickup'
  | 'arrived_at_pickup'
  | 'ride_started'
  | 'ride_completed'
  | 'cancelled';

export type ScooterTaxiOrder = {
  id: string;
  reference: string;
  createdAt: string;
  status: RideStage;
  pickup: {
    address: string;
    location: Coordinates;
  };
  destination: {
    address: string;
    location: Coordinates;
  };
  service: {
    id: string;
    name: string;
    description: string;
    helmetProvided: boolean;
    passengerCapacity: 1;
  };
  metrics: {
    distanceKm: number;
    estimatedDurationMinutes: number;
    fareMillimes: number;
  };
  paymentMethod: 'cash';
  driver: DriverInfo | null;
};
