# REDGO Front

## Architecture

- `apps/client`: l’unique application mobile Expo, avec les espaces Client et Chauffeur.
- `apps/admin`: application web d’administration séparée.
- `packages/shared`: types REDGO partagés.
- `packages/theme`: tokens visuels REDGO.

L’utilisateur choisit son espace dans l’application mobile. Les deux espaces partagent la même installation et l’authentification; l’accès chauffeur dépend des autorisations serveur. Le mode aperçu chauffeur ne représente pas un backend réel.

## Lancement

```powershell
cd front
npm run client
```

Par défaut, l’application démarre en mode aperçu sans authentification : choisissez l’espace Client ou Chauffeur pour parcourir les interfaces. Aucun compte n’est requis; les actions qui dépendent du backend ne sont pas simulées.

L’authentification Supabase peut être activée plus tard en renseignant les variables Supabase dans `apps/client/.env` et en définissant `EXPO_PUBLIC_ENABLE_AUTH=true`.

Pour lancer l’administration web :

```powershell
cd front
npm run admin
```

## Vérification

```powershell
npm run typecheck
```
