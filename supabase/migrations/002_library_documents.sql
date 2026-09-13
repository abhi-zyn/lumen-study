-- Shared textbook library + personal document index (StudyForge)

create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.admins enable row level security;
create policy "admins visible to signed in users" on public.admins
  for select to authenticated using (true);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- public textbooks: everyone reads, admins write
create table if not exists public.library_books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text,
  storage_path text not null,
  pages int default 0,
  cover_hue int default 220,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);
alter table public.library_books enable row level security;
create policy "library readable by everyone" on public.library_books for select using (true);
create policy "library insert admin" on public.library_books for insert to authenticated with check (public.is_admin());
create policy "library update admin" on public.library_books for update to authenticated using (public.is_admin());
create policy "library delete admin" on public.library_books for delete to authenticated using (public.is_admin());

-- personal PDFs (in the user's Google Drive or their private Supabase folder)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  kind text not null default 'note' check (kind in ('note','scan','textbook')),
  source text not null default 'supabase' check (source in ('supabase','drive')),
  drive_id text,
  storage_path text,
  size_bytes bigint,
  pages int default 0,
  created_at timestamptz default now()
);
alter table public.documents enable row level security;
create policy "documents own rows" on public.documents for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists documents_user_idx on public.documents (user_id, created_at desc);

-- public bucket for shared textbooks
insert into storage.buckets (id, name, public) values ('library','library', true)
  on conflict (id) do nothing;
create policy "library files readable" on storage.objects for select using (bucket_id = 'library');
create policy "library files insert admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'library' and public.is_admin());
create policy "library files update admin" on storage.objects for update to authenticated
  using (bucket_id = 'library' and public.is_admin());
create policy "library files delete admin" on storage.objects for delete to authenticated
  using (bucket_id = 'library' and public.is_admin());
