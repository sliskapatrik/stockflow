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

## Upgrade from v0.1 to v0.2

No required table/column changes are needed because the v0.1 schema already contained
the core Product, Warehouse, Warehouse Stock and Stock Movement tables.

v0.2 adds application/API logic and optional indexes. Existing v0.1 databases can be used directly.
