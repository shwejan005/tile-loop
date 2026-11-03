create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  supplier_key text not null check (char_length(btrim(supplier_key)) between 1 and 80),
  market_code text not null check (market_code ~ '^[A-Z]{2}$'),
  supplier_code text not null check (char_length(btrim(supplier_code)) between 1 and 100),
  brand text not null check (char_length(btrim(brand)) between 1 and 120),
  collection_name text,
  product_name text not null,
  color text,
  format_label text not null,
  width_mm numeric(8, 2) not null check (width_mm between 1 and 10000),
  height_mm numeric(8, 2) not null check (height_mm between 1 and 10000),
  thickness_mm numeric(6, 2) check (thickness_mm is null or thickness_mm between 0.1 and 100),
  tile_group text,
  body_type text,
  surface_finish text,
  structure text,
  edge text,
  sales_unit text,
  is_decor boolean not null default false,
  source_page_url text,
  source_api_url text,
  source_captured_at timestamptz not null,
  quality_flags text[] not null default '{}',
  catalog_status text not null default 'staging' check (catalog_status in ('staging', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_key, market_code, supplier_code)
);

create index catalog_market_format_idx on public.catalog_items (market_code, width_mm, height_mm);
create index catalog_collection_idx on public.catalog_items (brand, collection_name, color);
create index catalog_published_idx on public.catalog_items (catalog_status, brand, collection_name);

create trigger catalog_items_set_updated_at
before update on public.catalog_items
for each row execute function public.set_updated_at();

alter table public.catalog_items enable row level security;
revoke all on table public.catalog_items from anon, authenticated;
grant select on table public.catalog_items to anon, authenticated;
grant select, insert, update on table public.catalog_items to service_role;

create policy "Published supplier catalog items are readable"
on public.catalog_items for select to anon, authenticated
using (catalog_status = 'published');

alter table public.room_plans
  add column catalog_item_id uuid references public.catalog_items (id) on delete set null;

create index room_plans_catalog_item_idx on public.room_plans (catalog_item_id);

create or replace function public.validate_room_plan_catalog_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_width numeric(8, 2);
  v_height numeric(8, 2);
  v_status text;
begin
  if new.catalog_item_id is null then return new; end if;

  select width_mm, height_mm, catalog_status
    into v_width, v_height, v_status
    from public.catalog_items
    where id = new.catalog_item_id;

  if not found or v_status <> 'published' then
    raise exception 'Catalog item is not available for planning' using errcode = '23514';
  end if;

  if abs(new.tile_width_mm - v_width) > 0.005 or abs(new.tile_length_mm - v_height) > 0.005 then
    raise exception 'Room plan dimensions do not match the selected catalog format' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger room_plans_validate_catalog_item
before insert or update of catalog_item_id, tile_width_mm, tile_length_mm
on public.room_plans
for each row execute function public.validate_room_plan_catalog_item();

revoke all on function public.validate_room_plan_catalog_item() from public, anon, authenticated;

drop function public.save_room_plan_with_snapshot(
  uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  text, text, jsonb, jsonb, integer, integer, text
);

create function public.save_room_plan_with_snapshot(
  p_project_id uuid,
  p_room_plan_id uuid,
  p_catalog_item_id uuid,
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
      project_id, catalog_item_id, label, room_width_mm, room_length_mm, tile_width_mm,
      tile_length_mm, grout_mm, kerf_mm, orientation, reserve_pct
    ) values (
      p_project_id, p_catalog_item_id, p_label, p_room_width_mm, p_room_length_mm, p_tile_width_mm,
      p_tile_length_mm, p_grout_mm, p_kerf_mm, p_orientation, p_reserve_pct
    ) returning id into v_room_plan_id;
  else
    update public.room_plans set
      catalog_item_id = p_catalog_item_id,
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

revoke all on function public.save_room_plan_with_snapshot(
  uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  text, text, jsonb, jsonb, integer, integer, text
) from public, anon;
grant execute on function public.save_room_plan_with_snapshot(
  uuid, uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, text, numeric,
  text, text, jsonb, jsonb, integer, integer, text
) to authenticated;
