# CivicLens — Complete Setup & Deployment Guide

> Last Updated: 2026-09-01 | Version: 1.0

---

## Table of Contents

1. [Quick Start (Single Machine — SQLite)](#1-quick-start-single-machine)
2. [PostgreSQL Setup (City-Scale)](#2-postgresql-setup)
3. [MySQL Setup (Alternative)](#3-mysql-setup)
4. [Message Queue (Redis)](#4-message-queue-redis)
5. [Edge AI Mode](#5-edge-ai-mode)
6. [Multi-Server / Distributed Setup](#6-multi-server--distributed-setup)
7. [Docker Deployment](#7-docker-deployment)
8. [Security Hardening](#8-security-hardening)
9. [Configuration Reference](#9-configuration-reference)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Quick Start (Single Machine)

**Use case:** Building, campus, small facility — up to 50 cameras
**Database:** SQLite (zero setup)
**Time:** 5 minutes

### Step 1: Install CivicLens

```
Double-click: CivicLens-Setup.exe
    ↓
UAC Prompt → Click "Yes" (admin permission)
    ↓
Install Wizard → Choose install location (default: C:\Program Files\CivicLens)
    ↓
Click "Install"
    ↓
Check "Launch CivicLens Command Center" → Click "Finish"
```

### Step 2: Create the First Administrator

```
┌─────────────────────────────────────────────────┐
│  CivicLens Command Center                       │
│                                                 │
│  First-run bootstrap                            │
│  Create an administrator username and password  │
│                                                 │
│  [Create Administrator]                         │
└─────────────────────────────────────────────────┘
```

### Step 3: Add Cameras

```
Sidebar → Cameras → "Add Camera"
    ↓
Name: Gate 1
RTSP URL: rtsp://192.168.1.100:554/stream1
    ↓
Click "Save" → Camera appears on Camera Wall
```

**That's it. No database setup, no configuration needed.**

---

## 2. PostgreSQL Setup (City-Scale)

**Use case:** City-wide deployment, 100-500+ cameras, multi-server
**Time:** 20 minutes

### Step 1: Install PostgreSQL

**Windows:**
```
1. Download: https://www.postgresql.org/download/windows/
2. Run installer
3. Set password for 'postgres' user (remember it!)
4. Port: 5432 (default)
5. Finish installation
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Step 2: Create Database & User

Open **pgAdmin** (comes with PostgreSQL) or use command line:

```bash
# Command line method:
psql -U postgres

postgres=# CREATE DATABASE civiclens;
postgres=# CREATE USER civiclens_user WITH PASSWORD 'your_strong_password';
postgres=# GRANT ALL PRIVILEGES ON DATABASE civiclens TO civiclens_user;
postgres=# \c civiclens
postgres=# GRANT ALL ON SCHEMA public TO civiclens_user;
postgres=# \q
```

**Expected output:**
```
CREATE DATABASE
CREATE ROLE
GRANT
GRANT
```

### Step 3: Configure CivicLens

Navigate to your CivicLens installation folder:
```
C:\Program Files\CivicLens\backend\
```

Copy `.env.example` to `.env`:
```
copy .env.example .env
```

Edit `.env`:
```ini
# Change this line:
DATABASE_URL=postgresql://civiclens_user:your_strong_password@localhost:5432/civiclens
```

### Step 4: Install PostgreSQL Driver

```bash
# In the CivicLens backend folder:
cd "C:\Program Files\CivicLens\backend\venv\Scripts"
.\pip.exe install psycopg2-binary
```

### Step 5: Restart CivicLens

```
1. Close CivicLens (Ctrl+C in console or close the window)
2. Double-click CivicLens.exe again
3. Tables auto-created in PostgreSQL
4. Login and verify
```

**Verification — check tables in PostgreSQL:**
```bash
psql -U civiclens_user -d civiclens -c "\dt"
```

```
                 List of relations
 Schema |          Name           | Type  |    Owner
--------+-------------------------+-------+-----------------
 public | alembic_version         | table | civiclens_user
 public | alerts                  | table | civiclens_user
 public | cameras                 | table | civiclens_user
 public | civic_events            | table | civiclens_user
 public | detections              | table | civiclens_user
 public | missing_persons         | table | civiclens_user
 public | participants            | table | civiclens_user
 public | users                   | table | civiclens_user
 public | watchlist               | table | civiclens_user
 ... (17 tables total)
```

---

## 3. MySQL Setup (Alternative)

### Step 1: Install MySQL

```
1. Download: https://dev.mysql.com/downloads/installer/
2. Run MySQL Installer
3. Choose "Server only"
4. Set root password
5. Finish
```

### Step 2: Create Database

```bash
mysql -u root -p

mysql> CREATE DATABASE civiclens CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
mysql> CREATE USER 'civiclens_user'@'localhost' IDENTIFIED BY 'your_password';
mysql> GRANT ALL PRIVILEGES ON civiclens.* TO 'civiclens_user'@'localhost';
mysql> FLUSH PRIVILEGES;
mysql> EXIT;
```

### Step 3: Configure .env

```ini
DATABASE_URL=mysql+pymysql://civiclens_user:your_password@localhost:3306/civiclens
```

### Step 4: Install Driver

```bash
pip install pymysql cryptography
```

### Step 5: Restart CivicLens

---

## 4. Message Queue (Redis)

**Use case:** 100+ cameras, distributed processing across multiple servers
**Time:** 15 minutes

### Step 1: Install Redis

**Windows:**
```
1. Download: https://github.com/tporadowski/redis/releases
2. Extract to C:\Redis
3. Run: C:\Redis\redis-server.exe
4. Default port: 6379
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**Docker:**
```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### Step 2: Configure CivicLens

Edit `backend/.env`:
```ini
MESSAGE_QUEUE=redis://localhost:6379
QUEUE_CHANNEL=civiclens:detections
```

### Step 3: Restart CivicLens

```
Close CivicLens → Double-click CivicLens.exe
Backend log will show: "Message queue connected: redis://localhost:6379"
```

### How It Works
```
┌──────────┐     publish      ┌───────┐     consume     ┌──────────┐
│ Camera   │ ──────────────→ │ Redis │ ──────────────→ │ Worker   │
│ Detection│                  │ Queue │                  │ Node     │
└──────────┘                  └───────┘                  └──────────┘
     ↑                                                      │
     └──────────────── results/alerts ←─────────────────────┘
```

- Detection results are published to Redis instead of processed inline
- Worker nodes consume events and process them asynchronously
- Scales horizontally — add more workers to handle more cameras

---

## 5. Edge AI Mode

**Use case:** Resource-constrained devices, on-camera processing, Raspberry Pi, low-end servers
**Time:** 2 minutes (just edit .env)

### Step 1: Enable Edge Mode

Edit `backend/.env`:
```ini
EDGE_MODE=1
```

### Step 2: Fine-Tune (Optional)

```ini
EDGE_IMG_SIZE=320          # Lower resolution = faster (default: 320)
EDGE_FRAME_SKIP=3          # Process every 3rd frame (default: 3)
EDGE_CONF_THRESHOLD=0.35   # Higher = fewer detections, less load
EDGE_SKIP_SCENE=1          # Skip heavy scene analysis (SegFormer)
```

### What Edge Mode Does

| Setting | Full Mode | Edge Mode |
|---------|-----------|-----------|
| Model | yolov8n (640px) | yolov8n (320px) |
| Frame Skip | None (every frame) | Every 3rd frame |
| Confidence | 0.25 | 0.35 |
| Scene Analysis | Full | Skipped |
| GPU Required | Recommended | Not needed (CPU OK) |
| RAM Usage | ~2GB | ~500MB |

### Step 3: Restart

No code changes needed — just restart CivicLens.exe.

---

## 6. Multi-Server / Distributed Setup

**Use case:** 500+ cameras across multiple locations

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Edge Node 1 │     │  Edge Node 2 │     │  Edge Node 3 │
│  (50 cameras)│     │  (50 cameras)│     │  (50 cameras)│
│  GPU Server  │     │  GPU Server  │     │  GPU Server  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └────────────┬───────┴────────────────────┘
                    │
              ┌─────┴─────┐
              │ PostgreSQL │
              │  (Central) │
              └─────┬─────┘
                    │
              ┌─────┴─────┐
              │  Frontend  │
              │  (Next.js) │
              └───────────┘
```

### Step 1: Central Database Server

Install PostgreSQL on a dedicated server:
```
Server: db.civiclens.local
Port: 5432
Storage: 500GB SSD minimum
RAM: 16GB minimum
```

### Step 2: Edge Inference Nodes

Each edge node runs CivicLens backend only (no frontend):

```bash
# On each edge node:
1. Install CivicLens
2. Edit backend/.env:
   DATABASE_URL=postgresql://civiclens_user:password@db.civiclens.local:5432/civiclens

3. Start only backend:
   cd backend
   .\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Step 3: Frontend Server

Run Next.js frontend on a separate server:

```bash
# Frontend server:
1. Install Node.js 20+
2. cd civiclens-frontend
3. Edit .env.local:
   NEXT_PUBLIC_API_URL=http://edge-node-1.local:8000

4. npm run build
5. node server.js
```

### Step 4: Load Balancer (Optional)

Use Nginx to distribute API requests across edge nodes:

```nginx
upstream civiclens_backends {
    server edge-node-1.local:8000;
    server edge-node-2.local:8000;
    server edge-node-3.local:8000;
}

server {
    listen 80;
    location /api/ {
        proxy_pass http://civiclens_backends;
    }
}
```

---

## 7. Docker Deployment

### docker-compose.yml

```yaml
version: "3.8"

services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: civiclens
      POSTGRES_USER: civiclens_user
      POSTGRES_PASSWORD: your_password
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://civiclens_user:your_password@db:5432/civiclens
    ports:
      - "8000:8000"
    depends_on:
      - db
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  frontend:
    build: ./civiclens-frontend
    environment:
      NEXT_PUBLIC_API_URL: http://backend:8000
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  pgdata:
```

### Build & Run

```bash
docker-compose up -d --build
```

---

## 8. Security Hardening

### Secure Administrator Access

Create a strong administrator password during first-run bootstrap. To change it later:
```
Settings → Change Password
Current: [Your current password]
New: [A unique strong password]
```

### Network Security

```
✓ Use VPN for remote access
✓ Firewall: Only allow ports 3000, 8000 from trusted IPs
✓ HTTPS: Use Nginx + Let's Encrypt for SSL
✓ Change SECRET_KEY in .env to a random string
```

### Generate Secret Key

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Output:
```
dGhpcy1pcy1hLXNlY3JldC1rZXktY2hhbmdlLW1lLXBsZWFzZQ
```

Add to `.env`:
```ini
SECRET_KEY=dGhpcy1pcy1hLXNlY3JldC1rZXktY2hhbmdlLW1lLXBsZWFzZQ
```

---

## 9. Configuration Reference

All settings are configured via `backend/.env`. Copy `.env.example` to `.env` to get started.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///civiclens.db` | Database connection string |
| `MESSAGE_QUEUE` | _(empty)_ | Redis URL for message queue |
| `QUEUE_CHANNEL` | `civiclens:detections` | Redis pub/sub channel |
| `EDGE_MODE` | `0` | Enable lightweight edge processing |
| `EDGE_IMG_SIZE` | `640` / `320` | Inference resolution |
| `EDGE_FRAME_SKIP` | `1` / `3` | Process every Nth frame |
| `EDGE_CONF_THRESHOLD` | `0.25` / `0.35` | Detection confidence |
| `EDGE_SKIP_SCENE` | `0` / `1` | Skip SegFormer scene analysis |
| `WORKER_ONLY` | `0` | Backend-only mode (no frontend) |
| `STORAGE_RETENTION_DAYS` | `30` | Auto-delete old images |
| `BACKEND_PORT` | `8000` | Backend API port |
| `FRONTEND_PORT` | `3000` | Frontend UI port |
| `SECRET_KEY` | _(built-in)_ | JWT signing key (change in production) |

### Deployment Presets

**Single Building (≤50 cameras):**
```ini
# No .env needed — defaults work perfectly
```

**City District (50-200 cameras):**
```ini
DATABASE_URL=postgresql://user:pass@db-server:5432/civiclens
MESSAGE_QUEUE=redis://redis-server:6379
STORAGE_RETENTION_DAYS=60
```

**Edge Worker Node:**
```ini
DATABASE_URL=postgresql://user:pass@central-db:5432/civiclens
WORKER_ONLY=1
EDGE_MODE=1
EDGE_FRAME_SKIP=5
```

---

## 10. Troubleshooting

### Problem: "Database locked" errors

**Cause:** SQLite can't handle concurrent writes from many cameras
**Fix:** Switch to PostgreSQL (see Section 2)

### Problem: "Connection refused" to PostgreSQL

```bash
# Check PostgreSQL is running:
sudo systemctl status postgresql

# Check pg_hba.conf allows connections:
# Add this line to pg_hba.conf:
host  civiclens  civiclens_user  192.168.1.0/24  md5

# Restart PostgreSQL:
sudo systemctl restart postgresql
```

### Problem: "psycopg2 not found"

```bash
cd "C:\Program Files\CivicLens\backend\venv\Scripts"
.\pip.exe install psycopg2-binary
```

### Problem: Camera stream not connecting

```
1. Check RTSP URL is correct
2. Verify camera is reachable: ping 192.168.1.100
3. Check port 554 is open on camera
4. Try VLC: Media → Open Network Stream → paste RTSP URL
```

### Problem: High CPU/GPU usage

```
Solutions:
1. Reduce FPS in camera settings (default: 1 FPS for detection)
2. Use smaller YOLO model (yolov8n instead of yolov8s)
3. Add frame skipping (process every 5th frame)
4. Add more edge inference nodes
```

---

## Quick Reference

| Scenario | Database | Config |
|----------|----------|--------|
| Single building (≤50 cams) | SQLite | Default — no setup |
| City district (50-200 cams) | PostgreSQL | Edit `.env` |
| Full city (200+ cams) | PostgreSQL + Edge nodes | Multi-server |
| Enterprise (500+ cams) | PostgreSQL cluster + K8s | Docker + orchestration |

---

## Support

**Developer:** Usman Farid
**Made in:** Pakistan

---

*This document is part of CivicLens Command Center v1.0*
