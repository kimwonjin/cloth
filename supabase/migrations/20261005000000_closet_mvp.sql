-- 나의 옷장 MVP schema: profiles, clothes, outfits, wear logs, likes, board saves.

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user, created automatically on sign up)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default '' check (char_length(nickname) <= 20),
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Default nickname like "옷장러3f9a" (never derived from the phone number).
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nickname', ''),
      '옷장러' || substr(replace(new.id::text, '-', ''), 1, 4)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Clothes
-- ---------------------------------------------------------------------------
create table public.clothes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  image_path text not null,
  category text not null check (category in ('top', 'bottom', 'outer', 'shoes', 'accessory')),
  color text not null default 'etc',
  seasons text[] not null default '{spring,summer,autumn,winter}'
    check (seasons <@ array['spring', 'summer', 'autumn', 'winter']),
  brand text check (char_length(brand) <= 40),
  size text check (char_length(size) <= 20),
  created_at timestamptz not null default now()
);
create index clothes_user_id_idx on public.clothes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Outfits (saved / published / worn combinations)
-- ---------------------------------------------------------------------------
create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  source text not null default 'manual' check (source in ('ai', 'manual', 'copy')),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  styles text[] not null default '{}',
  seasons text[] not null default '{}',
  colors text[] not null default '{}',
  like_count integer not null default 0,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index outfits_user_id_idx on public.outfits (user_id, created_at desc);
create index outfits_public_idx on public.outfits (published_at desc) where visibility = 'public';

create table public.outfit_items (
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  clothing_id uuid not null references public.clothes (id) on delete cascade,
  slot text not null check (slot in ('top', 'bottom', 'outer', 'shoes', 'accessory')),
  position smallint not null default 0,
  primary key (outfit_id, clothing_id)
);
create index outfit_items_clothing_id_idx on public.outfit_items (clothing_id);

-- Keep published_at in sync with visibility.
create function public.set_outfit_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.visibility = 'public' and (tg_op = 'INSERT' or old.visibility <> 'public') then
    new.published_at := now();
  elsif new.visibility = 'private' then
    new.published_at := null;
  end if;
  return new;
end;
$$;

create trigger outfits_published_at
  before insert or update of visibility on public.outfits
  for each row execute function public.set_outfit_published_at();

-- ---------------------------------------------------------------------------
-- OOTD wear logs (one per user per day)
-- ---------------------------------------------------------------------------
create table public.wear_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  worn_on date not null,
  outfit_id uuid references public.outfits (id) on delete set null,
  photo_path text,
  created_at timestamptz not null default now(),
  unique (user_id, worn_on)
);

-- ---------------------------------------------------------------------------
-- Likes and board saves (Pinterest-style pins)
-- ---------------------------------------------------------------------------
create table public.outfit_likes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, outfit_id)
);

create table public.board_saves (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, outfit_id)
);

-- Likers can't update other people's outfits, so maintain the count here.
create function public.update_outfit_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.outfits set like_count = like_count + 1 where id = new.outfit_id;
  else
    update public.outfits set like_count = greatest(like_count - 1, 0) where id = old.outfit_id;
  end if;
  return null;
end;
$$;

create trigger outfit_likes_count
  after insert or delete on public.outfit_likes
  for each row execute function public.update_outfit_like_count();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clothes enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;
alter table public.wear_logs enable row level security;
alter table public.outfit_likes enable row level security;
alter table public.board_saves enable row level security;

-- Visibility helpers (security definer avoids recursive policy evaluation).
create function public.can_view_outfit(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.outfits o
    where o.id = target and (o.visibility = 'public' or o.user_id = (select auth.uid()))
  );
$$;

create function public.is_in_public_outfit(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.outfit_items oi
    join public.outfits o on o.id = oi.outfit_id
    where oi.clothing_id = target and o.visibility = 'public'
  );
$$;

create function public.owns_outfit(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.outfits o where o.id = target and o.user_id = (select auth.uid())
  );
$$;

create function public.owns_clothing(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.clothes c where c.id = target and c.user_id = (select auth.uid())
  );
$$;

-- profiles: nicknames are visible to signed-in users; only the owner edits.
create policy "profiles readable" on public.profiles
  for select to authenticated using (true);
create policy "profiles own update" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- clothes: own, or part of a public outfit (needed to render explore collages).
create policy "clothes readable" on public.clothes
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_in_public_outfit(id));
create policy "clothes own insert" on public.clothes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "clothes own update" on public.clothes
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "clothes own delete" on public.clothes
  for delete to authenticated using (user_id = (select auth.uid()));

-- outfits
create policy "outfits readable" on public.outfits
  for select to authenticated
  using (visibility = 'public' or user_id = (select auth.uid()));
create policy "outfits own insert" on public.outfits
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "outfits own update" on public.outfits
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "outfits own delete" on public.outfits
  for delete to authenticated using (user_id = (select auth.uid()));

-- outfit_items: readable with the outfit; writable only with own outfit + own clothes.
create policy "outfit items readable" on public.outfit_items
  for select to authenticated using (public.can_view_outfit(outfit_id));
create policy "outfit items own insert" on public.outfit_items
  for insert to authenticated
  with check (public.owns_outfit(outfit_id) and public.owns_clothing(clothing_id));
create policy "outfit items own delete" on public.outfit_items
  for delete to authenticated using (public.owns_outfit(outfit_id));

-- wear_logs: private to the owner.
create policy "wear logs own" on public.wear_logs
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- likes: own rows only, and only on outfits the user can see.
create policy "likes own select" on public.outfit_likes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "likes own insert" on public.outfit_likes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_view_outfit(outfit_id));
create policy "likes own delete" on public.outfit_likes
  for delete to authenticated using (user_id = (select auth.uid()));

-- board saves: own rows only.
create policy "board saves own select" on public.board_saves
  for select to authenticated using (user_id = (select auth.uid()));
create policy "board saves own insert" on public.board_saves
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_view_outfit(outfit_id));
create policy "board saves own delete" on public.board_saves
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: clothes images are public-read (shown in explore), OOTD photos private.
-- Objects live under "<user id>/<file>".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('clothes', 'clothes', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('ootd', 'ootd', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "closet images own insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('clothes', 'ootd')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "closet images own update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('clothes', 'ootd')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "closet images own delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('clothes', 'ootd')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "closet images own select" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('clothes', 'ootd')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
