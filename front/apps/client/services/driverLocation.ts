import type { Coordinates } from '@redgo/shared';
import { supabase } from './supabase';

export type LocationConnectionState = 'connecting' | 'live' | 'unavailable' | 'error';

type LocationRecord = {
  latitude: number | null;
  longitude: number | null;
  heading?: number | null;
  updated_at: string;
};

function isLocationRecord(value: unknown): value is LocationRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (record.latitude === null || typeof record.latitude === 'number')
    && (record.longitude === null || typeof record.longitude === 'number')
    && typeof record.updated_at === 'string';
}

/**
 * Publie la position GPS réelle du chauffeur/livreur vers Supabase
 * pour que le client puisse le suivre en temps réel jusqu'à l'arrivée.
 */
export async function publishDriverLocation(params: {
  orderId?: string | null;
  driverId?: string | null;
  latitude: number;
  longitude: number;
  heading?: number | null;
}): Promise<void> {
  const client = supabase;
  if (!client) return;

  const nowIso = new Date().toISOString();
  const { orderId, driverId, latitude, longitude, heading } = params;

  try {
    const tasks: Promise<unknown>[] = [];

    if (orderId) {
      tasks.push(
        Promise.resolve(
          client
            .from('delivery_driver_locations')
            .update({
              latitude,
              longitude,
              heading: typeof heading === 'number' && Number.isFinite(heading) ? heading : null,
              updated_at: nowIso,
            })
            .eq('order_id', orderId)
        )
      );
    }

    if (driverId) {
      tasks.push(
        Promise.resolve(
          (client as any)
            .from('driver_profiles')
            .update({
              current_latitude: latitude,
              current_longitude: longitude,
              updated_at: nowIso,
            })
            .eq('user_id', driverId)
        )
      );
    }

    await Promise.allSettled(tasks);
  } catch {
    // Ignore transient network errors during background GPS sync
  }
}

export function subscribeToDriverLocation(
  orderId: string,
  onLocation: (location: Coordinates, updatedAt: string) => void,
  onState: (state: LocationConnectionState, message?: string) => void,
) {
  const client = supabase;
  if (!client) {
    onState('unavailable', 'Le suivi en direct nécessite la configuration Supabase.');
    return () => undefined;
  }

  let active = true;
  let channel: ReturnType<typeof client.channel> | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  const reportRow = (value: unknown) => {
    if (!active || !isLocationRecord(value)) return;
    const row = value;
    if (typeof row.latitude !== 'number' || typeof row.longitude !== 'number') return;
    onLocation({ latitude: row.latitude, longitude: row.longitude }, row.updated_at);
  };

  const fetchLatest = async () => {
    if (!active) return;
    const { data, error } = await client
      .from('delivery_driver_locations')
      .select('latitude, longitude, heading, updated_at')
      .eq('order_id', orderId)
      .maybeSingle();

    if (!active) return;
    if (error) {
      onState('error', 'Impossible de lire la position. Vérifiez la commande et vos droits.');
      return;
    }
    reportRow(data);
  };

  onState('connecting', 'Connexion au suivi du coursier…');

  void (async () => {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (!active) return;
    if (sessionError || !sessionData.session) {
      onState('unavailable', 'Connectez-vous pour accéder au suivi sécurisé de cette commande.');
      return;
    }

    channel = client
      .channel(`driver-location:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_driver_locations',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          reportRow(payload.new);
        },
      )
      .subscribe((status, error) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') onState('connecting', 'En attente de la position du coursier…');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          onState('error', error?.message ?? 'Connexion au suivi interrompue.');
        }
      });

    await fetchLatest();

    // Filet de sécurité : rafraîchissement périodique toutes les 3s si WebSocket ralenti
    pollInterval = setInterval(() => {
      void fetchLatest();
    }, 3000);
  })().catch((error: unknown) => {
    if (active) onState('error', error instanceof Error ? error.message : 'Erreur de suivi inconnue.');
  });

  return () => {
    active = false;
    if (pollInterval) clearInterval(pollInterval);
    if (channel) void client.removeChannel(channel);
  };
}
