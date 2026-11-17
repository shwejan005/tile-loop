create or replace function public.touch_parent_project()
returns trigger
language plpgsql
security definer
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

revoke all on function public.touch_parent_project() from public, anon, authenticated;
