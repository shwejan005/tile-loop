alter table public.catalog_items
  add column price_unit text check (price_unit is null or price_unit in ('tile', 'carton', 'm2')),
  add column stock_unit text check (stock_unit is null or stock_unit in ('tiles', 'cartons', 'm2'));

alter table public.catalog_items
  drop constraint catalog_price_currency_pair_check,
  add constraint catalog_price_currency_pair_check
    check (
      (price_amount is null and price_currency is null and price_unit is null)
      or (price_amount is not null and price_currency is not null and price_unit is not null)
    ),
  drop constraint catalog_orderable_facts_check,
  add constraint catalog_orderable_facts_check
    check (
      ordering_status <> 'orderable'
      or (
        catalog_status = 'published'
        and tiles_per_carton is not null
        and price_amount is not null
        and price_currency is not null
        and price_unit is not null
        and stock_quantity is not null
        and stock_unit is not null
        and stock_updated_at is not null
        and facts_source_reference is not null
        and facts_verified_at is not null
      )
    );
