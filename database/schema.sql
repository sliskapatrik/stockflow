-- StockFlow complete database schema v0.5
-- Import into an EMPTY MySQL/MariaDB database named `stockflow`.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','warehouse','purchasing') NOT NULL DEFAULT 'warehouse',
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS warehouses (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500) NULL,
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(64) PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NULL,
    email VARCHAR(255) NULL,
    phone VARCHAR(100) NULL,
    address VARCHAR(500) NULL,
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    sku VARCHAR(100) NOT NULL UNIQUE,
    barcode VARCHAR(150) NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
    purchase_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    reorder_level DECIMAL(14,3) NOT NULL DEFAULT 0,
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_products_name (name),
    KEY idx_products_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS warehouse_stock (
    warehouse_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    quantity DECIMAL(14,3) NOT NULL DEFAULT 0,

    PRIMARY KEY (warehouse_id, product_id),
    KEY idx_warehouse_stock_product (product_id),

    CONSTRAINT fk_stock_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_stock_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_movements (
    id VARCHAR(64) PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL,
    warehouse_id VARCHAR(64) NOT NULL,
    movement_type ENUM(
        'receipt',
        'issue',
        'adjustment_in',
        'adjustment_out',
        'transfer_in',
        'transfer_out'
    ) NOT NULL,
    quantity DECIMAL(14,3) NOT NULL,
    reference_type VARCHAR(80) NULL,
    reference_id VARCHAR(64) NULL,
    note VARCHAR(500) NULL,
    created_by VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    KEY idx_movements_product_created (product_id, created_at),
    KEY idx_movements_warehouse_created (warehouse_id, created_at),
    KEY idx_movements_reference (reference_type, reference_id),

    CONSTRAINT fk_movements_product
        FOREIGN KEY (product_id)
        REFERENCES products(id),

    CONSTRAINT fk_movements_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id),

    CONSTRAINT fk_movements_user
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_orders (
    id VARCHAR(64) PRIMARY KEY,
    order_no BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    supplier_id VARCHAR(64) NOT NULL,
    warehouse_id VARCHAR(64) NOT NULL,
    status ENUM(
        'draft',
        'ordered',
        'partially_received',
        'received',
        'cancelled'
    ) NOT NULL DEFAULT 'draft',
    order_date DATE NULL,
    expected_date DATE NULL,
    note TEXT NULL,
    created_by VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_purchase_orders_order_no (order_no),
    KEY idx_purchase_orders_supplier (supplier_id),
    KEY idx_purchase_orders_warehouse (warehouse_id),
    KEY idx_purchase_orders_status (status),
    KEY idx_purchase_orders_created_at (created_at),

    CONSTRAINT fk_po_supplier
        FOREIGN KEY (supplier_id)
        REFERENCES suppliers(id),

    CONSTRAINT fk_po_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id),

    CONSTRAINT fk_po_user
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id VARCHAR(64) PRIMARY KEY,
    purchase_order_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    quantity_ordered DECIMAL(14,3) NOT NULL,
    quantity_received DECIMAL(14,3) NOT NULL DEFAULT 0,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,

    KEY idx_po_items_order (purchase_order_id),
    KEY idx_po_items_product (product_id),

    CONSTRAINT fk_po_items_order
        FOREIGN KEY (purchase_order_id)
        REFERENCES purchase_orders(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_po_items_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS inventory_counts (
    id VARCHAR(64) PRIMARY KEY,
    count_no BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    warehouse_id VARCHAR(64) NOT NULL,
    status ENUM('draft','in_progress','completed') NOT NULL DEFAULT 'draft',
    note VARCHAR(500) NULL,
    created_by VARCHAR(64) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,

    UNIQUE KEY uq_inventory_counts_count_no (count_no),
    KEY idx_inventory_counts_warehouse (warehouse_id),
    KEY idx_inventory_counts_status (status),
    KEY idx_inventory_counts_created_at (created_at),

    CONSTRAINT fk_inventory_counts_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id),

    CONSTRAINT fk_inventory_counts_user
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_count_items (
    id VARCHAR(64) PRIMARY KEY,
    inventory_count_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    system_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
    counted_quantity DECIMAL(14,3) NULL,
    difference DECIMAL(14,3) NOT NULL DEFAULT 0,

    UNIQUE KEY uq_inventory_count_product (inventory_count_id, product_id),
    KEY idx_inventory_count_items_product (product_id),

    CONSTRAINT fk_inventory_count_items_count
        FOREIGN KEY (inventory_count_id)
        REFERENCES inventory_counts(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_inventory_count_items_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



CREATE TABLE IF NOT EXISTS warehouse_locations (
    id VARCHAR(64) PRIMARY KEY,
    warehouse_id VARCHAR(64) NOT NULL,
    code VARCHAR(100) NOT NULL,
    qr_code VARCHAR(160) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_warehouse_location_code (warehouse_id, code),
    KEY idx_warehouse_locations_status (status),

    CONSTRAINT fk_warehouse_locations_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saved_views (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    view_type ENUM('products','movements') NOT NULL,
    name VARCHAR(160) NOT NULL,
    filter_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    KEY idx_saved_views_user_type (user_id, view_type),

    CONSTRAINT fk_saved_views_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


SET FOREIGN_KEY_CHECKS = 1;
