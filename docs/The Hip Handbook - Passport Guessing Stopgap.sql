-- The Hip Handbook - Passport Guessing Stopgap (audit DB-02, DB-04)
--
-- Problem: signing in and saving Passport shows only needs a first name and a
-- membersHIP number. 99 early members have 1- or 2-digit numbers and 66 have
-- 3-digit ones, so a script could guess them and overwrite their shows.
--
-- This stopgap, until a real per-member secret exists:
--   1. Counts failed sign-ins per visitor (hashed IP address, kept 24 hours).
--      After 20 failures in an hour, that visitor gets "too many tries" for the
--      rest of the hour. Across everyone, after 300 failures in an hour, all
--      sign-ins pause until the hour rolls over (stops a spread-out scan).
--   2. update_attended_shows refuses to remove more than 10 shows in one save,
--      and only accepts a list of up to 2,000 show IDs. The Passport removes one
--      show per save, so real fans never hit this.
--   3. The two number generators can no longer be called with the public key
--      (they're only used inside the database).
--
-- Run in the Supabase SQL Editor (project deqslacywpwnjjckdygp) as one block.
-- Safe to re-run. To undo, re-create unlock_member and update_attended_shows
-- from docs/The Hip Handbook - Database Schema.sql and drop member_auth_failures.

begin;

-- 1. Failure log: a one-way hash of the visitor's IP, never the IP itself
create table if not exists public.member_auth_failures (
  ip_hash   text        not null,
  failed_at timestamptz not null default now()
);
create index if not exists member_auth_failures_ip_time on public.member_auth_failures (ip_hash, failed_at);
create index if not exists member_auth_failures_time on public.member_auth_failures (failed_at);
alter table public.member_auth_failures enable row level security;
revoke all on table public.member_auth_failures from anon, authenticated;

-- The visitor's hashed IP, from the headers Supabase passes through
create or replace function public.member_auth_ip_hash()
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
  ip := coalesce(
    nullif(btrim(split_part(headers ->> 'x-forwarded-for', ',', 1)), ''),
    headers ->> 'cf-connecting-ip',
    headers ->> 'x-real-ip',
    'unknown'
  );
  return md5('tth-handbook:' || ip);
end;
$function$;

-- Raises 'too_many_attempts' when this visitor, or everyone together, has
-- failed too often in the last hour. Also clears entries older than a day.
create or replace function public.member_auth_check()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ip text := public.member_auth_ip_hash();
begin
  delete from member_auth_failures where failed_at < now() - interval '1 day';
  if (select count(*) from member_auth_failures
      where ip_hash = v_ip and failed_at > now() - interval '1 hour') >= 20
     or (select count(*) from member_auth_failures
      where failed_at > now() - interval '1 hour') >= 300 then
    raise exception 'too_many_attempts';
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

-- 2a. Sign-in: same result as before, now with the attempt limit
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

-- 2b. Saving shows: attempt limit, list sanity checks, no mass removal
create or replace function public.update_attended_shows(p_first_name text, p_number integer, p_shows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_shows jsonb;
  removed integer;
  updated jsonb;
begin
  perform public.member_auth_check();

  if p_shows is null or jsonb_typeof(p_shows) <> 'array' or jsonb_array_length(p_shows) > 2000 then
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

  select count(*) into removed
  from jsonb_array_elements_text(current_shows) as old(show_id)
  where not (p_shows ? old.show_id);
  if removed > 10 then
    raise exception 'too_many_removed';
  end if;

  update forum_members
  set attended_shows = p_shows
  where membership_number = p_number
    and lower(first_name) = lower(p_first_name)
  returning attended_shows into updated;
  return updated;
end;
$function$;

-- Helpers are internal only
revoke all on function public.member_auth_ip_hash() from public, anon, authenticated;
revoke all on function public.member_auth_check() from public, anon, authenticated;
revoke all on function public.member_auth_fail() from public, anon, authenticated;

-- 3. Number generators: internal only (DB-04). claim_member still works -
-- it runs with the owner's rights, so the column default runs as the owner.
-- (rls_auto_enable is left alone: as an event trigger it can't be called directly.)
revoke execute on function public.gen_membership_number() from public, anon, authenticated;
revoke execute on function public.generate_membership_number() from public, anon, authenticated;

commit;

-- Check: the public key can call exactly the three functions the site uses
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_can_call
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by 1;
