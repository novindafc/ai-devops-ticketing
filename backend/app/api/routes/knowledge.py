"""Knowledge Base Route"""
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.core.config import settings
from app.infrastructure.database.session import get_db
from app.infrastructure.database.models import KnowledgeModel

logger = logging.getLogger(__name__)
router = APIRouter()

def verify(x_internal_token: str = Header(...)):
    if x_internal_token != settings.INTERNAL_API_TOKEN:
        raise HTTPException(403, "Invalid token")

class KBStoreRequest(BaseModel):
    ticket_id: str; title: str; description: str; category: str; severity: str
    source: str; ai_analysis: Dict[str,Any] = {}; resolution_summary: Optional[str] = None
    applied_fix: Optional[str] = None; status: str = "OPEN"

class KBSearchRequest(BaseModel):
    query: str; category: Optional[str] = None; severity: Optional[str] = None; limit: int = 5

@router.post("/store")
async def store(req: KBStoreRequest, db: AsyncSession=Depends(get_db), _=Depends(verify)):
    result = await db.execute(select(KnowledgeModel).where(KnowledgeModel.ticket_id==req.ticket_id))
    row = result.scalar_one_or_none()
    if row:
        if req.resolution_summary: row.resolution_summary = req.resolution_summary
        if req.applied_fix: row.applied_fix = req.applied_fix
        row.status = req.status
        row.ai_tags = req.ai_analysis.get("tags", row.ai_tags)
    else:
        row = KnowledgeModel(ticket_id=req.ticket_id, title=req.title,
            description=(req.description or "")[:500], category=req.category,
            severity=req.severity, source=req.source,
            ai_tags=req.ai_analysis.get("tags",[]),
            resolution_summary=req.resolution_summary or "", applied_fix=req.applied_fix, status=req.status)
        db.add(row)
    await db.commit()
    return {"success":True,"ticket_id":req.ticket_id}

@router.post("/search")
async def search(req: KBSearchRequest, db: AsyncSession=Depends(get_db), _=Depends(verify)):
    terms = [t.strip() for t in req.query.lower().split() if len(t) > 3][:8]
    if not terms:
        return {"similar_incidents":[],"results":[],"count":0}
    conditions = " OR ".join([f"(LOWER(title) LIKE '%{t}%' OR LOWER(description) LIKE '%{t}%')" for t in terms])
    cat_filter = f"AND category = '{req.category}'" if req.category else ""
    try:
        result = await db.execute(text(f"""
            SELECT id, ticket_id, title, category, severity, resolution_summary, applied_fix, ai_tags, status
            FROM knowledge_base WHERE ({conditions}) {cat_filter}
            ORDER BY created_at DESC LIMIT :limit
        """), {"limit": req.limit})
        rows = result.fetchall()
        items = [{"id":str(r.id),"ticket_id":r.ticket_id,"title":r.title,"category":r.category,
                  "severity":r.severity,"resolution_summary":r.resolution_summary,
                  "applied_fix":r.applied_fix,"ai_tags":r.ai_tags} for r in rows]
        return {"similar_incidents":items,"results":items,"count":len(items)}
    except Exception as e:
        logger.error(f"KB search error: {e}")
        return {"similar_incidents":[],"results":[],"count":0}

@router.get("/entries")
async def list_entries(page: int=Query(1,ge=1), page_size: int=Query(20,ge=1,le=100),
                       db: AsyncSession=Depends(get_db), _=Depends(verify)):
    result = await db.execute(select(KnowledgeModel).order_by(KnowledgeModel.created_at.desc()).offset((page-1)*page_size).limit(page_size))
    return {"page":page,"page_size":page_size,"items":[r.to_dict() for r in result.scalars().all()]}
