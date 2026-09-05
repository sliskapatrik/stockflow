require("dotenv").config();

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("./database");

async function createAdmin() {
    try {
        const name = "StockFlow Admin";
        const email = "admin@stockflow.local";
        const password = "ChangeMe123!";

        const passwordHash = await bcrypt.hash(password, 12);

        await db.query(
            `INSERT INTO users (
                id, name, email, password_hash, role, status
             )
             VALUES (?, ?, ?, ?, 'admin', 'active')`,
            [crypto.randomUUID(), name, email, passwordHash]
        );

        console.log("StockFlow admin created.");
        console.log("Email:", email);
        console.log("Temporary password:", password);
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            console.log("StockFlow admin already exists.");
        } else {
            console.error("Could not create admin:", error);
        }
    } finally {
        await db.end();
    }
}

createAdmin();
