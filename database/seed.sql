-- Optional StockFlow demo/reference data v0.2

INSERT IGNORE INTO warehouses (
    id,
    code,
    name,
    address
)
VALUES
(
    'warehouse-main',
    'MAIN',
    'Main Warehouse',
    'St. Gallen, Switzerland'
);

INSERT IGNORE INTO products (
    id,
    sku,
    barcode,
    name,
    description,
    unit,
    purchase_price,
    reorder_level
)
VALUES
(
    'product-cable-001',
    'CAB-CAT6-100',
    '761000000001',
    'CAT6 Network Cable 100m',
    'CAT6 UTP installation cable, 100 metre roll.',
    'roll',
    79.90,
    5
),
(
    'product-switch-001',
    'NET-SW-24',
    '761000000002',
    '24-Port Gigabit Switch',
    'Managed 24-port gigabit network switch.',
    'pcs',
    249.00,
    2
);
