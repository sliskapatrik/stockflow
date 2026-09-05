require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const db = require("./database");
const authRoutes = require("./authRoutes");
const productsRoutes = require("./routes/productsRoutes");
const warehousesRoutes = require("./routes/warehousesRoutes");
const movementsRoutes = require("./routes/movementsRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const suppliersRoutes = require("./routes/suppliersRoutes");
const ordersRoutes = require("./routes/ordersRoutes");

const app = express();
const PORT = process.env.PORT || 3100;

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
    helmet({
        contentSecurityPolicy: false
    })
);

app.use(cors());

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use("/api/auth", authRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/warehouses", warehousesRoutes);
app.use("/api/movements", movementsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/orders", ordersRoutes);

app.get("/health", async function (req, res) {
    try {
        await db.query("SELECT 1");

        res.json({
            status: "ok",
            database: "connected",
            version: "0.3.0"
        });
    } catch (error) {
        res.status(503).json({
            status: "error",
            database: "disconnected",
            version: "0.3.0"
        });
    }
});

app.get("/api/status", function (req, res) {
    res.json({
        success: true,
        message: "StockFlow backend is online",
        version: "0.3.0"
    });
});

const frontendPath = path.join(__dirname, "..");

app.use(express.static(frontendPath));

app.use(function (req, res, next) {
    if (
        req.method === "GET" &&
        !req.path.startsWith("/api/") &&
        req.path !== "/health"
    ) {
        return res.sendFile(path.join(frontendPath, "index.html"));
    }

    next();
});

app.use("/api", function (req, res) {
    res.status(404).json({ error: "API endpoint not found" });
});

app.listen(PORT, function () {
    console.log(`StockFlow v0.3 running on http://localhost:${PORT}`);
});
