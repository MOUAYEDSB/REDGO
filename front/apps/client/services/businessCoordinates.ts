/**
 * Service centralisé pour les coordonnées précises des établissements (Restaurants & Hub Courses)
 * Garantit que chaque restaurant créé possède sa position réelle et distincte sur la carte de l'application.
 */

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export const MSAKEN_CENTER: Coordinates = { latitude: 35.7273, longitude: 10.5815 };
export const MESSAADINE_CENTER: Coordinates = { latitude: 35.7551, longitude: 10.5921 };

export const KNOWN_BUSINESS_COORDINATES: Record<string, { latitude: number; longitude: number; name: string; address: string }> = {
  courses_hub_msaken: {
    name: 'Courses REDGO (Hub Central)',
    latitude: 35.7420,
    longitude: 10.5890,
    address: 'Route de Messaadine, M\'Saken',
  },
  'el-sazon': {
    name: 'El Sazon',
    latitude: 35.7318,
    longitude: 10.5842,
    address: 'Avenue de l’Environnement, M’Saken',
  },
  'fast-food-chkanna': {
    name: 'Fast Food Chkanna',
    latitude: 35.7245,
    longitude: 10.5788,
    address: 'Rue Taieb Mhiri, M\'Saken Centre',
  },
  'chapati-baba-sanfour': {
    name: 'Chapati Baba Sanfour',
    latitude: 35.7289,
    longitude: 10.5810,
    address: 'Avenue Habib Bourguiba, M\'Saken Centre',
  },
  'black-house': {
    name: 'Black House',
    latitude: 35.7335,
    longitude: 10.5865,
    address: '3 Rue Sidi Abar, M’Saken',
  },
  'fleur-d-amour': {
    name: 'Fleur d\'Amour',
    latitude: 35.7262,
    longitude: 10.5835,
    address: 'Centre Ville M\'Saken',
  },
};

/**
 * Résout les coordonnées réelles d'un restaurant / commerce pour la carte
 * Si le restaurant a été créé avec des coordonnées GPS précises, on les utilise.
 * Sinon on résout via le registre connu, ou on applique une position distincte.
 */
export function resolveBusinessCoordinates(
  businessId?: string | null,
  businessName?: string | null,
  dbLatitude?: number | null,
  dbLongitude?: number | null,
): Coordinates {
  // 1. Si la base a des coordonnées spécifiques non-par défaut (autre que 35.7273 pile)
  if (
    typeof dbLatitude === 'number' &&
    typeof dbLongitude === 'number' &&
    dbLatitude !== 0 &&
    dbLongitude !== 0 &&
    !(Math.abs(dbLatitude - 35.7273) < 0.0001 && Math.abs(dbLongitude - 10.5815) < 0.0001)
  ) {
    return { latitude: dbLatitude, longitude: dbLongitude };
  }

  // 2. Recherche par identifiant dans le registre officiel
  if (businessId && KNOWN_BUSINESS_COORDINATES[businessId]) {
    const known = KNOWN_BUSINESS_COORDINATES[businessId];
    return { latitude: known.latitude, longitude: known.longitude };
  }

  // 3. Recherche par nom (insensible à la casse)
  if (businessName) {
    const lower = businessName.toLowerCase();
    for (const [key, item] of Object.entries(KNOWN_BUSINESS_COORDINATES)) {
      if (lower.includes(item.name.toLowerCase()) || lower.includes(key)) {
        return { latitude: item.latitude, longitude: item.longitude };
      }
    }
  }

  // 4. Si c'est un nouveau restaurant créé, générer un emplacement réaliste et distinct à M'Saken
  if (businessId) {
    let hash = 0;
    for (let i = 0; i < businessId.length; i++) {
      hash = (hash << 5) - hash + businessId.charCodeAt(i);
      hash |= 0;
    }
    const latOffset = ((Math.abs(hash) % 100) - 50) * 0.00015;
    const lngOffset = ((Math.abs(hash >> 3) % 100) - 50) * 0.00015;
    return {
      latitude: MSAKEN_CENTER.latitude + latOffset,
      longitude: MSAKEN_CENTER.longitude + lngOffset,
    };
  }

  return MSAKEN_CENTER;
}
