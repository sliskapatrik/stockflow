
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

