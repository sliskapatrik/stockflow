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

## Upgrade from v0.2 to v0.3

No mandatory new tables or columns are required.

The v0.2 schema already contained:

- `suppliers`
- `purchase_orders`
- `purchase_order_items`
- stock movement references

v0.3 activates those structures in the application.

The v0.3 fresh-install schema adds optional indexes for purchase order reporting/performance.
Your existing v0.2 database can be used without alteration.
