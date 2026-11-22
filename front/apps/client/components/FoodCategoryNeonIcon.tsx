import React from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export type FoodCategoryIconKey =
  | 'all'
  | 'pizzas'
  | 'ma9loub'
  | 'burgers'
  | 'tacos'
  | 'baquette-farcie'
  | 'chappati'
  | 'mtabga'
  | 'tabouna'
  | 'panini'
  | 'plats-tunisiens'
  | 'desserts'
  | 'boissons-eaux'
  | string;

// Mapping exact des icônes néon circulaires découpées depuis la référence ChatGPT
export const CATEGORY_ICON_IMAGES: Record<string, ImageSourcePropType> = {
  all: require('../assets/categories/icon_all.png'),
  pizzas: require('../assets/categories/icon_pizzas.png'),
  ma9loub: require('../assets/categories/icon_ma9loub.png'),
  burgers: require('../assets/categories/icon_burgers.png'),
  tacos: require('../assets/categories/icon_tacos.png'),
  'baquette-farcie': require('../assets/categories/icon_baquette-farcie.png'),
  chappati: require('../assets/categories/icon_chappati.png'),
  mtabga: require('../assets/categories/icon_mtabga.png'),
  tabouna: require('../assets/categories/icon_tabouna.png'),
  panini: require('../assets/categories/icon_panini.png'),
  'plats-tunisiens': require('../assets/categories/icon_plats-tunisiens.png'),
  desserts: require('../assets/categories/icon_desserts.png'),
  'boissons-eaux': require('../assets/categories/icon_boissons-eaux.png'),
};

// Mapping des photos réelles des plats découpées depuis la référence ChatGPT
export const CATEGORY_FOOD_IMAGES: Record<string, ImageSourcePropType> = {
  pizzas: require('../assets/categories/food_pizzas.png'),
  ma9loub: require('../assets/categories/food_ma9loub.png'),
  burgers: require('../assets/categories/food_burgers.png'),
  tacos: require('../assets/categories/food_tacos.png'),
  'baquette-farcie': require('../assets/categories/food_baquette-farcie.png'),
  chappati: require('../assets/categories/food_chappati.png'),
  mtabga: require('../assets/categories/food_mtabga.png'),
  tabouna: require('../assets/categories/food_tabouna.png'),
  panini: require('../assets/categories/food_panini.png'),
  'plats-tunisiens': require('../assets/categories/food_plats-tunisiens.png'),
  desserts: require('../assets/categories/food_desserts.png'),
  'boissons-eaux': require('../assets/categories/food_boissons-eaux.png'),
};

// Mapping des cartes complètes découpées depuis la référence ChatGPT
export const CATEGORY_CARD_IMAGES: Record<string, ImageSourcePropType> = {
  pizzas: require('../assets/categories/pizzas.png'),
  ma9loub: require('../assets/categories/ma9loub.png'),
  burgers: require('../assets/categories/burgers.png'),
  tacos: require('../assets/categories/tacos.png'),
  'baquette-farcie': require('../assets/categories/baquette-farcie.png'),
  chappati: require('../assets/categories/chappati.png'),
  mtabga: require('../assets/categories/mtabga.png'),
  tabouna: require('../assets/categories/tabouna.png'),
  panini: require('../assets/categories/panini.png'),
  'plats-tunisiens': require('../assets/categories/plats-tunisiens.png'),
  desserts: require('../assets/categories/desserts.png'),
  'boissons-eaux': require('../assets/categories/boissons-eaux.png'),
};

/**
 * Normalise l'identifiant pour faire correspondre l'icône correspondante
 */
export function resolveIconKey(idOrName: string): string {
  const norm = (idOrName || '').toLowerCase().trim();
  if (norm === 'all' || norm === 'tous') return 'all';
  if (norm.includes('pizza')) return 'pizzas';
  if (norm.includes('makloub') || norm.includes('ma9loub')) return 'ma9loub';
  if (norm.includes('burger')) return 'burgers';
  if (norm.includes('tacos')) return 'tacos';
  if (norm.includes('baguette') || norm.includes('baquette')) return 'baquette-farcie';
  if (norm.includes('chapati') || norm.includes('chappati')) return 'chappati';
  if (norm.includes('mtabga')) return 'mtabga';
  if (norm.includes('tabouna')) return 'tabouna';
  if (
    norm.includes('panini') ||
    norm.includes('cornet') ||
    norm.includes('calzone') ||
    norm.includes('fleur')
  ) {
    return 'panini';
  }
  if (
    norm.includes('plat') ||
    norm.includes('grillade') ||
    norm.includes('tunisien') ||
    norm.includes('pate') ||
    norm.includes('salade')
  ) {
    return 'plats-tunisiens';
  }
  if (
    norm.includes('dessert') ||
    norm.includes('sucre') ||
    norm.includes('sucré') ||
    norm.includes('glace') ||
    norm.includes('crepe')
  ) {
    return 'desserts';
  }
  if (
    norm.includes('boisson') ||
    norm.includes('eau') ||
    norm.includes('jus') ||
    norm.includes('soda')
  ) {
    return 'boissons-eaux';
  }
  return 'all';
}

/**
 * Renvoie l'icône image correspondante découpée depuis ChatGPT
 */
export function getCategoryIconImage(idOrName: string): ImageSourcePropType {
  const key = resolveIconKey(idOrName);
  return CATEGORY_ICON_IMAGES[key] || CATEGORY_ICON_IMAGES.all;
}

/**
 * Renvoie la photo réelle du plat découpée depuis ChatGPT
 */
export function getCategoryFoodImage(idOrName: string): ImageSourcePropType | null {
  const key = resolveIconKey(idOrName);
  return CATEGORY_FOOD_IMAGES[key] || null;
}

/**
 * Renvoie la carte entière de la catégorie découpée depuis ChatGPT
 */
export function getCategoryCardImage(idOrName: string): ImageSourcePropType | null {
  const key = resolveIconKey(idOrName);
  return CATEGORY_CARD_IMAGES[key] || null;
}

type FoodCategoryNeonIconProps = {
  categoryId: FoodCategoryIconKey;
  size?: number;
  color?: string;
};

/**
 * Composant Icône catégorie avec image découpée réelle ou fallback SVG
 */
export function FoodCategoryNeonIcon({
  categoryId,
  size = 22,
}: FoodCategoryNeonIconProps) {
  const imageSource = getCategoryIconImage(categoryId);

  if (imageSource) {
    return (
      <Image
        source={imageSource}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="contain"
      />
    );
  }

  // Fallback SVG minimal si besoin
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9.5" stroke="#FF2638" strokeWidth="1.5" />
      <Path d="M8 7v10M16 7v10M12 7v10" stroke="#FF2638" strokeWidth="1.5" />
    </Svg>
  );
}

/**
 * Badge circulaire néon avec l'icône réelle découpée depuis ChatGPT
 */
export function FoodCategoryNeonBadge({
  categoryId,
  isActive = false,
  badgeSize = 30,
  iconSize = 24,
}: {
  categoryId: FoodCategoryIconKey;
  isActive?: boolean;
  badgeSize?: number;
  iconSize?: number;
}) {
  const imageSource = getCategoryIconImage(categoryId);

  return (
    <View
      style={[
        styles.neonCircle,
        {
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize / 2,
        },
        isActive && styles.neonCircleActive,
      ]}
    >
      <Image
        source={imageSource}
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: iconSize / 2,
        }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  neonCircle: {
    backgroundColor: '#0A0A0C',
    borderWidth: 1.5,
    borderColor: '#3F1218',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF2638',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  neonCircleActive: {
    backgroundColor: '#1E070B',
    borderColor: '#FF2638',
    borderWidth: 2,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 5,
  },
});
