const express = require("express");
const db = require("../database");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole("admin", "purchasing"));

router.get("/overview", async function (req, res) {
    try {
        const [[stockValue]] = await db.query(
            `SELECT
                COALESCE(SUM(ws.quantity * p.purchase_price), 0) AS stockValue,
                COALESCE(SUM(ws.quantity), 0) AS totalQuantity
             FROM warehouse_stock ws
             INNER JOIN products p ON p.id = ws.product_id
             WHERE p.status = 'active'`
        );

        const [[poStats]] = await db.query(
            `SELECT
                COUNT(*) AS totalOrders,
                SUM(status IN ('draft','ordered','partially_received')) AS openOrders,
                SUM(status = 'received') AS receivedOrders,
                COALESCE(SUM(
                    CASE
                        WHEN status <> 'cancelled'
                        THEN poi_total.totalValue
                        ELSE 0
                    END
                ), 0) AS purchasingValue
             FROM purchase_orders po
             LEFT JOIN (
                SELECT
                    purchase_order_id,
                    SUM(quantity_ordered * unit_price) AS totalValue
                FROM purchase_order_items
                GROUP BY purchase_order_id
             ) poi_total ON poi_total.purchase_order_id = po.id`
        );

        const [[supplierStats]] = await db.query(
            `SELECT
                COUNT(*) AS totalSuppliers,
                SUM(status = 'active') AS activeSuppliers
             FROM suppliers`
        );

        const [warehouseValues] = await db.query(
            `SELECT
                w.id,
                w.code,
                w.name,
                COALESCE(SUM(ws.quantity), 0) AS totalQuantity,
                COALESCE(SUM(ws.quantity * p.purchase_price), 0) AS stockValue
             FROM warehouses w
             LEFT JOIN warehouse_stock ws ON ws.warehouse_id = w.id
             LEFT JOIN products p ON p.id = ws.product_id
             GROUP BY w.id
             ORDER BY stockValue DESC`
        );

        res.json({
            stockValue: Number(stockValue.stockValue),
            totalQuantity: Number(stockValue.totalQuantity),
            totalOrders: Number(poStats.totalOrders || 0),
            openOrders: Number(poStats.openOrders || 0),
            receivedOrders: Number(poStats.receivedOrders || 0),
            purchasingValue: Number(poStats.purchasingValue || 0),
            totalSuppliers: Number(supplierStats.totalSuppliers || 0),
            activeSuppliers: Number(supplierStats.activeSuppliers || 0),
            warehouseValues
        });
    } catch (error) {
        console.error("GET reports overview error:", error);
        res.status(500).json({ error: "Failed to load reporting overview" });
    }
});

router.get("/movements", async function (req, res) {
    try {
        const {
            warehouseId = "",
            type = "",
            from = "",
            to = ""
        } = req.query;

        let where = "WHERE 1 = 1";
        const params = [];

        if (warehouseId) {
            where += " AND sm.warehouse_id = ?";
            params.push(warehouseId);
        }

        if (type) {
            where += " AND sm.movement_type = ?";
            params.push(type);
        }

        if (from) {
            where += " AND sm.created_at >= ?";
            params.push(`${from} 00:00:00`);
        }

        if (to) {
            where += " AND sm.created_at <= ?";
            params.push(`${to} 23:59:59`);
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
             ${where}
             ORDER BY sm.created_at DESC
             LIMIT 1000`,
            params
        );

        res.json(rows);
    } catch (error) {
        console.error("GET movement report error:", error);
        res.status(500).json({ error: "Failed to load movement report" });
    }
});

router.get("/suppliers", async function (req, res) {
    try {
        const [rows] = await db.query(
            `SELECT
                s.id,
                s.company_name AS companyName,
                s.status,
                COUNT(DISTINCT po.id) AS orderCount,
                COALESCE(SUM(
                    CASE WHEN po.status <> 'cancelled'
                         THEN poi.quantity_ordered * poi.unit_price
                         ELSE 0
                    END
                ), 0) AS orderedValue,
                COALESCE(SUM(
                    CASE WHEN po.status = 'received'
                         THEN poi.quantity_received * poi.unit_price
                         ELSE 0
                    END
                ), 0) AS receivedValue
             FROM suppliers s
             LEFT JOIN purchase_orders po ON po.supplier_id = s.id
             LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
             GROUP BY s.id
             ORDER BY orderedValue DESC, s.company_name`
        );

        res.json(rows);
    } catch (error) {
        console.error("GET supplier report error:", error);
        res.status(500).json({ error: "Failed to load supplier report" });
    }
});

router.get("/purchasing", async function (req, res) {
    try {
        const [rows] = await db.query(
            `SELECT
                po.id,
                po.order_no AS orderNo,
                po.status,
                po.order_date AS orderDate,
                po.expected_date AS expectedDate,
                s.company_name AS supplierName,
                w.code AS warehouseCode,
                COALESCE(SUM(poi.quantity_ordered * poi.unit_price), 0) AS totalValue,
                COALESCE(SUM(poi.quantity_received * poi.unit_price), 0) AS receivedValue
             FROM purchase_orders po
             INNER JOIN suppliers s ON s.id = po.supplier_id
             INNER JOIN warehouses w ON w.id = po.warehouse_id
             LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
             GROUP BY po.id
             ORDER BY po.created_at DESC
             LIMIT 500`
        );

        res.json(rows.map((row) => ({
            ...row,
            displayNo: `PO-${String(row.orderNo).padStart(6, "0")}`
        })));
    } catch (error) {
        console.error("GET purchasing report error:", error);
        res.status(500).json({ error: "Failed to load purchasing report" });
    }
});

router.get("/export/movements.csv", async function (req, res) {
    try {
        const [rows] = await db.query(
            `SELECT
                sm.created_at AS createdAt,
                sm.movement_type AS movementType,
                p.sku,
                p.name AS productName,
                w.code AS warehouseCode,
                sm.quantity,
                p.unit,
                sm.reference_type AS referenceType,
                sm.reference_id AS referenceId,
                sm.note,
                u.name AS createdBy
             FROM stock_movements sm
             INNER JOIN products p ON p.id = sm.product_id
             INNER JOIN warehouses w ON w.id = sm.warehouse_id
             LEFT JOIN users u ON u.id = sm.created_by
             ORDER BY sm.created_at DESC`
        );

        const escapeCsv = (value) => {
            const str = String(value ?? "");
            return `"${str.replace(/"/g, '""')}"`;
        };

        const header = [
            "Created At",
            "Movement Type",
            "SKU",
            "Product",
            "Warehouse",
            "Quantity",
            "Unit",
            "Reference Type",
            "Reference ID",
            "Note",
            "Created By"
        ].map(escapeCsv).join(",");

        const lines = rows.map((row) => [
            row.createdAt,
            row.movementType,
            row.sku,
            row.productName,
            row.warehouseCode,
            row.quantity,
            row.unit,
            row.referenceType,
            row.referenceId,
            row.note,
            row.createdBy
        ].map(escapeCsv).join(","));

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="stockflow-movements.csv"');
        res.send([header, ...lines].join("\n"));
    } catch (error) {
        console.error("GET movement CSV error:", error);
        res.status(500).json({ error: "Failed to export movement CSV" });
    }
});

module.exports = router;
