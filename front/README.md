# REDGO Front

## Architecture

La vraie application mobile principale est l’espace client de `apps/client`.

- `apps/client`: application principale, avec onboarding, auth, client, driver preview et garde-fous de rôle.
- `apps/driver`: compatibilité / aperçu chauffeur, conservé uniquement pour tester l’interface sans backend.
- `apps/admin`: application web d’administration séparée.
- `packages/shared`: types partagés REDGO.
- `packages/theme`: tokens visuels REDGO.

## Règle de conception

Il n’y a qu’une seule app mobile installée par utilisateur :

- l’utilisateur choisit son espace au lancement ;
- le client et le chauffeur ont des interfaces différentes dans le même app ;
- le driver preview reste un mode d’aperçu UI et ne doit pas être présenté comme un backend réel.

## Lancement rapide

```powershell
cd front
npm run client
```

Pour tester l’aperçu chauffeur uniquement :

```powershell
cd front
npm run driver
```
