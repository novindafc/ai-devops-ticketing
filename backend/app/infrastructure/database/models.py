"""SQLAlchemy ORM Models"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, DateTime, JSON, Text, Float
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class TicketModel(Base):
    __tablename__ = "tickets"
    id               = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id        = Column(String, unique=True, nullable=False, index=True)
    title            = Column(String(500), nullable=False)
    description      = Column(Text, nullable=True)
    source           = Column(String(50), nullable=False, index=True)
    severity         = Column(String(20), nullable=False, index=True)
    category         = Column(String(50), nullable=False, index=True)
    environment      = Column(String(50), default="production")
    region           = Column(String(50), default="us-east-1")
    cluster          = Column(String(100), default="")
    namespace        = Column(String(100), default="default")
    affected_services= Column(JSON, default=list)
    reporter         = Column(JSON, default=dict)
    status           = Column(String(30), default="OPEN", index=True)
    jira_issue_key   = Column(String(50), nullable=True)
    sla_deadline     = Column(String, nullable=True)
    escalation_deadline = Column(String, nullable=True)
    escalated_at     = Column(String, nullable=True)
    resolved_at      = Column(String, nullable=True)
    resolution_summary = Column(Text, nullable=True)
    applied_fix      = Column(Text, nullable=True)
    ai_analysis      = Column(JSON, default=dict)
    workflow_actions = Column(JSON, default=dict)
    data_quality     = Column(JSON, default=dict)
    metadata_json    = Column(JSON, default=dict)
    reported_at      = Column(String, nullable=True)
    ingested_at      = Column(String, nullable=True)
    processed_at     = Column(String, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class KnowledgeModel(Base):
    __tablename__ = "knowledge_base"
    id               = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id        = Column(String, unique=True, nullable=False, index=True)
    title            = Column(String(500), nullable=False)
    description      = Column(Text, nullable=True)
    category         = Column(String(50), nullable=False, index=True)
    severity         = Column(String(20), nullable=False)
    source           = Column(String(50), nullable=True)
    ai_tags          = Column(JSON, default=list)
    resolution_summary = Column(Text, default="")
    applied_fix      = Column(Text, nullable=True)
    status           = Column(String(30), default="OPEN")
    helpful_count    = Column(Integer, default=0)
    created_at       = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}
