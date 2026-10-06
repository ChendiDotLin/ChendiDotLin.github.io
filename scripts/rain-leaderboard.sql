-- Run once in your Supabase project's SQL Editor. Safe to run again.
-- The browser can call only the two named RPCs, never modify tables directly.
begin;
create schema if not exists rain_private;
revoke all on schema rain_private from public, anon, authenticated;

create table if not exists rain_private.scores (
  mode text not null check (mode in ('drizzle', 'rain', 'monsoon')),
  player_id text not null check (char_length(player_id) between 1 and 20),
  cleared integer not null check (cleared >= 0 and cleared % 3 = 0 and cleared <= case mode when 'drizzle' then 36 when 'rain' then 108 else 144 end),
  elapsed_ms bigint not null check (elapsed_ms between 0 and 604800000),
  created_at timestamptz not null default clock_timestamp(),
  primary key (mode, player_id)
);
create index if not exists rain_score_order on rain_private.scores (mode, cleared desc, elapsed_ms, created_at, player_id);

create table if not exists rain_private.runs (
  run_id uuid primary key,
  mode text not null,
  player_id text not null,
  cleared integer not null,
  elapsed_ms bigint not null,
  improved boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);
alter table rain_private.runs add column if not exists revoked boolean not null default false;
alter table rain_private.scores enable row level security;
alter table rain_private.runs enable row level security;
revoke all on rain_private.scores, rain_private.runs from public, anon, authenticated;

create or replace function public.rain_leaderboard(p_mode text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_entries jsonb; v_total bigint;
begin
  if p_mode is null or p_mode not in ('drizzle', 'rain', 'monsoon') then
    raise exception 'Invalid mode' using errcode = '22023';
  end if;
  select count(*) into v_total from rain_private.scores where mode = p_mode;
  select coalesce(jsonb_agg(jsonb_build_object(
    'playerId', q.player_id, 'mode', q.mode, 'cleared', q.cleared,
    'elapsedMs', q.elapsed_ms, 'createdAt', floor(extract(epoch from q.created_at) * 1000)::bigint
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
    or p_player_id !~ '^[[:alnum:]_-]+$' or p_mode is null or p_mode not in ('drizzle', 'rain', 'monsoon')
    or p_cleared is null or p_cleared < 0 or p_cleared % 3 <> 0
    or p_cleared > (case p_mode when 'drizzle' then 36 when 'rain' then 108 else 144 end)
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
commit;
