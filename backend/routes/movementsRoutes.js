const express = require("express");
const crypto = require("crypto");
const db = require("../database");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authenticateToken);

function signedQuantity(type, quantity) {
    const q = Number(quantity);

    if (["receipt", "adjustment_in", "transfer_in"].includes(type)) {
        return q;
    }

    return -q;
}

async function getLockedStock(connection, warehouseId, productId) {
    await connection.query(
        `INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
         VALUES (?, ?, 0)
         ON DUPLICATE KEY UPDATE quantity = quantity`,
        [warehouseId, productId]
    );

    const [rows] = await connection.query(
        `SELECT quantity
         FROM warehouse_stock
         WHERE warehouse_id = ?
           AND product_id = ?
         FOR UPDATE`,
        [warehouseId, productId]
    );

    return Number(rows[0].quantity);
}

async function applyMovement(connection, {
    productId,
    warehouseId,
    type,
    quantity,
    note,
    userId,
    referenceType = null,
    referenceId = null
}) {
    const qty = Number(quantity);

    if (!Number.isFinite(qty) || qty <= 0) {
        throw Object.assign(new Error("Quantity must be greater than zero"), { statusCode: 400 });
    }

    const current = await getLockedStock(connection, warehouseId, productId);
    const delta = signedQuantity(type, qty);
    const next = current + delta;

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

    const movementId = crypto.randomUUID();

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
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            movementId,
            productId,
            warehouseId,
            type,
            qty,
            referenceType,
            referenceId,
            note?.trim() || null,
            userId
        ]
    );

    return movementId;
}

router.get("/", async function (req, res) {
    try {
        const warehouseId = String(req.query.warehouseId || "");
        const type = String(req.query.type || "");

        const params = [];
        let where = "WHERE 1 = 1";

        if (warehouseId) {
            where += " AND sm.warehouse_id = ?";
            params.push(warehouseId);
        }

        if (type) {
            where += " AND sm.movement_type = ?";
            params.push(type);
        }

        const [rows] = await db.query(
            `SELECT
                sm.id,
                sm.movement_type AS movementType,
                sm.quantity,
                sm.reference_type AS referenceType,
                sm.reference_id AS referenceId,
                sm.note,
                sm.created_at AS createdAt,
                p.id AS productId,
                p.sku,
                p.name AS productName,
                p.unit,
                w.id AS warehouseId,
                w.code AS warehouseCode,
                w.name AS warehouseName,
                u.name AS createdBy
             FROM stock_movements sm
             INNER JOIN products p ON p.id = sm.product_id
             INNER JOIN warehouses w ON w.id = sm.warehouse_id
             LEFT JOIN users u ON u.id = sm.created_by
             ${where}
             ORDER BY sm.created_at DESC
             LIMIT 250`,
            params
        );

        res.json(rows);
    } catch (error) {
        console.error("GET movements error:", error);
        res.status(500).json({ error: "Failed to load stock movements" });
    }
});

router.post("/", requireRole("admin", "warehouse"), async function (req, res) {
    const connection = await db.getConnection();

    try {
        const {
            productId,
            warehouseId,
            movementType,
            quantity,
            note
        } = req.body;

        if (!productId || !warehouseId || !movementType) {
            return res.status(400).json({ error: "Product, warehouse and movement type are required" });
        }

        if (!["receipt", "issue", "adjustment_in", "adjustment_out"].includes(movementType)) {
            return res.status(400).json({ error: "Invalid movement type" });
        }

        await connection.beginTransaction();

        const movementId = await applyMovement(connection, {
            productId,
            warehouseId,
            type: movementType,
            quantity,
            note,
            userId: req.user.id
        });

        await connection.commit();

        res.status(201).json({ success: true, movementId });
    } catch (error) {
        await connection.rollback();
        console.error("POST movement error:", error);
        res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : "Failed to post stock movement"
        });
    } finally {
        connection.release();
    }
});

router.post("/transfer", requireRole("admin", "warehouse"), async function (req, res) {
    const connection = await db.getConnection();

    try {
        const {
            productId,
            sourceWarehouseId,
            destinationWarehouseId,
            quantity,
            note
        } = req.body;

        if (!productId || !sourceWarehouseId || !destinationWarehouseId) {
            return res.status(400).json({
                error: "Product, source warehouse and destination warehouse are required"
            });
        }

        if (sourceWarehouseId === destinationWarehouseId) {
            return res.status(400).json({
                error: "Source and destination warehouses must be different"
            });
        }

        const transferId = crypto.randomUUID();

        await connection.beginTransaction();

        const outId = await applyMovement(connection, {
            productId,
            warehouseId: sourceWarehouseId,
            type: "transfer_out",
            quantity,
            note,
            userId: req.user.id,
            referenceType: "transfer",
            referenceId: transferId
        });

        const inId = await applyMovement(connection, {
            productId,
            warehouseId: destinationWarehouseId,
            type: "transfer_in",
            quantity,
            note,
            userId: req.user.id,
            referenceType: "transfer",
            referenceId: transferId
        });

        await connection.commit();

        res.status(201).json({
            success: true,
            transferId,
            movementIds: [outId, inId]
        });
    } catch (error) {
        await connection.rollback();
        console.error("POST transfer error:", error);
        res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : "Failed to transfer stock"
        });
    } finally {
        connection.release();
    }
});

module.exports = router;
