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
    name = body.get("name")
    email = body.get("email")
    password = body.get("password")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    try:
        check_user = (
            supabase
                .table("users")
                .select("*")
                .eq("email", email)
                .execute()
        )
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
        store = (
            supabase
                .table("stores")
                .select("id")
                .eq("merchant_id", user_id)
                .execute()
                )

        print(store)

        if len(store.data) > 0:
            print("Store already exists")
            new_store = store
        else:
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

        supabase.postgrest.auth(token)
        item = (
            supabase
                .table("products")
                .select("id")
                .eq("name", title)
                .eq("store_id", store.data[0]['id'])
                .execute()
        )
        print(item)

        if len(item.data) > 0:
            print("Item already exists for this store")
            new_item = item
        else:
            print(file_path)
            print(file)
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

async def add_cart_item(body: dict, token: str):
    user_id = body.get("user_id")
    title = body.get("title")

    if not title or not user_id:
        raise HTTPException(status_code=400, detail="Title, price, and user ID are required")
    try:
        print(user_id)

        item = (
            supabase_service
                .table("products")
                .select("*")
                .eq("name", title)
                .execute()
                )
        print(item)

        cart = (
            supabase
                .table("orders")
                .select("*")
                .eq("customer_id", user_id)
                .eq("status", "draft")
                .execute()
                )
        print(cart)
        
        if len(cart.data) == 0:
            supabase.postgrest.auth(token)
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
            cart = new_cart
            cart_id = new_cart.data[0]['id']
            print(new_cart)

            supabase.postgrest.auth(token)
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
            print(new_cart_item)
        else:
            cart_id = cart.data[0]['id']
            supabase.postgrest.auth(token)
            cart_item = (
                supabase
                    .table("order_items")
                    .select("id", "quantity")
                    .eq("order_id", cart_id)
                    .eq("product_id", item.data[0]['id'])
                    .execute()
            )

            if len(cart_item.data) > 0:
                print("Item already in cart, updating quantity")
                new_quantity = cart_item.data[0]['quantity'] + 1
                supabase.postgrest.auth(token)
                updated_cart_item = (
                    supabase
                        .table("order_items")
                        .update({
                            "quantity": new_quantity,
                        })
                        .eq("id", cart_item.data[0]['id'])
                        .execute()
                    )
                print(updated_cart_item)
                new_cart_item = updated_cart_item
            else:
                supabase.postgrest.auth(token)
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
                print(new_cart_item)
        
        supabase.postgrest.auth(token)
        cart_update = (
            supabase
                .table("orders")
                .update({
                    "total_amount": cart.data[0]['total_amount'] + item.data[0]['price'],
                })
                .eq("id", cart_id)
                .execute()
        )
        
        print("cart updated:", cart.data[0]['total_amount'] + item.data[0]['price'])
    except Exception as e:
        print("Error creating item:", e)
        raise HTTPException(status_code=500, detail="Failed to create item")

    return new_cart_item

async def gather_all_items(body: dict, token: str):
    user_id = body.get("user_id")

    if not user_id:
        raise HTTPException(status_code=400, detail="user ID is required")
    try:
        print(user_id)

        items = (
            supabase_service
                .table("products")
                .select("*")
                .execute()
                )
        print(items)

    except Exception as e:
        print("Error creating item:", e)
        raise HTTPException(status_code=500, detail="Failed to gather all items")

    return items

async def gather_store_items(body: dict, token: str):
    user_id = body.get("user_id")

    if not user_id:
        raise HTTPException(status_code=400, detail="user ID is required")
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

        if len(store.data) == 0:
            return {"data": []}
        else:
            supabase.postgrest.auth(token)
            items = (
                supabase
                    .table("products")
                    .select("*")
                    .eq("store_id", store.data[0]['id'])
                    .execute()
                    )
            print(items)

    except Exception as e:
        print("Error creating item:", e)
        raise HTTPException(status_code=500, detail="Failed to gather store items")

    return items

async def gather_store_info(body: dict, token: str):
    user_id = body.get("user_id")

    if not user_id:
        raise HTTPException(status_code=400, detail="user ID is required")
    try:
        print(user_id)

        supabase.postgrest.auth(token)
        store = (
            supabase
                .table("stores")
                .select("*")
                .eq("merchant_id", user_id)
                .execute()
                )
        print(store)

    except Exception as e:
        print("Error creating item:", e)
        raise HTTPException(status_code=500, detail="Failed to gather store info")

    return store

async def gather_cart_items(body: dict, token: str):
    user_id = body.get("user_id")

    if not user_id:
        raise HTTPException(status_code=400, detail="user ID is required")
    try:
        print(user_id)

        supabase.postgrest.auth(token)
        cart = (
            supabase
                .table("orders")
                .select("*")
                .eq("customer_id", user_id)
                .eq("status", "draft")
                .execute()
                )
        print(cart)

        if len(cart.data) == 0:
            return {"data": []}
        else:
            supabase.postgrest.auth(token)
            items = (
                supabase
                    .table("order_items")
                    .select("*")
                    .eq("order_id", cart.data[0]['id'])
                    .execute()
                    )
            print(items)

    except Exception as e:
        print("Error creating item:", e)
        raise HTTPException(status_code=500, detail="Failed to gather cart items")

    return items

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

    if isinstance(body, str):
        body = json.loads(body)

    new_cart_item = await add_cart_item(body, token)

    return {
        "message": "Hello from Python backend!",
        "user": new_cart_item,
    }

@app.post("/getUserData")
async def getUserData(request: Request):
    # gather store information from the database
    user = await verify_token(request)
    body = await request.json()
    token = request.headers.get("Authorization").split(" ", 1)[1].strip()

    if isinstance(body, str):
        body = json.loads(body)

    cart_items = await gather_cart_items(body, token)
    all_items = await gather_all_items(body, token)
    store_items = await gather_store_items(body, token)
    store_info = await gather_store_info(body, token)

    return {
        "message": "Hello from Python backend!",
        "cart_items": cart_items,
        "all_items": all_items,
        "store_items": store_items,
        "store_info": store_info,
    }
