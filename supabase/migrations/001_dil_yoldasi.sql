-- Dil Yoldaşı: cədvəllər, RLS, qarşılıqlı like → match, discovery RPC
-- Supabase SQL Editor-də və ya CLI ilə tətbiq edin.
-- Realtime: Dashboard → Database → Replication → messages cədvəlini əlavə edin (və ya aşağıdakı sətri işlədin).

-- ---------------------------------------------------------------------------
-- Cədvəllər
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  age integer not null check (age >= 13 and age <= 120),
  city text not null,
  level text not null check (level in ('A1', 'A2', 'B1', 'B2')),
  goal text not null check (goal in ('koc', 'is', 'imtahan', 'maraq')),
  streak integer not null default 0,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_user, to_user),
  check (from_user <> to_user)
);

create table if not exists public.passes (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_user, to_user),
  check (from_user <> to_user)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user1 uuid not null references public.profiles (id) on delete cascade,
  user2 uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user1, user2),
  check (user1 < user2)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_match_id_created_at_idx on public.messages (match_id, created_at);

-- ---------------------------------------------------------------------------
-- Qarşılıqlı like → match
-- ---------------------------------------------------------------------------

create or replace function public.handle_mutual_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a uuid;
  b uuid;
begin
  if exists (
    select 1
    from public.likes l
    where l.from_user = new.to_user
      and l.to_user = new.from_user
  ) then
    if new.from_user < new.to_user then
      a := new.from_user;
      b := new.to_user;
    else
      a := new.to_user;
      b := new.from_user;
    end if;
    insert into public.matches (user1, user2)
    values (a, b)
    on conflict (user1, user2) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_likes_mutual_match on public.likes;
create trigger trg_likes_mutual_match
  after insert on public.likes
  for each row
  execute procedure public.handle_mutual_like();

-- ---------------------------------------------------------------------------
-- Discovery: mənim səviyyəm ±1, like/pass/match istisna
-- ---------------------------------------------------------------------------

create or replace function public.get_partner_candidates()
returns table (
  id uuid,
  name text,
  age integer,
  city text,
  level text,
  goal text,
  streak integer,
  avatar_url text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select p.id as uid, p.level::text as lvl
    from public.profiles p
    where p.id = auth.uid()
  ),
  lvl_num as (
    select
      me.uid,
      case me.lvl
        when 'A1' then 1
        when 'A2' then 2
        when 'B1' then 3
        when 'B2' then 4
        else 0
      end as n
    from me
  )
  select
    p.id,
    p.name,
    p.age,
    p.city,
    p.level::text,
    p.goal::text,
    p.streak,
    p.avatar_url,
    p.created_at
  from public.profiles p
  cross join me
  cross join lvl_num ln
  where p.id <> me.uid
    and exists (select 1 from me)
    and abs(
      (case p.level
        when 'A1' then 1
        when 'A2' then 2
        when 'B1' then 3
        when 'B2' then 4
        else 0
      end) - ln.n
    ) <= 1
    and not exists (
      select 1 from public.likes l
      where l.from_user = me.uid and l.to_user = p.id
    )
    and not exists (
      select 1 from public.passes x
      where x.from_user = me.uid and x.to_user = p.id
    )
    and not exists (
      select 1 from public.matches m
      where (m.user1 = me.uid and m.user2 = p.id)
         or (m.user2 = me.uid and m.user1 = p.id)
    );
$$;

grant execute on function public.get_partner_candidates () to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.likes enable row level security;
alter table public.passes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;

-- profiles
drop policy if exists "profiles_select_auth" on public.profiles;
create policy "profiles_select_auth"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- likes
drop policy if exists "likes_select_involved" on public.likes;
create policy "likes_select_involved"
  on public.likes for select
  to authenticated
  using (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists "likes_insert_from_self" on public.likes;
create policy "likes_insert_from_self"
  on public.likes for insert
  to authenticated
  with check (auth.uid() = from_user);

-- passes
drop policy if exists "passes_select_own" on public.passes;
create policy "passes_select_own"
  on public.passes for select
  to authenticated
  using (auth.uid() = from_user);

drop policy if exists "passes_insert_from_self" on public.passes;
create policy "passes_insert_from_self"
  on public.passes for insert
  to authenticated
  with check (auth.uid() = from_user);

-- matches (yalnız trigger əlavə edir; istifadəçi birbaşa insert etmir)
drop policy if exists "matches_select_member" on public.matches;
create policy "matches_select_member"
  on public.matches for select
  to authenticated
  using (auth.uid() = user1 or auth.uid() = user2);

-- messages
drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = messages.match_id
        and (m.user1 = auth.uid() or m.user2 = auth.uid())
    )
  );

drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.user1 = auth.uid() or m.user2 = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime (Supabase versiyasından asılı olaraq publication adı dəyişə bilər)
-- ---------------------------------------------------------------------------
-- alter publication supabase_realtime add table public.messages;
