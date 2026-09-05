const express = require("express");
const db = require("../database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
router.use(authenticateToken);

router.get("/", async function (req, res) {
    try {
        const [[productStats]] = await db.query(
            `SELECT COUNT(*) AS totalProducts
             FROM products
             WHERE status = 'active'`
        );

        const [[stockStats]] = await db.query(
            `SELECT COALESCE(SUM(quantity), 0) AS totalStock
             FROM warehouse_stock`
        );

        const [[warehouseStats]] = await db.query(
            `SELECT COUNT(*) AS totalWarehouses
             FROM warehouses
             WHERE status = 'active'`
        );

        const [[lowStockStats]] = await db.query(
            `SELECT COUNT(*) AS lowStock
             FROM (
                SELECT
                    p.id,
                    p.reorder_level,
                    COALESCE(SUM(ws.quantity), 0) AS total_quantity
                FROM products p
                LEFT JOIN warehouse_stock ws ON ws.product_id = p.id
                WHERE p.status = 'active'
                  AND p.reorder_level > 0
                GROUP BY p.id
                HAVING total_quantity <= p.reorder_level
             ) x`
        );

        const [lowStockItems] = await db.query(
            `SELECT
                p.id,
                p.sku,
                p.name,
                p.unit,
                p.reorder_level AS reorderLevel,
                COALESCE(SUM(ws.quantity), 0) AS totalStock
             FROM products p
             LEFT JOIN warehouse_stock ws ON ws.product_id = p.id
             WHERE p.status = 'active'
               AND p.reorder_level > 0
             GROUP BY p.id
             HAVING totalStock <= p.reorder_level
             ORDER BY totalStock ASC, p.name
             LIMIT 20`
        );

        res.json({
            totalProducts: Number(productStats.totalProducts),
            totalStock: Number(stockStats.totalStock),
            lowStock: Number(lowStockStats.lowStock),
            totalWarehouses: Number(warehouseStats.totalWarehouses),
            lowStockItems
        });
    } catch (error) {
        console.error("GET dashboard error:", error);
        res.status(500).json({ error: "Failed to load dashboard" });
    }
});

module.exports = router;
