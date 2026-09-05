# StockFlow Database

For a fresh local installation:

1. Create an empty MySQL/MariaDB database named `stockflow`.
2. Import `schema.sql`.
3. Optionally import `seed.sql`.
4. Configure `backend/.env`.
5. Run `npm install` inside `backend`.
6. Run `node createAdmin.js`.
7. Start the backend with `npm start`.

`schema.sql` is the source of truth for a clean installation.
