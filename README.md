# StockFlow

StockFlow is a full-stack inventory, warehouse and purchasing management system built with Node.js, Express, MySQL/MariaDB and vanilla JavaScript.

# v0.6 – Reporting, Admin & Security

This phase completes the main application feature set before the final v1.0 portfolio release.

## Reporting

Admin users now have a Reports section with:

### Stock valuation
- total stock value
- total stock quantity
- valuation by warehouse

### Movement report
- warehouse filter
- movement type filter
- from date
- to date
- chronological results

### Supplier performance
- purchase order count
- ordered value
- received value

### Purchasing report
- PO number
- supplier
- warehouse
- status
- order value
- received value

### CSV export
Stock movements can be exported to:

```text
stockflow-movements.csv
```

## Admin / User Management

Admin can:

- create users
- edit users
- change role
- activate / deactivate accounts
- reset passwords

Roles:

```text
admin
warehouse
purchasing
```

The logged-in Admin cannot deactivate their own account.

## Application Settings

Settings include:

```text
Application name
Default currency
Minimum password length
Default reorder multiplier
```

Settings are stored in the database.

## Admin Audit

Changes to application settings are stored in:

```text
admin_audit
```

with:

- user
- action
- entity
- old value
- new value
- timestamp

## System Overview

Admin can view:

- total users
- active users
- active products
- active warehouses
- database name
- database version
- database time
- recent admin audit events

## Security / Validation

v0.6 strengthens:

- role checks on reporting and admin APIs
- user email uniqueness
- minimum password length enforcement
- own-account deactivation protection
- backend validation
- protected CSV export
- bcrypt password hashing
- JWT authentication
- login rate limiting
- negative-stock prevention
- transactional stock operations

## Existing Functionality Preserved

- Products
- Warehouses
- Stock Movements
- Transfers
- Suppliers
- Purchase Orders
- Partial Receiving
- Inventory Counts
- Reorder Suggestions
- Stock Audit
- Barcode / SKU lookup
- Quick receipt / issue
- Warehouse QR locations
- Saved Views

## Database Upgrade

For an existing v0.5 database run once:

```text
database/upgrade-v0.5-to-v0.6.sql
```

It adds:

```text
app_settings
admin_audit
```

For a clean installation use:

```text
database/schema.sql
```

## Version

```text
StockFlow v0.6.0
```
