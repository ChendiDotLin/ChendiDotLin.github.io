-- Restore Drizzle / Rainstorm / Monsoon to the formal boards.
-- Run the entire file in Supabase SQL Editor after the beta cutover.
-- Expedition boards are unchanged. Safe to rerun, even after new submissions.
begin;
select pg_catalog.pg_advisory_xact_lock(72419022);
create table if not exists rain_private.classic_restore_archive
  (like rain_private.beta_scores including all);
alter table rain_private.classic_restore_archive enable row level security;
revoke all on rain_private.classic_restore_archive from public, anon, authenticated;
do $$
declare v_count bigint;
begin
  if not exists (select 1 from rain_private.leaderboard_migrations where name='beta-cutover-v1') then
    raise exception 'Beta cutover has not completed; no scores were changed';
  end if;
  if not exists (select 1 from rain_private.leaderboard_migrations where name='restore-classic-v1') then
    lock table rain_private.scores, rain_private.beta_scores in access exclusive mode;
    -- Keep an exact private backup, including scores superseded by newer runs.
    insert into rain_private.classic_restore_archive select * from rain_private.beta_scores
      where mode in ('drizzle','rain','monsoon');
    get diagnostics v_count = row_count;
    insert into rain_private.scores as current
      select * from rain_private.beta_scores where mode in ('drizzle','rain','monsoon')
    on conflict (mode,player_id) do update set
      cleared=excluded.cleared,elapsed_ms=excluded.elapsed_ms,created_at=excluded.created_at,
      stage=excluded.stage,loadout=excluded.loadout,completed_stages=excluded.completed_stages,ten_ms=excluded.ten_ms
    where excluded.cleared>current.cleared
      or (excluded.cleared=current.cleared and excluded.elapsed_ms<current.elapsed_ms)
      or (excluded.cleared=current.cleared and excluded.elapsed_ms=current.elapsed_ms and excluded.created_at<current.created_at);
    delete from rain_private.beta_scores where mode in ('drizzle','rain','monsoon');
    insert into rain_private.leaderboard_migrations(name,score_count) values ('restore-classic-v1',v_count);
  end if;
end;
$$;
commit;
select mode,count(*) as formal_scores from rain_private.scores
where mode in ('drizzle','rain','monsoon') group by mode order by mode;
