import { requireSupabase } from './supabase';

export type UserNotification = {
  id: string;
  userId: string;
  role: 'client' | 'driver';
  category: 'order' | 'ride' | 'mission' | 'payment' | 'review';
  title: string;
  body: string;
  targetRoute: string | null;
  isRead: boolean;
  createdAt: string;
};

function mapRow(row: any): UserNotification {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    category: row.category,
    title: row.title,
    body: row.body,
    targetRoute: row.target_route || null,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  };
}

export async function fetchMyNotifications(limit = 40): Promise<UserNotification[]> {
  try {
    const client = requireSupabase();
    const { data, error } = await (client as any)
      .from('user_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return (data as any[]).map(mapRow);
  } catch {
    return [];
  }
}

export async function fetchUnreadNotificationsCount(userId?: string): Promise<number> {
  if (!userId) return 0;
  try {
    const client = requireSupabase();
    const { count, error } = await (client as any)
      .from('user_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error || typeof count !== 'number') return 0;
    return count;
  } catch {
    return 0;
  }
}

export async function markNotificationAsRead(id: string): Promise<void> {
  try {
    const client = requireSupabase();
    await (client as any)
      .from('user_notifications')
      .update({ is_read: true })
      .eq('id', id);
  } catch {
    // Ignorer
  }
}

export async function markAllNotificationsAsRead(userId?: string): Promise<void> {
  if (!userId) return;
  try {
    const client = requireSupabase();
    await (client as any)
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  } catch {
    // Ignorer
  }
}

export function subscribeToMyNotifications(
  userId: string,
  onInsert: (notif: UserNotification) => void,
  onAnyChange?: () => void,
): () => void {
  try {
    const client = requireSupabase();
    const channelName = `user-notifs-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          if (payload?.new) {
            onInsert(mapRow(payload.new));
          }
          onAnyChange?.();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` },
        () => {
          onAnyChange?.();
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}
