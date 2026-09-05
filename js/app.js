const API_URL =
    window.location.protocol === "file:"
        ? "http://localhost:3100/api"
        : "/api";

let authToken =
    localStorage.getItem("stockflowToken");

let currentUser = null;

const $ = (id) =>
    document.getElementById(id);

async function authFetch(url, options = {}) {
    const headers = {
        ...(options.headers || {})
    };

    if (authToken) {
        headers.Authorization =
            `Bearer ${authToken}`;
    }

    return fetch(url, {
        ...options,
        headers
    });
}

async function login(email, password) {
    const response =
        await fetch(
            `${API_URL}/auth/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body:
                    JSON.stringify({
                        email,
                        password
                    })
            }
        );

    const data =
        await response.json();

    if (!response.ok) {
        throw new Error(
            data.error || "Login failed"
        );
    }

    authToken = data.token;
    currentUser = data.user;

    localStorage.setItem(
        "stockflowToken",
        authToken
    );
}

async function loadCurrentUser() {
    if (!authToken) {
        return false;
    }

    try {
        const response =
            await authFetch(
                `${API_URL}/auth/me`
            );

        if (!response.ok) {
            throw new Error(
                "Invalid session"
            );
        }

        currentUser =
            await response.json();

        return true;
    } catch (error) {
        localStorage.removeItem(
            "stockflowToken"
        );

        authToken = null;
        currentUser = null;

        return false;
    }
}

function showLogin() {
    $("loginScreen")
        .classList
        .remove("hidden");

    $("app").style.display =
        "none";
}

function showApp() {
    $("loginScreen")
        .classList
        .add("hidden");

    $("app").style.display =
        "block";

    $("currentUserName")
        .textContent =
        currentUser.name;

    $("currentUserRole")
        .textContent =
        currentUser.role;
}

$("loginForm")
    .addEventListener(
        "submit",
        async function (event) {
            event.preventDefault();

            $("loginError")
                .textContent = "";

            try {
                await login(
                    $("loginEmail")
                        .value
                        .trim(),
                    $("loginPassword")
                        .value
                );

                showApp();
            } catch (error) {
                $("loginError")
                    .textContent =
                    error.message;
            }
        }
    );

$("logoutButton")
    .addEventListener(
        "click",
        function () {
            localStorage.removeItem(
                "stockflowToken"
            );

            authToken = null;
            currentUser = null;

            showLogin();
        }
    );

const viewTitles = {
    dashboard: [
        "Dashboard",
        "Inventory overview"
    ],
    products: [
        "Products",
        "Product catalogue"
    ],
    warehouses: [
        "Warehouses",
        "Storage locations"
    ],
    movements: [
        "Stock Movements",
        "Inventory transactions"
    ],
    suppliers: [
        "Suppliers",
        "Supplier directory"
    ],
    orders: [
        "Purchase Orders",
        "Purchasing workflow"
    ]
};

document
    .querySelectorAll(".nav-item")
    .forEach((button) => {
        button.addEventListener(
            "click",
            function () {
                const name =
                    button.dataset.view;

                document
                    .querySelectorAll(".view")
                    .forEach((view) =>
                        view.classList.remove(
                            "active-view"
                        )
                    );

                document
                    .querySelectorAll(
                        ".nav-item"
                    )
                    .forEach((item) =>
                        item.classList.remove(
                            "active"
                        )
                    );

                $(`${name}View`)
                    .classList
                    .add("active-view");

                button.classList.add(
                    "active"
                );

                $("pageTitle")
                    .textContent =
                    viewTitles[name][0];

                $("pageSubtitle")
                    .textContent =
                    viewTitles[name][1];
            }
        );
    });

async function start() {
    const valid =
        await loadCurrentUser();

    if (valid) {
        showApp();
    } else {
        showLogin();
    }
}

start();
