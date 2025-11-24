/************************************************************
 * TrustCart - Frontend Logic (Auth + Plaid Link)
 ************************************************************/

// API Configuration (your backend with Plaid endpoints)
const API_BASE_URL = "https://trust-cart-backend.onrender.com";

// Supabase Configuration
const SUPABASE_URL = "https://semkimaoxlmxtyhlhada.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlbWtpbWFveGxteHR5aGxoYWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMjMyNzIsImV4cCI6MjA3ODg5OTI3Mn0.RaOsVMI2UQULkWCYgJGntpNpndaqM1HIi4XHOkJb9k";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Plaid state
let plaidInitialized = false;
let plaidHandler = null;

/************************************************************
 * Main script
 ************************************************************/

document.addEventListener("DOMContentLoaded", async () => {
  /* =======================================================
   *  AUTH SECTION (Supabase email/password)
   * ======================================================= */

  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const showRegister = document.getElementById("showRegister");
  const showLogin = document.getElementById("showLogin");

  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");

  const regName = document.getElementById("regName");
  const regEmail = document.getElementById("regEmail");
  const regPassword = document.getElementById("regPassword");

  const bankSection = document.getElementById("bank");
  const linkButton = document.getElementById("link-bank-btn");

  /* ---------- Helpers ---------- */

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

  // Called whenever auth succeeds (login OR user already logged in)
  async function onAuthSuccess(user) {
    if (!user) return;

    const displayName =
      user.user_metadata?.full_name || user.email || "User";

    showToast(`Welcome, ${displayName}`, "success");

    // Show the "Connect Bank/Card" section
    if (bankSection) {
      bankSection.classList.remove("hidden");
    }

    // Initialize Plaid (only once)
    if (linkButton && !plaidInitialized) {
      await initPlaidLink();
    }
  }

  async function logoutUser() {
    await supabaseClient.auth.signOut();
    showToast("Logged out", "success");
    // Simple refresh to clear UI state
    setTimeout(() => window.location.reload(), 500);
  }

  // Expose logout for navbar button
  window.trustcartLogout = logoutUser;

  /* =======================================================
   *  CHECK IF USER ALREADY LOGGED IN (ON PAGE LOAD)
   * ======================================================= */
  try {
    const { data } = await supabaseClient.auth.getUser();
    if (data?.user) {
      await onAuthSuccess(data.user);
    }
  } catch (err) {
    console.error("Error checking current user:", err);
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

      // data.session.user is available here
      if (data?.user) {
        await onAuthSuccess(data.user);
      } else if (data?.session?.user) {
        await onAuthSuccess(data.session.user);
      } else {
        // fallback: re-fetch user
        const { data: userData } = await supabaseClient.auth.getUser();
        await onAuthSuccess(userData?.user);
      }
    });
  }

  /* =======================================================
   *  REGISTER HANDLER
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

      registerForm.reset();
      registerForm.classList.add("hidden");
      if (loginForm) loginForm.classList.remove("hidden");
    });
  }

  /* =======================================================
   *  SIMPLE "ADD TO CART" BUTTON FEEDBACK (no DB yet)
   * ======================================================= */
  const productButtons = document.querySelectorAll(".product-button");
  productButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      showToast("Added to cart", "success");
      // Later: update DOM or Supabase with real cart logic
    });
  });

  /* =======================================================
   * PLAID LINK SECTION (Frontend Part)
   * ======================================================= */

  async function createLinkToken() {
    const res = await fetch(`${API_BASE_URL}/create_link_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) throw new Error("Unable to create link token");

    const data = await res.json();
    return data.link_token;
  }

  async function exchangePublicToken(public_token, metadata) {
    const res = await fetch(`${API_BASE_URL}/exchange_public_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_token, metadata }),
    });

    if (!res.ok) throw new Error("Error exchanging public token");
    return await res.json();
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
            await exchangePublicToken(public_token, metadata);
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

  // NOTE: Plaid is now only initialized after login,
  // via onAuthSuccess() -> initPlaidLink().
});
