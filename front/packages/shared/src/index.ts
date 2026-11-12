export interface RedGoPlatform {
  name: string;
}

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type DriverLocationRow = {
  order_id: string;
  driver_id: string;
  customer_id: string;
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  updated_at: string;
};

export type AppRole = 'client' | 'driver';
export type DriverApplicationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessKind = 'courses' | 'restaurant';

export type BusinessRow = {
  id: string;
  kind: BusinessKind;
  name: string;
  description: string;
  phone: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  cover_image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductRow = {
  id: string;
  business_id: string;
  name: string;
  description: string;
  category: string;
  price_millimes: number;
  image_url: string | null;
  max_quantity: number;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProductOptionRow = {
  id: string;
  product_id: string;
  name: string;
  price_millimes: number;
  is_available: boolean;
  sort_order: number;
  created_at: string;
};

export type UserRoleRow = {
  user_id: string;
  role: AppRole;
  granted_at: string;
  granted_by: string | null;
};

export type DriverApplicationRow = {
  user_id: string;
  status: DriverApplicationStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
};

export type CashPaymentStatus = 'pending' | 'paid' | 'cancelled';
export type CashPaymentMissionType = 'delivery' | 'scooter_ride';

export type CashPaymentRow = {
  id: string;
  mission_id: string;
  amount_millimes: number;
  payment_method: 'cash';
  status: CashPaymentStatus;
  qr_token_hash: string | null;
  qr_issued_at: string | null;
  qr_expires_at: string | null;
  qr_used_at: string | null;
  paid_at: string | null;
  collected_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CashPaymentQrRow = {
  token: string;
  amount_millimes: number;
  expires_at: string;
  payment_status: CashPaymentStatus;
};

export type CashPaymentValidationRow = {
  mission_type: CashPaymentMissionType;
  target_id: string;
  reference: string;
  amount_millimes: number;
  payment_status: CashPaymentStatus;
  expires_at: string;
};

export type CashPaymentReceiptRow = {
  payment_status: 'paid';
  mission_type: CashPaymentMissionType;
  amount_millimes: number;
  paid_at: string;
  mission_id: string;
};

export type CashPaymentStatusRow = {
  mission_type: CashPaymentMissionType;
  amount_millimes: number;
  payment_status: CashPaymentStatus;
  expires_at: string | null;
  paid_at: string | null;
  ready_for_payment: boolean;
};

export type DeliveryOrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  business_id: string;
  product_name: string;
  business_name: string;
  quantity: number;
  unit_price_millimes: number;
  options_price_millimes: number;
  selected_options: unknown;
  notes: string;
  created_at: string;
};

export type DeliveryOrderStopRow = {
  id: string;
  order_id: string;
  business_id: string;
  business_name: string;
  stop_type: BusinessKind;
  address: string;
  latitude: number | null;
  longitude: number | null;
  sequence_number: number;
  status: 'pending' | 'reached' | 'completed';
  created_at: string;
};

export type DeliveryOrderRow = {
  id: string;
  reference: string;
  customer_id: string;
  driver_id: string | null;
  status:
    | 'confirmed'
    | 'searching_driver'
    | 'driver_assigned'
    | 'driver_shopping_courses'
    | 'collecting_restaurant'
    | 'on_the_way'
    | 'delivered'
    | 'cash_collected'
    | 'cancelled';
  destination_address: string;
  destination_instructions: string;
  recipient_phone: string;
  destination_latitude: number;
  destination_longitude: number;
  products_subtotal_millimes: number;
  delivery_fee_millimes: number;
  service_fee_millimes: number;
  total_millimes: number;
  payment_method: 'cash';
  created_at: string;
  updated_at: string;
  assigned_at: string | null;
  delivered_at: string | null;
};

export type ScooterRideRow = {
  id: string;
  reference: string;
  customer_id: string;
  driver_id: string | null;
  tariff_id: string | null;
  status:
    | 'searching'
    | 'driver_assigned'
    | 'approaching_pickup'
    | 'arrived_at_pickup'
    | 'ride_started'
    | 'ride_completed'
    | 'cancelled';
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  destination_address: string;
  destination_latitude: number;
  destination_longitude: number;
  estimated_distance_km: number;
  estimated_duration_minutes: number | null;
  fare_millimes: number;
  payment_method: 'cash';
  created_at: string;
  updated_at: string;
  assigned_at: string | null;
  completed_at: string | null;
};

export type ScooterTariffRow = {
  id: string;
  name: string;
  description: string;
  fare_millimes: number;
  passenger_capacity: number;
  helmet_provided: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DriverMissionStatus = 'searching' | 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export type DriverMissionRow = {
  id: string;
  mission_type: CashPaymentMissionType;
  delivery_order_id: string | null;
  scooter_ride_id: string | null;
  customer_id: string;
  driver_id: string | null;
  status: DriverMissionStatus;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  completed_at: string | null;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: 'general' | 'delivery' | 'scooter_ride' | 'account';
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type DriverCity = 'Msaken' | 'Messadine';

export type DriverProfileRow = {
  user_id: string;
  is_online: boolean;
  deliveries_enabled: boolean;
  scooter_taxi_enabled: boolean;
  vehicle_model: string;
  plate_number: string;
  scooter_brand: string;
  scooter_photo_path: string | null;
  city?: DriverCity | string | null;
  rating: number;
  completed_missions_count: number;
  created_at: string;
  updated_at: string;
};

export type OpenDriverMissionRow = {
  mission_id: string;
  mission_type: CashPaymentMissionType;
  reference: string;
  pickup_address: string;
  destination_address: string;
  created_at: string;
};

export type ActiveDriverMissionRow = {
  mission_id: string;
  mission_type: CashPaymentMissionType;
  target_id: string;
  reference: string;
  mission_status: 'assigned' | 'accepted' | 'in_progress';
  service_status: string;
  pickup_address: string | null;
  destination_address: string;
  amount_millimes: number;
  payment_status: CashPaymentStatus;
};

export type AdminCashPaymentRow = {
  payment_id: string;
  mission_id: string;
  mission_type: CashPaymentMissionType;
  reference: string;
  customer_id: string;
  customer_name: string;
  driver_id: string | null;
  driver_name: string | null;
  collected_by_name: string | null;
  amount_millimes: number;
  payment_method: 'cash';
  payment_status: CashPaymentStatus;
  created_at: string;
  paid_at: string | null;
  collected_by: string | null;
};

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: BusinessRow;
        Insert: Pick<BusinessRow, 'id' | 'kind' | 'name'> & Partial<Omit<BusinessRow, 'id' | 'kind' | 'name'>>;
        Update: Partial<Omit<BusinessRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: Pick<ProductRow, 'id' | 'business_id' | 'name' | 'price_millimes'> & Partial<Omit<ProductRow, 'id' | 'business_id' | 'name' | 'price_millimes'>>;
        Update: Partial<Omit<ProductRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
      product_options: {
        Row: ProductOptionRow;
        Insert: Pick<ProductOptionRow, 'id' | 'product_id' | 'name'> & Partial<Omit<ProductOptionRow, 'id' | 'product_id' | 'name'>>;
        Update: Partial<Omit<ProductOptionRow, 'id' | 'product_id' | 'created_at'>>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: Pick<ProfileRow, 'id'> & Partial<Omit<ProfileRow, 'id'>>;
        Update: Partial<Pick<ProfileRow, 'full_name' | 'phone'>>;
        Relationships: [];
      };
      user_roles: {
        Row: UserRoleRow;
        Insert: Pick<UserRoleRow, 'user_id' | 'role'> & Partial<Pick<UserRoleRow, 'granted_at' | 'granted_by'>>;
        Update: never;
        Relationships: [];
      };
      driver_applications: {
        Row: DriverApplicationRow;
        Insert: Pick<DriverApplicationRow, 'user_id'> & Partial<Omit<DriverApplicationRow, 'user_id'>>;
        Update: never;
        Relationships: [];
      };
      delivery_driver_locations: {
        Row: DriverLocationRow;
        Insert: Omit<DriverLocationRow, 'updated_at'> & { updated_at?: string };
        Update: Partial<Omit<DriverLocationRow, 'order_id' | 'driver_id' | 'customer_id'>>;
        Relationships: [];
      };
      cash_payments: {
        Row: CashPaymentRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      delivery_orders: {
        Row: DeliveryOrderRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      delivery_order_items: {
        Row: DeliveryOrderItemRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      delivery_order_stops: {
        Row: DeliveryOrderStopRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      scooter_rides: {
        Row: ScooterRideRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      scooter_tariffs: {
        Row: ScooterTariffRow;
        Insert: Pick<ScooterTariffRow, 'id' | 'name' | 'fare_millimes'> & Partial<Omit<ScooterTariffRow, 'id' | 'name' | 'fare_millimes'>>;
        Update: Partial<Omit<ScooterTariffRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
      driver_missions: {
        Row: DriverMissionRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: never;
        Update: Partial<Pick<NotificationRow, 'read_at'>>;
        Relationships: [];
      };
      driver_profiles: {
        Row: DriverProfileRow;
        Insert: never;
        Update: Partial<Omit<DriverProfileRow, 'user_id' | 'created_at'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      save_driver_application_profile: {
        Args: {
          scooter_brand: string;
          scooter_photo_path: string;
          profile_photo_path?: string;
          city?: string;
        };
        Returns: undefined;
      };
      place_delivery_order: {
        Args: {
          cart_items: Array<{
            product_id: string;
            quantity: number;
            option_ids?: string[];
            notes?: string;
          }>;
          destination_address: string;
          destination_instructions: string;
          recipient_phone: string;
          destination_latitude: number;
          destination_longitude: number;
        };
        Returns: string;
      };
      create_scooter_ride: {
        Args: {
          pickup_address: string;
          pickup_latitude: number;
          pickup_longitude: number;
          destination_address: string;
          destination_latitude: number;
          destination_longitude: number;
        };
        Returns: string;
      };
      redgo_is_admin: { Args: Record<string, never>; Returns: boolean };
      request_client_access: { Args: Record<string, never>; Returns: undefined };
      submit_driver_application: { Args: Record<string, never>; Returns: string };
      review_driver_application: {
        Args: { application_user_id: string; decision: string; note?: string | null };
        Returns: string;
      };
      issue_cash_payment_qr: {
        Args: { target_type: CashPaymentMissionType; target_id: string };
        Returns: CashPaymentQrRow[];
      };
      mark_mission_ready_for_cash: {
        Args: { target_mission_id: string };
        Returns: string;
      };
      validate_cash_payment_qr: {
        Args: { scanned_token: string };
        Returns: CashPaymentValidationRow[];
      };
      confirm_cash_payment: {
        Args: { scanned_token: string };
        Returns: CashPaymentReceiptRow[];
      };
      get_cash_payment_status: {
        Args: { target_type: CashPaymentMissionType; target_id: string };
        Returns: CashPaymentStatusRow[];
      };
      get_my_active_driver_mission: {
        Args: Record<string, never>;
        Returns: ActiveDriverMissionRow[];
      };
      list_open_driver_missions: {
        Args: Record<string, never>;
        Returns: OpenDriverMissionRow[];
      };
      accept_driver_mission: {
        Args: { target_mission_id: string };
        Returns: string;
      };
      list_admin_cash_payments: {
        Args: Record<string, never>;
        Returns: AdminCashPaymentRow[];
      };
      update_driver_mission_status: {
        Args: { target_mission_id: string; next_status: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
