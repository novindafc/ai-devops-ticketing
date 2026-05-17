"""
DevOps AI Ticketing — FastAPI Application
Clean Architecture: Domain → Application → Infrastructure → API
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.logging import setup_logging
from app.infrastructure.database.session import init_db
from app.api.routes import tickets, ai, kubernetes, knowledge, health, webhooks, status


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    await init_db()
    yield


app = FastAPI(
    title="DevOps AI Ticketing API",
    description="Enterprise AI-powered DevOps incident management",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.add_middleware(GZipMiddleware, minimum_size=1000)

for router, prefix, tags in [
    (health.router,    "/health",     ["Health"]),
    (tickets.router,   "/tickets",    ["Tickets"]),
    (ai.router,        "/ai",         ["AI"]),
    (kubernetes.router,"/kubernetes", ["Kubernetes"]),
    (knowledge.router, "/knowledge",  ["Knowledge Base"]),
    (webhooks.router,  "/webhooks",   ["Webhooks"]),
    (status.router,    "/status",     ["Status"]),
]:
    app.include_router(router, prefix=prefix, tags=tags)
