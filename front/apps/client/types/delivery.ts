export type DeliveryStage =
  | 'confirmed'
  | 'searching_driver'
  | 'driver_assigned'
  | 'driver_shopping_courses'
  | 'collecting_restaurant'
  | 'on_the_way'
  | 'delivered'
  | 'cash_collected'
  | 'cancelled';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type DriverInfo = {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  rating: number;
  completedRidesCount: number;
  vehicleModel: string;
  plateNumber: string;
  currentLocation: Coordinates;
};

export type DeliveryStop = {
  id: string;
  businessName: string;
  type: 'courses' | 'restaurant';
  address: string;
  location: Coordinates;
  status: 'pending' | 'reached' | 'completed';
};

export type DeliveryOrder = {
  id: string;
  reference: string;
  createdAt: string;
  status: DeliveryStage;
  hasCourses: boolean;
  hasFood: boolean;
  stops: DeliveryStop[];
  destination: {
    address: string;
    instructions?: string;
    recipientPhone: string;
    location: Coordinates;
  };
  pricing: {
    productsSubtotalMillimes: number;
    deliveryFeeMillimes: number;
    serviceFeeMillimes: number;
    finalTotalMillimes: number;
  };
  paymentMethod: 'cash';
  driver: DriverInfo | null;
  estimatedArrivalMinutes?: number;
};
