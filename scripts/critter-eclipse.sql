-- Run in Supabase SQL Editor after the existing Expedition/companion migrations.
-- Adds Eclipse without deleting, archiving or changing any existing score.
-- Safe to rerun. Admin allowlist and Expedition submission functions are preserved.
begin;
select pg_catalog.pg_advisory_xact_lock(72419022);
alter table rain_private.scores drop constraint if exists scores_mode_check;
alter table rain_private.scores add constraint scores_mode_check check
  (mode in ('drizzle','rain','monsoon','eclipse','expedition','expedition_distance','expedition_speed'));
alter table rain_private.scores drop constraint if exists scores_check;
alter table rain_private.scores add constraint scores_check check
  (cleared >= 0 and cleared % 3 = 0 and cleared <= case mode when 'drizzle' then 36 when 'rain' then 108 when 'monsoon' then 144 when 'eclipse' then 180 else 2147483646 end);

create or replace function public.rain_leaderboard(p_mode text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_entries jsonb; v_total bigint;
begin
  if p_mode is null or p_mode not in ('drizzle', 'rain', 'monsoon', 'eclipse', 'expedition') then
    raise exception 'Invalid mode' using errcode = '22023';
  end if;
  select count(*) into v_total from rain_private.scores where mode = p_mode;
  select coalesce(jsonb_agg(jsonb_build_object(
    'playerId', q.player_id, 'mode', q.mode, 'cleared', q.cleared,
    'stage', q.stage, 'loadout', q.loadout, 'elapsedMs', q.elapsed_ms, 'createdAt', floor(extract(epoch from q.created_at) * 1000)::bigint
  ) order by q.cleared desc, q.elapsed_ms, q.created_at, q.player_id collate "C"), '[]'::jsonb)
  into v_entries from (
    select * from rain_private.scores where mode = p_mode
    order by cleared desc, elapsed_ms, created_at, player_id collate "C" limit 100
  ) q;
  return jsonb_build_object('entries', v_entries, 'total', v_total);
end;
$$;

create or replace function public.rain_submit_score(
  p_run_id uuid, p_player_id text, p_mode text, p_cleared integer, p_elapsed_ms bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_new boolean; v_improved boolean; v_rank bigint; v_run rain_private.runs%rowtype;
begin
  p_player_id := normalize(btrim(p_player_id), NFKC);
  if p_run_id is null or p_player_id is null or char_length(p_player_id) not between 1 and 20
    or p_player_id !~ '^[[:alnum:]_-]+$' or p_mode is null or p_mode not in ('drizzle', 'rain', 'monsoon', 'eclipse', 'expedition')
    or p_cleared is null or p_cleared < 0 or p_cleared % 3 <> 0
    or p_cleared > (case p_mode when 'drizzle' then 36 when 'rain' then 108 when 'monsoon' then 144 when 'eclipse' then 180 else 2147483646 end)
    or p_elapsed_ms is null or p_elapsed_ms < 0 or p_elapsed_ms > 604800000 then
    raise exception 'Invalid score' using errcode = '22023';
  end if;

  -- Serialize administrative resets against submissions, while allowing concurrent runs.
  perform pg_catalog.pg_advisory_xact_lock_shared(72419022);

  -- Run IDs make retries safe even if the first response was lost in transit.
  insert into rain_private.runs (run_id, mode, player_id, cleared, elapsed_ms)
  values (p_run_id, p_mode, p_player_id, p_cleared, p_elapsed_ms)
  on conflict (run_id) do nothing returning true into v_new;
  if coalesce(v_new, false) then
    insert into rain_private.scores as existing (mode, player_id, cleared, elapsed_ms)
    values (p_mode, p_player_id, p_cleared, p_elapsed_ms)
    on conflict (mode, player_id) do update
      set cleared = excluded.cleared, elapsed_ms = excluded.elapsed_ms, created_at = clock_timestamp()
      where excluded.cleared > existing.cleared
        or (excluded.cleared = existing.cleared and excluded.elapsed_ms < existing.elapsed_ms)
    returning true into v_improved;
    v_improved := coalesce(v_improved, false);
    update rain_private.runs set improved = v_improved where run_id = p_run_id;
  else
    select * into v_run from rain_private.runs where run_id = p_run_id;
    if v_run.mode is distinct from p_mode or v_run.player_id is distinct from p_player_id
      or v_run.cleared is distinct from p_cleared or v_run.elapsed_ms is distinct from p_elapsed_ms then
      raise exception 'Run already submitted' using errcode = '22023';
    end if;
    if v_run.revoked then
      raise exception 'Run removed by administrator' using errcode = '22023';
    end if;
    v_improved := v_run.improved;
  end if;
  select position into v_rank from (
    select player_id, row_number() over (order by cleared desc, elapsed_ms, created_at, player_id collate "C") as position
    from rain_private.scores where mode = p_mode
  ) ranked where player_id = p_player_id;
  return jsonb_build_object('ok', true, 'improved', v_improved, 'rank', v_rank, 'playerId', p_player_id);
end;
$$;
revoke all on function public.rain_leaderboard(text) from public;
revoke all on function public.rain_submit_score(uuid, text, text, integer, bigint) from public;
grant execute on function public.rain_leaderboard(text) to anon, authenticated;
grant execute on function public.rain_submit_score(uuid, text, text, integer, bigint) to anon, authenticated;


-- Separate names let the client show a setup message before this migration runs.
create or replace function public.critter_eclipse_leaderboard()
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.rain_leaderboard('eclipse');
$$;
create or replace function public.critter_submit_eclipse(
  p_run_id uuid, p_player_id text, p_cleared integer, p_elapsed_ms bigint
) returns jsonb language sql security definer set search_path = '' as $$
  select public.rain_submit_score(p_run_id,p_player_id,'eclipse',p_cleared,p_elapsed_ms);
$$;
revoke all on function public.critter_eclipse_leaderboard() from public;
revoke all on function public.critter_submit_eclipse(uuid,text,integer,bigint) from public;
grant execute on function public.critter_eclipse_leaderboard() to anon,authenticated;
grant execute on function public.critter_submit_eclipse(uuid,text,integer,bigint) to anon,authenticated;

create or replace function public.rain_admin_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_counts jsonb; v_audit jsonb;
begin
  perform rain_private.require_admin();
  select jsonb_object_agg(m.mode, (select count(*) from rain_private.scores s where s.mode = m.mode))
    into v_counts from (values ('drizzle'), ('rain'), ('monsoon'), ('eclipse'), ('expedition'), ('expedition_distance'), ('expedition_speed')) m(mode);
  select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc), '[]'::jsonb) into v_audit from (
    select id, action, mode, player_id, deleted_count, created_at
    from rain_private.admin_audit order by id desc limit 20
  ) a;
  return jsonb_build_object('counts', v_counts, 'audit', v_audit);
end;
$$;

create or replace function public.rain_admin_delete(
  p_action text, p_mode text, p_player_id text, p_confirmation text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_archive jsonb; v_count integer; v_expected text;
begin
  perform rain_private.require_admin();
  if p_action is null or p_action not in ('player', 'mode', 'all') then
    raise exception 'Invalid action' using errcode = '22023';
  end if;
  if p_action <> 'all' and (p_mode is null or p_mode not in ('drizzle', 'rain', 'monsoon', 'eclipse', 'expedition', 'expedition_distance', 'expedition_speed')) then
    raise exception 'Invalid mode' using errcode = '22023';
  end if;
  if p_action = 'player' and (p_player_id is null or char_length(p_player_id) not between 1 and 20) then
    raise exception 'Invalid player' using errcode = '22023';
  end if;
  v_expected := case p_action when 'all' then 'CLEAR ALL' when 'mode' then 'CLEAR ' || p_mode else 'DELETE ' || p_player_id end;
  if p_confirmation is distinct from v_expected then
    raise exception 'Confirmation does not match' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(72419022);
  with removed as (
    delete from rain_private.scores
    where p_action = 'all' or (mode = p_mode and (p_action = 'mode' or player_id = p_player_id))
    returning *
  ) select coalesce(jsonb_agg(to_jsonb(removed)), '[]'::jsonb), count(*) into v_archive, v_count from removed;
  -- Retain UUID tombstones: retrying a previously deleted run cannot restore it.
  update rain_private.runs set revoked = true
    where not revoked and (p_action = 'all' or ((mode = p_mode or (mode = 'expedition_v3' and p_mode in ('expedition_distance','expedition_speed'))) and (p_action = 'mode' or player_id = p_player_id)));
  insert into rain_private.admin_audit(actor, action, mode, player_id, deleted_count, archived_scores)
    values (auth.uid(), p_action, case when p_action <> 'all' then p_mode end,
      case when p_action = 'player' then p_player_id end, v_count, v_archive);
  return jsonb_build_object('ok', true, 'deleted', v_count);
end;
$$;
revoke all on function public.rain_admin_status() from public, anon;
revoke all on function public.rain_admin_delete(text, text, text, text) from public, anon;
grant execute on function public.rain_admin_status() to authenticated;
grant execute on function public.rain_admin_delete(text, text, text, text) to authenticated;
notify pgrst, 'reload schema';
commit;
