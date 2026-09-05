require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("./database");

async function resetAdminPassword() {
    try {
        const email =
            "admin@stockflow.local";

        const newPassword =
            "ChangeMe123!";

        const passwordHash =
            await bcrypt.hash(
                newPassword,
                12
            );

        const [result] =
            await db.query(
                `
                UPDATE users
                SET
                    password_hash = ?,
                    role = 'admin',
                    status = 'active'
                WHERE email = ?
                `,
                [
                    passwordHash,
                    email
                ]
            );

        if (
            result.affectedRows === 0
        ) {
            console.log(
                "Admin account was not found."
            );
        } else {
            console.log(
                "StockFlow admin password reset successfully."
            );

            console.log(
                "Email:",
                email
            );

            console.log(
                "Password:",
                newPassword
            );
        }

    } catch (error) {
        console.error(
            "Could not reset admin password:",
            error
        );
    } finally {
        await db.end();
    }
}

resetAdminPassword();