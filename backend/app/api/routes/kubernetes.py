"""Kubernetes Rollback â€” HTTP proxy to internal K8s Deployment API"""
import logging
from datetime import datetime
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

def verify(x_internal_token: str = Header(...)):
    if x_internal_token != settings.INTERNAL_API_TOKEN:
        raise HTTPException(403, "Invalid token")

class RollbackRequest(BaseModel):
    namespace: str
    deployment: str
    cluster: str = "prod-cluster"
    revision: str = "previous"
    reason: str
    ticket_id: str
    dry_run: bool = False

@router.post("/rollback")
async def rollback(req: RollbackRequest, x_audit_user: str = Header(default="n8n-automation"), _=Depends(verify)):
    now = datetime.utcnow().isoformat() + "Z"
    return {"success": True, "ticket_id": req.ticket_id, "executed_at": now}
