const express = require("express");
const crypto = require("crypto");
const db = require("../database");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authenticateToken);

function countNo(value) {
    return `IC-${String(value).padStart(6, "0")}`;
}

router.get("/counts", async function (req, res) {
    try {
        const [rows] = await db.query(
            `SELECT
                ic.id,
                ic.count_no AS countNo,
                ic.status,
                ic.note,
                ic.created_at AS createdAt,
                ic.completed_at AS completedAt,
                w.id AS warehouseId,
                w.code AS warehouseCode,
                w.name AS warehouseName,
                u.name AS createdBy,
                COUNT(ici.id) AS itemCount,
                COALESCE(SUM(CASE WHEN ici.difference <> 0 THEN 1 ELSE 0 END), 0) AS discrepancyCount
             FROM inventory_counts ic
             INNER JOIN warehouses w ON w.id = ic.warehouse_id
             LEFT JOIN users u ON u.id = ic.created_by
             LEFT JOIN inventory_count_items ici ON ici.inventory_count_id = ic.id
             GROUP BY ic.id
             ORDER BY ic.created_at DESC`
        );

        res.json(rows.map((row) => ({
            ...row,
            displayNo: countNo(row.countNo)
        })));
    } catch (error) {
        console.error("GET inventory counts error:", error);
        res.status(500).json({ error: "Failed to load inventory counts" });
    }
});

router.get("/counts/:id", async function (req, res) {
    try {
        const [counts] = await db.query(
            `SELECT
                ic.id,
                ic.count_no AS countNo,
                ic.status,
                ic.note,
                ic.created_at AS createdAt,
                ic.completed_at AS completedAt,
                w.id AS warehouseId,
                w.code AS warehouseCode,
                w.name AS warehouseName,
                u.name AS createdBy
             FROM inventory_counts ic
             INNER JOIN warehouses w ON w.id = ic.warehouse_id
             LEFT JOIN users u ON u.id = ic.created_by
             WHERE ic.id = ?
             LIMIT 1`,
            [req.params.id]
        );

        if (!counts.length) {
            return res.status(404).json({ error: "Inventory count not found" });
        }

        const [items] = await db.query(
            `SELECT
                ici.id,
                ici.product_id AS productId,
                p.sku,
                p.name AS productName,
                p.unit,
                ici.system_quantity AS systemQuantity,
                ici.counted_quantity AS countedQuantity,
                ici.difference
             FROM inventory_count_items ici
             INNER JOIN products p ON p.id = ici.product_id
             WHERE ici.inventory_count_id = ?
             ORDER BY p.name`,
            [req.params.id]
        );

        res.json({
            ...counts[0],
            displayNo: countNo(counts[0].countNo),
            items
        });
    } catch (error) {
        console.error("GET inventory count detail error:", error);
        res.status(500).json({ error: "Failed to load inventory count" });
    }
});

router.post("/counts", requireRole("admin", "warehouse"), async function (req, res) {
    const connection = await db.getConnection();

    try {
        const { warehouseId, note } = req.body;

        if (!warehouseId) {
            return res.status(400).json({ error: "Warehouse is required" });
        }

        await connection.beginTransaction();

        const id = crypto.randomUUID();

        await connection.query(
            `INSERT INTO inventory_counts (
                id,
                warehouse_id,
                status,
                note,
                created_by
             )
             VALUES (?, ?, 'draft', ?, ?)`,
            [id, warehouseId, note?.trim() || null, req.user.id]
        );

        const [products] = await connection.query(
            `SELECT
                p.id AS productId,
                COALESCE(ws.quantity, 0) AS systemQuantity
             FROM products p
             LEFT JOIN warehouse_stock ws
                ON ws.product_id = p.id
               AND ws.warehouse_id = ?
             WHERE p.status = 'active'
             ORDER BY p.name`,
            [warehouseId]
        );

        for (const product of products) {
            await connection.query(
                `INSERT INTO inventory_count_items (
                    id,
                    inventory_count_id,
                    product_id,
                    system_quantity,
                    counted_quantity,
                    difference
                 )
                 VALUES (?, ?, ?, ?, NULL, 0)`,
                [
                    crypto.randomUUID(),
                    id,
                    product.productId,
                    Number(product.systemQuantity)
                ]
            );
        }

        await connection.commit();

        res.status(201).json({ success: true, id });
    } catch (error) {
        await connection.rollback();
        console.error("POST inventory count error:", error);
        res.status(500).json({ error: "Failed to create inventory count" });
    } finally {
        connection.release();
    }
});

router.put("/counts/:id/items", requireRole("admin", "warehouse"), async function (req, res) {
    const connection = await db.getConnection();

    try {
        const { items } = req.body;

        if (!Array.isArray(items)) {
            return res.status(400).json({ error: "Items are required" });
        }

        await connection.beginTransaction();

        const [counts] = await connection.query(
            `SELECT status
             FROM inventory_counts
             WHERE id = ?
             FOR UPDATE`,
            [req.params.id]
        );

        if (!counts.length) {
            throw Object.assign(new Error("Inventory count not found"), { statusCode: 404 });
        }

        if (counts[0].status === "completed") {
            throw Object.assign(new Error("Completed inventory count cannot be edited"), { statusCode: 409 });
        }

        for (const item of items) {
            const counted = Number(item.countedQuantity);

            if (!Number.isFinite(counted) || counted < 0) {
                throw Object.assign(new Error("Counted quantity must be zero or greater"), { statusCode: 400 });
            }

            await connection.query(
                `UPDATE inventory_count_items
                 SET counted_quantity = ?,
                     difference = ? - system_quantity
                 WHERE id = ?
                   AND inventory_count_id = ?`,
                [counted, counted, item.id, req.params.id]
            );
        }

        await connection.query(
            `UPDATE inventory_counts
             SET status = 'in_progress'
             WHERE id = ?
               AND status = 'draft'`,
            [req.params.id]
        );

        await connection.commit();

        res.json({ success: true });
    } catch (error) {
        await connection.rollback();
        console.error("PUT inventory count items error:", error);
        res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : "Failed to save inventory count"
        });
    } finally {
        connection.release();
    }
});

router.post("/counts/:id/complete", requireRole("admin", "warehouse"), async function (req, res) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [counts] = await connection.query(
            `SELECT
                id,
                warehouse_id AS warehouseId,
                status
             FROM inventory_counts
             WHERE id = ?
             FOR UPDATE`,
            [req.params.id]
        );

        if (!counts.length) {
            throw Object.assign(new Error("Inventory count not found"), { statusCode: 404 });
        }

        if (counts[0].status === "completed") {
            throw Object.assign(new Error("Inventory count is already completed"), { statusCode: 409 });
        }

        const [items] = await connection.query(
            `SELECT
                id,
                product_id AS productId,
                system_quantity AS systemQuantity,
                counted_quantity AS countedQuantity,
                difference
             FROM inventory_count_items
             WHERE inventory_count_id = ?
             FOR UPDATE`,
            [req.params.id]
        );

        if (items.some((item) => item.countedQuantity === null)) {
            throw Object.assign(
                new Error("Count every product before completing inventory"),
                { statusCode: 409 }
            );
        }

        for (const item of items) {
            const difference = Number(item.difference);

            await connection.query(
                `INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                 VALUES (?, ?, 0)
                 ON DUPLICATE KEY UPDATE quantity = quantity`,
                [counts[0].warehouseId, item.productId]
            );

            await connection.query(
                `UPDATE warehouse_stock
                 SET quantity = ?
                 WHERE warehouse_id = ?
                   AND product_id = ?`,
                [
                    Number(item.countedQuantity),
                    counts[0].warehouseId,
                    item.productId
                ]
            );

            if (difference !== 0) {
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
                     VALUES (?, ?, ?, ?, ?, 'inventory_count', ?, ?, ?)`,
                    [
                        crypto.randomUUID(),
                        item.productId,
                        counts[0].warehouseId,
                        difference > 0 ? "adjustment_in" : "adjustment_out",
                        Math.abs(difference),
                        req.params.id,
                        "Inventory count adjustment",
                        req.user.id
                    ]
                );
            }
        }

        await connection.query(
            `UPDATE inventory_counts
             SET status = 'completed',
                 completed_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [req.params.id]
        );

        await connection.commit();

        res.json({ success: true });
    } catch (error) {
        await connection.rollback();
        console.error("POST complete inventory count error:", error);
        res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : "Failed to complete inventory count"
        });
    } finally {
        connection.release();
    }
});

router.get("/reorder-suggestions", async function (req, res) {
    try {
        const [rows] = await db.query(
            `SELECT
                p.id,
                p.sku,
                p.name,
                p.unit,
                p.purchase_price AS purchasePrice,
                p.reorder_level AS reorderLevel,
                COALESCE(SUM(ws.quantity), 0) AS totalStock,
                GREATEST(
                    p.reorder_level * 2 - COALESCE(SUM(ws.quantity), 0),
                    0
                ) AS suggestedQuantity
             FROM products p
             LEFT JOIN warehouse_stock ws ON ws.product_id = p.id
             WHERE p.status = 'active'
               AND p.reorder_level > 0
             GROUP BY p.id
             HAVING totalStock <= p.reorder_level
             ORDER BY totalStock ASC, p.name`
        );

        res.json(rows);
    } catch (error) {
        console.error("GET reorder suggestions error:", error);
        res.status(500).json({ error: "Failed to load reorder suggestions" });
    }
});

router.get("/audit", async function (req, res) {
    try {
        const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);

        const [rows] = await db.query(
            `SELECT
                sm.id,
                sm.movement_type AS movementType,
                sm.quantity,
                sm.reference_type AS referenceType,
                sm.reference_id AS referenceId,
                sm.note,
                sm.created_at AS createdAt,
                p.sku,
                p.name AS productName,
                p.unit,
                w.code AS warehouseCode,
                w.name AS warehouseName,
                u.name AS createdBy
             FROM stock_movements sm
             INNER JOIN products p ON p.id = sm.product_id
             INNER JOIN warehouses w ON w.id = sm.warehouse_id
             LEFT JOIN users u ON u.id = sm.created_by
             ORDER BY sm.created_at DESC
             LIMIT ?`,
            [limit]
        );

        res.json(rows);
    } catch (error) {
        console.error("GET inventory audit error:", error);
        res.status(500).json({ error: "Failed to load stock audit" });
    }
});

module.exports = router;
