from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

@router.get("/")
async def health():
    return {"status":"ok","timestamp":datetime.utcnow().isoformat(),"version":"3.0.0"}

@router.get("/ready")
async def ready():
    return {"ready":True}
