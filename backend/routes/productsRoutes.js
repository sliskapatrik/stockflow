const express = require("express");
const crypto = require("crypto");
const db = require("../database");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken);

router.get("/", async function (req, res) {
    try {
        const search = String(req.query.search || "").trim();
        const like = `%${search}%`;

        const [rows] = await db.query(
            `SELECT
                p.id,
                p.sku,
                p.barcode,
                p.name,
                p.description,
                p.unit,
                p.purchase_price AS purchasePrice,
                p.reorder_level AS reorderLevel,
                p.status,
                COALESCE(SUM(ws.quantity), 0) AS totalStock
             FROM products p
             LEFT JOIN warehouse_stock ws ON ws.product_id = p.id
             WHERE (? = '' OR p.sku LIKE ? OR p.barcode LIKE ? OR p.name LIKE ?)
             GROUP BY p.id
             ORDER BY p.name`,
            [search, like, like, like]
        );

        res.json(rows);
    } catch (error) {
        console.error("GET products error:", error);
        res.status(500).json({ error: "Failed to load products" });
    }
});

router.get("/:id/stock", async function (req, res) {
    try {
        const [rows] = await db.query(
            `SELECT
                w.id AS warehouseId,
                w.code AS warehouseCode,
                w.name AS warehouseName,
                COALESCE(ws.quantity, 0) AS quantity
             FROM warehouses w
             LEFT JOIN warehouse_stock ws
                ON ws.warehouse_id = w.id
               AND ws.product_id = ?
             WHERE w.status = 'active'
             ORDER BY w.name`,
            [req.params.id]
        );

        res.json(rows);
    } catch (error) {
        console.error("GET product stock error:", error);
        res.status(500).json({ error: "Failed to load product stock" });
    }
});

router.post("/", requireRole("admin", "warehouse"), async function (req, res) {
    try {
        const {
            sku,
            barcode,
            name,
            description,
            unit,
            purchasePrice,
            reorderLevel,
            status
        } = req.body;

        if (!sku || !name || !unit) {
            return res.status(400).json({ error: "SKU, name and unit are required" });
        }

        const id = crypto.randomUUID();

        await db.query(
            `INSERT INTO products (
                id, sku, barcode, name, description, unit,
                purchase_price, reorder_level, status
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                sku.trim(),
                barcode?.trim() || null,
                name.trim(),
                description?.trim() || null,
                unit.trim(),
                Number(purchasePrice || 0),
                Number(reorderLevel || 0),
                status === "inactive" ? "inactive" : "active"
            ]
        );

        res.status(201).json({ success: true, id });
    } catch (error) {
        console.error("POST product error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "SKU or barcode already exists" });
        }

        res.status(500).json({ error: "Failed to create product" });
    }
});

router.put("/:id", requireRole("admin", "warehouse"), async function (req, res) {
    try {
        const {
            sku,
            barcode,
            name,
            description,
            unit,
            purchasePrice,
            reorderLevel,
            status
        } = req.body;

        if (!sku || !name || !unit) {
            return res.status(400).json({ error: "SKU, name and unit are required" });
        }

        const [result] = await db.query(
            `UPDATE products
             SET sku = ?,
                 barcode = ?,
                 name = ?,
                 description = ?,
                 unit = ?,
                 purchase_price = ?,
                 reorder_level = ?,
                 status = ?
             WHERE id = ?`,
            [
                sku.trim(),
                barcode?.trim() || null,
                name.trim(),
                description?.trim() || null,
                unit.trim(),
                Number(purchasePrice || 0),
                Number(reorderLevel || 0),
                status === "inactive" ? "inactive" : "active",
                req.params.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("PUT product error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "SKU or barcode already exists" });
        }

        res.status(500).json({ error: "Failed to update product" });
    }
});

router.delete("/:id", requireRole("admin"), async function (req, res) {
    try {
        const [[movementCount]] = await db.query(
            `SELECT COUNT(*) AS count
             FROM stock_movements
             WHERE product_id = ?`,
            [req.params.id]
        );

        if (Number(movementCount.count) > 0) {
            return res.status(409).json({
                error: "Product has stock history. Set it inactive instead of deleting it."
            });
        }

        const [result] = await db.query(
            `DELETE FROM products WHERE id = ?`,
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("DELETE product error:", error);
        res.status(500).json({ error: "Failed to delete product" });
    }
});

module.exports = router;
