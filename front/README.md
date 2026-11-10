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

Pour lancer l’administration web :

```powershell
cd front
npm run admin
```

## Vérification

```powershell
npm run typecheck
```
