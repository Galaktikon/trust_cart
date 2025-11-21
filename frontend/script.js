// --- CONFIG ---
const SUPABASE_URL = "https://semkimaoxlmxtyhlhada.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlbWtpbWFveGxteHR5aGxoYWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMjMyNzIsImV4cCI6MjA3ODg5OTI3Mn0.RaOsVMI2UQULkWCYgJGntpNpndaqM1HIi4XHOkJb9kY";
const BACKEND_URL = "https://your-backend.onrender.com";

// --- INIT ---
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI ELEMENTS
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const backendBtn = document.getElementById("backend-btn");
const backendResponseBox = document.getElementById("backend-response");

// --- LOGIN / SIGNUP ---
loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        // Auto-signup fallback
        const { data: signupData, error: signupErr } = await supabase.auth.signUp({ email, password });
        if (signupErr) return alert(signupErr.message);
        alert("Signed up! Verify your email.");
        return;
    }

    updateUI();
});

// --- LOGOUT ---
logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    updateUI();
});

// --- UPDATE UI ---
async function updateUI() {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        document.getElementById("auth-section").style.display = "none";
        document.getElementById("user-info").style.display = "block";
        document.getElementById("user-email").textContent = user.email;
    } else {
        document.getElementById("auth-section").style.display = "block";
        document.getElementById("user-info").style.display = "none";
    }
}

updateUI(); // On load

// --- CALL BACKEND ---
backendBtn.addEventListener("click", async () => {
    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch(`${BACKEND_URL}/test`, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`
        }
    });

    const json = await res.json();
    backendResponseBox.textContent = JSON.stringify(json, null, 2);
});
