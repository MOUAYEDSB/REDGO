import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { supabase } from '../services/supabase';

export type MapRestaurantPlace = {
  id: string;
  name: string;
  address: string;
  kind: 'restaurant' | 'courses';
  latitude: number;
  longitude: number;
};

type RestaurantMapMarkersProps = {
  onSelectPlace?: (place: MapRestaurantPlace) => void;
};

let cachedPlaces: MapRestaurantPlace[] | null = null;

export function RestaurantMapMarkers({ onSelectPlace }: RestaurantMapMarkersProps) {
  const [places, setPlaces] = useState<MapRestaurantPlace[]>(cachedPlaces ?? []);

  useEffect(() => {
    if (cachedPlaces) return;
    if (!supabase) return;

    let active = true;
    (supabase as any)
      .from('businesses')
      .select('id, name, address, kind, latitude, longitude, is_active')
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .then(({ data, error }: { data: any[] | null; error: any }) => {
        if (!active || error || !Array.isArray(data)) return;

        const list: MapRestaurantPlace[] = data
          .filter(
            (row) =>
              typeof row.latitude === 'number' &&
              typeof row.longitude === 'number' &&
              Number.isFinite(row.latitude) &&
              Number.isFinite(row.longitude) &&
              row.latitude !== 0 &&
              row.longitude !== 0,
          )
          .map((row) => ({
            id: row.id,
            name: row.name,
            address: row.address || "M'Saken",
            kind: row.kind === 'courses' ? 'courses' : 'restaurant',
            latitude: row.latitude,
            longitude: row.longitude,
          }));

        cachedPlaces = list;
        setPlaces(list);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  if (places.length === 0) return null;

  return (
    <>
      {places.map((place) => {
        const isCourses = place.kind === 'courses';
        return (
          <Marker
            key={`restau-pin-${place.id}`}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            title={place.name}
            description={place.address}
            anchor={{ x: 0.5, y: 0.85 }}
            onPress={() => onSelectPlace?.(place)}
            zIndex={2}
          >
            <View style={styles.wrap}>
              <View style={[styles.labelPill, isCourses ? styles.labelCourses : styles.labelRestau]}>
                <Text style={styles.labelText} numberOfLines={1}>
                  {place.name}
                </Text>
              </View>
              <View style={[styles.pin, isCourses ? styles.pinCourses : styles.pinRestau]}>
                <Ionicons
                  name={isCourses ? 'basket' : 'restaurant'}
                  size={13}
                  color="#FFFFFF"
                />
              </View>
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 2,
  },
  labelPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
    maxWidth: 115,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  labelRestau: {
    backgroundColor: 'rgba(245, 158, 11, 0.92)',
  },
  labelCourses: {
    backgroundColor: 'rgba(59, 130, 246, 0.92)',
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  pin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  pinRestau: {
    backgroundColor: '#F59E0B',
  },
  pinCourses: {
    backgroundColor: '#3B82F6',
  },
});
