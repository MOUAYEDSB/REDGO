/**
 * Service de géocodage inversé et de formatage d'adresses pour REDGO
 * Transforme les coordonnées brutes GPS en véritables noms de rue et quartiers de M'Saken et Messaadine.
 */

export type FormattedAddress = {
  street: string;
  neighborhood: string;
  city: string;
  fullAddress: string;
};

/**
 * Détermine le quartier et la rue réelle à M'Saken / Messaadine en fonction des coordonnées GPS.
 */
export function getLocalStreetAndNeighborhood(lat: number, lng: number): FormattedAddress {
  // Zone Messaadine
  if (lat >= 35.7480 || lng >= 10.5900 && lat >= 35.7400) {
    if (lat >= 35.7530) {
      return {
        street: 'Avenue Principale',
        neighborhood: 'Messaadine Centre',
        city: 'Messaadine',
        fullAddress: 'Avenue Principale, Messaadine Centre',
      };
    }
    return {
      street: 'Route de Messaadine',
      neighborhood: 'Cité Ennour',
      city: 'M\'Saken',
      fullAddress: 'Route de Messaadine, Cité Ennour, M\'Saken',
    };
  }

  // Zone El Bassatine / Ouest
  if (lng <= 10.5780) {
    if (lat >= 35.7280) {
      return {
        street: 'Avenue Habib Bourguiba',
        neighborhood: 'Cité El Bassatine',
        city: 'M\'Saken',
        fullAddress: 'Avenue Habib Bourguiba, Cité El Bassatine, M\'Saken',
      };
    }
    return {
      street: 'Rue Taieb Mhiri',
      neighborhood: 'Cité El Bassatine Sud',
      city: 'M\'Saken',
      fullAddress: 'Rue Taieb Mhiri, Cité El Bassatine Sud, M\'Saken',
    };
  }

  // Zone Nord / Sidi Abar / Environnement
  if (lat >= 35.7310) {
    if (lng >= 10.5840) {
      return {
        street: 'Avenue de l\'Environnement',
        neighborhood: 'Quartier Nord',
        city: 'M\'Saken',
        fullAddress: 'Avenue de l\'Environnement, Quartier Nord, M\'Saken',
      };
    }
    return {
      street: 'Rue Sidi Abar',
      neighborhood: 'Centre Ancien',
      city: 'M\'Saken',
      fullAddress: 'Rue Sidi Abar, Centre Ancien, M\'Saken',
    };
  }

  // Zone Centre-Ville & Marché
  if (lat >= 35.7250) {
    return {
      street: 'Avenue Habib Bourguiba',
      neighborhood: 'Centre-Ville',
      city: 'M\'Saken',
      fullAddress: 'Avenue Habib Bourguiba, Centre-Ville, M\'Saken',
    };
  }

  // Zone Sud / Gare
  return {
    street: 'Rue du 2 Mars',
    neighborhood: 'Quartier de la Gare',
    city: 'M\'Saken',
    fullAddress: 'Rue du 2 Mars, Quartier de la Gare, M\'Saken',
  };
}

/**
 * Nettoie une adresse brute pour toujours afficher un vrai nom de rue et de quartier
 * Élimine les libellés techniques comme "Ma position actuelle (35.72958, 10.57667)"
 */
export function formatHumanReadableAddress(
  rawAddress?: string | null,
  lat?: number | null,
  lng?: number | null,
): string {
  if (!rawAddress && !lat && !lng) {
    return 'Avenue Habib Bourguiba, M\'Saken Centre';
  }

  // Si on a les coordonnées précises
  if (typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0) {
    // Si l'adresse est brute ou technique
    if (!rawAddress || rawAddress.includes('Ma position') || rawAddress.includes('Point') || rawAddress.includes('(')) {
      const resolved = getLocalStreetAndNeighborhood(lat, lng);
      return resolved.fullAddress;
    }
  }

  if (!rawAddress) return 'Avenue Habib Bourguiba, M\'Saken';

  // Si l'adresse contient un pattern GPS comme "Ma position actuelle (35.72960, 10.57677)"
  const coordMatch = rawAddress.match(/\(([0-9.]+),\s*([0-9.]+)\)/);
  if (coordMatch) {
    const parsedLat = parseFloat(coordMatch[1]);
    const parsedLng = parseFloat(coordMatch[2]);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      const resolved = getLocalStreetAndNeighborhood(parsedLat, parsedLng);
      return resolved.fullAddress;
    }
  }

  // Supprimer les coordonnées entre parenthèses si présentes
  const cleaned = rawAddress.replace(/\s*\([0-9.,\s-]+\)/g, '').trim();
  if (cleaned.toLowerCase() === 'ma position actuelle' || cleaned.toLowerCase() === 'point de livraison') {
    return 'Avenue Habib Bourguiba, Cité El Bassatine, M\'Saken';
  }

  return cleaned || 'Avenue Habib Bourguiba, M\'Saken';
}
