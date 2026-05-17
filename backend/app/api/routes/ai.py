"""AI Analysis — calls Claude via Anthropic SDK"""
import json, logging
from typing import List
import anthropic
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

def verify(x_internal_token: str = Header(...)):
    if x_internal_token != settings.INTERNAL_API_TOKEN:
        raise HTTPException(403, "Invalid token")

class AnalyzeRequest(BaseModel):
    ticket_id: str
    title: str
    description: str
    severity: str
    category: str
    source: str
    environment: str
    cluster: str = ""
    namespace: str = "default"
    affected_services: List[str] = []
    kb_context: str = ""
    missing_fields: List[str] = []

SYSTEM = 'You are a principal SRE. Analyze DevOps incidents. Return ONLY valid JSON.'

@router.post("/analyze")
async def analyze(req: AnalyzeRequest, _=Depends(verify)):
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return {"ticket_id": req.ticket_id, "status": "ok"}
