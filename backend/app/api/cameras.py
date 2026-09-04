import json
from typing import List, Optional

import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.camera import Camera
from app.services.scene_detector import suggest_zones
from app.services.segmentation_detector import suggest_segmentation_zones
from app.services.tabular import read_table
from app.services.security import require_admin, get_current_user

router = APIRouter()

VALID_DETECTIONS = {"vehicle_parking", "crowd", "road_events", "littering"}
DEFAULT_DETECTIONS = ["vehicle_parking", "crowd", "road_events"]

# Camera-list column aliases — control-room exports name these differently.
CAMERA_FIELD_ALIASES = {
    "camera_name": ["camera_name", "camera name", "camera", "name", "camera id",
                    "camera_id", "id", "channel"],
    "rtsp_url": ["rtsp_url", "rtsp url", "rtsp", "url", "stream url", "stream",
                 "source", "source_path", "source path", "video url", "feed",
                 "feed url", "streaming url"],
    "purpose": ["purpose", "type", "area", "location", "description", "notes",
                "zone", "camera type"],
    "capture_interval": ["capture_interval", "capture interval", "interval",
                         "interval seconds", "seconds"],
}


def _detect_camera_columns(headers):
    normalized = {h.strip().lower(): h for h in headers}
    detected = {}
    for field, aliases in CAMERA_FIELD_ALIASES.items():
        for alias in aliases:
            if alias in normalized:
                detected[field] = normalized[alias]
                break
    return detected


class ZoneConfigRequest(BaseModel):
    camera_name: str
    zones: dict


class CameraSettingsRequest(BaseModel):
    camera_name: str
    purpose: str = "Custom"
    enabled_detections: List[str] = []
    # Source fields are optional: omitted means "keep current source settings"
    # (so e.g. saving zones never resets an RTSP camera back to manual).
    source_type: Optional[str] = None       # manual | rtsp | file
    source_path: Optional[str] = None       # RTSP URL or video file path
    capture_interval: Optional[int] = None  # seconds between processed frames
    monitoring_enabled: Optional[bool] = None  # auto-start monitoring on server boot


def _serialize_camera(c: Camera):
    return {
        "camera_name": c.camera_name,
        "purpose": c.purpose or "Custom",
        "enabled_detections": json.loads(c.enabled_detections) if c.enabled_detections else [],
        "zones": json.loads(c.zone_config) if c.zone_config else {},
        "source_type": c.source_type or "manual",
        "source_path": c.source_path or "",
        "capture_interval": c.capture_interval or 5,
        "monitoring_enabled": bool(c.monitoring_enabled),
    }


def _validate_source(source_type: str, source_path: str):
    if source_type not in ("manual", "rtsp", "file"):
        raise HTTPException(status_code=400, detail="source_type must be manual, rtsp, or file")
    if source_type in ("rtsp", "file") and not source_path.strip():
        raise HTTPException(status_code=400,
                            detail="source_path is required for rtsp/file sources")


def _validate_detections(detections: List[str]):
    invalid = set(detections) - VALID_DETECTIONS
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown detection types: {sorted(invalid)}")


@router.get("/api/cameras")
def list_cameras(db: Session = Depends(get_db)):
    cameras = db.query(Camera).all()
    return [_serialize_camera(c) for c in cameras]


@router.post("/api/cameras")
def create_camera(payload: CameraSettingsRequest, db: Session = Depends(get_db), _auth = Depends(require_admin)):
    _validate_detections(payload.enabled_detections)
    source_type = payload.source_type or "manual"
    source_path = (payload.source_path or "").strip()
    capture_interval = max(2, payload.capture_interval or 5)
    monitoring_enabled = bool(payload.monitoring_enabled)
    _validate_source(source_type, source_path)
    existing = db.query(Camera).filter(Camera.camera_name == payload.camera_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Camera already exists")
    camera = Camera(
        camera_name=payload.camera_name,
        purpose=payload.purpose,
        enabled_detections=json.dumps(payload.enabled_detections),
        source_type=source_type,
        source_path=source_path or None,
        capture_interval=capture_interval,
        monitoring_enabled=1 if monitoring_enabled else 0,
    )
    db.add(camera)
    db.commit()

    if monitoring_enabled:
        from app.services.stream_monitor import start_monitoring
        start_monitoring(camera.camera_name, db=db)
    return _serialize_camera(camera)


@router.post("/api/cameras/import")
async def import_cameras(
    file: UploadFile = File(...),
    dry_run: bool = Form(True),
    db: Session = Depends(get_db),
    _auth = Depends(require_admin),
):
    """Onboard many cameras at once from a CSV/XLSX list (camera name + RTSP
    URL). Built for control-room setup: upload the city's camera inventory,
    get a preview, confirm, and every camera starts monitoring 24/7."""
    data = await file.read()
    headers, rows = read_table(data, file.filename)
    columns = _detect_camera_columns(headers)

    if "camera_name" not in columns or "rtsp_url" not in columns:
        found = ", ".join(headers) or "(none)"
        raise HTTPException(status_code=400,
                            detail=f"Could not find camera-name and RTSP-URL columns. "
                                   f"Columns found: {found}. Expected headers like "
                                   f"'camera_name' and 'rtsp_url'.")

    name_col = columns["camera_name"]
    url_col = columns["rtsp_url"]
    purpose_col = columns.get("purpose")
    interval_col = columns.get("capture_interval")

    to_create, already_exists, errors = [], [], []
    seen_names = set()
    for i, row in enumerate(rows, start=2):  # row 1 is the header
        name = row.get(name_col, "").strip()
        url = row.get(url_col, "").strip()
        if not name and not url:
            continue
        if not name:
            errors.append({"row": i, "error": "camera name is empty"})
            continue
        if not url:
            errors.append({"row": i, "camera": name, "error": "RTSP URL is empty"})
            continue
        if name in seen_names:
            errors.append({"row": i, "camera": name, "error": "duplicate name in file"})
            continue
        seen_names.add(name)

        if db.query(Camera).filter(Camera.camera_name == name).first() is not None:
            already_exists.append({"row": i, "camera": name})
            continue

        interval = 5
        if interval_col and row.get(interval_col, "").strip():
            try:
                interval = max(2, int(float(row[interval_col])))
            except ValueError:
                errors.append({"row": i, "camera": name,
                               "error": f"invalid interval '{row[interval_col]}'"})
                continue

        to_create.append({
            "camera_name": name,
            "rtsp_url": url,
            "purpose": (row.get(purpose_col, "").strip() or "Custom") if purpose_col else "Custom",
            "capture_interval": interval,
        })

    created = []
    if not dry_run:
        from app.services.stream_monitor import start_monitoring
        for cam in to_create:
            camera = Camera(
                camera_name=cam["camera_name"],
                purpose=cam["purpose"],
                enabled_detections=json.dumps(DEFAULT_DETECTIONS),
                source_type="rtsp",
                source_path=cam["rtsp_url"],
                capture_interval=cam["capture_interval"],
                monitoring_enabled=1,
            )
            db.add(camera)
        db.commit()
        for cam in to_create:
            start_monitoring(cam["camera_name"])
            created.append(cam["camera_name"])

    return {
        "dry_run": dry_run,
        "filename": file.filename,
        "columns": headers,
        "detected_columns": columns,
        "row_count": len(rows),
        "cameras": to_create,
        "already_exists": already_exists,
        "errors": errors,
        "created": created,
    }


@router.put("/api/cameras/{camera_name}/settings")
def update_camera_settings(camera_name: str, payload: CameraSettingsRequest, db: Session = Depends(get_db), _auth = Depends(require_admin)):
    _validate_detections(payload.enabled_detections)
    camera = db.query(Camera).filter(Camera.camera_name == camera_name).first()
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    camera.purpose = payload.purpose
    camera.enabled_detections = json.dumps(payload.enabled_detections)

    source_changed = payload.source_type is not None
    if source_changed:
        source_type = payload.source_type
        source_path = (payload.source_path or "").strip()
        _validate_source(source_type, source_path)
        camera.source_type = source_type
        camera.source_path = source_path or None
        if payload.capture_interval is not None:
            camera.capture_interval = max(2, payload.capture_interval or 5)
    elif payload.capture_interval is not None:
        camera.capture_interval = max(2, payload.capture_interval or 5)

    if payload.monitoring_enabled is not None:
        camera.monitoring_enabled = 1 if payload.monitoring_enabled else 0
    db.commit()

    # Keep the worker's live view of the source in sync with what was saved.
    if source_changed or payload.monitoring_enabled is not None:
        from app.services import stream_monitor
        stream_monitor.stop_monitoring(camera_name)
        if camera.monitoring_enabled:
            stream_monitor.start_monitoring(camera_name, db=db)
    return _serialize_camera(camera)


@router.post("/api/cameras/zones")
def save_zones(payload: ZoneConfigRequest, db: Session = Depends(get_db), _auth = Depends(require_admin)):
    camera = db.query(Camera).filter(Camera.camera_name == payload.camera_name).first()
    if camera is None:
        camera = Camera(
            camera_name=payload.camera_name,
            zone_config=json.dumps(payload.zones),
            purpose="Custom",
            enabled_detections=json.dumps(DEFAULT_DETECTIONS),
        )
        db.add(camera)
    else:
        camera.zone_config = json.dumps(payload.zones)
    db.commit()
    return {"camera_name": payload.camera_name, "zones": payload.zones}


@router.get("/api/cameras/{camera_name}/zones")
def get_zones(camera_name: str, db: Session = Depends(get_db)):
    camera = db.query(Camera).filter(Camera.camera_name == camera_name).first()
    if camera is None or not camera.zone_config:
        return {"camera_name": camera_name, "zones": {}}
    return {"camera_name": camera_name, "zones": json.loads(camera.zone_config)}


@router.delete("/api/cameras/{camera_name}")
def delete_camera(camera_name: str, db: Session = Depends(get_db), _auth = Depends(require_admin)):
    camera = db.query(Camera).filter(Camera.camera_name == camera_name).first()
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    from app.services import stream_monitor
    stream_monitor.stop_monitoring(camera_name)
    db.delete(camera)
    db.commit()
    return {"deleted": camera_name}


@router.get("/api/cameras/monitoring/status")
def monitoring_status(_auth = Depends(get_current_user)):
    from app.services.stream_monitor import get_status
    return get_status()


@router.post("/api/cameras/{camera_name}/monitoring/start")
def start_camera_monitoring(camera_name: str, db: Session = Depends(get_db), _auth = Depends(get_current_user)):
    from app.services.stream_monitor import start_monitoring
    result = start_monitoring(camera_name, db=db)
    if not result.get("started"):
        raise HTTPException(status_code=400, detail=result.get("error", "Could not start monitoring"))
    return result


@router.post("/api/cameras/{camera_name}/monitoring/stop")
def stop_camera_monitoring(camera_name: str, _auth = Depends(get_current_user)):
    from app.services.stream_monitor import stop_monitoring
    return stop_monitoring(camera_name)


@router.post("/api/cameras/monitoring/start-all")
def start_all_monitoring(db: Session = Depends(get_db), _auth = Depends(get_current_user)):
    """Start every camera that has a server-side source (rtsp/file) configured."""
    from app.services.stream_monitor import start_monitoring, SOURCE_TYPES
    cameras = db.query(Camera).all()
    started, skipped = [], []
    for c in cameras:
        if c.source_type in SOURCE_TYPES and c.source_path:
            if start_monitoring(c.camera_name, db=db).get("started"):
                started.append(c.camera_name)
        else:
            skipped.append(c.camera_name)
    return {"started": started, "skipped_no_source": skipped}


@router.post("/api/cameras/monitoring/stop-all")
def stop_all_monitoring(_auth = Depends(get_current_user)):
    from app.services.stream_monitor import stop_all
    return stop_all()


@router.post("/api/cameras/suggest-zones")
async def suggest_zones_endpoint(image: UploadFile = File(...), min_confidence: float = 0.1):
    contents = await image.read()
    np_arr = np.frombuffer(contents, np.uint8)
    image_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Could not read the uploaded image")
    suggestions = suggest_zones(image_bgr, conf_threshold=min_confidence)
    return {"suggestions": suggestions}


@router.post("/api/cameras/suggest-zones-segmentation")
async def suggest_zones_segmentation_endpoint(image: UploadFile = File(...), min_confidence: float = 0.5):
    contents = await image.read()
    np_arr = np.frombuffer(contents, np.uint8)
    image_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image_bgr is None:
        print(f"[cameras] decode failed — filename={image.filename!r} content_type={image.content_type!r} "
              f"bytes_received={len(contents)}")
        raise HTTPException(status_code=400, detail="Could not read the uploaded image")
    suggestions = suggest_segmentation_zones(image_bgr, min_confidence=min_confidence)
    return {"suggestions": suggestions}
