const isLocalFrontend =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost";

const isBackendPort =
    window.location.port === "3100";

const API_URL =
    isLocalFrontend && !isBackendPort
        ? "http://localhost:3100/api"
        : "/api";

let authToken = localStorage.getItem("stockflowToken");
let currentUser = null;
let products = [];
let warehouses = [];
let movements = [];

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
    })[char]);
}

async function authFetch(url, options = {}) {
    const headers = { ...(options.headers || {}) };

    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        localStorage.removeItem("stockflowToken");
        authToken = null;
        currentUser = null;
        showLogin();
        throw new Error("Session expired. Please sign in again.");
    }

    return response;
}

async function readApi(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}

async function login(email, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const data = await readApi(response);

    authToken = data.token;
    currentUser = data.user;

    localStorage.setItem("stockflowToken", authToken);
}

async function loadCurrentUser() {
    if (!authToken) return false;

    try {
        const response = await authFetch(`${API_URL}/auth/me`);
        currentUser = await readApi(response);
        return true;
    } catch (error) {
        return false;
    }
}

function showLogin() {
    $("loginScreen").classList.remove("hidden");
    $("app").style.display = "none";
}

async function showApp() {
    $("loginScreen").classList.add("hidden");
    $("app").style.display = "block";

    $("currentUserName").textContent = currentUser.name;
    $("currentUserRole").textContent = currentUser.role;

    await Promise.all([
        loadProducts(),
        loadWarehouses(),
        loadDashboard()
    ]);
}

$("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("loginError").textContent = "";

    try {
        await login(
            $("loginEmail").value.trim(),
            $("loginPassword").value
        );
        await showApp();
    } catch (error) {
        $("loginError").textContent = error.message;
    }
});

$("logoutButton").addEventListener("click", () => {
    localStorage.removeItem("stockflowToken");
    authToken = null;
    currentUser = null;
    showLogin();
});

const viewTitles = {
    dashboard: ["Dashboard", "Inventory overview"],
    products: ["Products", "Product catalogue and stock"],
    warehouses: ["Warehouses", "Storage locations"],
    movements: ["Stock Movements", "Receipts, issues, adjustments and transfers"],
    suppliers: ["Suppliers", "Supplier directory"],
    orders: ["Purchase Orders", "Purchasing workflow"]
};

document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", async () => {
        const name = button.dataset.view;

        document.querySelectorAll(".view").forEach((view) =>
            view.classList.remove("active-view")
        );

        document.querySelectorAll(".nav-item").forEach((item) =>
            item.classList.remove("active")
        );

        $(`${name}View`).classList.add("active-view");
        button.classList.add("active");

        $("pageTitle").textContent = viewTitles[name][0];
        $("pageSubtitle").textContent = viewTitles[name][1];

        if (name === "dashboard") await loadDashboard();
        if (name === "products") await loadProducts();
        if (name === "warehouses") await loadWarehouses();
        if (name === "movements") await loadMovements();
    });
});

function openModal(id) {
    $(id).classList.add("open");
    document.body.classList.add("modal-open");
}

function closeModal(id) {
    $(id).classList.remove("open");

    if (!document.querySelector(".modal.open")) {
        document.body.classList.remove("modal-open");
    }
}

document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.closeModal));
});

document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal(modal.id);
    });
});

/* DASHBOARD */

async function loadDashboard() {
    try {
        const response = await authFetch(`${API_URL}/dashboard`);
        const data = await readApi(response);

        $("statProducts").textContent = data.totalProducts;
        $("statStock").textContent = formatQuantity(data.totalStock);
        $("statLowStock").textContent = data.lowStock;
        $("statWarehouses").textContent = data.totalWarehouses;

        const container = $("lowStockList");

        if (!data.lowStockItems.length) {
            container.innerHTML = `<div class="empty-state">No low-stock products.</div>`;
            return;
        }

        container.innerHTML = data.lowStockItems.map((item) => `
            <div class="data-card">
                <div>
                    <h3>${escapeHtml(item.name)}</h3>
                    <p>${escapeHtml(item.sku)}</p>
                    <div class="card-meta">
                        <span>Stock: ${formatQuantity(item.totalStock)} ${escapeHtml(item.unit)}</span>
                        <span>Reorder level: ${formatQuantity(item.reorderLevel)} ${escapeHtml(item.unit)}</span>
                    </div>
                </div>
                <div class="card-actions">
                    <span class="badge low">Low stock</span>
                </div>
            </div>
        `).join("");
    } catch (error) {
        console.error(error);
    }
}

/* PRODUCTS */

async function loadProducts() {
    try {
        const search = $("productSearch")?.value.trim() || "";
        const response = await authFetch(
            `${API_URL}/products?search=${encodeURIComponent(search)}`
        );

        products = await readApi(response);
        renderProducts();
        fillMovementSelectors();
    } catch (error) {
        console.error(error);
    }
}

function renderProducts() {
    const container = $("productList");

    if (!products.length) {
        container.innerHTML = `<div class="empty-state">No products found.</div>`;
        return;
    }

    container.innerHTML = products.map((product) => {
        const low = Number(product.reorderLevel) > 0 &&
            Number(product.totalStock) <= Number(product.reorderLevel);

        return `
            <div class="data-card">
                <div>
                    <h3>${escapeHtml(product.name)}</h3>
                    <p>${escapeHtml(product.sku)}${product.barcode ? ` · ${escapeHtml(product.barcode)}` : ""}</p>
                    <div class="card-meta">
                        <span>Stock: ${formatQuantity(product.totalStock)} ${escapeHtml(product.unit)}</span>
                        <span>Reorder: ${formatQuantity(product.reorderLevel)} ${escapeHtml(product.unit)}</span>
                        <span>Purchase: CHF ${Number(product.purchasePrice).toFixed(2)}</span>
                    </div>
                </div>

                <div class="card-actions">
                    ${low ? `<span class="badge low">Low stock</span>` : ""}
                    <span class="badge ${escapeHtml(product.status)}">${escapeHtml(product.status)}</span>
                    <button class="secondary-button" data-edit-product="${product.id}">Edit</button>
                    ${currentUser.role === "admin"
                        ? `<button class="danger-button" data-delete-product="${product.id}">Delete</button>`
                        : ""}
                </div>
            </div>
        `;
    }).join("");

    container.querySelectorAll("[data-edit-product]").forEach((button) => {
        button.addEventListener("click", () => editProduct(button.dataset.editProduct));
    });

    container.querySelectorAll("[data-delete-product]").forEach((button) => {
        button.addEventListener("click", () => deleteProduct(button.dataset.deleteProduct));
    });
}

$("productSearch").addEventListener("input", () => {
    clearTimeout(window.__productSearchTimer);
    window.__productSearchTimer = setTimeout(loadProducts, 250);
});

$("addProductButton").addEventListener("click", () => {
    $("productForm").reset();
    $("productId").value = "";
    $("productUnit").value = "pcs";
    $("productPurchasePrice").value = "0";
    $("productReorderLevel").value = "0";
    $("productStatus").value = "active";
    $("productModalTitle").textContent = "New Product";
    openModal("productModal");
});

function editProduct(id) {
    const product = products.find((item) => item.id === id);
    if (!product) return;

    $("productId").value = product.id;
    $("productSku").value = product.sku;
    $("productBarcode").value = product.barcode || "";
    $("productName").value = product.name;
    $("productDescription").value = product.description || "";
    $("productUnit").value = product.unit;
    $("productPurchasePrice").value = product.purchasePrice;
    $("productReorderLevel").value = product.reorderLevel;
    $("productStatus").value = product.status;
    $("productModalTitle").textContent = "Edit Product";

    openModal("productModal");
}

$("productForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = $("productId").value;

    const data = {
        sku: $("productSku").value.trim(),
        barcode: $("productBarcode").value.trim(),
        name: $("productName").value.trim(),
        description: $("productDescription").value.trim(),
        unit: $("productUnit").value.trim(),
        purchasePrice: Number($("productPurchasePrice").value || 0),
        reorderLevel: Number($("productReorderLevel").value || 0),
        status: $("productStatus").value
    };

    try {
        const response = await authFetch(
            id ? `${API_URL}/products/${id}` : `${API_URL}/products`,
            {
                method: id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            }
        );

        await readApi(response);
        closeModal("productModal");
        await Promise.all([loadProducts(), loadDashboard()]);
    } catch (error) {
        alert(error.message);
    }
});

async function deleteProduct(id) {
    if (!confirm("Delete this product? Products with stock history cannot be deleted.")) {
        return;
    }

    try {
        const response = await authFetch(`${API_URL}/products/${id}`, {
            method: "DELETE"
        });

        await readApi(response);
        await Promise.all([loadProducts(), loadDashboard()]);
    } catch (error) {
        alert(error.message);
    }
}

/* WAREHOUSES */

async function loadWarehouses() {
    try {
        const response = await authFetch(`${API_URL}/warehouses`);
        warehouses = await readApi(response);
        renderWarehouses();
        fillMovementSelectors();
        fillMovementFilter();
    } catch (error) {
        console.error(error);
    }
}

function renderWarehouses() {
    const container = $("warehouseList");

    if (!warehouses.length) {
        container.innerHTML = `<div class="empty-state">No warehouses found.</div>`;
        return;
    }

    container.innerHTML = warehouses.map((warehouse) => `
        <div class="data-card">
            <div>
                <h3>${escapeHtml(warehouse.name)}</h3>
                <p>${escapeHtml(warehouse.code)}${warehouse.address ? ` · ${escapeHtml(warehouse.address)}` : ""}</p>
                <div class="card-meta">
                    <span>Products: ${warehouse.productCount}</span>
                    <span>Total quantity: ${formatQuantity(warehouse.totalQuantity)}</span>
                </div>
            </div>

            <div class="card-actions">
                <span class="badge ${escapeHtml(warehouse.status)}">${escapeHtml(warehouse.status)}</span>
                ${currentUser.role === "admin"
                    ? `<button class="secondary-button" data-edit-warehouse="${warehouse.id}">Edit</button>`
                    : ""}
            </div>
        </div>
    `).join("");

    container.querySelectorAll("[data-edit-warehouse]").forEach((button) => {
        button.addEventListener("click", () => editWarehouse(button.dataset.editWarehouse));
    });
}

$("addWarehouseButton").addEventListener("click", () => {
    $("warehouseForm").reset();
    $("warehouseId").value = "";
    $("warehouseStatus").value = "active";
    $("warehouseModalTitle").textContent = "New Warehouse";
    openModal("warehouseModal");
});

function editWarehouse(id) {
    const warehouse = warehouses.find((item) => item.id === id);
    if (!warehouse) return;

    $("warehouseId").value = warehouse.id;
    $("warehouseCode").value = warehouse.code;
    $("warehouseName").value = warehouse.name;
    $("warehouseAddress").value = warehouse.address || "";
    $("warehouseStatus").value = warehouse.status;
    $("warehouseModalTitle").textContent = "Edit Warehouse";

    openModal("warehouseModal");
}

$("warehouseForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = $("warehouseId").value;

    const data = {
        code: $("warehouseCode").value.trim(),
        name: $("warehouseName").value.trim(),
        address: $("warehouseAddress").value.trim(),
        status: $("warehouseStatus").value
    };

    try {
        const response = await authFetch(
            id ? `${API_URL}/warehouses/${id}` : `${API_URL}/warehouses`,
            {
                method: id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            }
        );

        await readApi(response);
        closeModal("warehouseModal");
        await Promise.all([loadWarehouses(), loadDashboard()]);
    } catch (error) {
        alert(error.message);
    }
});

/* MOVEMENTS */

async function loadMovements() {
    try {
        const params = new URLSearchParams();

        if ($("movementWarehouseFilter").value) {
            params.set("warehouseId", $("movementWarehouseFilter").value);
        }

        if ($("movementTypeFilter").value) {
            params.set("type", $("movementTypeFilter").value);
        }

        const response = await authFetch(`${API_URL}/movements?${params.toString()}`);
        movements = await readApi(response);
        renderMovements();
    } catch (error) {
        console.error(error);
    }
}

function renderMovements() {
    const container = $("movementList");

    if (!movements.length) {
        container.innerHTML = `<div class="empty-state">No stock movements found.</div>`;
        return;
    }

    container.innerHTML = movements.map((movement) => `
        <div class="data-card">
            <div>
                <h3>${escapeHtml(movement.productName)}</h3>
                <p>${escapeHtml(movement.sku)} · ${escapeHtml(movement.warehouseCode)} - ${escapeHtml(movement.warehouseName)}</p>
                <div class="card-meta">
                    <span>${escapeHtml(formatMovementType(movement.movementType))}</span>
                    <span>Quantity: ${formatQuantity(movement.quantity)} ${escapeHtml(movement.unit)}</span>
                    <span>${formatDateTime(movement.createdAt)}</span>
                    ${movement.createdBy ? `<span>By: ${escapeHtml(movement.createdBy)}</span>` : ""}
                    ${movement.note ? `<span>Note: ${escapeHtml(movement.note)}</span>` : ""}
                </div>
            </div>

            <div class="card-actions">
                <span class="badge">${escapeHtml(formatMovementType(movement.movementType))}</span>
            </div>
        </div>
    `).join("");
}

$("addMovementButton").addEventListener("click", () => {
    $("movementForm").reset();
    $("movementType").value = "receipt";
    $("destinationWarehouseWrap").classList.add("hidden");
    fillMovementSelectors();
    openModal("movementModal");
});

$("movementType").addEventListener("change", () => {
    const transfer = $("movementType").value === "transfer";
    $("destinationWarehouseWrap").classList.toggle("hidden", !transfer);
    $("destinationWarehouse").required = transfer;
});

$("movementWarehouseFilter").addEventListener("change", loadMovements);
$("movementTypeFilter").addEventListener("change", loadMovements);

$("movementForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const type = $("movementType").value;
    const quantity = Number($("movementQuantity").value);

    try {
        let response;

        if (type === "transfer") {
            response = await authFetch(`${API_URL}/movements/transfer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId: $("movementProduct").value,
                    sourceWarehouseId: $("movementWarehouse").value,
                    destinationWarehouseId: $("destinationWarehouse").value,
                    quantity,
                    note: $("movementNote").value.trim()
                })
            });
        } else {
            response = await authFetch(`${API_URL}/movements`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId: $("movementProduct").value,
                    warehouseId: $("movementWarehouse").value,
                    movementType: type,
                    quantity,
                    note: $("movementNote").value.trim()
                })
            });
        }

        await readApi(response);

        closeModal("movementModal");

        await Promise.all([
            loadMovements(),
            loadProducts(),
            loadWarehouses(),
            loadDashboard()
        ]);
    } catch (error) {
        alert(error.message);
    }
});

function fillMovementSelectors() {
    if (!$("movementProduct") || !$("movementWarehouse")) return;

    const activeProducts = products.filter((item) => item.status === "active");
    const activeWarehouses = warehouses.filter((item) => item.status === "active");

    $("movementProduct").innerHTML = activeProducts.map((product) =>
        `<option value="${product.id}">${escapeHtml(product.sku)} - ${escapeHtml(product.name)}</option>`
    ).join("");

    const warehouseOptions = activeWarehouses.map((warehouse) =>
        `<option value="${warehouse.id}">${escapeHtml(warehouse.code)} - ${escapeHtml(warehouse.name)}</option>`
    ).join("");

    $("movementWarehouse").innerHTML = warehouseOptions;
    $("destinationWarehouse").innerHTML = warehouseOptions;
}

function fillMovementFilter() {
    const current = $("movementWarehouseFilter").value;

    $("movementWarehouseFilter").innerHTML =
        `<option value="">All warehouses</option>` +
        warehouses.map((warehouse) =>
            `<option value="${warehouse.id}">${escapeHtml(warehouse.code)} - ${escapeHtml(warehouse.name)}</option>`
        ).join("");

    if ([...$("movementWarehouseFilter").options].some((opt) => opt.value === current)) {
        $("movementWarehouseFilter").value = current;
    }
}

function formatQuantity(value) {
    return Number(value || 0).toLocaleString(undefined, {
        maximumFractionDigits: 3
    });
}

function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatMovementType(type) {
    return {
        receipt: "Receipt",
        issue: "Issue",
        adjustment_in: "Adjustment In",
        adjustment_out: "Adjustment Out",
        transfer_in: "Transfer In",
        transfer_out: "Transfer Out"
    }[type] || type;
}

async function start() {
    const valid = await loadCurrentUser();

    if (valid) {
        await showApp();
    } else {
        showLogin();
    }
}

start();
