const express = require("express");
const crypto = require("crypto");
const db = require("../database");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authenticateToken);

function formatOrderNo(value) {
    return `PO-${String(value).padStart(6, "0")}`;
}

router.get("/", async function (req, res) {
    try {
        const [rows] = await db.query(
            `SELECT
                po.id,
                po.order_no AS orderNo,
                po.status,
                po.order_date AS orderDate,
                po.expected_date AS expectedDate,
                po.note,
                po.created_at AS createdAt,
                po.updated_at AS updatedAt,
                s.id AS supplierId,
                s.company_name AS supplierName,
                w.id AS warehouseId,
                w.code AS warehouseCode,
                w.name AS warehouseName,
                u.name AS createdBy,
                COUNT(poi.id) AS itemCount,
                COALESCE(SUM(poi.quantity_ordered * poi.unit_price), 0) AS totalValue
             FROM purchase_orders po
             INNER JOIN suppliers s ON s.id = po.supplier_id
             INNER JOIN warehouses w ON w.id = po.warehouse_id
             LEFT JOIN users u ON u.id = po.created_by
             LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
             GROUP BY po.id
             ORDER BY po.created_at DESC`
        );

        res.json(rows.map((row) => ({
            ...row,
            displayNo: formatOrderNo(row.orderNo)
        })));
    } catch (error) {
        console.error("GET purchase orders error:", error);
        res.status(500).json({ error: "Failed to load purchase orders" });
    }
});

router.get("/:id", async function (req, res) {
    try {
        const [orders] = await db.query(
            `SELECT
                po.id,
                po.order_no AS orderNo,
                po.status,
                po.order_date AS orderDate,
                po.expected_date AS expectedDate,
                po.note,
                po.created_at AS createdAt,
                po.updated_at AS updatedAt,
                s.id AS supplierId,
                s.company_name AS supplierName,
                w.id AS warehouseId,
                w.code AS warehouseCode,
                w.name AS warehouseName
             FROM purchase_orders po
             INNER JOIN suppliers s ON s.id = po.supplier_id
             INNER JOIN warehouses w ON w.id = po.warehouse_id
             WHERE po.id = ?
             LIMIT 1`,
            [req.params.id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: "Purchase order not found" });
        }

        const [items] = await db.query(
            `SELECT
                poi.id,
                poi.product_id AS productId,
                p.sku,
                p.name AS productName,
                p.unit,
                poi.quantity_ordered AS quantityOrdered,
                poi.quantity_received AS quantityReceived,
                poi.unit_price AS unitPrice
             FROM purchase_order_items poi
             INNER JOIN products p ON p.id = poi.product_id
             WHERE poi.purchase_order_id = ?
             ORDER BY p.name`,
            [req.params.id]
        );

        const [receipts] = await db.query(
            `SELECT
                sm.id,
                sm.quantity,
                sm.created_at AS createdAt,
                sm.note,
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
             WHERE sm.reference_type = 'purchase_order'
               AND sm.reference_id = ?
               AND sm.movement_type = 'receipt'
             ORDER BY sm.created_at DESC`,
            [req.params.id]
        );

        res.json({
            ...orders[0],
            displayNo: formatOrderNo(orders[0].orderNo),
            items,
            receipts
        });
    } catch (error) {
        console.error("GET purchase order detail error:", error);
        res.status(500).json({ error: "Failed to load purchase order" });
    }
});

router.post("/", requireRole("admin", "purchasing"), async function (req, res) {
    const connection = await db.getConnection();

    try {
        const {
            supplierId,
            warehouseId,
            orderDate,
            expectedDate,
            note,
            items
        } = req.body;

        if (!supplierId || !warehouseId) {
            return res.status(400).json({ error: "Supplier and warehouse are required" });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "At least one purchase order item is required" });
        }

        for (const item of items) {
            if (!item.productId || Number(item.quantityOrdered) <= 0 || Number(item.unitPrice) < 0) {
                return res.status(400).json({ error: "Invalid purchase order item" });
            }
        }

        const id = crypto.randomUUID();

        await connection.beginTransaction();

        await connection.query(
            `INSERT INTO purchase_orders (
                id,
                supplier_id,
                warehouse_id,
                status,
                order_date,
                expected_date,
                note,
                created_by
             )
             VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`,
            [
                id,
                supplierId,
                warehouseId,
                orderDate || null,
                expectedDate || null,
                note?.trim() || null,
                req.user.id
            ]
        );

        for (const item of items) {
            await connection.query(
                `INSERT INTO purchase_order_items (
                    id,
                    purchase_order_id,
                    product_id,
                    quantity_ordered,
                    quantity_received,
                    unit_price
                 )
                 VALUES (?, ?, ?, ?, 0, ?)`,
                [
                    crypto.randomUUID(),
                    id,
                    item.productId,
                    Number(item.quantityOrdered),
                    Number(item.unitPrice)
                ]
            );
        }

        await connection.commit();

        res.status(201).json({ success: true, id });
    } catch (error) {
        await connection.rollback();
        console.error("POST purchase order error:", error);
        res.status(500).json({ error: "Failed to create purchase order" });
    } finally {
        connection.release();
    }
});

router.put("/:id/status", requireRole("admin", "purchasing"), async function (req, res) {
    try {
        const status = String(req.body.status || "");

        if (!["draft", "ordered", "partially_received", "received", "cancelled"].includes(status)) {
            return res.status(400).json({ error: "Invalid purchase order status" });
        }

        const [result] = await db.query(
            `UPDATE purchase_orders
             SET status = ?
             WHERE id = ?`,
            [status, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Purchase order not found" });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("PUT purchase order status error:", error);
        res.status(500).json({ error: "Failed to update purchase order status" });
    }
});

router.post("/:id/receive", requireRole("admin", "warehouse", "purchasing"), async function (req, res) {
    const connection = await db.getConnection();

    try {
        const { receipts, note } = req.body;

        if (!Array.isArray(receipts) || receipts.length === 0) {
            return res.status(400).json({ error: "Receipt items are required" });
        }

        await connection.beginTransaction();

        const [orders] = await connection.query(
            `SELECT id, warehouse_id AS warehouseId, status
             FROM purchase_orders
             WHERE id = ?
             FOR UPDATE`,
            [req.params.id]
        );

        if (orders.length === 0) {
            throw Object.assign(new Error("Purchase order not found"), { statusCode: 404 });
        }

        if (orders[0].status === "cancelled" || orders[0].status === "received") {
            throw Object.assign(new Error("This purchase order cannot receive more stock"), { statusCode: 409 });
        }

        for (const receipt of receipts) {
            const quantity = Number(receipt.quantity);

            if (!Number.isFinite(quantity) || quantity < 0) {
                throw Object.assign(new Error("Receipt quantity must be zero or greater"), { statusCode: 400 });
            }

            if (quantity === 0) continue;

            const [items] = await connection.query(
                `SELECT
                    id,
                    product_id AS productId,
                    quantity_ordered AS quantityOrdered,
                    quantity_received AS quantityReceived
                 FROM purchase_order_items
                 WHERE id = ?
                   AND purchase_order_id = ?
                 FOR UPDATE`,
                [receipt.itemId, req.params.id]
            );

            if (items.length === 0) {
                throw Object.assign(new Error("Purchase order item not found"), { statusCode: 404 });
            }

            const item = items[0];
            const remaining = Number(item.quantityOrdered) - Number(item.quantityReceived);

            if (quantity > remaining) {
                throw Object.assign(
                    new Error(`Cannot receive more than remaining quantity (${remaining})`),
                    { statusCode: 409 }
                );
            }

            await connection.query(
                `INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
                 VALUES (?, ?, 0)
                 ON DUPLICATE KEY UPDATE quantity = quantity`,
                [orders[0].warehouseId, item.productId]
            );

            const [stockRows] = await connection.query(
                `SELECT quantity
                 FROM warehouse_stock
                 WHERE warehouse_id = ?
                   AND product_id = ?
                 FOR UPDATE`,
                [orders[0].warehouseId, item.productId]
            );

            const newStock = Number(stockRows[0].quantity) + quantity;

            await connection.query(
                `UPDATE warehouse_stock
                 SET quantity = ?
                 WHERE warehouse_id = ?
                   AND product_id = ?`,
                [newStock, orders[0].warehouseId, item.productId]
            );

            await connection.query(
                `UPDATE purchase_order_items
                 SET quantity_received = quantity_received + ?
                 WHERE id = ?`,
                [quantity, item.id]
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
                 VALUES (?, ?, ?, 'receipt', ?, 'purchase_order', ?, ?, ?)`,
                [
                    crypto.randomUUID(),
                    item.productId,
                    orders[0].warehouseId,
                    quantity,
                    req.params.id,
                    note?.trim() || null,
                    req.user.id
                ]
            );
        }

        const [[summary]] = await connection.query(
            `SELECT
                SUM(quantity_ordered) AS orderedTotal,
                SUM(quantity_received) AS receivedTotal
             FROM purchase_order_items
             WHERE purchase_order_id = ?`,
            [req.params.id]
        );

        let nextStatus = "ordered";

        if (Number(summary.receivedTotal) > 0 &&
            Number(summary.receivedTotal) < Number(summary.orderedTotal)) {
            nextStatus = "partially_received";
        } else if (Number(summary.receivedTotal) >= Number(summary.orderedTotal)) {
            nextStatus = "received";
        }

        await connection.query(
            `UPDATE purchase_orders
             SET status = ?
             WHERE id = ?`,
            [nextStatus, req.params.id]
        );

        await connection.commit();

        res.json({ success: true, status: nextStatus });
    } catch (error) {
        await connection.rollback();
        console.error("POST purchase order receive error:", error);
        res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : "Failed to receive purchase order"
        });
    } finally {
        connection.release();
    }
});

module.exports = router;
