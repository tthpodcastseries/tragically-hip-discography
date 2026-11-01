-- HISTORY ONLY - DON'T RUN THIS FILE. (Marked 2026-11-01, audit REL-02.)
-- It's the 2026-10-31 snapshot: run top to bottom it stops at the table
-- (the generator it needs comes later), and its unlock_member and
-- update_attended_shows have no guessing limits. To rebuild the database use
-- "The Hip Handbook - Database Rebuild.sql".
--
-- The Hip Handbook - Database Schema (Supabase project deqslacywpwnjjckdygp, "tth-compendium")
--
-- Record of how the membersHIP database is set up, so it can be rebuilt if the
-- Supabase project is ever lost. Code only - no member data. Taken 2026-10-31
-- from the SQL Editor (pg_get_functiondef, information_schema, pg_constraint,
-- pg_policies), after the v5.4.6 lockdown. Comments added by hand.
--
-- Member data itself is backed up separately as a private CSV export
-- (Table Editor -> forum_members -> Export). Never commit that file:
-- this repo is public and the CSV holds fans' names.


-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.forum_members (
  id                uuid        not null default gen_random_uuid(),
  membership_number integer     not null default public.gen_membership_number(),
  first_name        text        not null,
  last_name         text        not null,
  favourite_song    text,
  created_at        timestamptz          default now(),
  attended_shows    jsonb                default '[]'::jsonb,
  constraint forum_members_pkey primary key (id),
  constraint forum_members_membership_number_key unique (membership_number)
);

-- Closed to the public key: RLS on, no rules, no table rights (v5.4.6).
-- The site reaches the table only through the security definer functions below.
alter table public.forum_members enable row level security;
revoke all on table public.forum_members from anon, authenticated;

-- Number lengths on 2026-10-31 (367 members): 9 one-digit and 90 two-digit
-- numbers (claimed 2026-04-06 to 04-10, before the random generator), then
-- 66 / 48 / 43 / 56 / 55 with 3 to 7 digits.


-- ---------------------------------------------------------------------------
-- Number generators
-- ---------------------------------------------------------------------------

-- Column default: random number with 3 to 7 digits, digit count picked evenly
create or replace function public.gen_membership_number()
returns integer
language plpgsql
as $function$
declare
  candidate integer;
  digits integer;
  lo integer;
  hi integer;
  attempts integer := 0;
begin
  loop
    -- Pick a digit count uniformly: 3, 4, 5, 6, or 7.
    digits := 3 + floor(random() * 5)::int;
    lo := power(10, digits - 1)::int;      -- 100, 1000, 10000, ...
    hi := (power(10, digits)::int) - 1;    -- 999, 9999, 99999, ...
    -- Random integer inside that band, inclusive on both ends.
    candidate := lo + floor(random() * (hi - lo + 1))::int;
    -- Make sure it's not already taken.
    if not exists (
      select 1 from public.forum_members where membership_number = candidate
    ) then
      return candidate;
    end if;
    attempts := attempts + 1;
    if attempts > 50 then
      raise exception 'Could not allocate a free membersHIP number after 50 tries';
    end if;
  end loop;
end;
$function$;

-- Older 7-digit generator. Not used by the table default any more.
create or replace function public.generate_membership_number()
returns integer
language plpgsql
as $function$
declare
  new_num integer;
  taken boolean;
begin
  loop
    new_num := floor(random() * 9000000 + 1000000)::integer;
    select exists(select 1 from forum_members where membership_number = new_num) into taken;
    if not taken then
      return new_num;
    end if;
  end loop;
end;
$function$;


-- ---------------------------------------------------------------------------
-- Functions the site calls (all run with the owner's rights)
-- ---------------------------------------------------------------------------

-- Claim page (forum-invite.html): saves a new member, returns only the number (v5.4.6)
create or replace function public.claim_member(
  p_first_name text,
  p_last_name text,
  p_favourite_song text default null
) returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_first text := btrim(coalesce(p_first_name, ''));
  v_last  text := btrim(coalesce(p_last_name, ''));
  v_song  text := nullif(btrim(coalesce(p_favourite_song, '')), '');
  v_num   bigint;
begin
  if v_first = '' or v_last = '' then
    raise exception 'Add yer first name and a last name or initial.';
  end if;
  if length(v_first) > 50 or length(v_last) > 50 or length(coalesce(v_song, '')) > 200 then
    raise exception 'That''s a bit long - try a shorter answer.';
  end if;

  insert into public.forum_members (first_name, last_name, favourite_song)
  values (v_first, v_last, v_song)
  returning membership_number into v_num;

  return v_num;
end;
$function$;

-- Member gate sign-in (js/tth-member-gate.js) and the keepalive workflow.
-- Returns null when the name + number don't match.
create or replace function public.unlock_member(p_first_name text, p_number integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'membership_number', membership_number,
    'first_name', first_name,
    'attended_shows', coalesce(attended_shows, '[]'::jsonb)
  )
  into result
  from forum_members
  where membership_number = p_number
    and lower(first_name) = lower(p_first_name)
  limit 1;
  return result;
end;
$function$;

-- Passport saving: replaces the member's whole show list
create or replace function public.update_attended_shows(p_first_name text, p_number integer, p_shows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  updated jsonb;
begin
  update forum_members
  set attended_shows = p_shows
  where membership_number = p_number
    and lower(first_name) = lower(p_first_name)
  returning attended_shows into updated;
  if updated is null then
    raise exception 'invalid_credentials';
  end if;
  return updated;
end;
$function$;

revoke all on function public.claim_member(text, text, text) from public;
grant execute on function public.claim_member(text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Event trigger helper: turns on RLS for any new table in public
-- ---------------------------------------------------------------------------

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null
       and cmd.schema_name in ('public')
       and cmd.schema_name not in ('pg_catalog', 'information_schema')
       and cmd.schema_name not like 'pg_toast%'
       and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception when others then
        raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$function$;


-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

-- Bucket hipstories-recordings: private (public = false), empty on 2026-10-31.
-- Rule "Allow public uploads": INSERT for anon, with check (bucket_id = 'hipstories-recordings').
-- Flagged in the audit (DB-03) - jD to decide whether Yer Hipstories still needs it.
