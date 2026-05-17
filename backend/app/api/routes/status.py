from fastapi import APIRouter

router = APIRouter()
STATUSES = ["OPEN","INVESTIGATING","MITIGATED","ESCALATED","RESOLVED"]

@router.get("/statuses")
async def list_statuses():
    return {"statuses": STATUSES}
