import os
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.config import STORAGE_DIR, DATABASE_URL
import app.models  # noqa: F401
from app.api.participants import router as participants_router
from app.api.detection import router as detection_router
from app.api.events import router as events_router
from app.api.cameras import router as cameras_router
from app.api.unknown_profiles import router as unknown_profiles_router
from app.api.redlist import router as redlist_router
from app.api.missing_persons import router as missing_persons_router
from app.api.auth import router as auth_router
from app.api.settings import router as settings_router
from app.api.bulk_import import router as bulk_import_router
from app.api.analytics import router as analytics_router

_app_start_time = time.time()

app = FastAPI(title="CivicLens API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:3000", "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

# Column migrations must run before anything queries the models —
# create_all only creates missing tables, not missing columns.
from app.migrate_camera_sources import migrate as migrate_camera_sources
migrate_camera_sources()
from app.migrate_participant_fields import migrate as migrate_participant_fields
migrate_participant_fields()

# Seed default cameras on first boot (skips any that already exist)
from app.seed_cameras import seed_cameras
from app.seed_event_types import seed_event_types
seed_cameras()
seed_event_types()

# Auto-start server-side monitoring for cameras flagged monitoring_enabled.
# Runs in its own thread so a slow/unreachable source can never block boot.
import threading
from app.services.stream_monitor import start_enabled_cameras
threading.Thread(target=start_enabled_cameras, daemon=True,
                 name="stream-monitor-autostart").start()

from app.services.storage_retention import start_retention
start_retention()

from app.services import queue_service
if queue_service.is_enabled():
    from app.services.queue_consumer import handle_queue_event
    queue_service.start_consumer(handle_queue_event)

os.makedirs(STORAGE_DIR, exist_ok=True)
app.mount("/images", StaticFiles(directory=STORAGE_DIR), name="images")

app.include_router(auth_router)
app.include_router(settings_router)
app.include_router(participants_router)
app.include_router(detection_router)
app.include_router(events_router)
app.include_router(cameras_router)
app.include_router(unknown_profiles_router)
app.include_router(redlist_router)
app.include_router(missing_persons_router)
app.include_router(bulk_import_router)
app.include_router(analytics_router)


@app.get("/api/health")
def health_check():
    from app.database import SessionLocal
    from app.models.camera import Camera

    db_type = "sqlite" if DATABASE_URL.startswith("sqlite") else DATABASE_URL.split("://")[0].split("+")[0]
    uptime = int(time.time() - _app_start_time)

    camera_count = 0
    try:
        db = SessionLocal()
        camera_count = db.query(Camera).count()
        db.close()
    except Exception:
        pass

    return {
        "status": "ok",
        "service": "CivicLens API",
        "version": "1.0.0",
        "database": db_type,
        "cameras": camera_count,
        "uptime_seconds": uptime,
    }
