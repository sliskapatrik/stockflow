# StockFlow

StockFlow is a full-stack inventory, warehouse and purchasing management system.

## v0.1 Foundation

The first phase contains:

- Node.js / Express backend
- MySQL / MariaDB connection
- JWT authentication
- bcrypt password hashing
- role-ready authentication model
- responsive application shell
- Dashboard
- Products module placeholder
- Warehouses module placeholder
- Stock Movements module placeholder
- Suppliers module placeholder
- Purchase Orders module placeholder
- complete initial database schema
- initial administrator creation script
- `/health` endpoint
- Git-ready project structure

## Planned Roles

- Admin
- Warehouse
- Purchasing

## Planned Core Features

- Products and SKUs
- Barcodes
- Multi-warehouse stock
- Receipts and issues
- Warehouse transfers
- Inventory adjustments
- Suppliers
- Purchase orders
- Partial receipts
- Low-stock alerts
- Reorder levels
- Audit history
- Reporting
- CSV exports
- barcode / QR workflow

## Technology

- HTML
- CSS
- Vanilla JavaScript
- Node.js
- Express
- MySQL / MariaDB
- JWT
- bcryptjs

## Local Setup

Create a database:

```sql
CREATE DATABASE stockflow
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

Create a dedicated user, for example:

```sql
CREATE USER 'stockflow'@'localhost'
IDENTIFIED BY 'YOUR_PASSWORD';

GRANT ALL PRIVILEGES
ON stockflow.*
TO 'stockflow'@'localhost';

FLUSH PRIVILEGES;
```

Import:

```text
database/schema.sql
```

Optionally import:

```text
database/seed.sql
```

Create:

```text
backend/.env
```

from `.env.example`.

Install and start:

```bash
cd backend
npm install
node createAdmin.js
npm start
```

Default development backend:

```text
http://localhost:3100
```

Health check:

```text
http://localhost:3100/health
```

Initial administrator created by `createAdmin.js`:

```text
admin@stockflow.local
ChangeMe123!
```

Change the temporary password before any real deployment.

## Version

```text
StockFlow v0.1.0
```
