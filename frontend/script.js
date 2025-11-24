/************************************************************
 * TrustCart - Frontend Logic (Auth + Plaid Link)
 *
 * API BASE URL FOR YOUR BACKEND SERVER
 ************************************************************/

// API Configuration
const API_BASE_URL = 'https://trust-cart-backend.onrender.com';

//Supabase Configuration
const SUPABASE_URL = "https://semkimaoxlmxtyhlhada.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlbWtpbWFveGxteHR5aGxoYWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMjMyNzIsImV4cCI6MjA3ODg5OTI3Mn0.RaOsVMI2UQULkWCYgJGntpNpndaqM1HIi4XHOkJb9kY";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/************************************************************
 * Rest of the script
 ************************************************************/

document.addEventListener("DOMContentLoaded", () => {
  /* =======================================================
   *  AUTH SECTION (auth using supabase)
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

  async function getLoggedInUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
  }

  async function logoutUser() {
    await supabaseClient.auth.signOut();
    showToast("Logged out", "success");
    setTimeout(() => window.location.reload(), 500);
  }

  window.trustcartLogout = logoutUser;

  const currentUser = getLoggedInUser();
  if (currentUser) {
    console.log("Logged in as:", currentUser.email);
    showToast(`Welcome back, ${currentUser.name}`, "success");
  }

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

      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        alert(error.message);
        return;
      }

      showToast("Logged in!", "success");
    });
  }

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

      const { data: signupData, error: signupErr } = await supabaseClient.auth.signUp({ email, password });
      if (signupErr) return alert(signupErr.message);

      showToast("Account created! Verify your email.", "success");

      registerForm.reset();
      registerForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
    });
  }

  const productButtons = document.querySelectorAll(".product-button");
  productButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      showToast("Added to cart", "success");
    });
  });

  /* =======================================================
   * PLAID LINK SECTION (Frontend Part)
   * ======================================================= */

  const linkButton = document.getElementById("link-bank-btn");

  async function createLinkToken() {
    const res = await fetch(`${API_BASE_URL}/create_link_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) throw new Error("Unable to create link token");

    const data = await res.json();
    return data.link_token;
  }

  async function exchangePublicToken(public_token, metadata) {
    const res = await fetch(`${API_BASE_URL}/exchange_public_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_token, metadata })
    });

    if (!res.ok) throw new Error("Error exchanging public token");
    return await res.json();
  }

  async function initPlaidLink() {
    if (typeof Plaid === "undefined") {
      showToast("Plaid Link script missing", "error");
      return;
    }

    try {
      const linkToken = await createLinkToken();

      const handler = Plaid.create({
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
          if (err) showToast("Bank connection canceled", "error");
        }
      });

      linkButton.addEventListener("click", (e) => {
        e.preventDefault();
        handler.open();
      });

    } catch (err) {
      console.error(err);
      showToast("Could not initialize Plaid", "error");
    }
  }

  if (linkButton) {
    initPlaidLink();
  }
});
