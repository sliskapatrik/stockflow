# StockFlow Database

`schema.sql` is the complete source of truth for a fresh StockFlow installation.

## Fresh installation

1. Create an empty database named `stockflow`.
2. Import `schema.sql`.
3. Optionally import `seed.sql`.
4. Configure `backend/.env`.
5. Run `npm install` inside `backend`.
6. Run `node createAdmin.js`.
7. Start StockFlow with `npm start`.

## Existing database upgrades

This portfolio project uses a complete `schema.sql` for fresh installations and small manual SQL upgrade files for existing local development databases.

Historical upgrade files:

```text
upgrade-v0.3-to-v0.4.sql
upgrade-v0.4-to-v0.5.sql
upgrade-v0.5-to-v0.6.sql
```

If your existing database already worked on StockFlow v0.6, **no additional database change is required for v1.0**.

No JavaScript migration scripts are used.
