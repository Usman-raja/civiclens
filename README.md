# CivicLens

**AI-powered video intelligence for safer, more responsive cities.**

CivicLens turns live camera feeds into actionable civic intelligence: face matching for registered profiles, watchlists and missing persons; object and scene detection; safety alerts; civic-behavior events; and operator-facing analytics in one command-center interface.

## Hackathon Submission

### The problem

City operators and security teams must monitor many camera feeds simultaneously. Manual surveillance is slow, difficult to scale, and often identifies incidents only after a delay. Teams also lack a unified way to investigate watchlist sightings, missing-person matches, crowd risks, illegal parking, unattended objects, and civic-behavior patterns.

### Our solution

CivicLens is a full-stack command center that connects camera streams to AI-assisted detection and a responsive control-room UI. It:

- Detects people, vehicles, and unattended objects with YOLOv8.
- Matches faces against registered citizen profiles, watchlists, and missing-person cases with InsightFace embeddings.
- Produces alerts for crowd surges, parking violations, unattended objects, road-safety signals, watchlist sightings, and missing-person matches.
- Generates civic events such as jaywalking, loitering, queue discipline, and proper disposal, with configurable scoring.
- Gives operators a Camera Wall, live monitoring, alerts, profiles, analytics, reports, camera-zone tools, and settings.

### Who it serves

- City surveillance and emergency-response control rooms
- Campuses, industrial sites, transport hubs, and gated communities
- Public-safety teams managing missing-person or watchlist workflows
- Civic administrations seeking evidence-based operational insight

### Innovation and technology

- **Computer vision:** InsightFace, YOLOv8, YOLO-World, and SegFormer.
- **Backend:** FastAPI, SQLAlchemy, JWT authentication, role-based access control.
- **Frontend:** Next.js 16, React 19, Tailwind CSS 4.
- **Deployment choices without code changes:** SQLite for a small installation; PostgreSQL or MySQL through `DATABASE_URL`; Redis-backed queue configuration for distributed processing; Edge AI settings for reduced resource usage; Docker Compose for service deployment.
- **Operational UX:** An intelligence-agency-inspired responsive UI that works from laptop displays to 4K control-room walls.

### What we built

CivicLens includes a working FastAPI API, database models, AI detection pipeline, RTSP/file camera monitoring workers, responsive Next.js command center, bulk onboarding for cameras and profiles, configurable detection thresholds, and deployment documentation. It can be packaged as a Windows installer for local demonstrations.

## Repository Structure

```text
backend/                 FastAPI API, SQLAlchemy models, AI services
civiclens-frontend/      Next.js command-center interface
docker-compose.yml       PostgreSQL + Redis + backend + frontend deployment
SETUP_GUIDE.md           Step-by-step deployment and configuration guide
REPO_WIKI.md             Detailed architecture and API reference
```

## Quick Start (Development)

### Backend

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd civiclens-frontend
npm install
npm run dev
```

Open `http://localhost:3000` and sign in with the locally configured account.

## Configuration

Copy `backend/.env.example` to `backend/.env` and choose the deployment configuration you need. Do not commit `.env` files.

```ini
# Default local installation
DATABASE_URL=sqlite:///civiclens.db

# Optional distributed deployment
# MESSAGE_QUEUE=redis://localhost:6379
# EDGE_MODE=1
# WORKER_ONLY=1
```

See `SETUP_GUIDE.md` for PostgreSQL, MySQL, Redis, Edge AI, Docker, security, and multi-server guidance.

## Presentation and Documentation

- `HACKATHON_SUBMISSION.md` — paste-ready project write-up
- `CivicLens-Hackathon-Presentation.pptx` — hackathon presentation
- `CivicLens-Setup-Guide.pdf` — deployment guide
- `SETUP_GUIDE.md` — editable deployment guide
- `REPO_WIKI.md` — technical architecture reference

## Privacy and Responsible Use

CivicLens processes surveillance imagery and biometric data. Deploy it only with appropriate legal authorization, clear governance, access controls, retention policies, and applicable privacy-law compliance.

## Made in Pakistan

Developed by Usman Farid.
