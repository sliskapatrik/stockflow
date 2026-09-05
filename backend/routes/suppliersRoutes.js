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
                id,
                company_name AS companyName,
                contact_name AS contactName,
                email,
                phone,
                address,
                status,
                created_at AS createdAt,
                updated_at AS updatedAt
             FROM suppliers
             ORDER BY company_name`
        );

        res.json(rows);
    } catch (error) {
        console.error("GET suppliers error:", error);
        res.status(500).json({ error: "Failed to load suppliers" });
    }
});

router.post("/", requireRole("admin", "purchasing"), async function (req, res) {
    try {
        const {
            companyName,
            contactName,
            email,
            phone,
            address,
            status
        } = req.body;

        if (!companyName || !companyName.trim()) {
            return res.status(400).json({ error: "Company name is required" });
        }

        const id = crypto.randomUUID();

        await db.query(
            `INSERT INTO suppliers (
                id,
                company_name,
                contact_name,
                email,
                phone,
                address,
                status
             )
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                companyName.trim(),
                contactName?.trim() || null,
                email?.trim() || null,
                phone?.trim() || null,
                address?.trim() || null,
                status === "inactive" ? "inactive" : "active"
            ]
        );

        res.status(201).json({ success: true, id });
    } catch (error) {
        console.error("POST supplier error:", error);
        res.status(500).json({ error: "Failed to create supplier" });
    }
});

router.put("/:id", requireRole("admin", "purchasing"), async function (req, res) {
    try {
        const {
            companyName,
            contactName,
            email,
            phone,
            address,
            status
        } = req.body;

        if (!companyName || !companyName.trim()) {
            return res.status(400).json({ error: "Company name is required" });
        }

        const [result] = await db.query(
            `UPDATE suppliers
             SET company_name = ?,
                 contact_name = ?,
                 email = ?,
                 phone = ?,
                 address = ?,
                 status = ?
             WHERE id = ?`,
            [
                companyName.trim(),
                contactName?.trim() || null,
                email?.trim() || null,
                phone?.trim() || null,
                address?.trim() || null,
                status === "inactive" ? "inactive" : "active",
                req.params.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Supplier not found" });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("PUT supplier error:", error);
        res.status(500).json({ error: "Failed to update supplier" });
    }
});

module.exports = router;
