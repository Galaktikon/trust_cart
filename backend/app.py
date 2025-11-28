from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
import os
import requests
import json

# ============================================================
# FastAPI app setup
# ============================================================

app = FastAPI()

# --- CORS (allow your frontend domain) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*" 
        # e.g. "https://trust-cart-backend.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
    ],
)

# ============================================================
# Supabase configuration
# ============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
supabase_service: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

# ============================================================
# Plaid configuration (optional; app will still run without it)
# ============================================================

PLAID_CLIENT_ID = os.getenv("PLAID_CLIENT_ID")
PLAID_SECRET = os.getenv("PLAID_SECRET")
PLAID_ENV = os.getenv("PLAID_ENV", "sandbox").lower()  # "sandbox", "development", "production"

PLAID_BASE_URL_MAP = {
    "sandbox": "https://sandbox.plaid.com",
    "development": "https://development.plaid.com",
    "production": "https://production.plaid.com",
}
PLAID_BASE_URL = PLAID_BASE_URL_MAP.get(PLAID_ENV, "https://sandbox.plaid.com")

# ============================================================
# Auth helper - verify Supabase JWT from frontend
# ============================================================

async def verify_token(request: Request):
    """
    Reads the Supabase JWT access token from the Authorization header:
        Authorization: Bearer <token>

    Uses Supabase Python client to validate the token and return the user object.

    This matches the frontend getAuthHeaders() in script.js, which sends:
        Authorization: Bearer <session.access_token>
    """
    auth = request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")

    token = auth.split(" ", 1)[1].strip()

    try:
        user_resp = supabase.auth.get_user(token)
    except Exception as e:
        print("Error calling supabase.auth.get_user:", e)
        raise HTTPException(status_code=401, detail="Invalid token")

    if user_resp.user is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    print("Verified user:", user_resp.user)
    return user_resp.user


# ============================================================
# Supabase helper functions
# ============================================================

async def create_user(body: dict):
    name = body.get("name")
    email = body.get("email")
    password = body.get("password")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    try:
        new_user = (
            supabase
                .table("users")
                .insert({
                    "id": user.id,
                    "role": "customer",
                    "display_name": name,
                })
                .execute()
        )
    except Exception as e:
        print("Error creating user:", e)
        raise HTTPException(status_code=500, detail="Failed to create user")

    if user_resp.user is None:
        raise HTTPException(status_code=500, detail="Failed to create user")

    return new_user

async def create_store(body: dict, token: str):
    print(body)
    user_id = body.get("id")
    description = body.get("description")

    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required")
    print("starting create store")
    try:
        name = (
            supabase
                .table("users")
                .select("display_name")
                .eq("id", user_id)
                .execute()
                )
        print("fetched name:")
        print(name)

        supabase.postgrest.auth(token)

        new_store = (
            supabase
                .table("stores")
                .insert({
                    "merchant_id": user_id,
                    "name": name.data[0]['display_name'] + "'s Store",
                    "description": description,
                })
                .execute()
                )
    except Exception as e:
        print("Error creating user:", e)
        raise HTTPException(status_code=500, detail="Failed to create user")

    return new_store

async def create_db_item(body: dict, token: str):
    user_id = body.get("user_id")
    title = body.get("title")
    description = body.get("description")
    price = body.get("price")
    file_path = body.get("filePath")
    file = body.get("file")

    if not title or not price or not user_id:
        raise HTTPException(status_code=400, detail="Title, price, and user ID are required")
    try:
        print(user_id)
        supabase.postgrest.auth(token)

        store = (
            supabase
                .table("stores")
                .select("id")
                .eq("merchant_id", user_id)
                .execute()
                )

        print(store)
        print(file_path)
        print(type(file_path))
        print(file)
        print(type(file))
        file_bytes = await file.read()
        try:
            result = supabase_service.storage.from_("product-images").upload(file_path, file_bytes, {"content-type": file.content_type})
            print("Upload result:", result)
        except Exception as e:
            print("Upload failed:", e)

        image_url = supabase.storage.from_("product-images").get_public_url(file_path)
        print(image_url)

        supabase.postgrest.auth(token)

        new_item = (
            supabase
                .table("products")
                .insert({
                    "store_id": store.data[0]['id'],
                    "name": title,
                    "description": description,
                    "price": price,
                    "stock": 10,
                    "image_url": image_url,
                })
                .execute()
                )
    except Exception as e:
        print("Error creating item:", e)
        raise HTTPException(status_code=500, detail="Failed to create item")

    return new_item

async def create_db_item(body: dict, token: str):
    user_id = body.get("user_id")
    title = body.get("title")

    if not title or not price or not user_id:
        raise HTTPException(status_code=400, detail="Title, price, and user ID are required")
    try:
        print(user_id)
        supabase.postgrest.auth(token)

        item = (
            supabase
                .table("products")
                .select("*")
                .eq("id", user_id)
                .execute()
                )

        cart = (
            supabase
                .table("orders")
                .select("*")
                .eq("customer_id", user_id)
                .eq("status", "draft")
                .execute()
                )
        
        if len(cart.data) == 0:
            new_cart = (
                supabase
                    .table("orders")
                    .insert({
                        "customer_id": user_id,
                        "store_id": item.data[0]['store_id'],
                        "total_amount": 0,
                        "status": "draft",
                    })
                    .execute()
                    )
            cart_id = new_cart.data[0]['id']

            new_cart_item = (
                supabase
                    .table("order_items")
                    .insert({
                        "order_id": cart_id,
                        "product_id": item.data[0]['id'],
                        "quantity": 1,
                        "price": item.data[0]['price'],
                    })
                    .execute()
                )
        else:
            cart_id = cart.data[0]['id']

            new_cart_item = (
                supabase
                    .table("order_items")
                    .insert({
                        "order_id": cart_id,
                        "product_id": item.data[0]['id'],
                        "quantity": 1,
                        "price": item.data[0]['price'],
                    })
                    .execute()
                )

    except Exception as e:
        print("Error creating item:", e)
        raise HTTPException(status_code=500, detail="Failed to create item")

    return new_cart_item

# ============================================================
# Pydantic models for request bodies
# ============================================================

class ExchangePublicTokenRequest(BaseModel):
    public_token: str
    metadata: dict | None = None

# ============================================================
# Health / root endpoint (optional, nice for debugging)
# ============================================================

@app.get("/")
async def root():
    return {"status": "ok", "service": "trustcart-backend"}

# ============================================================
# /endpoints
# ============================================================

@app.post("/register")
async def register(request: Request):
    # create a new user in the database
    body = await request.json()

    new_user = await create_user(body)

    return {
        "message": "Hello from Python backend!",
        "user": new_user,
    }

@app.post("/login")
async def login(request: Request):
    # create a new store in the database
    user = await verify_token(request)
    body = await request.json()
    token = request.headers.get("Authorization").split(" ", 1)[1].strip()

    if isinstance(body, str):
        body = json.loads(body)

    new_store = await create_store(body, token)

    return {
        "message": "Hello from Python backend!",
        "user": new_store,
    }

@app.post("/create_item")
async def create_item(request: Request,
    user_id: str = Form(...),
    title: str = Form(...),
    price: float = Form(...),
    description: str = Form(...),
    filePath: str = Form(...),
    file: UploadFile = File(...)):
    # create a new item in the database
    user = await verify_token(request)
    token = request.headers.get("Authorization").split(" ", 1)[1].strip()

    body = {
        "user_id": user_id,  
        "title": title,
        "price": price,
        "description": description,
        "filePath": filePath,
        "file": file,
    }

    new_item = await create_db_item(body, token)

    return {
        "message": "Hello from Python backend!",
        "user": new_item,
    }

@app.post("/add_to_cart")
async def add_to_cart(request: Request):
    # add an item to the user's cart

    user = await verify_token(request)
    body = await request.json()
    token = request.headers.get("Authorization").split(" ", 1)[1].strip()

    add_cart_item = await add_cart_item(body, token)

    return {
        "message": "Hello from Python backend!",
        "user": add_cart_item,
    }

@app.get("/retrieve_store_info")
async def retrieve_store_info(request: Request):
    # gather store information from the database

    user = await verify_token(request)



    return {
        "message": "Hello from Python backend!",
        "user": user.email,
        "id": user.id,
    }

# ============================================================
# /create_link_token - Plaid Link token creation
# ============================================================

@app.post("/create_link_token")
async def create_link_token(request: Request):
    """
    Called by frontend createLinkToken() via:

        callBackend("/create_link_token", { method: "POST", body: {} })

    Expected backend response shape (per script.js JSDoc):

        {
          "link_token": "<PLAID_LINK_TOKEN_STRING>",
          // ...optionally extra fields for logging
        }

    If PLAID_CLIENT_ID / PLAID_SECRET are not set, we return a stub
    link_token so the Plaid Link UI flow can still be demoed.
    """
    user = await verify_token(request)
    print(f"/create_link_token - authenticated user: {user.id}")

    # No Plaid config? Return stub for demo.
    if not PLAID_CLIENT_ID or not PLAID_SECRET:
        print("PLAID_CLIENT_ID or PLAID_SECRET not set. Returning stub link_token.")
        return {"link_token": "link-sandbox-stub-token-123"}

    payload = {
        "client_id": PLAID_CLIENT_ID,
        "secret": PLAID_SECRET,
        "client_name": "TrustCart",
        "language": "en",
        "country_codes": ["US"],
        "user": {
            "client_user_id": user.id,
        },
        "products": ["auth"],  # you can add more products like "transactions" later
    }

    resp = requests.post(f"{PLAID_BASE_URL}/link/token/create", json=payload)
    if not resp.ok:
        print("Plaid /link/token/create error:", resp.status_code, resp.text)
        raise HTTPException(
            status_code=500,
            detail="Failed to create Plaid link_token",
        )

    plaid_data = resp.json()
    link_token = plaid_data.get("link_token")

    if not link_token:
        raise HTTPException(
            status_code=500,
            detail="Plaid did not return link_token",
        )

    return {"link_token": link_token}

# ============================================================
# /exchange_public_token - Plaid public_token exchange
# ============================================================

@app.post("/exchange_public_token")
async def exchange_public_token(
    request: Request,
    body: ExchangePublicTokenRequest,
):
    """
    Called by frontend exchangePublicToken(public_token, metadata) via:

        callBackend("/exchange_public_token", {
          method: "POST",
          body: { public_token, metadata }
        })

    Expected backend response shape (per script.js JSDoc):

        {
          "status": "ok",
          "item_id": "<plaid_item_id>",
          "institution": {
              "id": "<institution_id>",
              "name": "<institution_name>"
          }
          // optionally: "account_ids": [...], "last4": "...", etc.
        }

    Frontend currently:
      - Checks json.status (if present) is "ok"
      - Logs the result and shows "Bank connection saved" on success
    """
    user = await verify_token(request)
    print(f"/exchange_public_token - authenticated user: {user.id}")

    # If Plaid is not configured, return a stub success for demo.
    if not PLAID_CLIENT_ID or not PLAID_SECRET:
        print("PLAID_CLIENT_ID or PLAID_SECRET not set. Returning stub exchange result.")
        institution_id = None
        institution_name = None
        if body.metadata and isinstance(body.metadata, dict):
            inst = body.metadata.get("institution") or {}
            institution_id = inst.get("institution_id")
            institution_name = inst.get("name")

        return {
            "status": "ok",
            "item_id": "item-stub-123",
            "institution": {
                "id": institution_id,
                "name": institution_name,
            },
            "user_id": user.id,
        }

    # Real Plaid call to exchange public_token for access_token
    exchange_payload = {
        "client_id": PLAID_CLIENT_ID,
        "secret": PLAID_SECRET,
        "public_token": body.public_token,
    }

    resp = requests.post(
        f"{PLAID_BASE_URL}/item/public_token/exchange",
        json=exchange_payload,
    )
    if not resp.ok:
        print("Plaid /item/public_token/exchange error:", resp.status_code, resp.text)
        raise HTTPException(
            status_code=500,
            detail="Failed to exchange Plaid public_token",
        )

    plaid_data = resp.json()
    access_token = plaid_data.get("access_token")
    item_id = plaid_data.get("item_id")

    # TODO (recommended): store access_token + item_id securely in DB using service role
    # Example:
    # service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
    # service_client.table("plaid_items").upsert({
    #     "user_id": user.id,
    #     "item_id": item_id,
    #     "access_token": access_token,
    # }).execute()

    # Try to get institution info from metadata for UI
    institution_id = None
    institution_name = None
    if body.metadata and isinstance(body.metadata, dict):
        inst = body.metadata.get("institution") or {}
        institution_id = inst.get("institution_id")
        institution_name = inst.get("name")

    return {
        "status": "ok",
        "item_id": item_id,
        "institution": {
            "id": institution_id,
            "name": institution_name,
        },
        "user_id": user.id,
    }
