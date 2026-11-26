-- Allow authenticated users to update avatar_path on their own profile
-- and configure public 'avatars' storage bucket for profile photos.

grant update (full_name, phone, avatar_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read access for avatars" on storage.objects;
create policy "Public read access for avatars"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

drop policy if exists "Users upload their own avatar" on storage.objects;
create policy "Users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update their own avatar" on storage.objects;
create policy "Users update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete their own avatar" on storage.objects;
create policy "Users delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
