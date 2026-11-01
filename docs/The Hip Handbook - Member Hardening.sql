-- The Hip Handbook - Member Hardening
-- (pre-relaunch audit 2026-11-01: SEC-01 interim limits, SEC-02, SEC-03, SEC-05, PRIV-01)
--
-- Builds on "The Hip Handbook - Passport Guessing Stopgap.sql" (already live).
-- Code only, no member data. The site keeps calling the same three functions
-- (claim_member, unlock_member, update_attended_shows) with the same inputs and
-- the same answers, so nothing on the site has to change at the same moment.
--
-- ===========================================================================
-- WHAT THIS CHANGES, IN PLAIN WORDS
-- ===========================================================================
--
--  1. Saving Passport shows (SEC-01, until each member gets a secret code):
--     - a new show ID must look like a real one (1 to 40 letters, digits, - or _;
--       setlist.fm IDs are 7 or 8). IDs a member already has are left alone.
--     - one member can make 120 saves an hour and remove 30 shows a day.
--       (Still no more than 10 removed in one save, as before.)
--     - every save that removes a show, or adds more than 25 at once, keeps a
--       copy of the list from just before, for 30 days, so you can put a wiped
--       Passport back (recipe at the bottom).
--  2. The "everyone" brake (SEC-02): when there are 300+ wrong sign-ins in an
--     hour, the site no longer locks every member out. It slows down instead:
--     only an address that just got it wrong waits 5 minutes for its next try.
--     A member who types their name and number right is never held up by
--     someone else's guessing.
--  3. The visitor's address (SEC-03): taken from Cloudflare's own header
--     (cf-connecting-ip), which a visitor can't fake, never from the first
--     X-Forwarded-For entry, which they can.
--  4. Claiming numbers (SEC-05): 5 a day per address, and 200 a day for
--     everyone together. Raise the 200 for a big launch day (see CHANGING A
--     LIMIT below).
--  5. The scrambled address (PRIV-01): scrambled with a long random secret
--     that lives only in your database (table member_secrets, closed to the
--     public key), never in this repo, so the repo alone can't unscramble it.
--
-- New error codes the site turns into friendly words (v5.5.x JS):
--   slow_down, too_many_saves, removal_limit_today (sign-in pop-up, Passport)
--   too_many_claims, claims_full_today (claim page)
--
-- ===========================================================================
-- HOW TO RUN IT (Supabase > project deqslacywpwnjjckdygp > SQL Editor)
-- ===========================================================================
--
-- STEP 0  Back up the member list: Table Editor > forum_members > Export >
--         CSV. Save it in your private Google Drive, never in this folder.
--
-- STEP 1  The address test (before anything else). It shows which address
--         headers reach the database, so we know step 3 above reads the right
--         one. It touches no member data.
--         a. Copy the lines between "TEST PART A" and "END TEST PART A"
--            below into a NEW SQL Editor tab and press Run.
--            Expect: "Success. No rows returned".
--         b. Tell Claude Code: "The header test function is in. Run the
--            header test from the Member Hardening file." It runs the one
--            command under TEST PART B from this Mac (it sends made-up
--            addresses on purpose) and reads the answer.
--            (Or run that command yourself in Terminal and paste what it
--            prints back to Claude Code.)
--         c. Copy the lines under "TEST PART C" into a new tab and Run.
--            That removes the test function. Expect: "Success".
--         What Claude Code checks: cf-connecting-ip should be your real
--         address (NOT 5.6.7.8). If it is 5.6.7.8 or empty, STOP: don't run
--         step 2, the address part needs changing first.
--         (If x-forwarded-for starts with 1.2.3.4, that confirms the old code
--         could be fooled - expected.)
--
-- STEP 2  Open this whole file in a new SQL Editor tab and press Run (the
--         test and undo parts are inside /* */ comments, so they don't run).
--         It runs as one block: if anything fails, nothing changes.
--         Expect a small table at the end:
--           public key can call   | claim_member, unlock_member, update_attended_shows
--           tables closed         | true
--           secret set            | true
--           limits                | (the nine limits and their numbers)
--         Anything else in the first row (an extra name like debug_my_headers):
--         paste it to Claude Code.
--
-- STEP 3  On your phone: sign in with your own first name and number, mark a
--         show, refresh, unmark it, refresh. Open the claim page and check it
--         loads (don't claim).
--
-- Safe to re-run: it keeps the secret and any limits you've changed.
--
-- TO UNDO: see "UNDO" at the very bottom.
--
-- CHANGING A LIMIT (for example, the relaunch day), in a new SQL Editor tab:
--   update public.member_limits set value = 1000 where name = 'claims_everyone_per_day';
-- See them all:
--   select * from public.member_limits order by name;
--
-- Refused saves and claims aren't logged (the database undoes everything in a
-- refused request, log included). The copies of the list before each removal
-- are, so a wiped Passport can always be put back.


/* ===========================================================================
TEST PART A - copy from the next line to END TEST PART A, Run in a new tab
-- Shows the caller only their OWN address headers. Nothing about members.
create or replace function public.debug_my_headers()
returns json
language sql
stable
as $$
  select json_build_object(
    'cf-connecting-ip', h ->> 'cf-connecting-ip',
    'x-forwarded-for',  h ->> 'x-forwarded-for',
    'x-real-ip',        h ->> 'x-real-ip'
  )
  from (select current_setting('request.headers', true)::json as h) s;
$$;
grant execute on function public.debug_my_headers() to anon;
END TEST PART A

TEST PART B - for Claude Code (or Terminal). KEY is the public anon key from
js/tth-member-gate.js (public by design, already in the site's code).
  KEY="<public anon key>"
  curl -s -X POST "https://deqslacywpwnjjckdygp.supabase.co/rest/v1/rpc/debug_my_headers" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 1.2.3.4" -H "CF-Connecting-IP: 5.6.7.8" -H "X-Real-IP: 9.9.9.9" -d '{}'
  Good answer: {"cf-connecting-ip" : "<this Mac's real address>", ...}

TEST PART C - copy the next line, Run in a new tab
drop function if exists public.debug_my_headers();
=========================================================================== */


begin;

-- ---------------------------------------------------------------------------
-- A. Limits you can change (closed to the public key)
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
-- B. The secret for scrambling addresses (PRIV-01). Made here, inside your
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
-- C. The visitor's address (SEC-03) and its scrambled form (PRIV-01)
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
-- D. The attempt limits (SEC-02): per address, plus a brake that slows down
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
-- E. Passport save log (SEC-01): counts saves, keeps the list from before
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
-- F. Claim log (SEC-05): scrambled address and time, kept 2 days
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
-- G. The three functions the site calls. Same names, inputs and answers.
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
-- H. Who can call what: the public key gets exactly the three site functions
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


/* ===========================================================================
LATER CHECKS (copy into a new tab whenever you like; read-only)

-- Is the address working? A day or two after Step 2. If nearly every wrong
-- try lands in the "true" row, the address isn't coming through: tell
-- Claude Code.
select ip_hash = public.member_hash_ip(null) as unknown_address,
       count(*) as wrong_tries, max(failed_at) as latest
from public.member_auth_failures group by 1;

-- Claims in the last 24 hours (against the 200 limit)
select count(*) from public.member_claim_log where claimed_at > now() - interval '1 day';

-- Members who removed the most shows this week (spotting vandalism)
select membership_number, sum(removed) as removed, sum(added) as added, count(*) as saves
from public.member_save_log where saved_at > now() - interval '7 days'
group by 1 order by 2 desc limit 20;

PUTTING A WIPED PASSPORT BACK (replace 123 with the member's number)
-- 1. See their recent changes, newest first. Pick the row just BEFORE the damage
--    (the earliest bad save): its shows_before is the list as it was.
select id, saved_at, added, removed, jsonb_array_length(shows_before) as shows_in_copy
from public.member_save_log where membership_number = 123 order by saved_at desc;
-- 2. Put that list back (replace 456 with the id from step 1)
update public.forum_members
set attended_shows = (select shows_before from public.member_save_log where id = 456)
where membership_number = 123;

WHEN A FAN ASKS TO BE DELETED (privacy page promise), also clear their copies:
delete from public.member_save_log where membership_number = 123;

UNDO (puts back the Stopgap from 2026-10-31)
1. Run the whole "The Hip Handbook - Passport Guessing Stopgap.sql" file.
2. Run PART 1 only of "The Hip Handbook - Member Data Lockdown.sql"
   (claim_member without limits).
3. Then run:
begin;
drop function if exists public.member_limit(text, integer);
drop function if exists public.member_visitor_ip();
drop function if exists public.member_hash_ip(text);
drop table if exists public.member_claim_log;
drop table if exists public.member_limits;
drop table if exists public.member_secrets;
commit;
member_save_log holds the copies for putting Passports back, so keep it
until you're sure: drop table if exists public.member_save_log;
=========================================================================== */
