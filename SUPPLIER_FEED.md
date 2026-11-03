# Approved supplier facts

TileLoop accepts a supplier-provided JSON feed using `tileloop-approved-supplier-feed/v1`. Each product carries its SKU/format, carton count, price amount/currency/unit (`tile`, `carton`, or `m2`), and stock quantity/unit (`tiles`, `cartons`, or `m2`) with an update time. The feed must identify its source and verification time.

Check a feed without writing to the database:

```sh
npm run catalog:import-approved -- ./supplier-feed.json --publish-approved --dry-run
```

Import normally and every row stays **staging-only**:

```sh
npm run catalog:import-approved -- ./supplier-feed.json
```

Only after a named operator has reviewed the source and each product is complete may the feed be published as orderable:

```sh
npm run catalog:import-approved -- ./supplier-feed.json --publish-approved
```

That mode requires reviewer identity/time plus carton, price/currency, and dated stock. The database enforces the same requirements. The importer does not place orders. No approved supplier feed is included in this repository; the public RAK catalog scrape lacks these facts and remains a separate staging source.
