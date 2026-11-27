# REDGO — Plateforme de Livraison, Courses & Scooter Taxi (M'Saken & Messaadine)

Application mobile **Expo / React Native** unifiée (**Client** & **Chauffeur**), tableau de bord web **Next.js Admin** et backend **Supabase** (PostgreSQL, Auth, Storage, RLS, RPCs & Realtime).

---

## 1. Architecture du dépôt

- `front/apps/client` : Application mobile Expo (React Native + Expo Router) regroupant l'espace **Client** et l'espace **Chauffeur**.
- `front/apps/admin` : Application web d'administration (Next.js).
- `front/packages/shared` : Types TypeScript partagés (`Database`, `ProfileRow`, `OpenDriverMissionRow`, `ActiveDriverMissionRow`, etc.).
- `front/packages/theme` : Tokens visuels de base.
- `back/supabase/migrations/` : Migrations SQL versionnées (tables, politiques RLS, RPCs transactionnelles, triggers, Storage).

---

## 2. Fonctionnalités implémentées

### Espace Client (`front/apps/client`)
- **Accueil dynamique** (`app/(tabs)/home.tsx`) :
  - Bannières promotionnelles (`promo_announcements` avec repli silencieux).
  - Bannières compactes de suivi en direct pour toute commande ou course active.
  - Restaurants partenaires, catégories populaires et sélection du moment depuis Supabase.
- **REDGO Food & Courses / Market** (`app/food/`, `app/market/`, `app/(tabs)/explore.tsx`) :
  - Catalogue dynamique avec variantes de produits, suppléments/options et panier partagé (`CartContext`).
- **Scooter Taxi & Envoi de Colis** (`app/booking/pickup.tsx`, `app/booking/map.tsx`, `app/booking/searching.tsx`, `app/ride/tracking/[id].tsx`) :
  - Cartographie interactive (`react-native-maps`) enrichie avec repères locaux OSM vérifiés à M'Saken & Messaadine (`LocalLandmarkMarkers`, `RestaurantMapMarkers`), routage routier (`fetchRoadRoute`) et géocodage inverse (`reverseGeocodeAddress` via Expo Location + Nominatim).
  - Tarification dynamique depuis `scooter_tariffs`.
- **Checkout & Annulation** (`app/checkout.tsx`, `app/order-confirmed.tsx`, `app/order/[id].tsx`) :
  - Sélection d'adresse par GPS actuel ou point sur la carte, contact & instructions conservés lors de la sélection carte.
  - Navigation sécurisée après confirmation (vidage de pile vers l'accueil).
  - Annulation client autorisée uniquement avant assignation d'un livreur via la RPC `cancel_customer_delivery_order(uuid)` (met aussi `driver_missions` à `'cancelled'`).
- **Historique « Mes commandes » & « Mes courses »** (`app/(tabs)/orders.tsx`, `app/(tabs)/rides.tsx`, `app/(tabs)/_layout.tsx`) :
  - Badges dynamiques en temps réel dans la barre de navigation.
  - Cartes enrichies avec photo, quantité et montant calculé de chaque article.
  - Boutons icônes compacts (**Donner un avis** & **Reçu / Détails**).

### Espace Chauffeur (`front/apps/client/components/DriverAppView.tsx`, `app/driver/`)
- **Radar & Missions en temps réel (sans polling)** :
  - Écoute Supabase Realtime (`driver_missions`, `delivery_orders`, `scooter_rides`, `driver_reviews`).
  - Missions disponibles triées **du plus récent au plus ancien** (`created_at desc`), filtrées côté SQL et client pour masquer toute commande/course annulée ou terminée.
  - Détails complets affichés directement sur chaque carte mission (articles avec miniatures, commerce, gain net chauffeur, montant à encaisser).
- **Mission active & Contact client** :
  - Carte interactive (`DriverMissionMap`), appel direct, nom complet du client (via RPC `get_driver_customer_profiles`), téléphone et instructions de remise.
- **Historique & Mes Gains 100 % dynamiques** (`app/driver/history.tsx`, `app/driver/earnings.tsx`) :
  - Filtres par période (**Aujourd'hui**, **Cette semaine**, **Tout**) et par type (**Toutes**, **Livraisons**, **Scooter Taxi**).
  - Affichage des articles avec photos et des avis clients reçus.
- **Score & Avis clients** (`services/driverReviews.ts`) :
  - Calcul dynamique de la note moyenne dans `driver_profiles.rating` et affichage des commentaires clients en direct.

### Paiement en espèces & QR Code
- `CashPaymentPanel.tsx` & `app/driver/cash-payment.tsx` :
  - Génération de QR code côté client, validation de l'encaissement côté chauffeur, puis formulaire d'évaluation (étoiles, tags, commentaire) synchronisé dans `driver_reviews`.

### Système de Notifications en temps réel (`user_notifications`)
- **Migration SQL** : `back/supabase/migrations/20261127010000_user_notifications.sql`
- Déclencheurs PostgreSQL ciblés uniquement sur les événements essentiels :
  - **Client** : assignation du livreur/chauffeur, étapes de livraison/course (`en route`, `arrivé`, `livrée`, `terminée`, `paiement confirmé`, `annulée`).
  - **Chauffeur** : nouvelle mission disponible (chauffeurs en ligne avec service activé), annulation client après assignation, nouvel avis reçu.
- **Interface** :
  - `services/notifications.ts` : chargement, compteur non-lus, marquage lu et abonnement Realtime.
  - `components/NotificationToastHost.tsx` : toast flottant en direct respectant les préférences utilisateur.
  - Écrans dédiés client (`app/(tabs)/notifications.tsx`) et chauffeur (`app/driver/notifications.tsx`) + badges dynamiques sur les cloches d'en-tête.

### Profil, Upload Avatar, Sécurité & Thèmes (Client & Chauffeur)
- **Thème Sombre & Mode Clair smooth** (`context/ThemeContext.tsx`) :
  - Identité néon REDGO (`#FF202A`) conservée dans les deux modes avec bascule dynamique des logos (`assets/logo-dark.png` / `assets/logo-light.png`).
- **Écrans partagés (`app/profile/`)** :
  - `personal-info.tsx` : édition nom, téléphone, upload photo de profil (`expo-image-picker` -> bucket Supabase Storage `avatars`), et paramètres scooter/services pour le chauffeur (`vehicle_model`, `plate_number`, `deliveries_enabled`, `scooter_taxi_enabled`).
  - `password.tsx` : mise à jour du mot de passe.
  - `notifications.tsx` : préférences de notifications persistées.
  - `help.tsx` : centre d'aide (FAQ Client & Chauffeur + contact support).

---

## 3. Migrations SQL à déployer dans Supabase

Exécutez les migrations dans `back/supabase/migrations/` dans l'ordre chronologique via le **Supabase SQL Editor**, en particulier les plus récentes :
1. `20261125010000_fix_scooter_rides_permissions.sql`
2. `20261126010000_customer_cancel_delivery_order.sql`
3. `20261126020000_driver_reviews_and_newest_missions.sql`
4. `20261126030000_profile_avatars_storage.sql`
5. `20261127010000_user_notifications.sql`

---

## 4. Commandes utiles

```powershell
# Lancer l'application mobile (Client & Chauffeur)
cd front
npm run client

# Vérification TypeScript client
npx tsc --noEmit --project apps/client/tsconfig.json

# Lancer le back-office Admin
npm run admin
```
