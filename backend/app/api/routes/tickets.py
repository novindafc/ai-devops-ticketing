"""Tickets Route — store, list, status update, escalation candidates"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, text
from app.core.config import settings
from app.infrastructure.database.session import get_db
from app.infrastructure.database.models import TicketModel

logger = logging.getLogger(__name__)
router = APIRouter()

def verify(x_internal_token: str = Header(...)):
    if x_internal_token != settings.INTERNAL_API_TOKEN:
        raise HTTPException(403, "Invalid token")

class StatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None
    escalated_at: Optional[str] = None

class ResolutionUpdate(BaseModel):
    resolution_summary: str
    applied_fix: Optional[str] = None

@router.post("/store")
async def store_ticket(payload: Dict[str, Any], db: AsyncSession = Depends(get_db), _=Depends(verify)):
    row = TicketModel(
        ticket_id=payload["ticket_id"], title=payload["title"],
        description=payload.get("description",""), source=payload["source"],
        severity=payload["severity"], category=payload["category"],
        environment=payload.get("environment","production"),
        region=payload.get("region","us-east-1"), cluster=payload.get("cluster",""),
        namespace=payload.get("namespace","default"),
        affected_services=payload.get("affected_services",[]),
        reporter=payload.get("reporter",{}), status=payload.get("status","OPEN"),
        jira_issue_key=payload.get("jira_issue_key"),
        sla_deadline=payload.get("sla_deadline"),
        escalation_deadline=payload.get("escalation_deadline"),
        ai_analysis=payload.get("ai_analysis",{}),
        workflow_actions=payload.get("workflow_actions",{}),
        data_quality=payload.get("data_quality",{}),
        metadata_json=payload.get("metadata",{}),
        reported_at=payload.get("reported_at"), ingested_at=payload.get("ingested_at"),
        processed_at=datetime.utcnow().isoformat(),
    )
    db.add(row); await db.commit()
    return {"success":True,"ticket_id":payload["ticket_id"]}

@router.get("/")
async def list_tickets(
    status: Optional[str]=None, severity: Optional[str]=None, category: Optional[str]=None,
    page: int=Query(1,ge=1), page_size: int=Query(20,ge=1,le=100),
    db: AsyncSession=Depends(get_db), _=Depends(verify)
):
    q = select(TicketModel)
    filters = []
    if status:   filters.append(TicketModel.status==status)
    if severity: filters.append(TicketModel.severity==severity)
    if category: filters.append(TicketModel.category==category)
    if filters:  q = q.where(and_(*filters))
    q = q.order_by(TicketModel.created_at.desc()).offset((page-1)*page_size).limit(page_size)
    result = await db.execute(q)
    return {"page":page,"page_size":page_size,"items":[r.to_dict() for r in result.scalars().all()]}

@router.get("/escalation-candidates")
async def escalation_candidates(db: AsyncSession=Depends(get_db), _=Depends(verify)):
    now = datetime.utcnow().isoformat()
    result = await db.execute(
        select(TicketModel).where(and_(
            TicketModel.escalation_deadline <= now,
            TicketModel.status.in_(["OPEN","INVESTIGATING","MITIGATED"])
        ))
    )
    rows = result.scalars().all()
    logger.info(f"Found {len(rows)} escalation candidates")
    return [r.to_dict() for r in rows]

@router.get("/{ticket_id}")
async def get_ticket(ticket_id: str, db: AsyncSession=Depends(get_db), _=Depends(verify)):
    result = await db.execute(select(TicketModel).where(TicketModel.ticket_id==ticket_id))
    row = result.scalar_one_or_none()
    if not row: raise HTTPException(404,f"Ticket {ticket_id} not found")
    return row.to_dict()

@router.patch("/{ticket_id}/status")
async def update_status(ticket_id: str, body: StatusUpdate, db: AsyncSession=Depends(get_db), _=Depends(verify)):
    result = await db.execute(select(TicketModel).where(TicketModel.ticket_id==ticket_id))
    row = result.scalar_one_or_none()
    if not row: raise HTTPException(404,f"Ticket {ticket_id} not found")
    row.status = body.status
    if body.escalated_at: row.escalated_at = body.escalated_at
    if body.status == "RESOLVED": row.resolved_at = datetime.utcnow().isoformat()
    await db.commit()
    return {"ticket_id":ticket_id,"status":body.status}

@router.patch("/{ticket_id}/resolve")
async def resolve_ticket(ticket_id: str, body: ResolutionUpdate, db: AsyncSession=Depends(get_db), _=Depends(verify)):
    result = await db.execute(select(TicketModel).where(TicketModel.ticket_id==ticket_id))
    row = result.scalar_one_or_none()
    if not row: raise HTTPException(404,f"Ticket {ticket_id} not found")
    row.status = "RESOLVED"; row.resolution_summary = body.resolution_summary
    row.applied_fix = body.applied_fix; row.resolved_at = datetime.utcnow().isoformat()
    await db.commit()
    return {"ticket_id":ticket_id,"status":"RESOLVED"}

@router.get("/stats/summary")
async def stats(db: AsyncSession=Depends(get_db), _=Depends(verify)):
    result = await db.execute(text("SELECT severity, category, status, COUNT(*) as count FROM tickets GROUP BY severity, category, status ORDER BY count DESC"))
    return [dict(r._mapping) for r in result.fetchall()]
