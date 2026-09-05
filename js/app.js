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
let suppliers = [];
let orders = [];
let currentOrderDetail = null;
let inventoryCounts = [];
let currentInventoryCount = null;

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
        loadSuppliers(),
        loadOrders(),
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
    orders: ["Purchase Orders", "Purchasing workflow"],
    inventory: ["Inventory Operations", "Physical counts, reorder suggestions and stock audit"]
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
        if (name === "suppliers") await loadSuppliers();
        if (name === "orders") await loadOrders();
        if (name === "inventory") await loadInventoryOperations();
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


/* SUPPLIERS */

async function loadSuppliers() {
    try {
        const response = await authFetch(`${API_URL}/suppliers`);
        suppliers = await readApi(response);
        renderSuppliers();
        fillPurchasingSelectors();
    } catch (error) {
        console.error(error);
    }
}

function renderSuppliers() {
    const container = $("supplierList");
    if (!container) return;

    if (!suppliers.length) {
        container.innerHTML = `<div class="empty-state">No suppliers found.</div>`;
        return;
    }

    container.innerHTML = suppliers.map((supplier) => `
        <div class="data-card">
            <div>
                <h3>${escapeHtml(supplier.companyName)}</h3>
                <p>${escapeHtml(supplier.contactName || "No contact")}</p>
                <div class="card-meta">
                    ${supplier.email ? `<span>${escapeHtml(supplier.email)}</span>` : ""}
                    ${supplier.phone ? `<span>${escapeHtml(supplier.phone)}</span>` : ""}
                    ${supplier.address ? `<span>${escapeHtml(supplier.address)}</span>` : ""}
                </div>
            </div>
            <div class="card-actions">
                <span class="badge ${escapeHtml(supplier.status)}">${escapeHtml(supplier.status)}</span>
                <button class="secondary-button" data-edit-supplier="${supplier.id}">Edit</button>
            </div>
        </div>
    `).join("");

    container.querySelectorAll("[data-edit-supplier]").forEach((button) => {
        button.addEventListener("click", () => editSupplier(button.dataset.editSupplier));
    });
}

$("addSupplierButton")?.addEventListener("click", () => {
    $("supplierForm").reset();
    $("supplierId").value = "";
    $("supplierStatus").value = "active";
    $("supplierModalTitle").textContent = "New Supplier";
    openModal("supplierModal");
});

function editSupplier(id) {
    const supplier = suppliers.find((item) => item.id === id);
    if (!supplier) return;

    $("supplierId").value = supplier.id;
    $("supplierCompanyName").value = supplier.companyName;
    $("supplierContactName").value = supplier.contactName || "";
    $("supplierEmail").value = supplier.email || "";
    $("supplierPhone").value = supplier.phone || "";
    $("supplierAddress").value = supplier.address || "";
    $("supplierStatus").value = supplier.status;
    $("supplierModalTitle").textContent = "Edit Supplier";

    openModal("supplierModal");
}

$("supplierForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = $("supplierId").value;
    const data = {
        companyName: $("supplierCompanyName").value.trim(),
        contactName: $("supplierContactName").value.trim(),
        email: $("supplierEmail").value.trim(),
        phone: $("supplierPhone").value.trim(),
        address: $("supplierAddress").value.trim(),
        status: $("supplierStatus").value
    };

    try {
        const response = await authFetch(
            id ? `${API_URL}/suppliers/${id}` : `${API_URL}/suppliers`,
            {
                method: id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            }
        );

        await readApi(response);
        closeModal("supplierModal");
        await loadSuppliers();
    } catch (error) {
        alert(error.message);
    }
});

/* PURCHASE ORDERS */

async function loadOrders() {
    try {
        const response = await authFetch(`${API_URL}/orders`);
        orders = await readApi(response);
        renderOrders();
    } catch (error) {
        console.error(error);
    }
}

function renderOrders() {
    const container = $("orderList");
    if (!container) return;

    if (!orders.length) {
        container.innerHTML = `<div class="empty-state">No purchase orders found.</div>`;
        return;
    }

    container.innerHTML = orders.map((order) => `
        <div class="data-card">
            <div>
                <h3>${escapeHtml(order.displayNo)}</h3>
                <p>${escapeHtml(order.supplierName)} · ${escapeHtml(order.warehouseCode)} - ${escapeHtml(order.warehouseName)}</p>
                <div class="card-meta">
                    <span>Items: ${order.itemCount}</span>
                    <span>Total: CHF ${Number(order.totalValue).toFixed(2)}</span>
                    ${order.orderDate ? `<span>Order: ${formatDateOnly(order.orderDate)}</span>` : ""}
                    ${order.expectedDate ? `<span>Expected: ${formatDateOnly(order.expectedDate)}</span>` : ""}
                </div>
            </div>
            <div class="card-actions">
                <span class="badge status-${escapeHtml(order.status)}">${escapeHtml(formatOrderStatus(order.status))}</span>
                <button class="secondary-button" data-open-order="${order.id}">Open</button>
            </div>
        </div>
    `).join("");

    container.querySelectorAll("[data-open-order]").forEach((button) => {
        button.addEventListener("click", () => openOrderDetail(button.dataset.openOrder));
    });
}

$("addOrderButton")?.addEventListener("click", () => {
    $("orderForm").reset();
    $("orderItemsEditor").innerHTML = "";
    $("orderDate").value = new Date().toISOString().slice(0, 10);
    fillPurchasingSelectors();
    addOrderItemRow();
    openModal("orderModal");
});

$("addOrderItemButton")?.addEventListener("click", addOrderItemRow);

function fillPurchasingSelectors() {
    if ($("orderSupplier")) {
        $("orderSupplier").innerHTML = suppliers
            .filter((item) => item.status === "active")
            .map((supplier) =>
                `<option value="${supplier.id}">${escapeHtml(supplier.companyName)}</option>`
            ).join("");
    }

    if ($("orderWarehouse")) {
        $("orderWarehouse").innerHTML = warehouses
            .filter((item) => item.status === "active")
            .map((warehouse) =>
                `<option value="${warehouse.id}">${escapeHtml(warehouse.code)} - ${escapeHtml(warehouse.name)}</option>`
            ).join("");
    }
}

function addOrderItemRow() {
    const wrapper = document.createElement("div");
    wrapper.className = "order-item-row";
    wrapper.innerHTML = `
        <div>
            <label>Product</label>
            <select class="po-product" required>
                ${products
                    .filter((item) => item.status === "active")
                    .map((product) =>
                        `<option value="${product.id}" data-price="${Number(product.purchasePrice)}">${escapeHtml(product.sku)} - ${escapeHtml(product.name)}</option>`
                    ).join("")}
            </select>
        </div>
        <div>
            <label>Quantity</label>
            <input class="po-quantity" type="number" min="0.001" step="0.001" value="1" required>
        </div>
        <div>
            <label>Unit price</label>
            <input class="po-price" type="number" min="0" step="0.01" value="0" required>
        </div>
        <div>
            <button type="button" class="danger-button remove-po-item">Remove</button>
        </div>
    `;

    const productSelect = wrapper.querySelector(".po-product");
    const priceInput = wrapper.querySelector(".po-price");

    function syncPrice() {
        const selected = productSelect.selectedOptions[0];
        priceInput.value = selected ? Number(selected.dataset.price || 0).toFixed(2) : "0.00";
    }

    productSelect.addEventListener("change", syncPrice);
    wrapper.querySelector(".remove-po-item").addEventListener("click", () => wrapper.remove());

    syncPrice();
    $("orderItemsEditor").appendChild(wrapper);
}

$("orderForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const rows = [...$("orderItemsEditor").querySelectorAll(".order-item-row")];

    const items = rows.map((row) => ({
        productId: row.querySelector(".po-product").value,
        quantityOrdered: Number(row.querySelector(".po-quantity").value),
        unitPrice: Number(row.querySelector(".po-price").value)
    }));

    if (!items.length) {
        alert("Add at least one item.");
        return;
    }

    try {
        const response = await authFetch(`${API_URL}/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                supplierId: $("orderSupplier").value,
                warehouseId: $("orderWarehouse").value,
                orderDate: $("orderDate").value || null,
                expectedDate: $("expectedDate").value || null,
                note: $("orderNote").value.trim(),
                items
            })
        });

        await readApi(response);
        closeModal("orderModal");
        await loadOrders();
    } catch (error) {
        alert(error.message);
    }
});

async function openOrderDetail(id) {
    try {
        const response = await authFetch(`${API_URL}/orders/${id}`);
        currentOrderDetail = await readApi(response);

        $("orderDetailTitle").textContent = currentOrderDetail.displayNo;
        $("orderDetailSubtitle").textContent =
            `${currentOrderDetail.supplierName} · ${currentOrderDetail.warehouseCode} - ${currentOrderDetail.warehouseName}`;

        renderOrderDetail();
        openModal("orderDetailModal");
    } catch (error) {
        alert(error.message);
    }
}

function renderOrderDetail() {
    const order = currentOrderDetail;
    if (!order) return;

    const total = order.items.reduce(
        (sum, item) => sum + Number(item.quantityOrdered) * Number(item.unitPrice),
        0
    );

    const canReceive = !["received", "cancelled"].includes(order.status);

    $("orderDetailContent").innerHTML = `
        <div class="order-summary-grid">
            <div class="summary-box">
                <span>Status</span>
                <strong>${escapeHtml(formatOrderStatus(order.status))}</strong>
            </div>
            <div class="summary-box">
                <span>Order date</span>
                <strong>${order.orderDate ? formatDateOnly(order.orderDate) : "—"}</strong>
            </div>
            <div class="summary-box">
                <span>Expected</span>
                <strong>${order.expectedDate ? formatDateOnly(order.expectedDate) : "—"}</strong>
            </div>
            <div class="summary-box">
                <span>Total</span>
                <strong>CHF ${total.toFixed(2)}</strong>
            </div>
        </div>

        <table class="order-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Ordered</th>
                    <th>Received</th>
                    <th>Remaining</th>
                    <th>Unit price</th>
                </tr>
            </thead>
            <tbody>
                ${order.items.map((item) => `
                    <tr>
                        <td>${escapeHtml(item.sku)} - ${escapeHtml(item.productName)}</td>
                        <td>${formatQuantity(item.quantityOrdered)} ${escapeHtml(item.unit)}</td>
                        <td>${formatQuantity(item.quantityReceived)} ${escapeHtml(item.unit)}</td>
                        <td>${formatQuantity(Number(item.quantityOrdered) - Number(item.quantityReceived))} ${escapeHtml(item.unit)}</td>
                        <td>CHF ${Number(item.unitPrice).toFixed(2)}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>

        ${canReceive ? `
            <div class="subsection-header">
                <h3>Receive stock</h3>
            </div>

            <div id="receiveItemsEditor">
                ${order.items.map((item) => {
                    const remaining = Math.max(0, Number(item.quantityOrdered) - Number(item.quantityReceived));
                    return `
                        <div class="receive-item-row">
                            <div>
                                <strong>${escapeHtml(item.sku)} - ${escapeHtml(item.productName)}</strong>
                                <div class="card-meta">
                                    <span>Remaining: ${formatQuantity(remaining)} ${escapeHtml(item.unit)}</span>
                                </div>
                            </div>
                            <div>
                                <label>Receive now</label>
                                <input class="receive-quantity"
                                       data-item-id="${item.id}"
                                       type="number"
                                       min="0"
                                       max="${remaining}"
                                       step="0.001"
                                       value="0">
                            </div>
                            <div></div>
                        </div>
                    `;
                }).join("")}
            </div>

            <label for="receiveOrderNote">Receipt note</label>
            <textarea id="receiveOrderNote" placeholder="Delivery note, invoice reference, condition..."></textarea>

            <div class="modal-actions">
                ${order.status === "draft"
                    ? `<button class="secondary-button" id="markOrderOrderedButton">Mark Ordered</button>`
                    : ""}
                <button class="primary-button" id="receiveOrderButton">Receive Selected Stock</button>
            </div>
        ` : ""}

        <div class="subsection-header">
            <h3>Receipt history</h3>
        </div>

        <div class="data-list">
            ${order.receipts.length ? order.receipts.map((receipt) => `
                <div class="data-card">
                    <div>
                        <h3>${escapeHtml(receipt.productName)}</h3>
                        <p>${escapeHtml(receipt.sku)} · ${escapeHtml(receipt.warehouseCode)} - ${escapeHtml(receipt.warehouseName)}</p>
                        <div class="card-meta">
                            <span>Received: ${formatQuantity(receipt.quantity)} ${escapeHtml(receipt.unit)}</span>
                            <span>${formatDateTime(receipt.createdAt)}</span>
                            ${receipt.createdBy ? `<span>By: ${escapeHtml(receipt.createdBy)}</span>` : ""}
                            ${receipt.note ? `<span>${escapeHtml(receipt.note)}</span>` : ""}
                        </div>
                    </div>
                </div>
            `).join("") : `<div class="empty-state">No receipts yet.</div>`}
        </div>
    `;

    $("receiveOrderButton")?.addEventListener("click", receiveCurrentOrder);
    $("markOrderOrderedButton")?.addEventListener("click", () => setOrderStatus(order.id, "ordered"));
}

async function setOrderStatus(id, status) {
    try {
        const response = await authFetch(`${API_URL}/orders/${id}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
        });

        await readApi(response);
        await Promise.all([loadOrders(), openOrderDetail(id)]);
    } catch (error) {
        alert(error.message);
    }
}

async function receiveCurrentOrder() {
    const order = currentOrderDetail;
    const inputs = [...$("receiveItemsEditor").querySelectorAll(".receive-quantity")];

    const receipts = inputs
        .map((input) => ({
            itemId: input.dataset.itemId,
            quantity: Number(input.value || 0)
        }))
        .filter((item) => item.quantity > 0);

    if (!receipts.length) {
        alert("Enter a quantity for at least one item.");
        return;
    }

    try {
        const response = await authFetch(`${API_URL}/orders/${order.id}/receive`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                receipts,
                note: $("receiveOrderNote").value.trim()
            })
        });

        await readApi(response);

        await Promise.all([
            loadOrders(),
            loadProducts(),
            loadWarehouses(),
            loadDashboard(),
            loadMovements()
        ]);

        await openOrderDetail(order.id);
    } catch (error) {
        alert(error.message);
    }
}

function formatOrderStatus(status) {
    return {
        draft: "Draft",
        ordered: "Ordered",
        partially_received: "Partially Received",
        received: "Received",
        cancelled: "Cancelled"
    }[status] || status;
}

function formatDateOnly(value) {
    if (!value) return "";
    return String(value).slice(0, 10);
}


/* INVENTORY OPERATIONS */

async function loadInventoryOperations() {
    await Promise.all([
        loadInventoryCounts(),
        loadReorderSuggestions(),
        loadStockAudit()
    ]);
    fillInventoryWarehouseSelector();
}

document.querySelectorAll(".inventory-tab").forEach((button) => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".inventory-tab").forEach((item) =>
            item.classList.remove("active")
        );
        document.querySelectorAll(".inventory-panel").forEach((panel) =>
            panel.classList.remove("active")
        );

        button.classList.add("active");

        const tab = button.dataset.inventoryTab;
        if (tab === "counts") $("inventoryCountsPanel").classList.add("active");
        if (tab === "reorder") $("inventoryReorderPanel").classList.add("active");
        if (tab === "audit") $("inventoryAuditPanel").classList.add("active");
    });
});

async function loadInventoryCounts() {
    try {
        const response = await authFetch(`${API_URL}/inventory/counts`);
        inventoryCounts = await readApi(response);
        renderInventoryCounts();
    } catch (error) {
        console.error(error);
    }
}

function renderInventoryCounts() {
    const container = $("inventoryCountList");
    if (!container) return;

    if (!inventoryCounts.length) {
        container.innerHTML = `<div class="empty-state">No inventory counts yet.</div>`;
        return;
    }

    container.innerHTML = inventoryCounts.map((count) => `
        <div class="data-card">
            <div>
                <h3>${escapeHtml(count.displayNo)}</h3>
                <p>${escapeHtml(count.warehouseCode)} - ${escapeHtml(count.warehouseName)}</p>
                <div class="card-meta">
                    <span>Status: ${escapeHtml(formatInventoryStatus(count.status))}</span>
                    <span>Items: ${count.itemCount}</span>
                    <span>Discrepancies: ${count.discrepancyCount}</span>
                    <span>${formatDateTime(count.createdAt)}</span>
                </div>
            </div>
            <div class="card-actions">
                <span class="badge">${escapeHtml(formatInventoryStatus(count.status))}</span>
                <button class="secondary-button" data-open-count="${count.id}">Open</button>
            </div>
        </div>
    `).join("");

    container.querySelectorAll("[data-open-count]").forEach((button) => {
        button.addEventListener("click", () => openInventoryCount(button.dataset.openCount));
    });
}

$("newInventoryCountButton")?.addEventListener("click", () => {
    $("inventoryCountForm").reset();
    fillInventoryWarehouseSelector();
    openModal("inventoryCountModal");
});

function fillInventoryWarehouseSelector() {
    if (!$("inventoryWarehouse")) return;

    $("inventoryWarehouse").innerHTML = warehouses
        .filter((item) => item.status === "active")
        .map((warehouse) =>
            `<option value="${warehouse.id}">${escapeHtml(warehouse.code)} - ${escapeHtml(warehouse.name)}</option>`
        )
        .join("");
}

$("inventoryCountForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        const response = await authFetch(`${API_URL}/inventory/counts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                warehouseId: $("inventoryWarehouse").value,
                note: $("inventoryCountNote").value.trim()
            })
        });

        const data = await readApi(response);
        closeModal("inventoryCountModal");
        await loadInventoryCounts();
        await openInventoryCount(data.id);
    } catch (error) {
        alert(error.message);
    }
});

async function openInventoryCount(id) {
    try {
        const response = await authFetch(`${API_URL}/inventory/counts/${id}`);
        currentInventoryCount = await readApi(response);

        $("inventoryCountDetailTitle").textContent = currentInventoryCount.displayNo;
        $("inventoryCountDetailSubtitle").textContent =
            `${currentInventoryCount.warehouseCode} - ${currentInventoryCount.warehouseName}`;

        renderInventoryCountDetail();
        openModal("inventoryCountDetailModal");
    } catch (error) {
        alert(error.message);
    }
}

function renderInventoryCountDetail() {
    const count = currentInventoryCount;
    if (!count) return;

    const editable = count.status !== "completed";

    $("inventoryCountDetailContent").innerHTML = `
        <div class="order-summary-grid">
            <div class="summary-box">
                <span>Status</span>
                <strong>${escapeHtml(formatInventoryStatus(count.status))}</strong>
            </div>
            <div class="summary-box">
                <span>Created</span>
                <strong>${formatDateTime(count.createdAt)}</strong>
            </div>
            <div class="summary-box">
                <span>Completed</span>
                <strong>${count.completedAt ? formatDateTime(count.completedAt) : "—"}</strong>
            </div>
            <div class="summary-box">
                <span>Warehouse</span>
                <strong>${escapeHtml(count.warehouseCode)}</strong>
            </div>
        </div>

        <div class="count-grid header">
            <div>Product</div>
            <div>System</div>
            <div>Counted</div>
            <div>Difference</div>
        </div>

        <div id="inventoryCountRows">
            ${count.items.map((item) => {
                const diff = item.countedQuantity === null ? 0 : Number(item.countedQuantity) - Number(item.systemQuantity);
                const diffClass = diff > 0 ? "difference-positive" : diff < 0 ? "difference-negative" : "difference-zero";

                return `
                    <div class="count-grid">
                        <div>
                            <strong>${escapeHtml(item.sku)} - ${escapeHtml(item.productName)}</strong>
                            <div class="card-meta"><span>${escapeHtml(item.unit)}</span></div>
                        </div>
                        <div>${formatQuantity(item.systemQuantity)}</div>
                        <div>
                            ${editable
                                ? `<input class="counted-quantity"
                                          data-item-id="${item.id}"
                                          type="number"
                                          min="0"
                                          step="0.001"
                                          value="${item.countedQuantity === null ? "" : Number(item.countedQuantity)}"
                                          placeholder="Count">`
                                : formatQuantity(item.countedQuantity)}
                        </div>
                        <div class="${diffClass}">
                            ${item.countedQuantity === null ? "—" : (diff > 0 ? "+" : "") + formatQuantity(diff)}
                        </div>
                    </div>
                `;
            }).join("")}
        </div>

        ${editable ? `
            <div class="modal-actions">
                <button class="secondary-button" id="saveInventoryCountButton">Save Count</button>
                <button class="primary-button" id="completeInventoryCountButton">Complete & Apply Adjustments</button>
            </div>
        ` : ""}
    `;

    $("saveInventoryCountButton")?.addEventListener("click", saveInventoryCount);
    $("completeInventoryCountButton")?.addEventListener("click", completeInventoryCount);
}

async function saveInventoryCount() {
    const inputs = [...$("inventoryCountRows").querySelectorAll(".counted-quantity")];

    if (inputs.some((input) => input.value === "")) {
        alert("Enter a counted quantity for every product.");
        return false;
    }

    const items = inputs.map((input) => ({
        id: input.dataset.itemId,
        countedQuantity: Number(input.value)
    }));

    try {
        const response = await authFetch(
            `${API_URL}/inventory/counts/${currentInventoryCount.id}/items`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items })
            }
        );

        await readApi(response);
        await openInventoryCount(currentInventoryCount.id);
        return true;
    } catch (error) {
        alert(error.message);
        return false;
    }
}

async function completeInventoryCount() {
    const saved = await saveInventoryCount();
    if (!saved) return;

    if (!confirm("Complete this inventory count and apply all stock discrepancies?")) {
        return;
    }

    try {
        const response = await authFetch(
            `${API_URL}/inventory/counts/${currentInventoryCount.id}/complete`,
            { method: "POST" }
        );

        await readApi(response);

        await Promise.all([
            loadInventoryCounts(),
            loadProducts(),
            loadWarehouses(),
            loadDashboard(),
            loadMovements(),
            loadStockAudit(),
            loadReorderSuggestions()
        ]);

        await openInventoryCount(currentInventoryCount.id);
    } catch (error) {
        alert(error.message);
    }
}

async function loadReorderSuggestions() {
    try {
        const response = await authFetch(`${API_URL}/inventory/reorder-suggestions`);
        const rows = await readApi(response);
        const container = $("reorderSuggestionList");
        if (!container) return;

        if (!rows.length) {
            container.innerHTML = `<div class="empty-state">No reorder suggestions.</div>`;
            return;
        }

        container.innerHTML = rows.map((item) => `
            <div class="data-card">
                <div>
                    <h3>${escapeHtml(item.name)}</h3>
                    <p>${escapeHtml(item.sku)}</p>
                    <div class="card-meta">
                        <span>Current: ${formatQuantity(item.totalStock)} ${escapeHtml(item.unit)}</span>
                        <span>Reorder level: ${formatQuantity(item.reorderLevel)} ${escapeHtml(item.unit)}</span>
                        <span>Suggested: ${formatQuantity(item.suggestedQuantity)} ${escapeHtml(item.unit)}</span>
                        <span>Estimated value: CHF ${(Number(item.suggestedQuantity) * Number(item.purchasePrice)).toFixed(2)}</span>
                    </div>
                </div>
                <div class="card-actions">
                    <span class="badge low">Reorder</span>
                </div>
            </div>
        `).join("");
    } catch (error) {
        console.error(error);
    }
}

async function loadStockAudit() {
    try {
        const response = await authFetch(`${API_URL}/inventory/audit?limit=200`);
        const rows = await readApi(response);
        const container = $("stockAuditList");
        if (!container) return;

        if (!rows.length) {
            container.innerHTML = `<div class="empty-state">No stock audit entries.</div>`;
            return;
        }

        container.innerHTML = rows.map((row) => `
            <div class="data-card">
                <div>
                    <h3>${escapeHtml(row.productName)}</h3>
                    <p>${escapeHtml(row.sku)} · ${escapeHtml(row.warehouseCode)} - ${escapeHtml(row.warehouseName)}</p>
                    <div class="card-meta">
                        <span>${escapeHtml(formatMovementType(row.movementType))}</span>
                        <span>Qty: ${formatQuantity(row.quantity)} ${escapeHtml(row.unit)}</span>
                        <span>${formatDateTime(row.createdAt)}</span>
                        ${row.referenceType ? `<span>Ref: ${escapeHtml(row.referenceType)}</span>` : ""}
                        ${row.createdBy ? `<span>By: ${escapeHtml(row.createdBy)}</span>` : ""}
                    </div>
                </div>
            </div>
        `).join("");
    } catch (error) {
        console.error(error);
    }
}

function formatInventoryStatus(status) {
    return {
        draft: "Draft",
        in_progress: "In Progress",
        completed: "Completed"
    }[status] || status;
}
