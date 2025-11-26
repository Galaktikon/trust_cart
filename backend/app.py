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
    allow_origins=[
        "*"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With"
    ],
)



# --- SUPABASE CLIENT ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

JWT_ALGO = "HS256"
JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# --- VERIFY TOKEN ---
async def verify_token(request: Request):
    auth = request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    token = auth.split(" ", 1)[1]

    user_resp = supabase.auth.get_user(token)
    if user_resp.user is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_resp.user



# --- TEST ENDPOINT ---
@app.get("/test")
async def test(request: Request):
    user = await verify_token(request)
    print(f"Authenticated user: {user}")
    # Example DB query
    #data = supabase.table("users").select("*").eq("email", user["sub"]).execute()

    try:
        # Insert the row
        insert_result = (
            supabase
                .table("users")
                .insert({
                    "id": user.id,
                    "role": "admin",
                    "display_name": "Josiah James",
                })
                .execute()
        )

        # Fetch the just-inserted row
        user_row = (
            supabase
                .table("users")
                .select("*")
                .eq("id", user.id)
                .execute()
        )

        print(user_row.data)

    except Exception as e:
        print(f"Error inserting user: {e}")


    return {
        "message": "Hello from Python backend!",
        "user": user.email,
        "id": user.id,
        #"db_data": data.data,
    }
