# StockFlow

StockFlow is a full-stack inventory, warehouse and purchasing management system built with Node.js, Express, MySQL/MariaDB and vanilla JavaScript.

## v0.2 – Products, Warehouses & Stock

This phase adds the first complete inventory workflow.

### Products

- create products
- edit products
- SKU
- optional barcode
- product description
- unit
- purchase price
- reorder level
- active / inactive status
- total stock across all warehouses
- low-stock indication
- search by SKU, barcode or name
- safe deletion for products without stock history

### Warehouses

- create warehouses
- edit warehouses
- warehouse code
- warehouse name
- address
- active / inactive status
- product count per warehouse
- total warehouse quantity

### Stock Movements

Supported movements:

- Receipt
- Issue
- Adjustment In
- Adjustment Out
- Warehouse Transfer

Stock cannot become negative.

Warehouse transfers are transactional:

1. stock leaves the source warehouse
2. stock enters the destination warehouse
3. both movements share one transfer reference
4. the whole operation rolls back if any step fails

### Dashboard

The dashboard now uses real database data:

- active product count
- total stock
- low-stock product count
- active warehouse count
- low-stock product list

### Roles

- Admin
- Warehouse
- Purchasing

Admin can manage warehouses and delete products where safe.
Warehouse users are prepared to manage inventory operations.
Purchasing will become active in v0.3.

## Database

`database/schema.sql` contains the complete fresh-install schema.

Upgrade from v0.1 requires no mandatory table or column changes because the initial schema already included the core inventory tables.

## Run locally

```bash
cd backend
npm install
npm start
```

Default backend:

```text
http://localhost:3100
```

Health:

```text
http://localhost:3100/health
```

## Version

```text
StockFlow v0.2.0
```
