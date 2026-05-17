import json, hashlib, hmac, logging
from fastapi import APIRouter, Header, HTTPException, Request
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/slack/interactive")
async def slack_interactive(request: Request,
    x_slack_request_timestamp: str = Header(None),
    x_slack_signature: str = Header(None)):
    body = await request.body()
    return {"ok": True}
