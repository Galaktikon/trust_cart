from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import jwt
from jwt import PyJWTError
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

@app.options("/{path:path}")
async def preflight_handler():
    return {}

# --- SUPABASE CLIENT ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

JWT_SECRET = os.getenv("SUPABASE_ANON_KEY")
JWT_ALGO = "HS256"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

# --- VERIFY TOKEN ---
async def verify_token(request: Request):
    auth = request.headers.get("Authorization")
    if not auth:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = auth.split(" ")[1]
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    return payload


# --- TEST ENDPOINT ---
@app.get("/test")
async def test(request: Request):
    user = await verify_token(request)
    print(f"Authenticated user: {user}")
    # Example DB query
    data = supabase.table("users").select("*").eq("email", user["sub"]).execute()

    return {
        "message": "Hello from Python backend!",
        "user": user["email"],
        "id": user["sub"],
        "db_data": data.data,
    }
