# iCOOL HVAC AI CAD Platform v2.0

## iCOOL Engineering Platform - Smart HVAC Design System

[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688.svg)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://postgresql.org)
[![PostGIS](https://img.shields.io/badge/PostGIS-3.4-3E9B5B.svg)](https://postgis.net)

---

## Architecture

```
+-------------------------------+
|      iCOOL Platform v2.0      |
+-------------------------------+
| Web | Mobile | CAD Plugin     |
+-------------------------------+
|      FastAPI Backend          |
|  CAD | Load | Design | AI     |
|  Rule Engine | QA | Export    |
+-------------------------------+
| PostgreSQL+PostGIS | Redis    |
| MinIO S3 Storage              |
+-------------------------------+
```

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.11+ (for local dev)
- OpenAI API Key (optional, for AI)

### Run with Docker Compose

```bash
cd icool-platform
cp backend/.env.example backend/.env
# Edit .env with your API keys
nano backend/.env

docker-compose up -d
docker-compose exec backend alembic upgrade head

# Open API docs
open http://localhost:8000/docs
```

### Services
| Service | URL | Description |
|:---|:---|:---|
| API | http://localhost:8000 | FastAPI backend |
| API Docs | http://localhost:8000/docs | Swagger UI |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache/Queue |
| MinIO Console | http://localhost:9001 | Object storage |

---

## Project Structure

```
icool-platform/
├── backend/
│   ├── main.py              # FastAPI app (30+ endpoints)
│   ├── config.py            # Pydantic Settings
│   ├── schemas/             # 11 Pydantic model files
│   ├── models/
│   │   └── database.py      # 17 SQLAlchemy + PostGIS models
│   ├── core/
│   │   ├── cad_engine/      # DWG/DXF parsing (ezdxf+shapely)
│   │   ├── load_calc/       # ASHRAE calculations
│   │   ├── design_engine/   # Wall/Ducted/VRV designers
│   │   ├── ai_layer/        # GPT-4/Claude integration
│   │   ├── rule_engine/     # 20+ engineering rules
│   │   ├── qa_engine/       # 30+ validation checks
│   │   └── export_engine/   # DXF/PDF/Excel/Reports
│   ├── services/
│   │   ├── auth_service.py  # JWT + RBAC
│   │   ├── project_service.py
│   │   ├── file_service.py
│   │   └── email_service.py
│   ├── workers/
│   │   ├── celery_app.py    # Task queue setup
│   │   └── tasks/           # Background jobs
│   └── alembic/             # DB migrations
├── tests/                   # pytest suite
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## Core Features

| Module | Status | Description |
|:---|:---|:---|
| **CAD Parser** | Ready | ezdxf + shapely geometry extraction |
| **Room Detection** | Ready | Polygonization + AI naming |
| **Load Calculation** | Ready | ASHRAE RTS (2 levels) |
| **Wall Split Design** | Ready | Full design + piping |
| **Ducted Design** | Ready | Duct sizing + ESP calculation |
| **VRV/VRF Design** | Ready | Manufacturer-aware (Daikin/Mitsubishi/Toshiba/Carrier) |
| **AI Assistant** | Ready | GPT-4/Claude + Rule Engine safety |
| **QA Validation** | Ready | 30+ engineering checks |
| **Export Engine** | Ready | DXF/PDF/Excel/Reports |
| **Multi-tenant** | Ready | Company isolation + RBAC |

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|:---|:---|:---|
| POST | `/api/v1/auth/register` | Register |
| POST | `/api/v1/auth/login` | Login (OAuth2) |
| GET | `/api/v1/auth/me` | Current user |
| POST | `/api/v1/auth/refresh` | Refresh token |

### Projects
| Method | Endpoint | Description |
|:---|:---|:---|
| POST | `/api/v1/projects` | Create |
| GET | `/api/v1/projects` | List (paginated) |
| GET | `/api/v1/projects/{id}` | Get |
| PUT | `/api/v1/projects/{id}` | Update |
| DELETE | `/api/v1/projects/{id}` | Delete |

### CAD & Design
| Method | Endpoint | Description |
|:---|:---|:---|
| POST | `/api/v1/projects/{id}/files` | Upload CAD |
| POST | `/api/v1/cad/parse/{file_id}` | Parse CAD (async) |
| POST | `/api/v1/rooms/{id}/load` | Calculate load |
| POST | `/api/v1/design/wall-split` | Design Wall Split |
| POST | `/api/v1/design/ducted` | Design Ducted |
| POST | `/api/v1/design/vrv` | Design VRV |
| POST | `/api/v1/design/{id}/validate` | Run QA |
| POST | `/api/v1/projects/{id}/exports` | Export files (async) |
| POST | `/api/v1/ai/suggest` | AI suggestions |
| POST | `/api/v1/ai/explain` | Explain errors |

---

## Testing

```bash
pytest tests/ -v
pytest tests/ --cov=backend --cov-report=html
```

---

## License

Proprietary Software - iCOOL Engineering Platform
(c) 2026 iCOOL Engineering. All rights reserved.
