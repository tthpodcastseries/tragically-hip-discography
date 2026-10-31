-- The Hip Handbook - Member Data Lockdown (v5.4.6)
--
-- Problem: the public key that ships in the site's JavaScript could read every
-- row of forum_members (first name, last name, favourite song, Passport shows).
--
-- Fix: nobody touches the table directly any more. The site only goes through
-- three functions, which run with the owner's rights and hand back just what
-- the page needs:
--   claim_member           - new: saves a new member, returns only their number
--   unlock_member          - existing: sign in with first name + number
--   update_attended_shows  - existing: save Passport shows
--
-- Run in the Supabase dashboard: project deqslacywpwnjjckdygp -> SQL Editor.
-- Run each PART on its own, in order. Do not run the whole file at once.


-- ===========================================================================
-- STEP 0 (optional, for the record) - what the table's rules look like now.
-- Copy the results somewhere safe before Part 2 removes them.
--
-- Result on 2026-10-31, before the fix:
--   "Allow anonymous insert"  INSERT  {public}  with_check: true
--   "Allow read own row"      SELECT  {public}  using: true   <- the leak:
--                             despite the name, it let anyone read every row
-- ===========================================================================

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'forum_members';


-- ===========================================================================
-- PART 1 - safe to run any time. Nothing on the live site breaks.
-- Run this, then deploy v5.4.6 (the new claim page), then run Part 2.
-- ===========================================================================

begin;

create or replace function public.claim_member(
  p_first_name text,
  p_last_name text,
  p_favourite_song text default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.claim_member(text, text, text) from public;
grant execute on function public.claim_member(text, text, text) to anon, authenticated;

-- unlock_member and update_attended_shows already run with the owner's rights
-- (checked 2026-10-31), so they keep working once Part 2 closes the table.

commit;

-- Check: should list three functions, all with security_definer = true
select p.proname, p.oid::regprocedure as signature, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('claim_member', 'unlock_member', 'update_attended_shows');


-- ===========================================================================
-- PART 2 - the lockdown. Run AFTER v5.4.6 is live on the site.
-- (Run before it, and "Get my number" fails until the deploy finishes.)
-- ===========================================================================

begin;

alter table public.forum_members enable row level security;

-- Remove every rule on the table, whatever it is called
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'forum_members'
  loop
    execute format('drop policy %I on public.forum_members', p.policyname);
  end loop;
end $$;

-- And the table-level permissions for the public key
revoke all on table public.forum_members from anon, authenticated;

commit;

-- Check: should return no rows
select policyname from pg_policies
where schemaname = 'public' and tablename = 'forum_members';
