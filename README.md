# StockFlow

StockFlow is a full-stack inventory, warehouse and purchasing management system built with Node.js, Express, MySQL/MariaDB and vanilla JavaScript.

# v0.5 – Barcode / QR & Productivity

This phase focuses on faster warehouse work.

## Scanner / Lookup

The Scanner & Productivity page accepts:

- barcode
- SKU
- product name
- warehouse code
- warehouse location code
- QR identifier

A real USB/Bluetooth barcode scanner that behaves like a keyboard can type directly into the lookup field.

When exactly one product is found, StockFlow automatically selects it for quick stock operations.

## Fast Stock Lookup

Product lookup shows:

- total stock
- stock split across active warehouses

Example:

```text
CAB-CAT6-100 - CAT6 Network Cable 100m
MAIN: 8
SECOND: 12
Total: 20
```

## Quick Receipt / Issue

After scanning a product:

```text
Product
Warehouse
Quick Receipt / Quick Issue
Quantity
Note
```

can be posted without opening the full Stock Movement form.

Quick operations still:

- use MySQL transactions
- prevent negative stock
- create normal stock movement history
- include the logged-in user
- use reference type `quick_scan`

## Warehouse Locations / QR

Warehouses can now have internal scan-friendly locations such as:

```text
A-01-03
Rack A / Shelf 01 / Bin 03
QR: LOC-A-01-03
```

Each location includes:

- warehouse
- location code
- unique QR identifier
- name
- active/inactive status

The current v0.5 scope treats QR values as identifiers. A physical QR label can encode this text and scanners can enter it into StockFlow.

## Saved Views

Users can save:

### Product views
- product search query

### Movement views
- selected warehouse
- movement type

Saved views belong to the logged-in user.

## Existing Functionality Preserved

- Products / SKU / barcode
- Warehouses
- stock quantities
- receipts / issues
- adjustments
- transfers
- Suppliers
- Purchase Orders
- partial receiving
- Inventory Counts
- Reorder Suggestions
- Stock Audit
- low-stock dashboard
- roles and authentication

## Database Upgrade

For an existing v0.4 database run once:

```text
database/upgrade-v0.4-to-v0.5.sql
```

It adds:

```text
warehouse_locations
saved_views
```

For a clean installation use:

```text
database/schema.sql
```

## Version

```text
StockFlow v0.5.0
```
