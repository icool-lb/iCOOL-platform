"""
iCOOL HVAC AI CAD Platform - Backend Application
Complete HVAC Engineering Platform with AI Assistance
"""

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import FileResponse, StreamingResponse
from contextlib import asynccontextmanager
import uvicorn
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import asyncio
import json

from core.cad_engine.parser import CADParser
from core.cad_engine.geometry import GeometryEngine
from core.load_calc.engine import LoadCalculationEngine
from core.design_engine.wall_split.engine import WallSplitEngine
from core.design_engine.ducted.engine import DuctedEngine
from core.design_engine.vrv.engine import VRVEngine
from core.ai_layer.engine import AIEngine
from core.rule_engine.engine import RuleEngine
from core.qa_engine.engine import QAEngine
from core.export_engine.engine import ExportEngine
from models.database import DatabaseManager
from services.auth_service import AuthService
from services.project_service import ProjectService
from services.file_service import FileService
from services.email_service import EmailService
from workers.celery_app import celery_app
from schemas import (
    ProjectCreate, ProjectResponse, ProjectUpdate,
    RoomCreate, RoomResponse, RoomUpdate,
    ZoneCreate, ZoneResponse, ZoneUpdate,
    LoadCalculationRequest, LoadCalculationResponse,
    DesignRequest, DesignResponse,
    ValidationRequest, ValidationResponse,
    ExportRequest, ExportResponse,
    AIQueryRequest, AIQueryResponse,
    UserCreate, UserResponse, UserLogin,
    CompanyCreate, CompanyResponse,
    EquipmentCreate, EquipmentResponse,
    FileUploadResponse, PaginatedResponse
)
from config import settings

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

# Initialize services
db_manager = DatabaseManager()
auth_service = AuthService(db_manager)
project_service = ProjectService(db_manager)
file_service = FileService()
email_service = EmailService()

# Initialize core engines
cad_parser = CADParser()
geometry_engine = GeometryEngine()
load_calc_engine = LoadCalculationEngine()
wall_split_engine = WallSplitEngine()
ducted_engine = DuctedEngine()
vrv_engine = VRVEngine()
ai_engine = AIEngine()
rule_engine = RuleEngine()
qa_engine = QAEngine()
export_engine = ExportEngine()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    await db_manager.connect()
    await ai_engine.initialize()
    await rule_engine.load_rules()
    print("🚀 iCOOL Platform started successfully!")
    yield
    # Shutdown
    await db_manager.disconnect()
    await ai_engine.shutdown()
    print("👋 iCOOL Platform shutdown complete.")

app = FastAPI(
    title="iCOOL HVAC AI CAD Platform",
    description="Complete HVAC Engineering Platform with AI Assistance",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# AUTHENTICATION ENDPOINTS
# ============================================

@app.post("/api/v1/auth/register", response_model=UserResponse)
async def register(user: UserCreate):
    """Register a new user"""
    return await auth_service.register_user(user)

@app.post("/api/v1/auth/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login and get access token"""
    return await auth_service.authenticate_user(form_data.username, form_data.password)

@app.get("/api/v1/auth/me", response_model=UserResponse)
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get current authenticated user"""
    return await auth_service.get_user_from_token(token)

@app.post("/api/v1/auth/refresh")
async def refresh_token(token: str = Depends(oauth2_scheme)):
    """Refresh access token"""
    return await auth_service.refresh_token(token)

# ============================================
# COMPANY ENDPOINTS
# ============================================

@app.post("/api/v1/companies", response_model=CompanyResponse)
async def create_company(
    company: CompanyCreate,
    token: str = Depends(oauth2_scheme)
):
    """Create a new company (tenant)"""
    user = await auth_service.get_user_from_token(token)
    return await project_service.create_company(company, user.id)

@app.get("/api/v1/companies/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Get company details"""
    user = await auth_service.get_user_from_token(token)
    return await project_service.get_company(company_id, user.id)

# ============================================
# PROJECT ENDPOINTS
# ============================================

@app.post("/api/v1/projects", response_model=ProjectResponse)
async def create_project(
    project: ProjectCreate,
    token: str = Depends(oauth2_scheme)
):
    """Create a new HVAC project"""
    user = await auth_service.get_user_from_token(token)
    return await project_service.create_project(project, user.id)

@app.get("/api/v1/projects", response_model=PaginatedResponse[ProjectResponse])
async def list_projects(
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    token: str = Depends(oauth2_scheme)
):
    """List all projects for current user"""
    user = await auth_service.get_user_from_token(token)
    return await project_service.list_projects(user.id, page, limit, status)

@app.get("/api/v1/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Get project details"""
    user = await auth_service.get_user_from_token(token)
    return await project_service.get_project(project_id, user.id)

@app.put("/api/v1/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project: ProjectUpdate,
    token: str = Depends(oauth2_scheme)
):
    """Update project"""
    user = await auth_service.get_user_from_token(token)
    return await project_service.update_project(project_id, project, user.id)

@app.delete("/api/v1/projects/{project_id}")
async def delete_project(
    project_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Delete project"""
    user = await auth_service.get_user_from_token(token)
    await project_service.delete_project(project_id, user.id)
    return {"message": "Project deleted successfully"}

# ============================================
# FILE UPLOAD ENDPOINTS
# ============================================

@app.post("/api/v1/projects/{project_id}/files", response_model=FileUploadResponse)
async def upload_file(
    project_id: str,
    file: UploadFile = File(...),
    file_type: str = "dwg",
    token: str = Depends(oauth2_scheme)
):
    """Upload CAD file (DWG/DXF/PDF)"""
    user = await auth_service.get_user_from_token(token)

    # Validate file
    if not file_service.validate_file(file):
        raise HTTPException(status_code=400, detail="Invalid file format or size")

    # Save file
    file_info = await file_service.save_file(file, project_id, user.id)

    # Trigger async parsing
    celery_app.send_task(
        "parse_cad_file",
        args=[file_info.id, project_id, user.id]
    )

    return file_info

@app.get("/api/v1/projects/{project_id}/files")
async def list_project_files(
    project_id: str,
    token: str = Depends(oauth2_scheme)
):
    """List all files for a project"""
    user = await auth_service.get_user_from_token(token)
    return await file_service.list_files(project_id, user.id)

# ============================================
# CAD PARSING ENDPOINTS
# ============================================

@app.post("/api/v1/cad/parse/{file_id}")
async def parse_cad_file(
    file_id: str,
    background_tasks: BackgroundTasks,
    token: str = Depends(oauth2_scheme)
):
    """Parse CAD file and extract geometry"""
    user = await auth_service.get_user_from_token(token)

    # Get file
    file_info = await file_service.get_file(file_id, user.id)

    # Parse in background
    background_tasks.add_task(
        cad_parser.parse_async,
        file_info.path,
        file_info.project_id
    )

    return {"message": "Parsing started", "file_id": file_id}

@app.get("/api/v1/cad/parse/{file_id}/status")
async def get_parse_status(
    file_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Get CAD parsing status"""
    user = await auth_service.get_user_from_token(token)
    return await cad_parser.get_status(file_id)

@app.get("/api/v1/cad/parse/{file_id}/geometry")
async def get_parsed_geometry(
    file_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Get parsed geometry data"""
    user = await auth_service.get_user_from_token(token)
    return await cad_parser.get_geometry(file_id)

# ============================================
# ROOM DETECTION ENDPOINTS
# ============================================

@app.get("/api/v1/floors/{floor_id}/rooms", response_model=List[RoomResponse])
async def get_floor_rooms(
    floor_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Get all rooms for a floor"""
    user = await auth_service.get_user_from_token(token)
    return await project_service.get_floor_rooms(floor_id, user.id)

@app.post("/api/v1/floors/{floor_id}/rooms/detect")
async def detect_rooms(
    floor_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Auto-detect rooms from CAD geometry"""
    user = await auth_service.get_user_from_token(token)

    # Get floor geometry
    floor_geometry = await project_service.get_floor_geometry(floor_id)

    # Detect rooms using AI + geometry
    rooms = await geometry_engine.detect_rooms(floor_geometry)

    # Suggest room names using AI
    for room in rooms:
        room.suggested_name = await ai_engine.suggest_room_name(room)

    return rooms

@app.post("/api/v1/floors/{floor_id}/rooms/confirm")
async def confirm_rooms(
    floor_id: str,
    rooms: List[RoomCreate],
    token: str = Depends(oauth2_scheme)
):
    """Confirm detected rooms"""
    user = await auth_service.get_user_from_token(token)
    return await project_service.confirm_rooms(floor_id, rooms, user.id)

# ============================================
# LOAD CALCULATION ENDPOINTS
# ============================================

@app.post("/api/v1/rooms/{room_id}/load", response_model=LoadCalculationResponse)
async def calculate_room_load(
    room_id: str,
    request: LoadCalculationRequest,
    token: str = Depends(oauth2_scheme)
):
    """Calculate heat load for a room"""
    user = await auth_service.get_user_from_token(token)

    # Get room data
    room = await project_service.get_room(room_id, user.id)

    # Calculate load
    result = await load_calc_engine.calculate(
        room=room,
        climate_data=request.climate_data,
        standards=request.standards,
        calculation_level=request.calculation_level
    )

    # Save result
    await project_service.save_load_calculation(room_id, result)

    return result

@app.post("/api/v1/projects/{project_id}/load/bulk")
async def calculate_project_load(
    project_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Calculate load for all rooms in project"""
    user = await auth_service.get_user_from_token(token)

    # Get all rooms
    rooms = await project_service.get_project_rooms(project_id)

    # Calculate in parallel
    tasks = [load_calc_engine.calculate(room) for room in rooms]
    results = await asyncio.gather(*tasks)

    # Save all
    await project_service.save_bulk_load_calculations(project_id, results)

    return {"message": "Bulk calculation complete", "rooms_processed": len(results)}

# ============================================
# ZONE MANAGEMENT ENDPOINTS
# ============================================

@app.post("/api/v1/projects/{project_id}/zones/auto")
async def auto_create_zones(
    project_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Auto-create zones based on load and room types"""
    user = await auth_service.get_user_from_token(token)

    # Get project data
    project = await project_service.get_project(project_id, user.id)
    rooms = await project_service.get_project_rooms(project_id)

    # AI suggests zone division
    zone_suggestions = await ai_engine.suggest_zones(rooms, project)

    # Validate with rule engine
    validated_zones = await rule_engine.validate_zones(zone_suggestions)

    return validated_zones

@app.post("/api/v1/projects/{project_id}/zones", response_model=ZoneResponse)
async def create_zone(
    project_id: str,
    zone: ZoneCreate,
    token: str = Depends(oauth2_scheme)
):
    """Create a new zone"""
    user = await auth_service.get_user_from_token(token)
    return await project_service.create_zone(project_id, zone, user.id)

@app.get("/api/v1/projects/{project_id}/zones", response_model=List[ZoneResponse])
async def get_project_zones(
    project_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Get all zones for a project"""
    user = await auth_service.get_user_from_token(token)
    return await project_service.get_project_zones(project_id, user.id)

# ============================================
# DESIGN ENGINE ENDPOINTS
# ============================================

@app.post("/api/v1/design/wall-split", response_model=DesignResponse)
async def design_wall_split(
    request: DesignRequest,
    token: str = Depends(oauth2_scheme)
):
    """Design Wall Split system"""
    user = await auth_service.get_user_from_token(token)

    # Get zone data
    zone = await project_service.get_zone(request.zone_id, user.id)

    # Design
    design = await wall_split_engine.design(
        zone=zone,
        constraints=request.constraints,
        preferences=request.preferences
    )

    # Validate
    validated_design = await rule_engine.validate_wall_split(design)

    # AI suggestions
    ai_suggestions = await ai_engine.suggest_wall_split_improvements(validated_design)

    return DesignResponse(
        design=validated_design,
        ai_suggestions=ai_suggestions,
        warnings=validated_design.warnings,
        status="preview"
    )

@app.post("/api/v1/design/ducted", response_model=DesignResponse)
async def design_ducted(
    request: DesignRequest,
    token: str = Depends(oauth2_scheme)
):
    """Design Ducted Split system"""
    user = await auth_service.get_user_from_token(token)

    zone = await project_service.get_zone(request.zone_id, user.id)

    design = await ducted_engine.design(
        zone=zone,
        constraints=request.constraints,
        preferences=request.preferences
    )

    validated_design = await rule_engine.validate_ducted(design)
    ai_suggestions = await ai_engine.suggest_ducted_improvements(validated_design)

    return DesignResponse(
        design=validated_design,
        ai_suggestions=ai_suggestions,
        warnings=validated_design.warnings,
        status="preview"
    )

@app.post("/api/v1/design/vrv", response_model=DesignResponse)
async def design_vrv(
    request: DesignRequest,
    token: str = Depends(oauth2_scheme)
):
    """Design VRV/VRF system"""
    user = await auth_service.get_user_from_token(token)

    zone = await project_service.get_zone(request.zone_id, user.id)

    design = await vrv_engine.design(
        zone=zone,
        constraints=request.constraints,
        preferences=request.preferences,
        manufacturer=request.manufacturer
    )

    validated_design = await rule_engine.validate_vrv(design)
    ai_suggestions = await ai_engine.suggest_vrv_improvements(validated_design)

    return DesignResponse(
        design=validated_design,
        ai_suggestions=ai_suggestions,
        warnings=validated_design.warnings,
        status="preview"
    )

@app.post("/api/v1/design/{design_id}/confirm")
async def confirm_design(
    design_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Confirm and apply design"""
    user = await auth_service.get_user_from_token(token)
    return await project_service.confirm_design(design_id, user.id)

# ============================================
# VALIDATION (QA) ENDPOINTS
# ============================================

@app.post("/api/v1/design/{design_id}/validate", response_model=ValidationResponse)
async def validate_design(
    design_id: str,
    request: ValidationRequest,
    token: str = Depends(oauth2_scheme)
):
    """Run engineering QA on design"""
    user = await auth_service.get_user_from_token(token)

    # Get design
    design = await project_service.get_design(design_id, user.id)

    # Run QA checks
    qa_results = await qa_engine.validate(
        design=design,
        checks=request.checks,
        standards=request.standards
    )

    # Categorize results
    errors = [r for r in qa_results if r.severity == "error"]
    warnings = [r for r in qa_results if r.severity == "warning"]
    info = [r for r in qa_results if r.severity == "info"]

    return ValidationResponse(
        design_id=design_id,
        errors=errors,
        warnings=warnings,
        info=info,
        can_export=len(errors) == 0,
        summary={
            "total_issues": len(qa_results),
            "errors": len(errors),
            "warnings": len(warnings),
            "info": len(info)
        }
    )

# ============================================
# EXPORT ENDPOINTS
# ============================================

@app.post("/api/v1/projects/{project_id}/exports")
async def export_project(
    project_id: str,
    request: ExportRequest,
    background_tasks: BackgroundTasks,
    token: str = Depends(oauth2_scheme)
):
    """Export project to various formats"""
    user = await auth_service.get_user_from_token(token)

    # Validate design first
    design = await project_service.get_design(request.design_id, user.id)

    # Export in background
    export_task = celery_app.send_task(
        "export_project",
        args=[
            project_id,
            request.design_id,
            request.formats,
            request.options,
            user.id
        ]
    )

    return {
        "message": "Export started",
        "task_id": export_task.id,
        "formats": request.formats
    }

@app.get("/api/v1/exports/{export_id}/status")
async def get_export_status(
    export_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Get export status"""
    user = await auth_service.get_user_from_token(token)
    return await export_engine.get_status(export_id)

@app.get("/api/v1/exports/{export_id}/download")
async def download_export(
    export_id: str,
    token: str = Depends(oauth2_scheme)
):
    """Download exported files"""
    user = await auth_service.get_user_from_token(token)

    file_path = await export_engine.get_export_path(export_id, user.id)

    return FileResponse(
        file_path,
        media_type="application/zip",
        filename=f"export_{export_id}.zip"
    )

# ============================================
# AI ASSISTANT ENDPOINTS
# ============================================

@app.post("/api/v1/ai/suggest", response_model=AIQueryResponse)
async def ai_suggest(
    request: AIQueryRequest,
    token: str = Depends(oauth2_scheme)
):
    """Get AI suggestions for design"""
    user = await auth_service.get_user_from_token(token)

    # Get context
    context = await project_service.get_ai_context(request.project_id, user.id)

    # Get AI suggestion
    suggestion = await ai_engine.suggest(
        query=request.query,
        context=context,
        design_type=request.design_type
    )

    # Validate with rule engine
    validated = await rule_engine.validate_ai_suggestion(suggestion)

    return AIQueryResponse(
        suggestion=validated.suggestion,
        explanation=validated.explanation,
        confidence=validated.confidence,
        related_rules=validated.related_rules,
        warnings=validated.warnings
    )

@app.post("/api/v1/ai/explain")
async def ai_explain(
    request: AIQueryRequest,
    token: str = Depends(oauth2_scheme)
):
    """Get AI explanation for errors or design decisions"""
    user = await auth_service.get_user_from_token(token)

    explanation = await ai_engine.explain(
        query=request.query,
        project_id=request.project_id,
        design_id=request.design_id
    )

    return {"explanation": explanation}

@app.post("/api/v1/ai/generate-report")
async def ai_generate_report(
    request: AIQueryRequest,
    token: str = Depends(oauth2_scheme)
):
    """Generate technical report using AI"""
    user = await auth_service.get_user_from_token(token)

    report = await ai_engine.generate_report(
        project_id=request.project_id,
        report_type=request.report_type,
        language=request.language or "ar"
    )

    return {"report": report}

# ============================================
# EQUIPMENT LIBRARY ENDPOINTS
# ============================================

@app.get("/api/v1/library/equipment")
async def list_equipment(
    manufacturer: Optional[str] = None,
    system_type: Optional[str] = None,
    capacity_min: Optional[float] = None,
    capacity_max: Optional[float] = None,
    token: str = Depends(oauth2_scheme)
):
    """List equipment from library"""
    user = await auth_service.get_user_from_token(token)

    filters = {
        "manufacturer": manufacturer,
        "system_type": system_type,
        "capacity_min": capacity_min,
        "capacity_max": capacity_max
    }

    return await project_service.list_equipment(filters)

@app.post("/api/v1/library/equipment", response_model=EquipmentResponse)
async def add_equipment(
    equipment: EquipmentCreate,
    token: str = Depends(oauth2_scheme)
):
    """Add new equipment to library (admin only)"""
    user = await auth_service.get_user_from_token(token)

    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    return await project_service.add_equipment(equipment)

# ============================================
# REPORTING ENDPOINTS
# ============================================

@app.get("/api/v1/projects/{project_id}/reports/{report_type}")
async def get_report(
    project_id: str,
    report_type: str,
    format: str = "pdf",
    token: str = Depends(oauth2_scheme)
):
    """Get project report"""
    user = await auth_service.get_user_from_token(token)

    report = await export_engine.generate_report(
        project_id=project_id,
        report_type=report_type,
        format=format,
        user_id=user.id
    )

    return FileResponse(
        report.path,
        media_type=f"application/{format}",
        filename=f"{report_type}_{project_id}.{format}"
    )

# ============================================
# WEBHOOK ENDPOINTS
# ============================================

@app.post("/api/v1/webhooks")
async def create_webhook(
    webhook: dict,
    token: str = Depends(oauth2_scheme)
):
    """Create webhook for external integrations"""
    user = await auth_service.get_user_from_token(token)
    return await project_service.create_webhook(webhook, user.id)

# ============================================
# HEALTH CHECK
# ============================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "database": await db_manager.health_check(),
            "ai_engine": ai_engine.is_ready(),
            "cad_parser": cad_parser.is_ready()
        }
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "iCOOL HVAC AI CAD Platform",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=settings.WORKERS
    )
