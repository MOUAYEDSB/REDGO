# Architecture

REDGO is a three-surface application backed by Supabase.

- The client app is built with React Native, Expo, and TypeScript.
- The driver app is built with React Native, Expo, and TypeScript.
- The admin application is built with Next.js and TypeScript.
- Frontend workspaces share packages for types, validation, configuration, and design tokens.
- PostgreSQL, RLS, Auth, Realtime, Storage, and Edge Functions are provided by Supabase.

An Express backend is not part of the Phase 0 architecture.
