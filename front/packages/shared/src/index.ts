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
  phone: string | null;
  created_at: string;
  updated_at: string;
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

export type Database = {
  public: {
    Tables: {
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
    };
    Views: Record<string, never>;
    Functions: {
      request_client_access: { Args: Record<string, never>; Returns: undefined };
      submit_driver_application: { Args: Record<string, never>; Returns: string };
      review_driver_application: {
        Args: { application_user_id: string; decision: string; note?: string | null };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
