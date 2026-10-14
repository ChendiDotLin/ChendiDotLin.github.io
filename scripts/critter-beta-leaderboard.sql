-- Critter Cascade: archive ALL existing leaderboard modes as the beta board.
-- Run this ENTIRE file in the existing Supabase project's SQL Editor.
-- One atomic snapshot: preserves full rows, timestamps, loadouts and run receipts.
-- Safe to rerun: the marker prevents moving any later formal scores.
begin;
-- The submission/admin RPCs use this same lock, so a run is entirely before
-- or after the cutover. Keep run receipts: retries cannot reinsert old scores.
select pg_catalog.pg_advisory_xact_lock(72419022);
create table if not exists rain_private.beta_scores
  (like rain_private.scores including all);
create table if not exists rain_private.leaderboard_migrations (
  name text primary key,
  migrated_at timestamptz not null default clock_timestamp(),
  score_count bigint not null
);
alter table rain_private.beta_scores enable row level security;
alter table rain_private.leaderboard_migrations enable row level security;
revoke all on rain_private.beta_scores, rain_private.leaderboard_migrations from public, anon, authenticated;

do $$
declare v_count bigint;
begin
  if not exists (select 1 from rain_private.leaderboard_migrations where name='beta-cutover-v1') then
    -- Prevent direct SQL writes too; RPC writes are serialized above.
    lock table rain_private.scores in access exclusive mode;
    if exists (select 1 from rain_private.beta_scores) then
      raise exception 'Beta archive already contains data without a migration marker; no scores were moved';
    end if;
    insert into rain_private.beta_scores select * from rain_private.scores;
    get diagnostics v_count = row_count;
    if v_count <> (select count(*) from rain_private.scores) then
      raise exception 'Archive count mismatch; no scores were moved';
    end if;
    delete from rain_private.scores;
    insert into rain_private.leaderboard_migrations(name,score_count) values ('beta-cutover-v1',v_count);
  end if;
end;
$$;

-- Public, read-only top ten for every archived mode. Full archive stays private.
create or replace function public.critter_beta_leaderboard(p_mode text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_entries jsonb; v_total bigint;
begin
  if p_mode is null or p_mode not in ('drizzle','rain','monsoon','expedition','expedition_distance','expedition_speed') then
    raise exception 'Invalid mode' using errcode='22023';
  end if;
  select count(*) into v_total from rain_private.beta_scores where mode=p_mode;
  select coalesce(jsonb_agg(jsonb_build_object(
    'playerId',q.player_id,'mode',q.mode,'cleared',q.cleared,'elapsedMs',q.elapsed_ms,
    'stage',q.stage,'completedStages',q.completed_stages,'tenMs',q.ten_ms,'loadout',q.loadout,
    'createdAt',floor(extract(epoch from q.created_at)*1000)::bigint
  ) order by q.position),'[]'::jsonb) into v_entries from (
    select *,row_number() over(order by
      case when p_mode='expedition_distance' then completed_stages end desc,
      case when p_mode<>'expedition_speed' then cleared end desc,
      elapsed_ms,created_at,player_id collate "C") position
    from rain_private.beta_scores where mode=p_mode
    order by position limit 10
  ) q;
  return jsonb_build_object('entries',v_entries,'total',v_total);
end;
$$;
revoke all on function public.critter_beta_leaderboard(text) from public;
grant execute on function public.critter_beta_leaderboard(text) to anon,authenticated;
notify pgrst, 'reload schema';
commit;
-- Verification: one row per archived mode, including how many formal scores remain.
select b.mode,count(*) as beta_scores,
  (select count(*) from rain_private.scores s where s.mode=b.mode) as formal_scores
from rain_private.beta_scores b group by b.mode order by b.mode;
