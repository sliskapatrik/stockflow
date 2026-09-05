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
- users
- roles
- settings
- reports
- system overview
- all inventory operations

### Warehouse
- products
- stock movements
- warehouse transfers
- inventory counts
- barcode / QR productivity workflow
- purchase order receiving

### Purchasing
- suppliers
- purchase orders
- partial receiving
- purchasing-related workflow

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

Search supports:

- SKU
- barcode
- product name

---

# Warehouses

Warehouses support:

- code
- name
- address
- active / inactive status
- product count
- total quantity

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

Stock cannot become negative.

Warehouse transfers are transactional:

```text
Source warehouse
        ↓
Transfer Out
        ↓
Destination warehouse
        ↓
Transfer In
```

If any step fails, the whole transfer is rolled back.

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
- expected date
- notes
- multiple products
- quantity
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

Purchase orders can be received over multiple deliveries.

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

1. validates remaining PO quantity
2. prevents over-receipt
3. increases warehouse stock
4. updates `quantity_received`
5. creates stock movement history
6. links movement to the PO
7. updates PO status

The receiving workflow runs inside a MySQL transaction.

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

StockFlow creates:

```text
Adjustment Out: 17
```

The operation is transactional and recorded in the stock audit.

---

# Reorder Suggestions

Products at or below reorder level appear in Reorder Suggestions.

Current suggestion logic:

```text
Target stock = reorder level × 2
Suggested quantity = target stock - current stock
```

The UI also shows estimated purchase value.

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

A USB/Bluetooth barcode scanner that behaves as a keyboard can enter values directly into the lookup field.

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

- transactions
- negative-stock protection
- movement history
- logged-in user
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
- status

The QR value acts as a scan-friendly identifier.

---

# Saved Views

Users can save commonly used views.

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
Filters:

- warehouse
- movement type
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

Admin can export stock movements to:

```text
stockflow-movements.csv
```

---

# User Management

Admin can:

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

The active Admin cannot deactivate their own account.

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

Admin can inspect:

- total users
- active users
- products
- warehouses
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
- minimum password length
- backend validation
- negative-stock protection
- MySQL transactions
- protected CSV export
- disabled Express `X-Powered-By`
- Helmet HTTP security headers

---

# Responsive UI

The final v1.0 interface supports smaller browser windows.

Important behavior:

- the main page can scroll vertically
- the browser can scroll horizontally if a very small viewport cannot contain dense warehouse tables
- sidebar has independent vertical scrolling when needed
- modal dialogs scroll internally
- the page behind an open modal remains locked

This prevents controls or table columns from becoming inaccessible when the browser is resized.

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
│   ├── README.md
│   ├── upgrade-v0.3-to-v0.4.sql
│   ├── upgrade-v0.4-to-v0.5.sql
│   └── upgrade-v0.5-to-v0.6.sql
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

# Database Tables

The current schema contains tables such as:

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

## 1. Create database

```sql
CREATE DATABASE stockflow
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

## 2. Create dedicated DB user

Example:

```sql
CREATE USER 'stockflow'@'localhost'
IDENTIFIED BY 'YOUR_PASSWORD';

GRANT ALL PRIVILEGES
ON stockflow.*
TO 'stockflow'@'localhost';

FLUSH PRIVILEGES;
```

## 3. Import schema

Import:

```text
database/schema.sql
```

Optionally import:

```text
database/seed.sql
```

## 4. Configure environment

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

Never commit the real `.env`.

## 5. Install dependencies

```bash
cd backend
npm install
```

## 6. Create initial Admin

```bash
node createAdmin.js
```

Initial development credentials:

```text
Email:
admin@stockflow.local

Password:
ChangeMe123!
```

Change the temporary password before production use.

## 7. Start StockFlow

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

# Existing v0.6 Database

If StockFlow v0.6 already works with your existing local database:

```text
No additional SQL change is required for v1.0.
```

---

# Portfolio Highlights

StockFlow demonstrates:

- full-stack JavaScript development
- REST API architecture
- relational database modeling
- transactions
- stock consistency
- multi-warehouse inventory
- purchase-order workflow
- partial receiving
- physical inventory
- stock reconciliation
- audit history
- barcode-oriented workflows
- role-based access control
- reporting
- CSV export
- admin tooling
- responsive UI
- production-oriented validation

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
- [ ] Reorder suggestions
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
