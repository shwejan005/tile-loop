create table public.installation_outcomes (
  id uuid primary key default gen_random_uuid(),
  plan_snapshot_id uuid not null unique references public.plan_snapshots (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  actual_tiles_used integer not null check (actual_tiles_used between 1 and 100000),
  breakage_tiles integer check (breakage_tiles is null or breakage_tiles between 0 and actual_tiles_used),
  labor_minutes integer check (labor_minutes is null or labor_minutes between 1 and 100000),
  practicality_rating smallint check (practicality_rating is null or practicality_rating between 1 and 5),
  note text check (note is null or char_length(note) <= 1000),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index installation_outcomes_created_by_idx on public.installation_outcomes (created_by, completed_at desc);

create trigger installation_outcomes_set_updated_at
before update on public.installation_outcomes
for each row execute function public.set_updated_at();

alter table public.installation_outcomes enable row level security;
revoke all on table public.installation_outcomes from anon, authenticated;
grant select, insert, update on table public.installation_outcomes to authenticated;

create policy "Owners read their installation outcomes"
on public.installation_outcomes for select to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.plan_snapshots as snapshot
    join public.room_plans as room_plan on room_plan.id = snapshot.room_plan_id
    join public.projects as project on project.id = room_plan.project_id
    where snapshot.id = plan_snapshot_id and project.owner_id = (select auth.uid())
  )
);

create policy "Owners record their installation outcomes"
on public.installation_outcomes for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.plan_snapshots as snapshot
    join public.room_plans as room_plan on room_plan.id = snapshot.room_plan_id
    join public.projects as project on project.id = room_plan.project_id
    where snapshot.id = plan_snapshot_id and project.owner_id = (select auth.uid())
  )
);

create policy "Owners update their installation outcomes"
on public.installation_outcomes for update to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.plan_snapshots as snapshot
    join public.room_plans as room_plan on room_plan.id = snapshot.room_plan_id
    join public.projects as project on project.id = room_plan.project_id
    where snapshot.id = plan_snapshot_id and project.owner_id = (select auth.uid())
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.plan_snapshots as snapshot
    join public.room_plans as room_plan on room_plan.id = snapshot.room_plan_id
    join public.projects as project on project.id = room_plan.project_id
    where snapshot.id = plan_snapshot_id and project.owner_id = (select auth.uid())
  )
);
