const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../database");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole("admin"));

router.get("/users", async function (req, res) {
    try {
        const [rows] = await db.query(
            `SELECT
                id,
                name,
                email,
                role,
                status,
                created_at AS createdAt,
                updated_at AS updatedAt
             FROM users
             ORDER BY created_at DESC`
        );

        res.json(rows);
    } catch (error) {
        console.error("GET users error:", error);
        res.status(500).json({ error: "Failed to load users" });
    }
});

router.post("/users", async function (req, res) {
    try {
        const { name, email, role, status, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                error: "Name, email and password are required"
            });
        }

        if (!["admin", "warehouse", "purchasing"].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const [[minSetting]] = await db.query(
            `SELECT setting_value AS value
             FROM app_settings
             WHERE setting_key = 'minimum_password_length'
             LIMIT 1`
        );

        const minimumPasswordLength = Number(minSetting?.value || 8);

        if (password.length < minimumPasswordLength) {
            return res.status(400).json({
                error: `Password must contain at least ${minimumPasswordLength} characters`
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await db.query(
            `INSERT INTO users (
                id,
                name,
                email,
                password_hash,
                role,
                status
             )
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                crypto.randomUUID(),
                name.trim(),
                email.trim().toLowerCase(),
                passwordHash,
                role,
                status === "inactive" ? "inactive" : "active"
            ]
        );

        res.status(201).json({ success: true });
    } catch (error) {
        console.error("POST user error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "Email already exists" });
        }

        res.status(500).json({ error: "Failed to create user" });
    }
});

router.put("/users/:id", async function (req, res) {
    try {
        const { name, email, role, status } = req.body;

        if (!name || !email || !role) {
            return res.status(400).json({
                error: "Name, email and role are required"
            });
        }

        if (!["admin", "warehouse", "purchasing"].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        if (req.params.id === req.user.id && status === "inactive") {
            return res.status(409).json({
                error: "You cannot deactivate your own account"
            });
        }

        const [result] = await db.query(
            `UPDATE users
             SET name = ?,
                 email = ?,
                 role = ?,
                 status = ?
             WHERE id = ?`,
            [
                name.trim(),
                email.trim().toLowerCase(),
                role,
                status === "inactive" ? "inactive" : "active",
                req.params.id
            ]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("PUT user error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "Email already exists" });
        }

        res.status(500).json({ error: "Failed to update user" });
    }
});

router.post("/users/:id/reset-password", async function (req, res) {
    try {
        const { password } = req.body;

        const [[minSetting]] = await db.query(
            `SELECT setting_value AS value
             FROM app_settings
             WHERE setting_key = 'minimum_password_length'
             LIMIT 1`
        );

        const minimumPasswordLength = Number(minSetting?.value || 8);

        if (!password || password.length < minimumPasswordLength) {
            return res.status(400).json({
                error: `Password must contain at least ${minimumPasswordLength} characters`
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await db.query(
            `UPDATE users
             SET password_hash = ?
             WHERE id = ?`,
            [passwordHash, req.params.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("POST reset password error:", error);
        res.status(500).json({ error: "Failed to reset password" });
    }
});

router.get("/settings", async function (req, res) {
    try {
        const [rows] = await db.query(
            `SELECT
                setting_key AS settingKey,
                setting_value AS settingValue,
                updated_at AS updatedAt
             FROM app_settings
             ORDER BY setting_key`
        );

        const settings = {};
        rows.forEach((row) => {
            settings[row.settingKey] = row.settingValue;
        });

        res.json(settings);
    } catch (error) {
        console.error("GET settings error:", error);
        res.status(500).json({ error: "Failed to load settings" });
    }
});

router.put("/settings", async function (req, res) {
    const connection = await db.getConnection();

    try {
        const allowed = {
            app_name: "StockFlow",
            default_currency: "CHF",
            minimum_password_length: "8",
            default_reorder_multiplier: "2"
        };

        await connection.beginTransaction();

        for (const [key, fallback] of Object.entries(allowed)) {
            const value = String(req.body[key] ?? fallback).trim();

            const [existing] = await connection.query(
                `SELECT setting_value
                 FROM app_settings
                 WHERE setting_key = ?
                 FOR UPDATE`,
                [key]
            );

            const oldValue = existing[0]?.setting_value ?? null;

            await connection.query(
                `INSERT INTO app_settings (
                    setting_key,
                    setting_value,
                    updated_by
                 )
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    setting_value = VALUES(setting_value),
                    updated_by = VALUES(updated_by)`,
                [key, value, req.user.id]
            );

            if (oldValue !== value) {
                await connection.query(
                    `INSERT INTO admin_audit (
                        id,
                        user_id,
                        action,
                        entity_type,
                        entity_id,
                        old_value,
                        new_value
                     )
                     VALUES (?, ?, 'settings_update', 'app_setting', ?, ?, ?)`,
                    [
                        crypto.randomUUID(),
                        req.user.id,
                        key,
                        oldValue,
                        value
                    ]
                );
            }
        }

        await connection.commit();

        res.json({ success: true });
    } catch (error) {
        await connection.rollback();
        console.error("PUT settings error:", error);
        res.status(500).json({ error: "Failed to save settings" });
    } finally {
        connection.release();
    }
});

router.get("/system-overview", async function (req, res) {
    try {
        const [[users]] = await db.query(
            `SELECT
                COUNT(*) AS totalUsers,
                SUM(status = 'active') AS activeUsers
             FROM users`
        );

        const [[products]] = await db.query(
            `SELECT
                COUNT(*) AS totalProducts,
                SUM(status = 'active') AS activeProducts
             FROM products`
        );

        const [[warehouses]] = await db.query(
            `SELECT
                COUNT(*) AS totalWarehouses,
                SUM(status = 'active') AS activeWarehouses
             FROM warehouses`
        );

        const [[database]] = await db.query(
            `SELECT
                DATABASE() AS databaseName,
                NOW() AS databaseTime,
                VERSION() AS databaseVersion`
        );

        const [audit] = await db.query(
            `SELECT
                aa.id,
                aa.action,
                aa.entity_type AS entityType,
                aa.entity_id AS entityId,
                aa.old_value AS oldValue,
                aa.new_value AS newValue,
                aa.created_at AS createdAt,
                u.name AS userName
             FROM admin_audit aa
             LEFT JOIN users u ON u.id = aa.user_id
             ORDER BY aa.created_at DESC
             LIMIT 50`
        );

        res.json({
            totalUsers: Number(users.totalUsers),
            activeUsers: Number(users.activeUsers || 0),
            totalProducts: Number(products.totalProducts),
            activeProducts: Number(products.activeProducts || 0),
            totalWarehouses: Number(warehouses.totalWarehouses),
            activeWarehouses: Number(warehouses.activeWarehouses || 0),
            databaseName: database.databaseName,
            databaseTime: database.databaseTime,
            databaseVersion: database.databaseVersion,
            audit
        });
    } catch (error) {
        console.error("GET system overview error:", error);
        res.status(500).json({ error: "Failed to load system overview" });
    }
});

module.exports = router;
