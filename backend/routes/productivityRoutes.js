const express = require("express");
const crypto = require("crypto");
const db = require("../database");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authenticateToken);

router.get("/lookup", async function (req, res) {
    try {
        const query = String(req.query.q || "").trim();

        if (!query) {
            return res.json({ products: [], locations: [] });
        }

        const like = `%${query}%`;

        const [products] = await db.query(
            `SELECT
                p.id,
                p.sku,
                p.barcode,
                p.name,
                p.unit,
                p.reorder_level AS reorderLevel,
                COALESCE(SUM(ws.quantity), 0) AS totalStock
             FROM products p
             LEFT JOIN warehouse_stock ws ON ws.product_id = p.id
             WHERE p.status = 'active'
               AND (
                    p.sku LIKE ?
                    OR p.barcode LIKE ?
                    OR p.name LIKE ?
               )
             GROUP BY p.id
             ORDER BY
                CASE WHEN p.barcode = ? THEN 0 WHEN p.sku = ? THEN 1 ELSE 2 END,
                p.name
             LIMIT 25`,
            [like, like, like, query, query]
        );

        const [locations] = await db.query(
            `SELECT
                wl.id,
                wl.code,
                wl.qr_code AS qrCode,
                wl.name,
                wl.status,
                w.id AS warehouseId,
                w.code AS warehouseCode,
                w.name AS warehouseName
             FROM warehouse_locations wl
             INNER JOIN warehouses w ON w.id = wl.warehouse_id
             WHERE wl.status = 'active'
               AND (
                    wl.code LIKE ?
                    OR wl.qr_code LIKE ?
                    OR wl.name LIKE ?
                    OR w.code LIKE ?
                    OR w.name LIKE ?
               )
             ORDER BY w.name, wl.code
             LIMIT 25`,
            [like, like, like, like, like]
        );

        res.json({ products, locations });
    } catch (error) {
        console.error("GET productivity lookup error:", error);
        res.status(500).json({ error: "Failed to search StockFlow" });
    }
});

router.get("/products/:id/stock", async function (req, res) {
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
        console.error("GET fast stock lookup error:", error);
        res.status(500).json({ error: "Failed to load stock locations" });
    }
});

router.get("/locations", async function (req, res) {
    try {
        const [rows] = await db.query(
            `SELECT
                wl.id,
                wl.warehouse_id AS warehouseId,
                w.code AS warehouseCode,
                w.name AS warehouseName,
                wl.code,
                wl.qr_code AS qrCode,
                wl.name,
                wl.status,
                wl.created_at AS createdAt
             FROM warehouse_locations wl
             INNER JOIN warehouses w ON w.id = wl.warehouse_id
             ORDER BY w.name, wl.code`
        );

        res.json(rows);
    } catch (error) {
        console.error("GET warehouse locations error:", error);
        res.status(500).json({ error: "Failed to load warehouse locations" });
    }
});

router.post("/locations", requireRole("admin", "warehouse"), async function (req, res) {
    try {
        const { warehouseId, code, qrCode, name, status } = req.body;

        if (!warehouseId || !code || !name) {
            return res.status(400).json({
                error: "Warehouse, location code and name are required"
            });
        }

        const id = crypto.randomUUID();
        const finalQr = (qrCode || `LOC-${code}`).trim();

        await db.query(
            `INSERT INTO warehouse_locations (
                id,
                warehouse_id,
                code,
                qr_code,
                name,
                status
             )
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                id,
                warehouseId,
                code.trim(),
                finalQr,
                name.trim(),
                status === "inactive" ? "inactive" : "active"
            ]
        );

        res.status(201).json({ success: true, id, qrCode: finalQr });
    } catch (error) {
        console.error("POST warehouse location error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                error: "Location code or QR identifier already exists"
            });
        }

        res.status(500).json({ error: "Failed to create warehouse location" });
    }
});

router.put("/locations/:id", requireRole("admin", "warehouse"), async function (req, res) {
    try {
        const { warehouseId, code, qrCode, name, status } = req.body;

        if (!warehouseId || !code || !name || !qrCode) {
            return res.status(400).json({
                error: "Warehouse, location code, QR identifier and name are required"
            });
        }

        const [result] = await db.query(
            `UPDATE warehouse_locations
             SET warehouse_id = ?,
                 code = ?,
                 qr_code = ?,
                 name = ?,
                 status = ?
             WHERE id = ?`,
            [
                warehouseId,
                code.trim(),
                qrCode.trim(),
                name.trim(),
                status === "inactive" ? "inactive" : "active",
                req.params.id
            ]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: "Warehouse location not found" });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("PUT warehouse location error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                error: "Location code or QR identifier already exists"
            });
        }

        res.status(500).json({ error: "Failed to update warehouse location" });
    }
});

router.get("/saved-views", async function (req, res) {
    try {
        const [rows] = await db.query(
            `SELECT
                id,
                view_type AS viewType,
                name,
                filter_json AS filterJson,
                created_at AS createdAt
             FROM saved_views
             WHERE user_id = ?
             ORDER BY view_type, name`,
            [req.user.id]
        );

        res.json(rows.map((row) => ({
            ...row,
            filters: JSON.parse(row.filterJson || "{}")
        })));
    } catch (error) {
        console.error("GET saved views error:", error);
        res.status(500).json({ error: "Failed to load saved views" });
    }
});

router.post("/saved-views", async function (req, res) {
    try {
        const { viewType, name, filters } = req.body;

        if (!["products", "movements"].includes(viewType)) {
            return res.status(400).json({ error: "Invalid saved view type" });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Saved view name is required" });
        }

        const id = crypto.randomUUID();

        await db.query(
            `INSERT INTO saved_views (
                id,
                user_id,
                view_type,
                name,
                filter_json
             )
             VALUES (?, ?, ?, ?, ?)`,
            [
                id,
                req.user.id,
                viewType,
                name.trim(),
                JSON.stringify(filters || {})
            ]
        );

        res.status(201).json({ success: true, id });
    } catch (error) {
        console.error("POST saved view error:", error);
        res.status(500).json({ error: "Failed to save view" });
    }
});

router.delete("/saved-views/:id", async function (req, res) {
    try {
        const [result] = await db.query(
            `DELETE FROM saved_views
             WHERE id = ?
               AND user_id = ?`,
            [req.params.id, req.user.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: "Saved view not found" });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("DELETE saved view error:", error);
        res.status(500).json({ error: "Failed to delete saved view" });
    }
});

router.post("/quick-movement", requireRole("admin", "warehouse"), async function (req, res) {
    const connection = await db.getConnection();

    try {
        const {
            productId,
            warehouseId,
            movementType,
            quantity,
            note
        } = req.body;

        if (!productId || !warehouseId) {
            return res.status(400).json({ error: "Product and warehouse are required" });
        }

        if (!["receipt", "issue"].includes(movementType)) {
            return res.status(400).json({ error: "Quick movement must be receipt or issue" });
        }

        const qty = Number(quantity);

        if (!Number.isFinite(qty) || qty <= 0) {
            return res.status(400).json({ error: "Quantity must be greater than zero" });
        }

        await connection.beginTransaction();

        await connection.query(
            `INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
             VALUES (?, ?, 0)
             ON DUPLICATE KEY UPDATE quantity = quantity`,
            [warehouseId, productId]
        );

        const [stockRows] = await connection.query(
            `SELECT quantity
             FROM warehouse_stock
             WHERE warehouse_id = ?
               AND product_id = ?
             FOR UPDATE`,
            [warehouseId, productId]
        );

        const current = Number(stockRows[0].quantity);
        const next = movementType === "receipt" ? current + qty : current - qty;

        if (next < 0) {
            throw Object.assign(
                new Error(`Insufficient stock. Available quantity: ${current}`),
                { statusCode: 409 }
            );
        }

        await connection.query(
            `UPDATE warehouse_stock
             SET quantity = ?
             WHERE warehouse_id = ?
               AND product_id = ?`,
            [next, warehouseId, productId]
        );

        await connection.query(
            `INSERT INTO stock_movements (
                id,
                product_id,
                warehouse_id,
                movement_type,
                quantity,
                reference_type,
                reference_id,
                note,
                created_by
             )
             VALUES (?, ?, ?, ?, ?, 'quick_scan', NULL, ?, ?)`,
            [
                crypto.randomUUID(),
                productId,
                warehouseId,
                movementType,
                qty,
                note?.trim() || "Quick barcode workflow",
                req.user.id
            ]
        );

        await connection.commit();

        res.status(201).json({ success: true, quantity: next });
    } catch (error) {
        await connection.rollback();
        console.error("POST quick movement error:", error);
        res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : "Failed to post quick movement"
        });
    } finally {
        connection.release();
    }
});

module.exports = router;
