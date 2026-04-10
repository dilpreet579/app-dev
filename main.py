from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import asyncio

app = FastAPI()

# Allow CORS so our local HTML file can fetch data from this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dummy dataset (Groceries)
dummy_data = [
    {"id": 1, "name": "Milk", "category": "Dairy"},
    {"id": 2, "name": "Whole Wheat Bread", "category": "Bakery"},
    {"id": 3, "name": "Organic Bananas", "category": "Produce"},
    {"id": 4, "name": "Eggs (Dozen)", "category": "Dairy"},
    {"id": 5, "name": "Jasmine Rice 5kg", "category": "Pantry"},
    {"id": 6, "name": "Apples", "category": "Produce"},
    {"id": 7, "name": "Chicken Breast", "category": "Meat"},
    {"id": 8, "name": "Atta Bread", "category": "Bakery"},
    {"id": 9, "name": "Besan", "category": "Pantry"},
    {"id": 10, "name": "Poha", "category": "Pantry"},
    {"id": 11, "name": "Chicken Masala", "category": "Spices"},
    {"id": 12, "name": "Garam Masala", "category": "Spices"},
    {"id": 13, "name": "Onions", "category": "Produce"},
    {"id": 14, "name": "Ginger Garlic Paste", "category": "Pantry"},
    {"id": 15, "name": "Kellogs Chocos", "category": "Cereal"},
    {"id": 16, "name": "Oats", "category": "Cereal"},
    {"id": 17, "name": "Paneer", "category": "Dairy"},
    {"id": 18, "name": "Curd", "category": "Dairy"},
    {"id": 19, "name": "Egg Tray (30)", "category": "Dairy"}
]

@app.get("/search")
async def search(q: str = Query("", min_length=0)):
    # Simulating a slight network delay to make the effect of debouncing 
    # and loading states visible on the frontend
    await asyncio.sleep(0.3)
    
    if not q:
        return []
    
    # Case-insensitive search on the item "name"
    results = [item for item in dummy_data if q.lower() in item["name"].lower()]
    return results
