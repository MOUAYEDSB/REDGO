import type {
  ActiveDriverMissionRow,
  DriverProfileRow,
  OpenDriverMissionRow,
} from '@redgo/shared';
import { requireSupabase } from './supabase';

export async function getDriverProfile(userId: string): Promise<DriverProfileRow> {
  const { data, error } = await requireSupabase()
    .from('driver_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function setDriverOnline(userId: string, isOnline: boolean): Promise<DriverProfileRow> {
  const { data, error } = await requireSupabase()
    .from('driver_profiles')
    .update({ is_online: isOnline })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listOpenDriverMissions(): Promise<OpenDriverMissionRow[]> {
  const { data, error } = await requireSupabase().rpc('list_open_driver_missions');
  if (error) throw error;
  return data ?? [];
}

export async function getMyActiveDriverMission(): Promise<ActiveDriverMissionRow | null> {
  const { data, error } = await requireSupabase().rpc('get_my_active_driver_mission');
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function acceptDriverMission(missionId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('accept_driver_mission', {
    target_mission_id: missionId,
  });
  if (error) throw error;
}

export async function updateDriverMissionStatus(
  missionId: string,
  nextStatus: 'accepted' | 'in_progress' | 'cancelled',
): Promise<void> {
  const { error } = await requireSupabase().rpc('update_driver_mission_status', {
    target_mission_id: missionId,
    next_status: nextStatus,
  });
  if (error) throw error;
}
