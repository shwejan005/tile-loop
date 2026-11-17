alter table public.installation_outcomes
  add column installer_label text
    check (installer_label is null or char_length(installer_label) <= 80),
  add column actual_tiles_installed integer
    check (actual_tiles_installed is null or actual_tiles_installed between 0 and 100000),
  add column reusable_offcuts jsonb not null default '[]'::jsonb
    check (jsonb_typeof(reusable_offcuts) = 'array' and jsonb_array_length(reusable_offcuts) <= 100),
  add column discarded_offcuts jsonb not null default '[]'::jsonb
    check (jsonb_typeof(discarded_offcuts) = 'array' and jsonb_array_length(discarded_offcuts) <= 100);

alter table public.installation_outcomes
  add constraint installation_outcomes_installed_within_consumed
    check (actual_tiles_installed is null or actual_tiles_installed + coalesce(breakage_tiles, 0) <= actual_tiles_used);
