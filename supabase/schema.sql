create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.voices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 50),
  minimax_voice_id text not null unique,
  status text not null default 'active' check (status in ('cloning', 'active', 'expiring', 'expired')),
  preview_url text,
  last_used_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists voices_user_id_created_at_idx
  on public.voices (user_id, created_at desc);

create index if not exists voices_user_id_status_idx
  on public.voices (user_id, status);

drop trigger if exists voices_set_updated_at on public.voices;
create trigger voices_set_updated_at
before update on public.voices
for each row
execute function public.set_updated_at();

create table if not exists public.generation_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  voice_id uuid not null references public.voices(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  temp_audio_url text,
  storage_audio_url text,
  error_code integer,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists generation_tasks_user_id_created_at_idx
  on public.generation_tasks (user_id, created_at desc);

create index if not exists generation_tasks_voice_id_created_at_idx
  on public.generation_tasks (voice_id, created_at desc);

drop trigger if exists generation_tasks_set_updated_at on public.generation_tasks;
create trigger generation_tasks_set_updated_at
before update on public.generation_tasks
for each row
execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('generated-audio', 'generated-audio', false)
on conflict (id) do nothing;

alter table public.voices enable row level security;
alter table public.generation_tasks enable row level security;

drop policy if exists "voices_select_own" on public.voices;
create policy "voices_select_own"
on public.voices
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "voices_insert_own" on public.voices;
create policy "voices_insert_own"
on public.voices
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "voices_update_own" on public.voices;
create policy "voices_update_own"
on public.voices
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "voices_delete_own" on public.voices;
create policy "voices_delete_own"
on public.voices
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "generation_tasks_select_own" on public.generation_tasks;
create policy "generation_tasks_select_own"
on public.generation_tasks
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "generation_tasks_insert_own" on public.generation_tasks;
create policy "generation_tasks_insert_own"
on public.generation_tasks
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "generation_tasks_update_own" on public.generation_tasks;
create policy "generation_tasks_update_own"
on public.generation_tasks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "generation_tasks_delete_own" on public.generation_tasks;
create policy "generation_tasks_delete_own"
on public.generation_tasks
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "generated_audio_select_own" on storage.objects;
create policy "generated_audio_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'generated-audio'
  and auth.uid()::text = (storage.foldername(name))[1]
);
