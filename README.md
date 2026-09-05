# StockFlow

StockFlow is a full-stack inventory, warehouse and purchasing management system built with **Node.js, Express, MySQL/MariaDB, HTML, CSS and vanilla JavaScript**.

It was created as a portfolio project focused on realistic inventory operations, stock consistency, purchasing workflows, auditability and role-based access.

---

# Version

```text
StockFlow v1.0.0
```

---

# Main Features

## Authentication and Roles

StockFlow uses JWT authentication and bcrypt password hashing.

Supported roles:

```text
admin
warehouse
purchasing
```

### Admin
- full access
- user and role management
- application settings
- reporting
- system overview
- suppliers and purchasing
- all inventory operations

### Warehouse
- products
- stock movements
- warehouse transfers
- inventory counts
- barcode / QR productivity workflow
- purchase order receiving
- fast stock lookup

### Purchasing
- suppliers
- purchase orders
- purchase order items
- partial receiving
- purchasing workflow

---

# Products

Products support:

- SKU
- optional barcode
- name
- description
- unit
- purchase price
- reorder level
- active / inactive status
- total stock across warehouses
- low-stock indication

Search supports SKU, barcode and product name.

---

# Warehouses

Warehouses support:

- warehouse code
- name
- address
- active / inactive status
- product count
- total stored quantity

Stock is stored independently per warehouse.

---

# Stock Movements

Supported movement types:

```text
receipt
issue
adjustment_in
adjustment_out
transfer_in
transfer_out
```

Every stock-changing operation creates movement history.

Warehouse transfers are transactional. If any step fails, the whole operation is rolled back.

StockFlow prevents stock from becoming negative.

---

# Suppliers

Supplier profiles support:

- company name
- contact person
- email
- phone
- address
- active / inactive status

---

# Purchase Orders

Purchase Orders support:

- automatic PO number
- supplier
- destination warehouse
- order date
- expected delivery date
- notes
- multiple products
- ordered quantity
- unit price
- total value

Human-readable PO numbers:

```text
PO-000001
PO-000002
```

Statuses:

```text
Draft
Ordered
Partially Received
Received
Cancelled
```

---

# Partial Receiving

Purchase orders can be received in multiple deliveries.

Example:

```text
Ordered: 100
Received now: 40
Remaining: 60
Status: Partially Received
```

Later:

```text
Received now: 60
Remaining: 0
Status: Received
```

Receiving automatically:

1. validates the remaining PO quantity
2. prevents over-receipt
3. increases warehouse stock
4. updates `quantity_received`
5. creates stock movement history
6. links the movement to the Purchase Order
7. updates the PO status

The workflow runs inside a MySQL transaction.

---

# Inventory Counts

Physical inventory workflow:

```text
Create Count
     ↓
Snapshot system quantity
     ↓
Enter physical quantity
     ↓
Review difference
     ↓
Complete inventory
     ↓
Apply stock correction
```

Inventory numbers:

```text
IC-000001
IC-000002
```

Statuses:

```text
Draft
In Progress
Completed
```

Example:

```text
System: 25
Counted: 8
Difference: -17
```

StockFlow automatically creates:

```text
Adjustment Out: 17
```

If physical stock is higher than system stock, an `Adjustment In` is created.

The operation is transactional and recorded in Stock Audit.

---

# Reorder Suggestions

Products at or below reorder level appear in Reorder Suggestions.

Current suggestion logic:

```text
Target stock = reorder level × 2
Suggested quantity = target stock - current stock
```

The interface also shows the estimated purchase value.

---

# Stock Audit

Stock Audit shows chronological stock activity:

- receipts
- issues
- adjustments
- transfers
- purchase-order receipts
- inventory-count adjustments
- quick scanner movements

Audit entries include:

- product
- warehouse
- movement type
- quantity
- timestamp
- reference
- user

---

# Barcode / QR Productivity

The Scanner & Productivity module accepts:

- barcode
- SKU
- product name
- warehouse location code
- QR identifier

A USB/Bluetooth barcode scanner that behaves like a keyboard can type directly into the lookup field.

---

# Fast Stock Lookup

A product lookup shows stock across active warehouses.

Example:

```text
CAB-CAT6-100 - CAT6 Network Cable 100m
MAIN: 8
SECOND: 12
Total: 20
```

---

# Quick Receipt / Issue

Fast warehouse workflow:

```text
Scan product
     ↓
Choose warehouse
     ↓
Receipt / Issue
     ↓
Quantity
     ↓
Post
```

Quick operations still use:

- MySQL transactions
- negative-stock protection
- stock movement history
- logged-in user tracking
- `quick_scan` reference

---

# Warehouse Locations / QR

Warehouses can contain internal locations such as:

```text
A-01-03
Rack A / Shelf 01 / Bin 03
QR: LOC-A-01-03
```

Location data includes:

- warehouse
- location code
- QR identifier
- name
- active / inactive status

The QR value acts as a scan-friendly identifier.

---

# Saved Views

Users can save frequently used filters.

## Product saved view
- product search query

## Movement saved view
- warehouse
- movement type

Saved views belong to the logged-in user.

---

# Dashboard

The dashboard uses real database values:

- Total Products
- Total Stock
- Low Stock
- Warehouses
- low-stock product list

---

# Reporting

Admin reporting includes:

## Stock Valuation
- total stock value
- total quantity
- valuation by warehouse

## Movement Report
- warehouse filter
- movement type filter
- date from
- date to

## Supplier Performance
- order count
- ordered value
- received value

## Purchasing Report
- PO number
- supplier
- warehouse
- status
- total value
- received value

---

# CSV Export

Admin users can export stock movements to:

```text
stockflow-movements.csv
```

---

# User Management

Admin users can:

- create user
- edit user
- assign role
- activate / deactivate user
- reset password

Supported roles:

```text
admin
warehouse
purchasing
```

The currently logged-in Admin cannot deactivate their own account.

---

# Application Settings

Admin settings include:

```text
Application name
Default currency
Minimum password length
Default reorder multiplier
```

Settings are stored in the database.

---

# Admin Audit

Administrative configuration changes are recorded in:

```text
admin_audit
```

Audit data includes:

- user
- action
- entity
- old value
- new value
- timestamp

---

# System Overview

Admin users can inspect:

- total users
- active users
- active products
- active warehouses
- database name
- database version
- database time
- recent admin audit activity

---

# Security

StockFlow includes:

- bcrypt password hashing
- JWT authentication
- protected API routes
- role-based authorization
- login rate limiting
- email uniqueness
- minimum password length validation
- backend input validation
- negative-stock protection
- MySQL transactions
- protected CSV export
- Helmet security headers
- `.env` excluded from Git

---

# Responsive UI

The final v1.0 interface supports smaller browser windows.

Important behavior:

- the main page can scroll vertically
- the browser can scroll horizontally if a very small viewport cannot contain dense tables
- the sidebar has its own vertical scrolling when needed
- modal dialogs scroll internally
- the page behind an open modal remains locked

This prevents controls, tables and reports from becoming inaccessible when the browser is resized.

---

# Technology Stack

## Frontend
- HTML5
- CSS3
- Vanilla JavaScript
- Fetch API
- LocalStorage for JWT token

## Backend
- Node.js
- Express.js

## Database
- MySQL / MariaDB
- mysql2

## Authentication
- JSON Web Tokens
- bcryptjs

## Security
- Helmet
- express-rate-limit
- CORS

---

# Project Structure

```text
stockflow/
│
├── index.html
├── README.md
├── VERSION
├── .gitignore
│
├── css/
│   └── style.css
│
├── js/
│   └── app.js
│
├── database/
│   ├── schema.sql
│   ├── seed.sql
│   └── README.md
│
└── backend/
    ├── server.js
    ├── database.js
    ├── authRoutes.js
    ├── createAdmin.js
    ├── package.json
    ├── .env.example
    │
    ├── middleware/
    │   └── auth.js
    │
    └── routes/
        ├── productsRoutes.js
        ├── warehousesRoutes.js
        ├── movementsRoutes.js
        ├── dashboardRoutes.js
        ├── suppliersRoutes.js
        ├── ordersRoutes.js
        ├── inventoryRoutes.js
        ├── productivityRoutes.js
        ├── reportsRoutes.js
        └── adminRoutes.js
```

---

# Database

The complete current database structure is stored in:

```text
database/schema.sql
```

Optional demo/reference data is stored in:

```text
database/seed.sql
```

The final repository uses a clean full-schema approach for fresh installations.

There are no JavaScript migration files in the final release.

---

# Database Tables

The current schema includes:

```text
users
warehouses
suppliers
products
warehouse_stock
stock_movements
purchase_orders
purchase_order_items
inventory_counts
inventory_count_items
warehouse_locations
saved_views
app_settings
admin_audit
```

---

# Fresh Installation

## 1. Clone repository

```bash
git clone https://github.com/sliskapatrik/stockflow.git
cd stockflow
```

## 2. Create database

```sql
CREATE DATABASE stockflow
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

## 3. Create dedicated DB user

```sql
CREATE USER 'stockflow'@'localhost'
IDENTIFIED BY 'YOUR_PASSWORD';

GRANT ALL PRIVILEGES
ON stockflow.*
TO 'stockflow'@'localhost';

FLUSH PRIVILEGES;
```

## 4. Import schema

Import:

```text
database/schema.sql
```

Optionally import:

```text
database/seed.sql
```

## 5. Configure backend

Create:

```text
backend/.env
```

based on:

```text
backend/.env.example
```

Example:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=stockflow
DB_PASSWORD=your_database_password
DB_NAME=stockflow

JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=8h

PORT=3100
NODE_ENV=development
```

Never commit the real `.env` file.

## 6. Install dependencies

```bash
cd backend
npm install
```

## 7. Create initial Admin

```bash
node createAdmin.js
```

Default development Admin:

```text
Email:
admin@stockflow.local

Password:
ChangeMe123!
```

Change the temporary password before real deployment.

## 8. Start StockFlow

```bash
npm start
```

Open:

```text
http://localhost:3100
```

Health check:

```text
http://localhost:3100/health
```

---

# Portfolio Highlights

StockFlow demonstrates:

- full-stack JavaScript development
- REST API architecture
- relational database modeling
- transaction-safe inventory logic
- stock consistency
- multi-warehouse inventory
- Purchase Order workflow
- partial receiving
- physical inventory
- stock reconciliation
- audit history
- barcode-oriented workflows
- QR/location identification
- role-based access control
- reporting
- CSV export
- admin tooling
- responsive UI
- security validation

---

# Recommended Portfolio Screenshots

```text
screenshots/
├── 01-login.png
├── 02-dashboard.png
├── 03-products.png
├── 04-stock-movements.png
├── 05-purchase-order.png
├── 06-inventory-count.png
├── 07-scanner-productivity.png
├── 08-reports.png
└── 09-admin.png
```

---

# Final Release Checklist

- [ ] Admin login
- [ ] Warehouse login
- [ ] Purchasing login
- [ ] Product creation
- [ ] Warehouse creation
- [ ] Receipt
- [ ] Issue
- [ ] Warehouse transfer
- [ ] Negative-stock protection
- [ ] Supplier creation
- [ ] Purchase Order
- [ ] Partial receiving
- [ ] Inventory Count
- [ ] Inventory discrepancy correction
- [ ] Reorder Suggestions
- [ ] Stock Audit
- [ ] Barcode lookup
- [ ] QR location lookup
- [ ] Quick Receipt / Issue
- [ ] Saved Views
- [ ] Reports
- [ ] CSV export
- [ ] User management
- [ ] Password reset
- [ ] Settings
- [ ] System Overview
- [ ] Responsive page scrolling
- [ ] Modal scrolling
- [ ] `/health`
- [ ] `.env` ignored
- [ ] `node_modules` ignored
- [ ] fresh `schema.sql` installation tested

---

# GitHub Release

Final commit:

```bash
git add .
git commit -m "Release StockFlow v1.0"
git push
```

Create release tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

# Author

**Patrik Sliska**

GitHub:

```text
https://github.com/sliskapatrik
```

Repository:

```text
https://github.com/sliskapatrik/stockflow
```
