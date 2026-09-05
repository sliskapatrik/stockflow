-- Optional StockFlow demo/reference data v0.1

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
