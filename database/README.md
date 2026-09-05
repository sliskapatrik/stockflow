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

## Upgrade from v0.5 to v0.6

Run once in HeidiSQL:

```text
database/upgrade-v0.5-to-v0.6.sql
```

This creates:

- `app_settings`
- `admin_audit`

and inserts default application settings.

No JavaScript migration files are used.
