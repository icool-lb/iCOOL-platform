"""
iCOOL Platform Configuration
"""

from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "iCOOL HVAC AI CAD Platform"
    VERSION: str = "2.0.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://icool:icool@localhost:5432/icool_db"
    )
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    # PostGIS
    POSTGIS_ENABLED: bool = True

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    REDIS_POOL_SIZE: int = 50

    # Storage (S3/MinIO)
    STORAGE_ENDPOINT: str = os.getenv("STORAGE_ENDPOINT", "http://localhost:9000")
    STORAGE_ACCESS_KEY: str = os.getenv("STORAGE_ACCESS_KEY", "minioadmin")
    STORAGE_SECRET_KEY: str = os.getenv("STORAGE_SECRET_KEY", "minioadmin")
    STORAGE_BUCKET: str = os.getenv("STORAGE_BUCKET", "icool-files")
    STORAGE_REGION: str = os.getenv("STORAGE_REGION", "us-east-1")

    # AI
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    AI_MODEL: str = os.getenv("AI_MODEL", "gpt-4")
    AI_TEMPERATURE: float = 0.3
    AI_MAX_TOKENS: int = 4000

    # CAD Engine
    ODA_SDK_PATH: str = os.getenv("ODA_SDK_PATH", "/opt/oda")
    AUTODESK_APS_CLIENT_ID: str = os.getenv("AUTODESK_APS_CLIENT_ID", "")
    AUTODESK_APS_CLIENT_SECRET: str = os.getenv("AUTODESK_APS_CLIENT_SECRET", "")

    # Celery
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

    # Email
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")

    # Monitoring
    PROMETHEUS_ENABLED: bool = True
    JAEGER_ENABLED: bool = True
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://icool.engineering",
        "https://app.icool.engineering"
    ]

    # File Upload
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB
    ALLOWED_FILE_TYPES: List[str] = ["dwg", "dxf", "pdf", "rvt", "ifc"]

    # HVAC Standards
    DEFAULT_STANDARD: str = "ASHRAE"
    SUPPORTED_STANDARDS: List[str] = ["ASHRAE", "SMACNA", "Local"]

    # Localization
    DEFAULT_LANGUAGE: str = "ar"
    SUPPORTED_LANGUAGES: List[str] = ["ar", "en", "fr"]

    # Subscription Tiers
    FREE_TIER_PROJECTS: int = 3
    FREE_TIER_USERS: int = 1
    PRO_TIER_PROJECTS: int = 10
    PRO_TIER_USERS: int = 3
    TEAM_TIER_PROJECTS: int = -1  # Unlimited
    TEAM_TIER_USERS: int = 10

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
