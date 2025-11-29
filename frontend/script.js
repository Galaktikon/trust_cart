/************************************************************ 
 * TrustCart - Frontend Logic (Auth + Products + Plaid Link)
 * Authorization: Bearer <supabase_jwt>
 *
 * Backend endpoints used:
 *  - GET  /test
 *  - POST /create_link_token
 *  - POST /exchange_public_token
 ************************************************************/

// Backend for Plaid endpoints, test endpoint, etc.
const API_BASE_URL = "https://trust-cart-backend.onrender.com";

// Supabase Configuration (public anon key is OK in frontend)
const SUPABASE_URL = "https://semkimaoxlmxtyhlhada.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlbWtpbWFveGxteHR5aGxoYWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMjMyNzIsImV4cCI6MjA3ODg5OTI3Mn0.RaOsVMI2UQULkWCYgJGntpNpndaqM1HIi4XHOkJb9kY";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Plaid state
let plaidInitialized = false;
let plaidHandler = null;

/************************************************************
 * Main script
 ************************************************************/

document.addEventListener("DOMContentLoaded", async () => {
  /* =======================================================
   *  DOM ELEMENTS
   * ======================================================= */

  // High-level sections for auth gating
  const authSection = document.getElementById("authSection");
  const dashboardSection = document.getElementById("dashboard");
  const logoutBtn = document.getElementById("logoutBtn");

  // Nav buttons for sub-views
  const navHomeBtn = document.getElementById("navHomeBtn");
  const navMarketplaceBtn = document.getElementById("navMarketplaceBtn");
  const navDashboardBtn = document.getElementById("navDashboardBtn");
  const navCartBtn = document.getElementById("navCartBtn");
  const navSellBtn = document.getElementById("navSellBtn");

  // Sub-view containers inside #dashboard
  const dashboardView = document.getElementById("dashboardView");
  const cartView = document.getElementById("cartView");
  const sellView = document.getElementById("sellView");
  const marketplaceSection = document.getElementById("marketplaceSection");

  // Home widget buttons
  const homeWidgetLinks = document.querySelectorAll(".home-widget-link");

  // Auth forms / fields
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const showRegister = document.getElementById("showRegister");
  const showLogin = document.getElementById("showLogin");

  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");

  const regName = document.getElementById("regName");
  const regEmail = document.getElementById("regEmail");
  const regPassword = document.getElementById("regPassword");

  // Dashboard elements
  const bankSection = document.getElementById("bank");
  const linkButton = document.getElementById("link-bank-btn");

  const merchantProductsList = document.getElementById("merchantProducts");
  const statTotalProducts = document.getElementById("statTotalProducts");
  const statTotalValue = document.getElementById("statTotalValue");
  const statTotalOrders = document.getElementById("statTotalOrders");

  const uploadForm = document.getElementById("uploadItemForm");
  const itemTitle = document.getElementById("itemTitle");
  const itemPrice = document.getElementById("itemPrice");
  const itemDescription = document.getElementById("itemDescription");
  const itemImage = document.getElementById("itemImage");

  // Track login state (for nav protection)
  let isLoggedIn = false;

  /* =======================================================
   *  HELPERS
   * ======================================================= */

  function showToast(message, type = "info") {
    const box = document.createElement("div");
    box.textContent = message;
    box.style.position = "fixed";
    box.style.top = "20px";
    box.style.right = "20px";
    box.style.padding = "12px 18px";
    box.style.borderRadius = "10px";
    box.style.fontSize = "14px";
    box.style.zIndex = "9999";
    box.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    box.style.transform = "translateY(0)";

    if (type === "success") {
      box.style.background = "#4ade80";
      box.style.color = "#064e3b";
    } else if (type === "error") {
      box.style.background = "#f87171";
      box.style.color = "#fff";
    } else {
      box.style.background = "#e5e7eb";
      box.style.color = "#111827";
    }

    document.body.appendChild(box);

    setTimeout(() => {
      box.style.opacity = "0";
      box.style.transform = "translateY(-10px)";
      setTimeout(() => box.remove(), 300);
    }, 2000);
  }

  function isValidEmail(email) {
    return /\S+@\S+\.\S+/.test(email);
  }

  function isValidPassword(pass) {
    return pass.length >= 6;
  }

  /**
   * Switch between Dashboard / Cart / Sell inside #dashboard.
   * Also used for "home" (alias of dashboard) and "marketplace".
   */
  function setDashboardSubView(view) {
    if (!dashboardSection) return;

    // Hide all sub-views (we only have one view container (dashboardView)
    // plus cartView / sellView; marketplace lives inside dashboardView)
    if (dashboardView) dashboardView.classList.remove("hidden");
    if (cartView) cartView.classList.add("hidden");
    if (sellView) sellView.classList.add("hidden");

    // Reset nav pills
    [navHomeBtn, navMarketplaceBtn, navDashboardBtn, navCartBtn, navSellBtn].forEach(
      (btn) => {
        if (!btn) return;
        btn.classList.remove("active");
        btn.classList.add("faded");
      }
    );

    if (view === "cart" && cartView) {
      // Cart subview
      dashboardView.classList.add("hidden");
      cartView.classList.remove("hidden");
      if (navCartBtn) {
        navCartBtn.classList.add("active");
        navCartBtn.classList.remove("faded");
      }
    } else if (view === "sell" && sellView) {
      // Sell subview
      dashboardView.classList.add("hidden");
      sellView.classList.remove("hidden");
      if (navSellBtn) {
        navSellBtn.classList.add("active");
        navSellBtn.classList.remove("faded");
      }
    } else if (view === "marketplace") {
      // Marketplace lives inside dashboardView, so keep dashboardView visible
      if (dashboardView) dashboardView.classList.remove("hidden");
      if (navMarketplaceBtn) {
        navMarketplaceBtn.classList.add("active");
        navMarketplaceBtn.classList.remove("faded");
      }
      // Scroll to marketplace section inside dashboard
      if (marketplaceSection) {
        marketplaceSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else if (view === "home") {
      // "Home" is just the top of dashboardView with widgets
      if (dashboardView) dashboardView.classList.remove("hidden");
      if (navHomeBtn) {
        navHomeBtn.classList.add("active");
        navHomeBtn.classList.remove("faded");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // default: dashboard metrics view
      if (dashboardView) dashboardView.classList.remove("hidden");
      if (navDashboardBtn) {
        navDashboardBtn.classList.add("active");
        navDashboardBtn.classList.remove("faded");
      }
      dashboardView.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /**
   * Simple UI mode helpers:
   *  - showAuthUI(): only login/register visible
   *  - showDashboardUI(): only dashboard visible
   */
  function showAuthUI() {
    isLoggedIn = false;
    if (authSection) authSection.classList.remove("hidden");
    if (dashboardSection) dashboardSection.classList.add("hidden");
    if (logoutBtn) logoutBtn.classList.add("hidden");

    // Reset subview state
    setDashboardSubView("dashboard");
  }

  function showDashboardUI() {
    isLoggedIn = true;
    if (authSection) authSection.classList.add("hidden");
    if (dashboardSection) dashboardSection.classList.remove("hidden");
    if (logoutBtn) logoutBtn.classList.remove("hidden");

    // Default: land on dashboard (metrics) plus widgets visible at top
    setDashboardSubView("dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /**
   * Get Authorization headers for talking to the FastAPI backend.
   */
  async function getAuthHeaders(f) {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error("Error getting session:", error);
      throw new Error("Could not get auth session");
    }
    const token = data?.session?.access_token;
    if (!token) {
      throw new Error("No active auth token; user is not logged in");
    }
    if (f) {
      return {
        Authorization: `Bearer ${token}`,
      };
    } else {
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    }
  }

  /**
   * Generic helper to call your FastAPI backend with auth.
   */
  async function callBackend(endpoint, f, { method = "GET", body = null } = {}) {
    const headers = await getAuthHeaders(f);

    const opts = { method, headers };

    if (body instanceof FormData) {
      // Remove content-type if getAuthHeaders added it
      if (opts.headers["Content-Type"]) {
        delete opts.headers["Content-Type"];
      }
      opts.body = body;  // send FormData as-is
    } else if (body != null) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(`${API_BASE_URL}${endpoint}`, opts);

    let json;
    try {
      json = await res.json();
    } catch (e) {
      const text = await res.text();
      throw new Error(
        `Backend ${endpoint} returned non-JSON. Status ${res.status}. Body: ${text}`
      );
    }

    if (!res.ok) {
      console.error(`Backend error on ${endpoint}:`, res.status, json);
      throw new Error(
        `Backend ${endpoint} failed with status ${res.status}: ${
          json.detail || json.message || JSON.stringify(json)
        }`
      );
    }

    return { json, res };
  }

  // Called whenever auth succeeds (login OR already logged in OR sign-up with session)
  async function onAuthSuccess(user) {
    if (!user) return;

    // Switch UI into "dashboard" mode
    showDashboardUI();

    const displayName =
      user.user_metadata?.full_name || user.email || "Merchant";

    showToast(`Welcome, ${displayName}`, "success");

    // Show the bank / payouts section (Plaid integration)
    if (bankSection) {
      bankSection.classList.remove("hidden");
    }

    // Initialize Plaid (only once)
    if (linkButton && !plaidInitialized) {
      await initPlaidLink();
    }

    // Load merchant's products + analytics
    await loadUserData(user);
  }

  async function logoutUser() {
    await supabaseClient.auth.signOut();
    showAuthUI();
    showToast("Logged out", "success");
    setTimeout(() => window.location.reload(), 500);
  }

  // Expose logout for navbar button
  window.trustcartLogout = logoutUser;

  /* =======================================================
   *  NAV BUTTON HANDLERS (Home / Marketplace / Dashboard / Cart / Sell)
   * ======================================================= */

  if (navHomeBtn) {
    navHomeBtn.addEventListener("click", () => {
      if (!isLoggedIn) {
        showToast("Log in to access your workspace.", "error");
        return;
      }
      setDashboardSubView("home");
    });
  }

  if (navMarketplaceBtn) {
    navMarketplaceBtn.addEventListener("click", () => {
      if (!isLoggedIn) {
        showToast("Log in to access the marketplace.", "error");
        return;
      }
      setDashboardSubView("marketplace");
    });
  }

  if (navDashboardBtn) {
    navDashboardBtn.addEventListener("click", () => {
      if (!isLoggedIn) {
        showToast("Log in to access your dashboard.", "error");
        return;
      }
      setDashboardSubView("dashboard");
    });
  }

  if (navCartBtn) {
    navCartBtn.addEventListener("click", () => {
      if (!isLoggedIn) {
        showToast("Log in to view your cart.", "error");
        return;
      }
      setDashboardSubView("cart");
    });
  }

  if (navSellBtn) {
    navSellBtn.addEventListener("click", () => {
      if (!isLoggedIn) {
        showToast("Log in to list products for sale.", "error");
        return;
      }
      setDashboardSubView("sell");
    });
  }

  // Home widget shortcuts
  if (homeWidgetLinks && homeWidgetLinks.length > 0) {
    homeWidgetLinks.forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view || "dashboard";
        if (!isLoggedIn) {
          showToast("Log in to use this section.", "error");
          return;
        }
        setDashboardSubView(view);
      });
    });
  }

  /* =======================================================
   *  CHECK IF USER ALREADY LOGGED IN (ON PAGE LOAD)
   * ======================================================= */

  try {
    const { data } = await supabaseClient.auth.getUser();
    if (data?.user) {
      await onAuthSuccess(data.user);
    } else {
      showAuthUI();
    }
  } catch (err) {
    console.error("Error checking current user:", err);
    showAuthUI();
  }

  /* =======================================================
   *  TOGGLE LOGIN / REGISTER FORMS
   * ======================================================= */

  if (showRegister && showLogin && loginForm && registerForm) {
    showRegister.addEventListener("click", (e) => {
      e.preventDefault();
      loginForm.classList.add("hidden");
      registerForm.classList.remove("hidden");
    });

    showLogin.addEventListener("click", (e) => {
      e.preventDefault();
      registerForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
    });
  }

  /* =======================================================
   *  LOGIN HANDLER
   * ======================================================= */

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = (loginEmail?.value || "").trim();
      const password = (loginPassword?.value || "").trim();

      if (!isValidEmail(email)) {
        showToast("Enter a valid email", "error");
        return;
      }
      if (!isValidPassword(password)) {
        showToast("Password must be at least 6 characters", "error");
        return;
      }

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error(error);
        showToast(error.message || "Login failed", "error");
        return;
      }

      showToast("Logged in!", "success");

      // Prefer user from response, fall back to getUser()
      const userFromData = data?.user || data?.session?.user;
      if (userFromData) {
        await onAuthSuccess(userFromData);
      } else {
        const { data: userData } = await supabaseClient.auth.getUser();
        await onAuthSuccess(userData?.user);
      }

      var loginBody = { 
        id: userFromData.id,
        description: "Store" };

      try {
        const { json } = await callBackend("/login", false, { method: "POST" , body: JSON.stringify(loginBody) });
        console.log("Backend /login response:", JSON.stringify(json, null, 2));
      } catch (err) {
        console.error("Error calling /login endpoint:", err);
      }
    });
  }

  /* =======================================================
   *  REGISTER HANDLER (Sign up → then connect bank)
   * ======================================================= */

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = (regName?.value || "").trim();
      const email = (regEmail?.value || "").trim();
      const password = (regPassword?.value || "").trim();

      if (name.length < 2) {
        showToast("Enter your full name", "error");
        return;
      }
      if (!isValidEmail(email)) {
        showToast("Enter a valid email", "error");
        return;
      }
      if (!isValidPassword(password)) {
        showToast("Password must be at least 6 characters", "error");
        return;
      }

      const { data: signupData, error: signupErr } =
        await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });

      if (signupErr) {
        console.error(signupErr);
        showToast(signupErr.message || "Sign-up failed", "error");
        return;
      }

      showToast("Account created! Check your email to verify.", "success");
      console.log("Sign-up data:", signupData);

      // If Supabase auto-logs in (depends on your auth settings), call onAuthSuccess
      if (signupData?.session?.user) {
        await onAuthSuccess(signupData.session.user);
      }

      const { data, error } = await supabaseClient
        .from("users")
        .select("id")
        .eq("email", email)
        .single();

      if (data) {
        console.log("User already exists in 'users' table:", data);
        
      } else {
        const { data, error } = await supabaseClient
          .from("users")
          .insert({
            id: signupData.user.id,
            role: "customer",
            display_name: name,
            email: email,
          });
      }

      if (error) {
        console.error("Error inserting user:", error);
      } else {
        console.log("Inserted user:", data);
      }

      registerForm.reset();
      registerForm.classList.add("hidden");
      if (loginForm) loginForm.classList.remove("hidden");
    });
  }

  /* =======================================================
   *  SIMPLE "ADD TO CART" BUTTON FEEDBACK (prototype)
   * ======================================================= */

  var productCards = document.querySelectorAll(".market-card");
  productCards.forEach((card) => {
    card.addEventListener("click", async () => {
      // Extract info from this card
      const title = card.querySelector(".market-title")?.textContent.trim();
      const meta = card.querySelector(".market-meta")?.textContent.trim();
      const price = card.querySelector(".market-price")?.textContent.trim();

      console.log("Clicked product:", { title, meta, price });

      const { data: userData, error: userErr } =
        await supabaseClient.auth.getUser();
      const user = userData?.user;

      var addCartBody = { 
        user_id: user.id,
        title: title };

      try {
        const { json } = await callBackend("/add_to_cart", false, { method: "POST" , body: JSON.stringify(addCartBody) });
        console.log("Backend /add_to_cart response:", JSON.stringify(json, null, 2));
      } catch (err) {
        console.error("Error calling /add_to_cart endpoint:", err);
      }

      // Show toast
      showToast(`Added "${title}" to cart (demo)`, "success");
      await loadUserData(user);

    });
  });

  /* =======================================================
   *  USER PRODUCT UPLOAD (Image + Row in "products" table)
   * ======================================================= */

  if (uploadForm) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // 1. Ensure user is logged in
      const { data: userData, error: userErr } =
        await supabaseClient.auth.getUser();
      const user = userData?.user;

      if (userErr || !user) {
        showToast("You must be logged in to upload items", "error");
        return;
      }

      // 2. Get form values
      const title = (itemTitle?.value || "").trim();
      const price = parseFloat(itemPrice?.value || "0");
      const description = (itemDescription?.value || "").trim();
      const file = itemImage?.files?.[0];

      if (!title || !file || isNaN(price) || price < 0) {
        showToast("Please fill out all required fields correctly", "error");
        return;
      }

      try {
        // 3. Upload image to Supabase Storage
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const filePath = fileName;
        console.log("Title:", title);
        console.log("Price:", price);
        console.log("Description:", description);
        console.log("File:", file);
        console.log("File path:", filePath);

        const formData = new FormData();
        formData.append("user_id", user.id);
        formData.append("title", title);
        formData.append("price", price);
        formData.append("description", description);
        formData.append("filePath", filePath);
        formData.append("file", file);

        try {
          const { json } = await callBackend("/create_item", true,{ method: "POST" , body: formData });
          console.log("Backend /create_item response:", JSON.stringify(json, null, 2));
        } catch (err) {
          console.error("Error calling /create_item endpoint:", err);
        }

        showToast("Item uploaded successfully!", "success");
        uploadForm.reset();

        // Reload merchant products + stats
        await loadUserData(user);
      } catch (err) {
        console.error(err);
        showToast("Unexpected error uploading item", "error");
      }
    });
  }

  /* =======================================================
   *  LOAD MERCHANT PRODUCTS + ANALYTICS
   * ======================================================= */

  async function loadUserData(user) {
    if (!user || !merchantProductsList) return;

    merchantProductsList.innerHTML =
      '<li class="muted">Loading your products...</li>';

    try {
      var dataBody = { 
        user_id: user.id};
   
      let response;

      try {
        const { json } = await callBackend("/getUserData", false, { method: "POST" , body: JSON.stringify(dataBody) });
        response = json
        console.log("Backend /getUserData response:", JSON.stringify(json, null, 2));
      } catch (err) {
        console.error("Error calling /getUserData endpoint:", err);
      }

      var all_items = response.all_items.data
      var store_info = response.store_info.data
      var store_items = response.store_items.data
      var cart_items = response.cart_items.data

      let totalValue = 0;
      store_items.forEach((item) => {
        console.log("Store item:", item);
        totalValue += item.price || 0;
      });

      cart_items.forEach((item) => {
        console.log("Cart item:", item);
      });

      let grid = document.getElementById("market-grid");
      grid.innerHTML = "";

      all_items.forEach(item => {
        const card = document.createElement("div");
        card.className = "market-card";

        card.innerHTML = `
          <div class="market-body">
            <img src="${item.image_url}" alt="${item.name}" class="market-image" />
            <div class="market-title">${item.name}</div>
            <div class="market-meta">${item.description}</div>
            <div class="market-price">$${item.price.toFixed(2)}</div>
          </div>
        `;

        grid.appendChild(card);
      });

      grid = document.getElementById("merchantProducts");
      grid.innerHTML = "";

      store_items.forEach(item => {
        const card = document.createElement("div");
        card.className = "merchant-card";

        card.innerHTML = `
          <div class="market-body">
            <div class="market-title">${item.name}</div>
            <div class="market-meta">${item.description}</div>
            <div class="market-price">$${item.price.toFixed(2)}</div>
            <div class="market-stock">${item.stock} left</div>
          </div>
        `;

        grid.appendChild(card);
      });

      grid = document.getElementById("cartList");
      grid.innerHTML = "";

      cart_items.forEach(item => {
        const card = document.createElement("div");
        card.className = "merchant-card";

        var name;
        all_items.forEach(prod => {
          if (prod.id === item.product_id) {
            name = prod.name;
          }
        });

        card.innerHTML = `
          <div class="market-body">
            <div class="market-title">${name}</div>
            <div class="market-meta">${item.quantity}</div>
            <div class="market-price">$${item.price.toFixed(2)}</div>
          </div>
        `;

        grid.appendChild(card);
      });

      // Update analytics
      if (statTotalProducts) {
        statTotalProducts.textContent = store_items.length.toString();
      }
      if (statTotalValue) {
        statTotalValue.textContent = `$${totalValue.toFixed(2)}`;
      }
      if (statTotalOrders) {
        // For now, demo value = 0; future work: compute from orders table
        statTotalOrders.textContent = "0";
      }

      productCards = document.querySelectorAll(".market-card");


    } catch (err) {
      console.error(err);
      merchantProductsList.innerHTML =
        '<li class="muted">Error loading products.</li>';
    }
  }

  /* =======================================================
   *  PLAID LINK (Bank connection after signup/login)
   * ======================================================= */

  async function createLinkToken() {
    const { json } = await callBackend("/create_link_token", false,{
      method: "POST",
      body: {},
    });

    if (!json.link_token) {
      throw new Error(
        "Backend /create_link_token did not return link_token in response"
      );
    }

    return json.link_token;
  }

  async function exchangePublicToken(public_token, metadata) {
    const { json } = await callBackend("/exchange_public_token", false, {
      method: "POST",
      body: { public_token, metadata },
    });

    if (json.status && json.status !== "ok") {
      throw new Error(
        `Backend /exchange_public_token returned non-ok status: ${json.status}`
      );
    }

    return json;
  }

  async function initPlaidLink() {
    if (plaidInitialized) return;
    plaidInitialized = true;

    if (typeof Plaid === "undefined") {
      showToast("Plaid Link script missing", "error");
      console.error("Plaid global not found. Check script tag in HTML.");
      return;
    }

    if (!linkButton) {
      console.warn("link-bank-btn not found in DOM.");
      return;
    }

    try {
      const linkToken = await createLinkToken();

      plaidHandler = Plaid.create({
        token: linkToken,
        onSuccess: async (public_token, metadata) => {
          showToast("Bank linked!", "success");
          try {
            const result = await exchangePublicToken(public_token, metadata);
            console.log(
              "Plaid exchange_public_token result:",
              JSON.stringify(result, null, 2)
            );
            showToast("Bank connection saved", "success");
          } catch (err) {
            console.error(err);
            showToast("Error saving bank", "error");
          }
        },
        onExit: (err, metadata) => {
          if (err) {
            console.error("Plaid exit with error:", err, metadata);
            showToast("Bank connection canceled", "error");
          }
        },
      });

      linkButton.addEventListener("click", (e) => {
        e.preventDefault();
        if (plaidHandler) {
          plaidHandler.open();
        }
      });
    } catch (err) {
      console.error(err);
      showToast("Could not initialize Plaid", "error");
    }
  }

  // NOTE: Plaid is initialized as part of onAuthSuccess() after login/sign-up.
});
