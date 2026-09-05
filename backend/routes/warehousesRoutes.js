const express = require("express");
const crypto = require("crypto");
const db = require("../database");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authenticateToken);

router.get("/", async function (req, res) {
    try {
        const [rows] = await db.query(
            `SELECT
                w.id,
                w.code,
                w.name,
                w.address,
                w.status,
                COUNT(DISTINCT ws.product_id) AS productCount,
                COALESCE(SUM(ws.quantity), 0) AS totalQuantity
             FROM warehouses w
             LEFT JOIN warehouse_stock ws ON ws.warehouse_id = w.id
             GROUP BY w.id
             ORDER BY w.name`
        );

        res.json(rows);
    } catch (error) {
        console.error("GET warehouses error:", error);
        res.status(500).json({ error: "Failed to load warehouses" });
    }
});

router.get("/:id/stock", async function (req, res) {
    try {
        const [rows] = await db.query(
            `SELECT
                p.id AS productId,
                p.sku,
                p.name,
                p.unit,
                p.reorder_level AS reorderLevel,
                COALESCE(ws.quantity, 0) AS quantity
             FROM products p
             LEFT JOIN warehouse_stock ws
                ON ws.product_id = p.id
               AND ws.warehouse_id = ?
             WHERE p.status = 'active'
             ORDER BY p.name`,
            [req.params.id]
        );

        res.json(rows);
    } catch (error) {
        console.error("GET warehouse stock error:", error);
        res.status(500).json({ error: "Failed to load warehouse stock" });
    }
});

router.post("/", requireRole("admin"), async function (req, res) {
    try {
        const { code, name, address, status } = req.body;

        if (!code || !name) {
            return res.status(400).json({ error: "Warehouse code and name are required" });
        }

        const id = crypto.randomUUID();

        await db.query(
            `INSERT INTO warehouses (id, code, name, address, status)
             VALUES (?, ?, ?, ?, ?)`,
            [
                id,
                code.trim(),
                name.trim(),
                address?.trim() || null,
                status === "inactive" ? "inactive" : "active"
            ]
        );

        res.status(201).json({ success: true, id });
    } catch (error) {
        console.error("POST warehouse error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "Warehouse code already exists" });
        }

        res.status(500).json({ error: "Failed to create warehouse" });
    }
});

router.put("/:id", requireRole("admin"), async function (req, res) {
    try {
        const { code, name, address, status } = req.body;

        if (!code || !name) {
            return res.status(400).json({ error: "Warehouse code and name are required" });
        }

        const [result] = await db.query(
            `UPDATE warehouses
             SET code = ?, name = ?, address = ?, status = ?
             WHERE id = ?`,
            [
                code.trim(),
                name.trim(),
                address?.trim() || null,
                status === "inactive" ? "inactive" : "active",
                req.params.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Warehouse not found" });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("PUT warehouse error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "Warehouse code already exists" });
        }

        res.status(500).json({ error: "Failed to update warehouse" });
    }
});

module.exports = router;
