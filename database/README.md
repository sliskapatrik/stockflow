# StockFlow Database

`schema.sql` is the complete source of truth for a fresh StockFlow installation.

## Fresh installation

1. Create an empty `stockflow` database.
2. Import `schema.sql`.
3. Optionally import `seed.sql`.
4. Configure `backend/.env`.
5. Run `npm install` in `backend`.
6. Run `node createAdmin.js`.
7. Start with `npm start`.

## Upgrade from v0.3 to v0.4

v0.4 introduces two new tables:

- `inventory_counts`
- `inventory_count_items`

For an existing v0.3 database, run:

```text
database/upgrade-v0.3-to-v0.4.sql
```

once in HeidiSQL before starting StockFlow v0.4.

No JavaScript migration scripts are used.
