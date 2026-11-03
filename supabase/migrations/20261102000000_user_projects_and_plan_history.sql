create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 24),
  room_width_mm numeric(8, 2) not null check (room_width_mm between 300 and 50000),
  room_length_mm numeric(8, 2) not null check (room_length_mm between 300 and 50000),
  tile_width_mm numeric(7, 2) not null check (tile_width_mm between 50 and 3000),
  tile_length_mm numeric(7, 2) not null check (tile_length_mm between 50 and 3000),
  grout_mm numeric(5, 2) not null check (grout_mm between 0 and 30),
  kerf_mm numeric(5, 2) not null check (kerf_mm between 0 and 10),
  orientation text not null check (orientation in ('standard', 'rotated')),
  reserve_pct numeric(5, 2) not null check (reserve_pct between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, label),
  check (tile_width_mm > grout_mm and tile_length_mm > grout_mm)
);

create table public.plan_snapshots (
  id uuid primary key default gen_random_uuid(),
  room_plan_id uuid not null references public.room_plans (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  algorithm_version text not null check (char_length(algorithm_version) between 1 and 40),
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  inputs jsonb not null check (jsonb_typeof(inputs) = 'object'),
  result_summary jsonb not null check (jsonb_typeof(result_summary) = 'object'),
  minimum_tiles_by_area integer not null check (minimum_tiles_by_area > 0),
  created_at timestamptz not null default now()
);

create table public.installer_comparisons (
  id uuid primary key default gen_random_uuid(),
  plan_snapshot_id uuid not null unique references public.plan_snapshots (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  installer_estimate_tiles integer not null check (installer_estimate_tiles between 1 and 100000),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index projects_owner_created_idx on public.projects (owner_id, created_at desc);
create index room_plans_project_updated_idx on public.room_plans (project_id, updated_at desc);
create index room_plans_created_by_idx on public.room_plans (created_by);
create index plan_snapshots_room_created_idx on public.plan_snapshots (room_plan_id, created_at desc);
create index plan_snapshots_created_by_idx on public.plan_snapshots (created_by);
create index installer_comparisons_created_by_idx on public.installer_comparisons (created_by);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger room_plans_set_updated_at
before update on public.room_plans
for each row execute function public.set_updated_at();

create or replace function public.touch_parent_project()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.projects set updated_at = now() where id = old.project_id;
    return old;
  end if;

  update public.projects set updated_at = now() where id = new.project_id;
  return new;
end;
$$;

create trigger room_plans_touch_project
after insert or update or delete on public.room_plans
for each row execute function public.touch_parent_project();

create or replace function public.enforce_installer_area_minimum()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_minimum integer;
begin
  select minimum_tiles_by_area
    into v_minimum
    from public.plan_snapshots
    where id = new.plan_snapshot_id;

  if v_minimum is null then
    raise exception 'Plan snapshot not found' using errcode = '23503';
  end if;

  if new.installer_estimate_tiles < v_minimum then
    raise exception 'Installer estimate is below the floor-area minimum of % tiles', v_minimum
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger installer_comparisons_enforce_area_minimum
before insert or update of plan_snapshot_id, installer_estimate_tiles
on public.installer_comparisons
for each row execute function public.enforce_installer_area_minimum();

alter table public.projects enable row level security;
alter table public.room_plans enable row level security;
alter table public.plan_snapshots enable row level security;
alter table public.installer_comparisons enable row level security;

revoke all on table public.projects from anon, authenticated;
revoke all on table public.room_plans from anon, authenticated;
revoke all on table public.plan_snapshots from anon, authenticated;
revoke all on table public.installer_comparisons from anon, authenticated;

grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.room_plans to authenticated;
grant select, insert on table public.plan_snapshots to authenticated;
grant select, insert on table public.installer_comparisons to authenticated;

create policy "Owners can read projects"
on public.projects for select to authenticated
using (owner_id = (select auth.uid()));

create policy "Users can create their own projects"
on public.projects for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "Owners can update projects"
on public.projects for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Owners can delete projects"
on public.projects for delete to authenticated
using (owner_id = (select auth.uid()));

create policy "Owners can read room plans"
on public.room_plans for select to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.projects p
    where p.id = room_plans.project_id and p.owner_id = (select auth.uid())
  )
);

create policy "Owners can create room plans"
on public.room_plans for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.projects p
    where p.id = room_plans.project_id and p.owner_id = (select auth.uid())
  )
);

create policy "Owners can update room plans"
on public.room_plans for update to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.projects p
    where p.id = room_plans.project_id and p.owner_id = (select auth.uid())
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.projects p
    where p.id = room_plans.project_id and p.owner_id = (select auth.uid())
  )
);

create policy "Owners can delete room plans"
on public.room_plans for delete to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.projects p
    where p.id = room_plans.project_id and p.owner_id = (select auth.uid())
  )
);

create policy "Owners can read plan snapshots"
on public.plan_snapshots for select to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.room_plans rp
    join public.projects p on p.id = rp.project_id
    where rp.id = plan_snapshots.room_plan_id and p.owner_id = (select auth.uid())
  )
);

create policy "Owners can create plan snapshots"
on public.plan_snapshots for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.room_plans rp
    join public.projects p on p.id = rp.project_id
    where rp.id = plan_snapshots.room_plan_id and p.owner_id = (select auth.uid())
  )
);

create policy "Owners can read installer comparisons"
on public.installer_comparisons for select to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.plan_snapshots ps
    join public.room_plans rp on rp.id = ps.room_plan_id
    join public.projects p on p.id = rp.project_id
    where ps.id = installer_comparisons.plan_snapshot_id and p.owner_id = (select auth.uid())
  )
);

create policy "Owners can create installer comparisons"
on public.installer_comparisons for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.plan_snapshots ps
    join public.room_plans rp on rp.id = ps.room_plan_id
    join public.projects p on p.id = rp.project_id
    where ps.id = installer_comparisons.plan_snapshot_id and p.owner_id = (select auth.uid())
  )
);

create or replace function public.save_room_plan_with_snapshot(
  p_project_id uuid,
  p_room_plan_id uuid,
  p_label text,
  p_room_width_mm numeric,
  p_room_length_mm numeric,
  p_tile_width_mm numeric,
  p_tile_length_mm numeric,
  p_grout_mm numeric,
  p_kerf_mm numeric,
  p_orientation text,
  p_reserve_pct numeric,
  p_algorithm_version text,
  p_input_hash text,
  p_inputs jsonb,
  p_result_summary jsonb,
  p_minimum_tiles_by_area integer,
  p_installer_estimate_tiles integer default null,
  p_installer_note text default null
)
returns table (room_plan_id uuid, plan_snapshot_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room_plan_id uuid;
  v_plan_snapshot_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_room_plan_id is null then
    insert into public.room_plans (
      project_id, label, room_width_mm, room_length_mm, tile_width_mm,
      tile_length_mm, grout_mm, kerf_mm, orientation, reserve_pct
    ) values (
      p_project_id, p_label, p_room_width_mm, p_room_length_mm, p_tile_width_mm,
      p_tile_length_mm, p_grout_mm, p_kerf_mm, p_orientation, p_reserve_pct
    ) returning id into v_room_plan_id;
  else
    update public.room_plans set
      label = p_label,
      room_width_mm = p_room_width_mm,
      room_length_mm = p_room_length_mm,
      tile_width_mm = p_tile_width_mm,
      tile_length_mm = p_tile_length_mm,
      grout_mm = p_grout_mm,
      kerf_mm = p_kerf_mm,
      orientation = p_orientation,
      reserve_pct = p_reserve_pct
    where id = p_room_plan_id and project_id = p_project_id
    returning id into v_room_plan_id;

    if v_room_plan_id is null then
      raise exception 'Room plan not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.plan_snapshots (
    room_plan_id, algorithm_version, input_hash, inputs, result_summary, minimum_tiles_by_area
  ) values (
    v_room_plan_id, p_algorithm_version, p_input_hash, p_inputs, p_result_summary, p_minimum_tiles_by_area
  ) returning id into v_plan_snapshot_id;

  if p_installer_estimate_tiles is not null then
    insert into public.installer_comparisons (
      plan_snapshot_id, installer_estimate_tiles, note
    ) values (
      v_plan_snapshot_id, p_installer_estimate_tiles, p_installer_note
    );
  end if;

  return query select v_room_plan_id, v_plan_snapshot_id;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_installer_area_minimum() from public, anon, authenticated;
revoke all on function public.touch_parent_project() from public, anon, authenticated;
revoke all on function public.save_room_plan_with_snapshot(
  uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  text, text, jsonb, jsonb, integer, integer, text
) from public, anon;
grant execute on function public.save_room_plan_with_snapshot(
  uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  text, text, jsonb, jsonb, integer, integer, text
) to authenticated;
