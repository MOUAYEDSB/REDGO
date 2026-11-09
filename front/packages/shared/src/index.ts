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

export type Database = {
  public: {
    Tables: {
      delivery_driver_locations: {
        Row: DriverLocationRow;
        Insert: Omit<DriverLocationRow, 'updated_at'> & { updated_at?: string };
        Update: Partial<Omit<DriverLocationRow, 'order_id' | 'driver_id' | 'customer_id'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
