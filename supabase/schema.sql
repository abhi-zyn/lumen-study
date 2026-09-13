-- Lumen study workspace schema (run in Supabase SQL editor)

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  subject text,
  topic text,
  due_date date,
  minutes int default 30,
  done boolean default false,
  created_at timestamptz default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text,
  tags text,
  body text,
  updated_at timestamptz default now()
);

create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text,
  storage_path text,      -- object path in the 'textbooks' bucket
  pages int default 0,
  progress real default 0,
  created_at timestamptz default now()
);

-- one row per pen stroke / highlight
create table if not exists highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  book_id uuid references books on delete cascade,
  page int not null,
  color text,
  points jsonb not null,  -- [[x,y],...] normalised 0-1 coordinates
  quote text,             -- selected text, if any
  created_at timestamptz default now()
);

-- Row Level Security: every user sees only their own rows
alter table profiles   enable row level security;
alter table tasks      enable row level security;
alter table notes      enable row level security;
alter table books      enable row level security;
alter table highlights enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tasks','notes','books','highlights'] loop
    execute format($f$
      create policy "own rows select" on %1$I for select using (auth.uid() = user_id);
      create policy "own rows insert" on %1$I for insert with check (auth.uid() = user_id);
      create policy "own rows update" on %1$I for update using (auth.uid() = user_id);
      create policy "own rows delete" on %1$I for delete using (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;

create policy "own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);

-- Private storage bucket for PDFs; files live under <uid>/<filename>.pdf
insert into storage.buckets (id, name, public) values ('textbooks','textbooks', false)
on conflict (id) do nothing;

create policy "own pdfs" on storage.objects for all
  using (bucket_id = 'textbooks' and owner = auth.uid())
  with check (bucket_id = 'textbooks' and owner = auth.uid());
