# StockFlow

StockFlow is a full-stack inventory, warehouse and purchasing management system built with Node.js, Express, MySQL/MariaDB and vanilla JavaScript.

# v0.4 – Inventory Operations

This phase adds physical inventory control, discrepancy processing, reorder suggestions and a stock audit view.

## Inventory Counts

Users with Admin or Warehouse permissions can create an inventory count for a warehouse.

When a count is created, StockFlow snapshots the current system quantity for every active product.

The workflow is:

```text
Create inventory count
        ↓
Physical count
        ↓
Enter counted quantities
        ↓
Review discrepancies
        ↓
Complete inventory
        ↓
Stock is corrected
        ↓
Adjustment movements are written to the audit trail
```

Inventory count numbers use:

```text
IC-000001
IC-000002
```

Supported count statuses:

```text
Draft
In Progress
Completed
```

## Discrepancies

For every product StockFlow shows:

- system quantity
- physically counted quantity
- difference

Example:

```text
System: 10
Counted: 8
Difference: -2
```

Completing the count changes warehouse stock to `8` and creates:

```text
Adjustment Out: 2
```

If physical stock is higher:

```text
System: 10
Counted: 12
Difference: +2
```

StockFlow creates:

```text
Adjustment In: 2
```

The entire completion is transactional.

## Reorder Suggestions

Products at or below their reorder level appear in the Reorder Suggestions view.

The current suggestion formula is:

```text
target stock = reorder level × 2
suggested quantity = target stock - current stock
```

The interface also shows the estimated purchase value.

## Stock Audit

The Stock Audit view provides a chronological record of stock-changing activity:

- receipts
- issues
- adjustments
- warehouse transfers
- purchase-order receipts
- inventory-count adjustments

Each entry includes:

- product
- warehouse
- movement type
- quantity
- timestamp
- reference
- user

## Existing Features Preserved

- Products
- SKU / barcode
- Warehouses
- real stock quantities
- receipts and issues
- adjustments
- warehouse transfers
- low-stock dashboard
- Suppliers
- Purchase Orders
- partial receiving
- PO receipt history
- negative-stock protection
- JWT authentication
- roles

## Database Upgrade

For an existing v0.3 database, run once:

```text
database/upgrade-v0.3-to-v0.4.sql
```

This creates:

```text
inventory_counts
inventory_count_items
```

For a clean installation use:

```text
database/schema.sql
```

## Version

```text
StockFlow v0.4.0
```
