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

## Upgrade from v0.4 to v0.5

Run once in HeidiSQL:

```text
database/upgrade-v0.4-to-v0.5.sql
```

This creates:

- `warehouse_locations`
- `saved_views`

No JavaScript migration files are used.
