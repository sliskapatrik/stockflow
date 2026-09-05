require("dotenv").config();

const path =
    require("path");

const express =
    require("express");

const cors =
    require("cors");

const helmet =
    require("helmet");

const db =
    require("./database");

const authRoutes =
    require("./authRoutes");

const app =
    express();

const PORT =
    process.env.PORT || 3100;

app.set(
    "trust proxy",
    1
);

app.disable(
    "x-powered-by"
);

app.use(
    helmet({
        contentSecurityPolicy:
            false
    })
);

app.use(
    cors()
);

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    "/api/auth",
    authRoutes
);

app.get(
    "/health",
    async function (req, res) {
        try {
            await db.query(
                "SELECT 1"
            );

            res.json({
                status: "ok",
                database:
                    "connected"
            });
        } catch (error) {
            res.status(503).json({
                status:
                    "error",
                database:
                    "disconnected"
            });
        }
    }
);

app.get(
    "/api/status",
    function (req, res) {
        res.json({
            success: true,
            message:
                "StockFlow backend is online"
        });
    }
);

const frontendPath =
    path.join(__dirname, "..");

app.use(
    express.static(
        frontendPath
    )
);

app.use(
    function (req, res, next) {
        if (
            req.method === "GET" &&
            !req.path.startsWith(
                "/api/"
            ) &&
            req.path !== "/health"
        ) {
            return res.sendFile(
                path.join(
                    frontendPath,
                    "index.html"
                )
            );
        }

        next();
    }
);

app.listen(
    PORT,
    function () {
        console.log(
            `StockFlow running on http://localhost:${PORT}`
        );
    }
);
