import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

export type LocalLandmark = {
  id: string;
  label: string;
  address: string;
  icon: keyof typeof Ionicons.glyphMap;
  latitude: number;
  longitude: number;
  category: 'center' | 'service';
};

/**
 * Repères et lieux reconnus de M'Saken et Messaadine,
 * avec leurs coordonnées exactes vérifiées sur OpenStreetMap.
 */
export const LOCAL_LANDMARKS: LocalLandmark[] = [
  {
    id: 'msaken_centre',
    label: "M'Saken",
    address: "M'Saken, RN1, Gouvernorat Sousse",
    icon: 'business',
    latitude: 35.7330411,
    longitude: 10.5751923,
    category: 'center',
  },
  {
    id: 'marche_municipal',
    label: 'Marché Municipal',
    address: "Marché Municipal, Rue Farhat Hached, M'Saken",
    icon: 'storefront',
    latitude: 35.7266265,
    longitude: 10.5829902,
    category: 'service',
  },
  {
    id: 'marche_hebdo',
    label: 'Marché Hebdomadaire',
    address: "Marché Hebdomadaire, M'Saken",
    icon: 'cart',
    latitude: 35.7241947,
    longitude: 10.5838556,
    category: 'service',
  },
  {
    id: 'gare_msaken',
    label: "Gare M'Saken",
    address: "Gare de M'Saken",
    icon: 'train',
    latitude: 35.7289523,
    longitude: 10.5999530,
    category: 'service',
  },
  {
    id: 'csb_nord_msaken',
    label: "CSB Nord M'Saken",
    address: "CSB Nord M'Saken, Rue Ezzouhour",
    icon: 'medkit',
    latitude: 35.7337083,
    longitude: 10.5742259,
    category: 'service',
  },
  {
    id: 'pharmacie_hachicha',
    label: 'Pharmacie Hachicha',
    address: "Pharmacie Hachicha, Centre-Ville, M'Saken",
    icon: 'medical',
    latitude: 35.7272592,
    longitude: 10.5807675,
    category: 'service',
  },
  {
    id: 'stb_msaken',
    label: "STB M'Saken",
    address: "Banque STB, M'Saken",
    icon: 'card',
    latitude: 35.7296334,
    longitude: 10.5784750,
    category: 'service',
  },
  {
    id: 'ecole_poste',
    label: 'École Rue de Poste',
    address: "École Primaire Rue de Poste, M'Saken",
    icon: 'school',
    latitude: 35.7261396,
    longitude: 10.5833339,
    category: 'service',
  },
  {
    id: 'messaadine_centre',
    label: 'Messaadine',
    address: 'Messaadine Centre',
    icon: 'location',
    latitude: 35.7613215,
    longitude: 10.5966672,
    category: 'center',
  },
  {
    id: 'municipalite_messaadine',
    label: 'Municipalité Messadine',
    address: 'Municipalité Messadine, Route Nationale Tunis - Ras Jedir',
    icon: 'flag',
    latitude: 35.7568365,
    longitude: 10.5973755,
    category: 'service',
  },
  {
    id: 'halte_messaadine',
    label: 'Halte Messadine',
    address: 'Halte ferroviaire Messadine',
    icon: 'train',
    latitude: 35.7548572,
    longitude: 10.5909773,
    category: 'service',
  },
  {
    id: 'pharmacie_nuit_messaadine',
    label: 'Pharmacie de nuit',
    address: 'Pharmacie de nuit, Messadine',
    icon: 'medical',
    latitude: 35.7577724,
    longitude: 10.5998270,
    category: 'service',
  },
  {
    id: 'garde_nationale_messaadine',
    label: 'Garde Nationale',
    address: 'Garde Nationale, Messadine',
    icon: 'shield',
    latitude: 35.7600970,
    longitude: 10.6009804,
    category: 'service',
  },
];

type LocalLandmarkMarkersProps = {
  onSelectLandmark?: (landmark: LocalLandmark) => void;
};

export function LocalLandmarkMarkers({ onSelectLandmark }: LocalLandmarkMarkersProps) {
  return (
    <>
      {LOCAL_LANDMARKS.map((lm) => (
        <Marker
          key={`lm-${lm.id}`}
          coordinate={{ latitude: lm.latitude, longitude: lm.longitude }}
          title={lm.label}
          description={lm.address}
          anchor={{ x: 0.5, y: 0.5 }}
          onPress={() => onSelectLandmark?.(lm)}
          zIndex={1}
        >
          <View
            style={[
              styles.pill,
              lm.category === 'center' && styles.pillCenter,
            ]}
          >
            <Ionicons name={lm.icon} size={10} color="#E2E8F0" />
            <Text style={styles.text} numberOfLines={1}>
              {lm.label}
            </Text>
          </View>
        </Marker>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  pillCenter: {
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    borderColor: 'rgba(56, 189, 248, 0.55)',
  },
  text: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '700',
  },
});
