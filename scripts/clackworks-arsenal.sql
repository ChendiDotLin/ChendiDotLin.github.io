-- Clackworks: accept seven new original equipment IDs.
-- Run this ENTIRE file in Supabase SQL Editor. Safe to rerun.
-- Preserves scores, admins, permissions and existing save submissions.
begin;
create or replace function public.rain_submit_expedition_v3(
  p_run_id uuid,p_player_id text,p_cleared integer,p_elapsed_ms bigint,p_stage integer,
  p_completed_stages integer,p_ten_ms bigint,p_loadout jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old rain_private.runs%rowtype; v_item jsonb; v_ids text[] := '{}'; v_active integer := 0;
  v_new boolean; v_distance boolean := false; v_speed boolean := false; v_rank bigint; v_speed_rank bigint;
begin
  p_player_id := normalize(btrim(p_player_id),NFKC);
  if p_run_id is null or p_player_id is null or char_length(p_player_id) not between 1 and 20
    or p_player_id !~ '^[[:alnum:]_-]+$' or p_stage is null or p_stage not between 1 and 1000000
    or p_completed_stages is null or p_completed_stages not between p_stage-1 and p_stage
    or p_cleared is null or p_cleared % 3 <> 0
    or p_cleared < rain_private.expedition_banked(p_stage)
    or p_cleared > rain_private.expedition_banked(p_stage+1)
    or (p_completed_stages=p_stage) is distinct from (p_cleared=rain_private.expedition_banked(p_stage+1))
    or p_elapsed_ms is null or p_elapsed_ms not between 0 and 604800000
    or (p_completed_stages>=10) is distinct from (p_ten_ms is not null)
    or p_ten_ms < 0 or p_ten_ms > p_elapsed_ms
    or p_loadout is null or jsonb_typeof(p_loadout)<>'array' then
    raise exception 'Invalid expedition' using errcode='22023';
  end if;
  if jsonb_array_length(p_loadout) not between 1 and 7 or octet_length(p_loadout::text)>800 then
    raise exception 'Invalid loadout' using errcode='22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_loadout) loop
    if jsonb_typeof(v_item)<>'object' or v_item->>'id' is null
      or v_item->>'id' not in ('feather','shield','ukulele','cell','gasoline','behemoth','clover','blackhole','radar','prism','seeker','resin','turbine','capacitor','echo','recycler')
      or v_item->>'id'=any(v_ids) or not(v_item ? 'level') or v_item->'level' not in ('1'::jsonb,'2'::jsonb,'3'::jsonb) then
      raise exception 'Invalid loadout' using errcode='22023';
    end if;
    v_ids := array_append(v_ids,v_item->>'id');
    if v_item->>'id' in ('blackhole','radar') then v_active := v_active+1; end if;
  end loop;
  if v_active>1 or jsonb_array_length(p_loadout)-v_active>6 then raise exception 'Invalid loadout' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(72419022);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_run_id::text,17));
  insert into rain_private.runs(run_id,mode,player_id,cleared,elapsed_ms,stage,loadout,completed_stages,ten_ms)
    values(p_run_id,'expedition_v3',p_player_id,p_cleared,p_elapsed_ms,p_stage,p_loadout,p_completed_stages,p_ten_ms)
    on conflict(run_id) do nothing returning true into v_new;
  if coalesce(v_new,false) then
    insert into rain_private.scores as old(mode,player_id,cleared,elapsed_ms,stage,loadout,completed_stages,ten_ms)
      values('expedition_distance',p_player_id,p_cleared,p_elapsed_ms,p_stage,p_loadout,p_completed_stages,p_ten_ms)
      on conflict(mode,player_id) do update set cleared=excluded.cleared,elapsed_ms=excluded.elapsed_ms,
        stage=excluded.stage,loadout=excluded.loadout,completed_stages=excluded.completed_stages,ten_ms=excluded.ten_ms,created_at=clock_timestamp()
      where (excluded.completed_stages,excluded.cleared,-excluded.elapsed_ms)>(old.completed_stages,old.cleared,-old.elapsed_ms)
      returning true into v_distance;
    if p_ten_ms is not null then
      insert into rain_private.scores as old(mode,player_id,cleared,elapsed_ms,stage,loadout,completed_stages,ten_ms)
        values('expedition_speed',p_player_id,p_cleared,p_ten_ms,p_stage,p_loadout,p_completed_stages,p_ten_ms)
        on conflict(mode,player_id) do update set cleared=excluded.cleared,elapsed_ms=excluded.elapsed_ms,
          stage=excluded.stage,loadout=excluded.loadout,completed_stages=excluded.completed_stages,ten_ms=excluded.ten_ms,created_at=clock_timestamp()
        where excluded.ten_ms<old.ten_ms returning true into v_speed;
    end if;
    update rain_private.runs set improved=coalesce(v_distance,false) or coalesce(v_speed,false) where run_id=p_run_id;
  else
    select * into v_old from rain_private.runs where run_id=p_run_id;
    if v_old.revoked then raise exception 'Run removed by administrator' using errcode='22023'; end if;
    if v_old.mode is distinct from 'expedition_v3' or v_old.player_id is distinct from p_player_id
      or v_old.cleared is distinct from p_cleared or v_old.elapsed_ms is distinct from p_elapsed_ms
      or v_old.stage is distinct from p_stage or v_old.completed_stages is distinct from p_completed_stages
      or v_old.ten_ms is distinct from p_ten_ms or v_old.loadout is distinct from p_loadout then
      raise exception 'Run already submitted' using errcode='22023';
    end if;
    v_distance := v_old.improved;
  end if;
  select position into v_rank from (select player_id,row_number() over(order by completed_stages desc,cleared desc,elapsed_ms,created_at,player_id collate "C") position
    from rain_private.scores where mode='expedition_distance') ranked where player_id=p_player_id;
  select position into v_speed_rank from (select player_id,row_number() over(order by elapsed_ms,created_at,player_id collate "C") position
    from rain_private.scores where mode='expedition_speed') ranked where player_id=p_player_id;
  return jsonb_build_object('ok',true,'playerId',p_player_id,'improved',coalesce(v_distance,false) or coalesce(v_speed,false),'rank',v_rank,'speedRank',v_speed_rank);
end;
$$;
revoke all on function public.rain_expedition_v3_leaderboard(text) from public;
revoke all on function public.rain_submit_expedition_v3(uuid,text,integer,bigint,integer,integer,bigint,jsonb) from public;
grant execute on function public.rain_expedition_v3_leaderboard(text) to anon,authenticated;
grant execute on function public.rain_submit_expedition_v3(uuid,text,integer,bigint,integer,integer,bigint,jsonb) to anon,authenticated;

notify pgrst, 'reload schema';
commit;
