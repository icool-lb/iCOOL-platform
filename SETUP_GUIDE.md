# iCOOL Platform - Setup & Activation Guide

---

## Step 1: Prerequisites

Install Docker & Docker Compose:
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install docker.io docker-compose

# macOS
brew install docker docker-compose

# Windows: Download Docker Desktop from docker.com
```

Verify:
```bash
docker --version
docker-compose --version
```

---

## Step 2: Extract & Enter

```bash
unzip icool-platform-complete.zip
cd icool-platform
```

---

## Step 3: Configure Environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```bash
# REQUIRED - Change this!
SECRET_KEY=your-super-secret-key-here-min-32-chars

# Optional - for AI features
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-your-anthropic-key

# Optional - for email notifications
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

---

## Step 4: Start All Services

```bash
docker-compose up -d
```

This starts 6 services:
| Service | Port | Description |
|:---|:---|:---|
| PostgreSQL + PostGIS | 5432 | Database |
| Redis | 6379 | Cache & Message Queue |
| MinIO | 9000/9001 | Object Storage |
| FastAPI Backend | 8000 | API Server |
| Celery Worker | - | Background Tasks |
| Celery Beat | - | Task Scheduler |

Check status:
```bash
docker-compose ps
```

---

## Step 5: Initialize Database

```bash
# Run migrations
docker-compose exec backend alembic upgrade head

# Verify tables
docker-compose exec postgres psql -U icool -d icool_db -c "\\dt"
```

---

## Step 6: Test the API

### Health Check
```bash
curl http://localhost:8000/health
```

Expected:
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "database": "connected",
  "redis": "connected",
  "storage": "connected"
}
```

### Register User
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"engineer@icool.com","password":"password123","first_name":"Ahmed","last_name":"Engineer"}'
```

### Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=engineer@icool.com&password=password123"
```

Response:
```json
{"access_token":"eyJ...","token_type":"bearer","expires_in":1800}
```

---

## Step 7: Test Core Features

### 1. Create Project
```bash
curl -X POST http://localhost:8000/api/v1/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"company_id":"comp-1","name":"Office Building HVAC","building_type":"office","design_standard":"ASHRAE"}'
```

### 2. Upload CAD File
```bash
curl -X POST http://localhost:8000/api/v1/projects/PROJECT_ID/files \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/plan.dxf"
```

### 3. Parse CAD (Async)
```bash
curl -X POST http://localhost:8000/api/v1/cad/parse/FILE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Calculate Load
```bash
curl -X POST http://localhost:8000/api/v1/rooms/ROOM_ID/load \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"standards":"ASHRAE","calculation_level":"engineering"}'
```

### 5. Design Wall Split
```bash
curl -X POST http://localhost:8000/api/v1/design/wall-split \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"zone_id":"ZONE_ID","manufacturer":"daikin","constraints":{"max_pipe_length":15}}'
```

### 6. Validate Design
```bash
curl -X POST http://localhost:8000/api/v1/design/DESIGN_ID/validate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 7. Export Files (Async)
```bash
curl -X POST http://localhost:8000/api/v1/projects/PROJECT_ID/exports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"design_id":"DESIGN_ID","formats":["dxf","pdf","boq_excel"],"language":"ar"}'
```

---

## Step 8: Run Tests

```bash
pip install -r requirements.txt
pytest tests/ -v
pytest tests/ --cov=backend --cov-report=html
```

---

## Step 9: Monitor Celery

```bash
# View task queue
docker-compose exec redis redis-cli -n 1 LLEN celery

# View worker logs
docker-compose logs -f celery-worker

# Flower dashboard
docker-compose exec celery-worker celery -A workers.celery_app flower --port=5555
```

---

## Troubleshooting

| Problem | Solution |
|:---|:---|
| Port 8000 in use | `sudo lsof -i :8000` then kill, or change port |
| DB connection failed | `docker-compose restart postgres` |
| Redis failed | `docker-compose restart redis` |
| MinIO bucket missing | `docker-compose exec minio mc mb local/icool-files` |

---

## Production Checklist

- [ ] Change all default passwords
- [ ] Use proper SSL certificates
- [ ] Set up reverse proxy (Nginx/Traefik)
- [ ] Configure backups
- [ ] Enable monitoring (Prometheus/Grafana)
- [ ] Set up log aggregation (ELK)

---

## Support

iCOOL Engineering Team
