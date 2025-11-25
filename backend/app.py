from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os

app = FastAPI()

# --- CORS (allow your frontend domain) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://trust-cart-731s.onrender.com"],  # Change to your actual frontend domain on Render
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SUPABASE CLIENT ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

# --- VERIFY TOKEN ---
async def verify_token(request: Request):
    auth = request.headers.get("Authorization")
    if not auth:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = auth.split(" ")[1]
    user = supabase.auth.get_user(token)
    if not user or not user.user:
        raise HTTPException(status_code=401, detail="Invalid token")

    return user.user


# --- TEST ENDPOINT ---
@app.post("/test")
async def test(request: Request):
    user = await verify_token(request)
    print(f"Authenticated user: {user}")
    # Example DB query
    data = supabase.table("users").select("*").eq("email", user.id).execute()

    return {
        "message": "Hello from Python backend!",
        "user": user.email,
        "id": user.id,
        "db_data": data.data,
    }
