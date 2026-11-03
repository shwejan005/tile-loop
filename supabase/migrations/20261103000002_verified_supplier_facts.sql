alter table public.catalog_items
  add column tiles_per_carton integer check (tiles_per_carton is null or tiles_per_carton between 1 and 1000),
  add column price_amount numeric(12, 2) check (price_amount is null or price_amount >= 0),
  add column price_currency text check (price_currency is null or price_currency ~ '^[A-Z]{3}$'),
  add column stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  add column stock_updated_at timestamptz,
  add column facts_source_reference text check (facts_source_reference is null or char_length(facts_source_reference) <= 500),
  add column facts_verified_at timestamptz,
  add column ordering_status text not null default 'planning-only'
    check (ordering_status in ('planning-only', 'orderable')),
  add constraint catalog_price_currency_pair_check
    check ((price_amount is null and price_currency is null) or (price_amount is not null and price_currency is not null)),
  add constraint catalog_orderable_facts_check
    check (
      ordering_status <> 'orderable'
      or (
        catalog_status = 'published'
        and tiles_per_carton is not null
        and price_amount is not null
        and price_currency is not null
        and stock_quantity is not null
        and stock_updated_at is not null
        and facts_source_reference is not null
        and facts_verified_at is not null
      )
    );

create index catalog_orderable_market_idx
  on public.catalog_items (market_code, brand, collection_name)
  where catalog_status = 'published' and ordering_status = 'orderable';
