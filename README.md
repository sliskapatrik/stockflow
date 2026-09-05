# StockFlow

StockFlow is a full-stack inventory, warehouse and purchasing management system built with Node.js, Express, MySQL/MariaDB and vanilla JavaScript.

# v0.3 – Suppliers & Purchase Orders

This phase adds a complete purchasing workflow.

## Suppliers

- create supplier
- edit supplier
- company name
- contact name
- email
- phone
- address
- active / inactive status

## Purchase Orders

- create purchase order
- automatic PO number
- supplier
- destination warehouse
- order date
- expected delivery date
- notes
- multiple products
- ordered quantity
- purchase price
- total order value
- order detail

Human-readable order numbers are displayed as:

```text
PO-000001
PO-000002
```

## Purchase Order Statuses

```text
Draft
Ordered
Partially Received
Received
Cancelled
```

## Partial Receiving

Stock can be received in multiple deliveries.

Example:

```text
Ordered: 100
First receipt: 40
Remaining: 60
Status: Partially Received
```

Later:

```text
Second receipt: 60
Remaining: 0
Status: Received
```

Each receipt automatically:

1. validates the remaining PO quantity
2. prevents over-receipt
3. increases stock in the PO destination warehouse
4. increments `quantity_received`
5. creates a normal `receipt` stock movement
6. links the stock movement to the purchase order
7. updates the PO status

All operations are completed inside a MySQL transaction.

## Receipt History

Purchase order detail displays receipt history including:

- product
- quantity
- warehouse
- date/time
- user
- receipt note

The receipt is also visible in normal Stock Movements.

## Existing v0.2 Functionality Preserved

- Products
- SKU / barcode
- Warehouses
- Real stock quantities
- Receipt
- Issue
- Adjustments
- Warehouse transfer
- Low-stock dashboard
- negative-stock protection
- JWT authentication
- roles

## Roles

- Admin
- Warehouse
- Purchasing

Purchasing and Admin can create suppliers and purchase orders.
Warehouse, Purchasing and Admin can receive purchase order stock.

## Database

No mandatory DB upgrade is required from v0.2 because the required purchasing tables already existed in the foundation schema.

`database/schema.sql` remains the source of truth for fresh installations.

## Version

```text
StockFlow v0.3.0
```
