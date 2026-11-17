alter table public.installation_outcomes
  add column consumption_basis text not null default 'legacy-unknown'
    check (consumption_basis in ('legacy-unknown', 'consumed-including-breakage-v1'));
