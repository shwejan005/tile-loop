begin;
select plan(19);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'owner@example.test', '', now()),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'other@example.test', '', now());

insert into public.projects (id, owner_id, name)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Owner project');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$select name from public.projects where id = '33333333-3333-3333-3333-333333333333'$$,
  array['Owner project'],
  'an owner reads their own project'
);

insert into public.room_plans (
  id, project_id, label, room_width_mm, room_length_mm, tile_width_mm, tile_length_mm,
  grout_mm, kerf_mm, orientation, reserve_pct
) values (
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  'ROOM-01', 4870, 3620, 600, 600, 3, 3, 'standard', 10
);

select results_eq(
  $$select label from public.room_plans where id = '44444444-4444-4444-4444-444444444444'$$,
  array['ROOM-01'],
  'an owner creates and reads their own room plan'
);

insert into public.plan_snapshots (
  id, room_plan_id, algorithm_version, input_hash, inputs, result_summary, minimum_tiles_by_area
) values (
  '55555555-5555-5555-5555-555555555555',
  '44444444-4444-4444-4444-444444444444',
  'straight-lay-2', repeat('a', 64), '{}'::jsonb,
  '{"stockTiles": 63, "orderQuantity": 70}'::jsonb, 49
);

select results_eq(
  $$select algorithm_version from public.plan_snapshots where id = '55555555-5555-5555-5555-555555555555'$$,
  array['straight-lay-2'],
  'an owner reads their immutable calculation snapshot'
);

select throws_ok(
  $$insert into public.installer_comparisons (plan_snapshot_id, installer_estimate_tiles)
    values ('55555555-5555-5555-5555-555555555555', 48)$$,
  '23514', null,
  'the database rejects an installer estimate below the floor-area minimum'
);

insert into public.installer_comparisons (
  id, plan_snapshot_id, installer_estimate_tiles
) values (
  '66666666-6666-6666-6666-666666666666',
  '55555555-5555-5555-5555-555555555555', 55
);

select results_eq(
  $$select installer_estimate_tiles from public.installer_comparisons where id = '66666666-6666-6666-6666-666666666666'$$,
  array[55],
  'an owner records an installer estimate above the minimum'
);

insert into public.installation_outcomes (
  id, plan_snapshot_id, actual_tiles_used, breakage_tiles, labor_minutes, practicality_rating, note
) values (
  '77777777-7777-7777-7777-777777777777',
  '55555555-5555-5555-5555-555555555555', 58, 2, 420, 4, 'Installer-reviewed final count.'
);

select results_eq(
  $$select actual_tiles_used from public.installation_outcomes where id = '77777777-7777-7777-7777-777777777777'$$,
  array[58],
  'an owner records actual material use against a saved calculation'
);

update public.installation_outcomes set labor_minutes = 390 where id = '77777777-7777-7777-7777-777777777777';
select results_eq(
  $$select labor_minutes from public.installation_outcomes where id = '77777777-7777-7777-7777-777777777777'$$,
  array[390],
  'an owner can correct an installation outcome'
);

select throws_ok(
  $$update public.plan_snapshots set result_summary = '{}'::jsonb where id = '55555555-5555-5555-5555-555555555555'$$,
  '42501', null,
  'calculation snapshots cannot be edited after saving'
);

select throws_ok(
  $$update public.installer_comparisons set installer_estimate_tiles = 56 where id = '66666666-6666-6666-6666-666666666666'$$,
  '42501', null,
  'installer comparison records are immutable'
);

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select is_empty(
  $$select * from public.projects where id = '33333333-3333-3333-3333-333333333333'$$,
  'another user cannot read the project'
);

select is_empty(
  $$select * from public.room_plans where id = '44444444-4444-4444-4444-444444444444'$$,
  'another user cannot read the room plan'
);

select is_empty(
  $$select * from public.plan_snapshots where id = '55555555-5555-5555-5555-555555555555'$$,
  'another user cannot read the calculation snapshot'
);

select is_empty(
  $$select * from public.installer_comparisons where id = '66666666-6666-6666-6666-666666666666'$$,
  'another user cannot read the installer estimate'
);

select is_empty(
  $$select * from public.installation_outcomes where id = '77777777-7777-7777-7777-777777777777'$$,
  'another user cannot read installation outcomes'
);

select throws_ok(
  $$insert into public.room_plans (
      project_id, label, room_width_mm, room_length_mm, tile_width_mm, tile_length_mm,
      grout_mm, kerf_mm, orientation, reserve_pct
    ) values (
      '33333333-3333-3333-3333-333333333333', 'STOLEN', 4870, 3620, 600, 600, 3, 3, 'standard', 10
    )$$,
  '42501', null,
  'another user cannot create a room inside the owner project'
);

select is_empty(
  $$update public.projects set name = 'stolen' where id = '33333333-3333-3333-3333-333333333333' returning id$$,
  'another user cannot update the project'
);

select throws_ok(
  $$insert into public.projects (owner_id, name)
    values ('11111111-1111-1111-1111-111111111111', 'Impersonated project')$$,
  '42501', null,
  'another user cannot create a project for the owner'
);

select throws_ok(
  $$insert into public.installation_outcomes (plan_snapshot_id, actual_tiles_used)
    values ('55555555-5555-5555-5555-555555555555', 58)$$,
  '42501', null,
  'another user cannot record an outcome against the owner snapshot'
);

set local role anon;
select throws_ok(
  $$select * from public.projects$$,
  '42501', null,
  'unauthenticated users have no project table grant'
);

select * from finish();
rollback;
