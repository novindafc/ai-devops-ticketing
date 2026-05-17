"""Domain entities — pure Python, zero framework dependencies."""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

class Severity(str, Enum):
    CRITICAL = "CRITICAL"; HIGH = "HIGH"; MEDIUM = "MEDIUM"; LOW = "LOW"; INFO = "INFO"

class Category(str, Enum):
    DEPLOYMENT = "DEPLOYMENT"; INFRASTRUCTURE = "INFRASTRUCTURE"; SECURITY = "SECURITY"
    PERFORMANCE = "PERFORMANCE"; DATABASE = "DATABASE"; NETWORK = "NETWORK"; APPLICATION = "APPLICATION"

class TicketStatus(str, Enum):
    OPEN = "OPEN"; INVESTIGATING = "INVESTIGATING"; MITIGATED = "MITIGATED"
    ESCALATED = "ESCALATED"; RESOLVED = "RESOLVED"

@dataclass
class Reporter:
    name: str
    email: str
    team: str

@dataclass
class AIAnalysis:
    summary: str
    priority_score: int
    recommended_team: str
    root_cause_hypothesis: str
    recommended_actions: List[str]
    requires_rollback: bool
    rollback_target: str
    rollback_confidence: float
    escalate_to_oncall: bool
    estimated_resolution_min: int
    confidence: float
    tags: List[str]
    similar_fix: Optional[str] = None
    used_fallback: bool = False

@dataclass
class Ticket:
    ticket_id: str
    title: str
    description: str
    source: str
    severity: Severity
    category: Category
    environment: str
    region: str
    cluster: str
    namespace: str
    affected_services: List[str]
    reporter: Reporter
    reported_at: datetime
    ingested_at: datetime
    sla_deadline: datetime
    escalation_deadline: datetime
    status: TicketStatus = TicketStatus.OPEN
    ai_analysis: Optional[AIAnalysis] = None
    jira_issue_key: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_summary: Optional[str] = None
    applied_fix: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
