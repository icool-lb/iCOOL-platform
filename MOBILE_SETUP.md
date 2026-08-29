# iCOOL Platform - Mobile Activation Guide
# تفعيل منصة iCOOL من الهاتف

---

## الطريقة 1: Termux (Android) - التشغيل المحلي

### 1.1 تثبيت Termux
```bash
# من F-Droid (مستحسن) أو Google Play
# رابط: https://f-droid.org/packages/com.termux/
```

### 1.2 تحديث Termux
```bash
pkg update && pkg upgrade -y
```

### 1.3 تثبيت المتطلبات
```bash
pkg install python python-pip postgresql redis git openssh -y
```

### 1.4 تثبيت Python dependencies
```bash
pip install fastapi uvicorn sqlalchemy psycopg2-binary redis celery pydantic python-jose passlib ezdxf shapely numpy openai anthropic reportlab pandas openpyxl python-dotenv
```

**ملاحظة:** PostGIS و GeoAlchemy2 غير متوفرين على Termux. استخدم SQLite بدلاً من PostgreSQL للتجربة.

### 1.5 تعديل الإعدادات للهاتف
```bash
# أنشئ ملف .env
nano backend/.env
```

محتوى `.env` للهاتف:
```
DEBUG=true
HOST=0.0.0.0
PORT=8000
SECRET_KEY=mobile-test-key-change-later
DATABASE_URL=sqlite:///./icool_mobile.db
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
STORAGE_TYPE=local
STORAGE_PATH=./uploads
OPENAI_API_KEY=sk-your-key
```

### 1.6 تعديل database.py للـ SQLite
```bash
# عدل models/database.py
# استبدل:
# from geoalchemy2 import Geometry
# بـ:
# Geometry = None  # أو أزل PostGIS

# وغيّر:
# engine = create_engine(settings.DATABASE_URL)
# لـ:
# engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
```

### 1.7 تشغيل Redis
```bash
redis-server --daemonize yes
```

### 1.8 تشغيل التطبيق
```bash
cd icool-platform/backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 1.9 الوصول من المتصفح
```
http://localhost:8000/docs
# أو من نفس الجهاز:
http://127.0.0.1:8000/health
```

---

## الطريقة 2: VPS + SSH (الأفضل للإنتاج)

### 2.1 تأجير VPS (من الهاتف)
```
استخدم تطبيق المتصفح:
- DigitalOcean: https://cloud.digitalocean.com
- AWS: https://aws.amazon.com
- Hetzner: https://hetzner.com
- Vultr: https://vultr.com
```

المواصفات المقترحة:
- 2 vCPU
- 4 GB RAM
- 50 GB SSD
- Ubuntu 22.04

### 2.2 الاتصال بالسيرفر من الهاتف
```bash
# استخدم Termius أو JuiceSSH
# أو حتى Termux:

ssh root@YOUR_SERVER_IP
```

### 2.3 تثبيت Docker (من الهاتف عبر SSH)
```bash
# في Termux أو Termius
ssh root@YOUR_SERVER_IP

# ثم على السيرفر:
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# تثبيت Docker Compose
apt install docker-compose -y
```

### 2.4 رفع المشروع للسيرفر
```bash
# من الهاتف (Termux)
scp -r icool-platform root@YOUR_SERVER_IP:/opt/

# أو استخدم rsync:
rsync -avz icool-platform/ root@YOUR_SERVER_IP:/opt/icool-platform/
```

### 2.5 تشغيل المشروع على السيرفر
```bash
ssh root@YOUR_SERVER_IP
cd /opt/icool-platform
cp backend/.env.example backend/.env
# عدل .env بـ nano

docker-compose up -d
docker-compose exec backend alembic upgrade head
```

### 2.6 فتح API من الهاتف
```
http://YOUR_SERVER_IP:8000/docs
```

---

## الطريقة 3: GitHub Codespaces (الأسهل)

### 3.1 رفع المشروع لـ GitHub
```bash
# من Termux أو الكمبيوتر
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/icool-platform.git
git push -u origin main
```

### 3.2 فتح Codespaces من الهاتف
```
1. افتح GitHub في متصفح الهاتف
2. اذهب لـ repository
3. اضغط Code > Codespaces > Create codespace
```

### 3.3 تشغيل في Codespaces
```bash
# يعمل تلقائياً في المتصفح!
cd icool-platform
cp backend/.env.example backend/.env
# عدل .env

docker-compose up -d
docker-compose exec backend alembic upgrade head
```

### 3.4 الوصول
```
GitHub يوفر رابط عام تلقائياً:
https://YOUR_CODESPACE_NAME-8000.github.dev
```

---

## الطريقة 4: Railway / Render (نشر فوري)

### 4.1 Railway (مجاني)
```
1. سجل في railway.app من الهاتف
2. اربط GitHub repository
3. اضغط Deploy
4. يعمل تلقائياً!
```

### 4.2 Render (مجاني)
```
1. سجل في render.com
2. New Web Service > Connect GitHub
3. اختر repository
4. Build Command: docker-compose up -d
5. Deploy!
```

---

## مقارنة سريعة

| الطريقة | الصعوبة | التكلفة | الاستخدام |
|:---|:---|:---|:---|
| **Termux** | متوسطة | مجاني | تجربة محلية |
| **VPS + SSH** | سهلة | $5-10/شهر | إنتاج حقيقي |
| **Codespaces** | سهلة جداً | مجاني (120 ساعة) | تطوير + تجربة |
| **Railway/Render** | سهلة جداً | مجاني/مدفوع | إنتاج بدون إدارة |

---

## توصيتي

- **للتجربة السريعة:** GitHub Codespaces
- **للإنتاج الحقيقي:** VPS (DigitalOcean/Vultr) + SSH من Termius
- **للتطوير المستمر:** Railway أو Render

---

## تطبيقات SSH موصى بها للهاتف

| التطبيق | المنصة | الرابط |
|:---|:---|:---|
| **Termius** | iOS/Android | App Store / Play Store |
| **JuiceSSH** | Android | Play Store |
| **Termux** | Android | F-Droid |
| **a-Shell** | iOS | App Store |

---

## ملاحظات مهمة

1. **PostGIS** لا يعمل على Termux - استخدم SQLite للتجربة
2. **MinIO** يستهلك ذاكرة - على VPS صغيرة استخدم S3 حقيقي
3. **Celery** يحتاج RAM كافية - 2GB على الأقل
4. **للتجربة بدون Docker:** شغّل فقط `uvicorn main:app` مع SQLite

---

## أمر سريع للتجربة (Termux)

```bash
# نسخة لطيفة وسريعة
pkg install python python-pip git -y
pip install fastapi uvicorn sqlalchemy pydantic python-jose passlib python-dotenv

# استنسخ المشروع
git clone https://github.com/YOUR_REPO/icool-platform.git
cd icool-platform/backend

# عدل database.py لـ SQLite
# شغّل مباشرة
uvicorn main:app --host 0.0.0.0 --port 8000

# افتح من المتصفح:
# http://localhost:8000/docs
```
