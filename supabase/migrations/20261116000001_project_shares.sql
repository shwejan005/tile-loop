create table public.project_share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index project_share_one_active_idx
  on public.project_share_links (project_id)
  where revoked_at is null;
create index project_share_owner_idx on public.project_share_links (owner_id, created_at desc);

alter table public.project_share_links enable row level security;
revoke all on table public.project_share_links from anon, authenticated;
grant select, insert, update, delete on table public.project_share_links to authenticated;

create policy "Project owners manage share links"
on public.project_share_links for all to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.projects p
    where p.id = project_share_links.project_id and p.owner_id = (select auth.uid())
  )
)
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.projects p
    where p.id = project_share_links.project_id and p.owner_id = (select auth.uid())
  )
);

create or replace function public.rotate_project_share(p_project_id uuid, p_token_hash text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_share_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  update public.project_share_links
    set revoked_at = now()
    where project_id = p_project_id and owner_id = auth.uid() and revoked_at is null;
  insert into public.project_share_links (project_id, owner_id, token_hash)
    values (p_project_id, auth.uid(), p_token_hash)
    returning id into v_share_id;
  return v_share_id;
end;
$$;

create or replace function public.get_shared_project(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', project.name,
    'created_at', project.created_at,
    'plans', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'label', room_plan.label,
          'room_width_mm', room_plan.room_width_mm,
          'room_length_mm', room_plan.room_length_mm,
          'tile_width_mm', room_plan.tile_width_mm,
          'tile_length_mm', room_plan.tile_length_mm,
          'grout_mm', room_plan.grout_mm,
          'kerf_mm', room_plan.kerf_mm,
          'orientation', room_plan.orientation,
          'snapshot', (
            select jsonb_build_object(
              'algorithm_version', snapshot.algorithm_version,
              'created_at', snapshot.created_at,
              'inputs', jsonb_build_object(
                'roomGeometry', snapshot.inputs -> 'roomGeometry',
                'roomWidthMm', snapshot.inputs -> 'roomWidthMm',
                'roomLengthMm', snapshot.inputs -> 'roomLengthMm',
                'layout', jsonb_build_object('pattern', snapshot.inputs #> '{layout,pattern}')
              ),
              'result_summary', jsonb_build_object(
                'orderQuantity', snapshot.result_summary -> 'orderQuantity',
                'cutPieceCount', snapshot.result_summary -> 'cutPieceCount',
                'pieces', coalesce((
                  select jsonb_agg(jsonb_build_object(
                    'id', piece -> 'id',
                    'x', piece -> 'x',
                    'y', piece -> 'y',
                    'w', piece -> 'w',
                    'h', piece -> 'h',
                    'full', piece -> 'full',
                    'geometry', piece -> 'geometry'
                  ) order by listed.ordinal)
                  from jsonb_array_elements(snapshot.result_summary -> 'pieces') with ordinality as listed(piece, ordinal)
                ), '[]'::jsonb)
              )
            )
            from public.plan_snapshots snapshot
            where snapshot.room_plan_id = room_plan.id
            order by snapshot.created_at desc
            limit 1
          )
        ) order by room_plan.label
      )
      from public.room_plans room_plan
      where room_plan.project_id = project.id
    ), '[]'::jsonb)
  )
  from public.project_share_links share_link
  join public.projects project on project.id = share_link.project_id
  where share_link.token_hash = p_token_hash
    and share_link.revoked_at is null
    and p_token_hash ~ '^[a-f0-9]{64}$'
  limit 1;
$$;

revoke all on function public.rotate_project_share(uuid, text) from public, anon;
grant execute on function public.rotate_project_share(uuid, text) to authenticated;
revoke all on function public.get_shared_project(text) from public;
grant execute on function public.get_shared_project(text) to anon, authenticated;
