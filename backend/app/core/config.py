from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)
    APP_ENV: str = "development"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me"
    INTERNAL_API_TOKEN: str = "change-me-internal"
    DATABASE_URL: str = "postgresql+asyncpg://devops:devops@postgres:5432/devops_ticketing"
    REDIS_URL: str = "redis://redis:6379/0"
    ANTHROPIC_API_KEY: str = ""
    AI_MODEL: str = "claude-sonnet-4-20250514"
    AI_MAX_TOKENS: int = 2048
    JIRA_BASE_URL: str = "https://company.atlassian.net"
    JIRA_USER: str = ""
    JIRA_API_TOKEN: str = ""
    JIRA_PROJECT_KEY: str = "DEVOPS"
    SLACK_BOT_TOKEN: str = ""
    SLACK_SIGNING_SECRET: str = ""
    K8S_DEPLOYMENT_API_URL: str = "http://k8s-mock:9090"
    K8S_DEPLOYMENT_API_TOKEN: str = ""
    K8S_DEFAULT_CLUSTER: str = "prod-cluster"
    GITHUB_WEBHOOK_SECRET: str = ""
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]
    ESCALATION_WINDOW_MINUTES: int = 30

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
