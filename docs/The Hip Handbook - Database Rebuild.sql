-- The Hip Handbook - Database Rebuild (Supabase project "tth-compendium")
--
-- The WHOLE membersHIP database in one file, in the order it has to run, so it
-- can be rebuilt if the Supabase project is ever lost (audit REL-02,
-- 2026-11-01). Code only - no member data, no keys.
--
-- This file replaces, as the record of the database:
--   The Hip Handbook - Database Schema.sql          (history: 2026-10-31 snapshot)
--   The Hip Handbook - Member Data Lockdown.sql     (history: v5.4.6 change)
--   The Hip Handbook - Passport Guessing Stopgap.sql (history: 2026-10-31 change)
--   The Hip Handbook - Member Hardening.sql          (the change that brings the
--                                                     live project up to this file)
-- Keep it in step: any later database change goes in here too.
--
-- NEVER run this against the live project. It's for a brand-new, empty one.
--
-- ===========================================================================
-- HOW TO REBUILD
-- ===========================================================================
--  1. Supabase > New project. Region: East US (North Virginia), because the
--     privacy page says that's where the member list lives.
--  2. SQL Editor > paste this whole file > Run. It runs as one block (except
--     the optional step 11), so if anything fails nothing is half-built.
--     Expect the check table at the end:
--       public key can call | claim_member, unlock_member, update_attended_shows
--       tables closed       | true
--       secret set          | true
--  3. Put the members back from the latest private CSV backup:
--     Table Editor > forum_members > Insert > Import data from CSV.
--     Keep their original membership_number values (their sign-ins).
--  4. The dashboard settings SQL can't hold (audit SEC-04):
--     Authentication > Sign In / Providers: "Allow new users to sign up" OFF,
--     Email provider OFF, Apple OFF. The site never uses Supabase logins.
--  5. New project = new address and key. Update SUPABASE_URL and the public
--     key in js/tth-member-gate.js, js/forum-invite.js, the keepalive workflow
--     (.github/workflows/supabase-keepalive.yml), and connect-src in _headers.
--  6. Sign in on the site with your own name and number, mark a show, refresh.
--
-- ===========================================================================
-- KEEPING THIS FILE HONEST (read-only, any time, on the LIVE project)
-- ===========================================================================
-- Paste the results to Claude Code to compare with this file:
--   select p.proname, pg_get_functiondef(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' order by 1;
--   select evtname, evtevent, evtfoid::regproc from pg_event_trigger;
--   select id, name, public from storage.buckets;
-- Not yet compared (2026-11-01): the event trigger's name in step 11, and
-- whether the storage bucket below still exists.


begin;

-- ---------------------------------------------------------------------------
-- 1. Number generators. These come FIRST: the table's column default uses
--    gen_membership_number(), and Postgres checks that it exists when the
--    table is made. (The old Schema file had them the other way round.)
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

-- Older 7-digit generator. Not used by the table default any more; kept
-- because the live project still has it.
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
-- 2. The member table. Closed to the public key: RLS on, no rules, no table
--    rights. The site reaches it only through the three functions in step 9.
-- ---------------------------------------------------------------------------
create table if not exists public.forum_members (
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
alter table public.forum_members enable row level security;
revoke all on table public.forum_members from anon, authenticated;

-- Number lengths on 2026-10-31 (367 members): 9 one-digit and 90 two-digit
-- numbers (claimed 2026-04-06 to 04-10, before the random generator), then
-- 66 / 48 / 43 / 56 / 55 with 3 to 7 digits.

-- The generators are internal only (audit DB-04). claim_member still works:
-- it runs with the owner's rights, so the column default runs as the owner.
revoke execute on function public.gen_membership_number() from public, anon, authenticated;
revoke execute on function public.generate_membership_number() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. Limits you can change (closed to the public key)
-- ---------------------------------------------------------------------------
create table if not exists public.member_limits (
  name         text    primary key,
  value        integer not null,
  what_it_does text
);
alter table public.member_limits enable row level security;
revoke all on table public.member_limits from anon, authenticated;

-- "on conflict do nothing": re-running this file never resets a limit you changed
insert into public.member_limits (name, value, what_it_does) values
  ('failed_tries_per_address_per_hour', 20,  'Wrong name + number tries one address gets in an hour, then "too many tries" for the rest of the hour.'),
  ('failed_tries_everyone_per_hour',    300, 'Wrong tries from everyone together in an hour before sign-in slows down. It never locks members out.'),
  ('slow_down_seconds',                 300, 'While slowed down: how long an address that just got it wrong waits before its next try.'),
  ('saves_per_member_per_hour',         120, 'Passport saves one member can make in an hour (each mark or unmark is one save).'),
  ('removed_per_save',                  10,  'Shows one save can remove.'),
  ('removed_per_member_per_day',        30,  'Shows one member can remove in 24 hours.'),
  ('shows_per_member',                  2000,'Most shows one Passport can hold.'),
  ('claims_per_address_per_day',        5,   'New numbers one address can claim in 24 hours.'),
  ('claims_everyone_per_day',           200, 'New numbers everyone together can claim in 24 hours. Raise it for a big launch day.')
on conflict (name) do nothing;

create or replace function public.member_limit(p_name text, p_default integer)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((select value from member_limits where name = p_name), p_default);
$function$;


-- ---------------------------------------------------------------------------
-- 4. The secret for scrambling addresses (PRIV-01). Made here, inside your
--    database, from 244 random bits. Never written anywhere else.
-- ---------------------------------------------------------------------------
create table if not exists public.member_secrets (
  name       text        primary key,
  value      text        not null,
  created_at timestamptz not null default now()
);
alter table public.member_secrets enable row level security;
revoke all on table public.member_secrets from anon, authenticated;

insert into public.member_secrets (name, value)
values ('ip_salt', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;


-- ---------------------------------------------------------------------------
-- 5. The visitor's address (SEC-03) and its scrambled form (PRIV-01)
-- ---------------------------------------------------------------------------

-- The visitor's address, or null when the request doesn't say
create or replace function public.member_visitor_ip()
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  headers json;
  ip text;
begin
  begin
    headers := current_setting('request.headers', true)::json;
  exception when others then
    headers := null;
  end;
  -- 1. Cloudflare's header: Cloudflare overwrites it, so a visitor can't fake it
  ip := nullif(btrim(headers ->> 'cf-connecting-ip'), '');
  -- 2. Otherwise the LAST X-Forwarded-For entry, added by the proxy in front of
  --    the database. Never the first: the visitor can write that one.
  if ip is null then
    ip := nullif(btrim(regexp_replace(coalesce(headers ->> 'x-forwarded-for', ''), '^.*,', '')), '');
  end if;
  return ip;
end;
$function$;

-- Scrambled with the secret: sha256(secret | address)
create or replace function public.member_hash_ip(p_ip text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select encode(sha256(convert_to(
    coalesce((select value from member_secrets where name = 'ip_salt'), '')
      || '|' || coalesce(p_ip, 'unknown'),
    'UTF8')), 'hex');
$function$;

-- Same name as in the Stopgap, new recipe. (The old entries in
-- member_auth_failures stop matching anyone: the per-address counts start
-- fresh once, which is harmless. They're cleared within a day.)
create or replace function public.member_auth_ip_hash()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.member_hash_ip(public.member_visitor_ip());
$function$;


-- ---------------------------------------------------------------------------
-- 6. The attempt limits (SEC-02): per address, plus a brake that slows down
--    instead of locking everyone out
-- ---------------------------------------------------------------------------
create table if not exists public.member_auth_failures (
  ip_hash   text        not null,
  failed_at timestamptz not null default now()
);
create index if not exists member_auth_failures_ip_time on public.member_auth_failures (ip_hash, failed_at);
create index if not exists member_auth_failures_time on public.member_auth_failures (failed_at);
alter table public.member_auth_failures enable row level security;
revoke all on table public.member_auth_failures from anon, authenticated;

-- Raises 'too_many_attempts' when this address has failed too often this hour,
-- and 'slow_down' when everyone together has AND this address just failed.
-- Also clears entries older than a day.
create or replace function public.member_auth_check()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ip   text := public.member_visitor_ip();
  v_hash text := public.member_hash_ip(v_ip);
begin
  delete from member_auth_failures where failed_at < now() - interval '1 day';

  -- This address. Skipped when the address is unknown, so one shared
  -- "unknown" bucket can never lock every member out.
  if v_ip is not null
     and (select count(*) from member_auth_failures
          where ip_hash = v_hash and failed_at > now() - interval '1 hour')
         >= public.member_limit('failed_tries_per_address_per_hour', 20) then
    raise exception 'too_many_attempts';
  end if;

  -- Everyone together: slow down, don't lock out. Only an address that got it
  -- wrong in the last few minutes has to wait; it applies the same way whether
  -- the next try is right or wrong, so it gives nothing away.
  if (select count(*) from member_auth_failures
      where failed_at > now() - interval '1 hour')
     >= public.member_limit('failed_tries_everyone_per_hour', 300)
     and exists (select 1 from member_auth_failures
                 where ip_hash = v_hash
                   and failed_at > now() - make_interval(secs => public.member_limit('slow_down_seconds', 300))) then
    raise exception 'slow_down';
  end if;
end;
$function$;

create or replace function public.member_auth_fail()
returns void
language sql
security definer
set search_path to 'public'
as $function$
  insert into member_auth_failures (ip_hash) values (public.member_auth_ip_hash());
$function$;


-- ---------------------------------------------------------------------------
-- 7. Passport save log (SEC-01): counts saves, keeps the list from before
--    each removal for 30 days. Member numbers and show IDs only.
-- ---------------------------------------------------------------------------
create table if not exists public.member_save_log (
  id                bigint      generated always as identity primary key,
  membership_number integer     not null,
  saved_at          timestamptz not null default now(),
  added             integer     not null default 0,
  removed           integer     not null default 0,
  shows_before      jsonb
);
create index if not exists member_save_log_member_time on public.member_save_log (membership_number, saved_at);
create index if not exists member_save_log_time on public.member_save_log (saved_at);
alter table public.member_save_log enable row level security;
revoke all on table public.member_save_log from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 8. Claim log (SEC-05): scrambled address and time, kept 2 days
-- ---------------------------------------------------------------------------
create table if not exists public.member_claim_log (
  ip_hash    text        not null,
  claimed_at timestamptz not null default now()
);
create index if not exists member_claim_log_ip_time on public.member_claim_log (ip_hash, claimed_at);
create index if not exists member_claim_log_time on public.member_claim_log (claimed_at);
alter table public.member_claim_log enable row level security;
revoke all on table public.member_claim_log from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 9. The three functions the site calls. Same names, inputs and answers.
-- ---------------------------------------------------------------------------

-- Claim page (js/forum-invite.js): saves a new member, returns only the number
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
  v_ip    text := public.member_visitor_ip();
  v_hash  text := public.member_hash_ip(v_ip);
  v_num   bigint;
begin
  if v_first = '' or v_last = '' then
    raise exception 'Add yer first name and a last name or initial.';
  end if;
  if length(v_first) > 50 or length(v_last) > 50 or length(coalesce(v_song, '')) > 200 then
    raise exception 'That''s a bit long - try a shorter answer.';
  end if;

  delete from member_claim_log where claimed_at < now() - interval '2 days';

  -- This address (skipped when the address is unknown, as above)
  if v_ip is not null
     and (select count(*) from member_claim_log
          where ip_hash = v_hash and claimed_at > now() - interval '1 day')
         >= public.member_limit('claims_per_address_per_day', 5) then
    raise exception 'too_many_claims';
  end if;
  -- Everyone together
  if (select count(*) from member_claim_log
      where claimed_at > now() - interval '1 day')
     >= public.member_limit('claims_everyone_per_day', 200) then
    raise exception 'claims_full_today';
  end if;

  insert into public.forum_members (first_name, last_name, favourite_song)
  values (v_first, v_last, v_song)
  returning membership_number into v_num;

  insert into member_claim_log (ip_hash) values (v_hash);

  return v_num;
end;
$function$;

-- Sign-in (js/tth-member-gate.js) and the keepalive workflow.
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
  perform public.member_auth_check();

  -- No member has number 0 or a blank name (the keepalive sends number 0):
  -- answer null without logging a failed try
  if p_number is null or p_number < 1 or btrim(coalesce(p_first_name, '')) = '' then
    return null;
  end if;

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

  if result is null then
    perform public.member_auth_fail();
  end if;
  return result;
end;
$function$;

-- Saving Passport shows: replaces the member's whole list.
-- Returns the saved list, or null when the name + number don't match.
create or replace function public.update_attended_shows(p_first_name text, p_number integer, p_shows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_shows jsonb;
  v_added   integer;
  v_removed integer;
  updated   jsonb;
begin
  perform public.member_auth_check();

  -- A list of text, no longer than a Passport can hold
  if p_shows is null or jsonb_typeof(p_shows) <> 'array'
     or jsonb_array_length(p_shows) > public.member_limit('shows_per_member', 2000)
     or exists (select 1 from jsonb_array_elements(p_shows) as e(v) where jsonb_typeof(e.v) <> 'string') then
    raise exception 'invalid_shows';
  end if;

  select coalesce(attended_shows, '[]'::jsonb) into current_shows
  from forum_members
  where membership_number = p_number
    and lower(first_name) = lower(p_first_name)
  for update;

  -- Wrong name + number: log it and return null. (Raising an error here would
  -- roll back the logged failure along with everything else in the request.)
  if not found then
    perform public.member_auth_fail();
    return null;
  end if;
  if jsonb_typeof(current_shows) <> 'array' then
    current_shows := '[]'::jsonb;
  end if;

  -- A NEW show ID must look like a real one: 1 to 40 letters, digits, - or _
  -- (setlist.fm IDs are 7 or 8). IDs the member already has are left alone.
  if exists (select 1 from jsonb_array_elements_text(p_shows) as n(show_id)
             where not (current_shows ? n.show_id)
               and n.show_id !~ '^[A-Za-z0-9_-]{1,40}$') then
    raise exception 'invalid_shows';
  end if;

  select count(distinct n.show_id) into v_added
  from jsonb_array_elements_text(p_shows) as n(show_id)
  where not (current_shows ? n.show_id);

  select count(distinct o.show_id) into v_removed
  from jsonb_array_elements_text(current_shows) as o(show_id)
  where not (p_shows ? o.show_id);

  if v_removed > public.member_limit('removed_per_save', 10) then
    raise exception 'too_many_removed';
  end if;

  -- A save that changes nothing (same shows, maybe reordered) isn't counted
  if v_added > 0 or v_removed > 0 then
    if (select count(*) from member_save_log
        where membership_number = p_number and saved_at > now() - interval '1 hour')
       >= public.member_limit('saves_per_member_per_hour', 120) then
      raise exception 'too_many_saves';
    end if;
    if v_removed > 0
       and (select coalesce(sum(removed), 0) from member_save_log
            where membership_number = p_number and saved_at > now() - interval '1 day')
           + v_removed > public.member_limit('removed_per_member_per_day', 30) then
      raise exception 'removal_limit_today';
    end if;
  end if;

  update forum_members
  set attended_shows = p_shows
  where membership_number = p_number
    and lower(first_name) = lower(p_first_name)
  returning attended_shows into updated;

  if v_added > 0 or v_removed > 0 then
    insert into member_save_log (membership_number, added, removed, shows_before)
    values (p_number, v_added, v_removed,
            case when v_removed > 0 or v_added > 25 then current_shows end);
    delete from member_save_log where saved_at < now() - interval '30 days';
  end if;

  return updated;
end;
$function$;


-- ---------------------------------------------------------------------------
-- 10. Who can call what: the public key gets exactly the three site functions
-- ---------------------------------------------------------------------------
revoke all on function public.member_limit(text, integer) from public, anon, authenticated;
revoke all on function public.member_visitor_ip() from public, anon, authenticated;
revoke all on function public.member_hash_ip(text) from public, anon, authenticated;
revoke all on function public.member_auth_ip_hash() from public, anon, authenticated;
revoke all on function public.member_auth_check() from public, anon, authenticated;
revoke all on function public.member_auth_fail() from public, anon, authenticated;

revoke all on function public.claim_member(text, text, text) from public;
revoke all on function public.unlock_member(text, integer) from public;
revoke all on function public.update_attended_shows(text, integer, jsonb) from public;
grant execute on function public.claim_member(text, text, text) to anon, authenticated;
grant execute on function public.unlock_member(text, integer) to anon, authenticated;
grant execute on function public.update_attended_shows(text, integer, jsonb) to anon, authenticated;

commit;


-- ---------------------------------------------------------------------------
-- 11. Optional: turn RLS on automatically for any new table in public.
--     Every table above already turns its own on, so if this step says
--     "permission denied", skip it. Its own block, so a failure here leaves
--     steps 1-10 in place.
-- ---------------------------------------------------------------------------
begin;

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

-- Name not yet checked against the live project (see KEEPING THIS FILE HONEST)
drop event trigger if exists ensure_rls;
create event trigger ensure_rls on ddl_command_end
  execute function public.rls_auto_enable();

commit;


-- ---------------------------------------------------------------------------
-- 12. Storage (not run - here for the record)
-- ---------------------------------------------------------------------------
-- The live project had a private bucket "hipstories-recordings" (empty on
-- 2026-10-31) with a rule "Allow public uploads" letting anyone upload into it
-- (audit DB-03 / SEC-06). jD deleted that rule on 2026-11-02 (bucket still
-- empty). The Handbook doesn't use it. Only if Yer Hipstories
-- turns out to need it, make the bucket private and WITHOUT the public rule:
--   insert into storage.buckets (id, name, public)
--   values ('hipstories-recordings', 'hipstories-recordings', false)
--   on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- Check (the table you see after Run)
-- ---------------------------------------------------------------------------
select 'public key can call' as "check",
       string_agg(p.proname, ', ' order by p.proname) as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prorettype <> 'event_trigger'::regtype
  and has_function_privilege('anon', p.oid, 'execute')
union all
select 'tables closed',
       bool_and(c.relrowsecurity
                and not has_table_privilege('anon', c.oid, 'select')
                and not has_table_privilege('anon', c.oid, 'insert'))::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('forum_members', 'member_auth_failures', 'member_limits',
                    'member_secrets', 'member_save_log', 'member_claim_log')
union all
select 'secret set',
       coalesce((select (length(value) >= 32)::text from public.member_secrets where name = 'ip_salt'), 'false')
union all
select 'limits', string_agg(name || ' = ' || value, ', ' order by name)
from public.member_limits;
