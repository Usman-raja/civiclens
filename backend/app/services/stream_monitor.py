"""Server-side continuous camera monitoring.

Each camera with a configured source (RTSP stream or video file) gets a
worker thread that grabs frames, writes the newest frame to disk for the
camera wall, and runs the full detection pipeline on it. Monitoring keeps
running with no browser open — this is what turns the demo into a station.

Statuses are tracked in memory (the workers' own registry); the latest frame
of every camera is written to app/storage/images/live/<safe_name>.jpg and is
served by the existing /images static mount.
"""
import json
import os
import re
import threading
import time

import cv2

from app.config import STORAGE_DIR
from app.database import SessionLocal
from app.models.camera import Camera

LIVE_DIR = os.path.join(STORAGE_DIR, "live")
os.makedirs(LIVE_DIR, exist_ok=True)

_lock = threading.Lock()
_workers = {}    # camera_name -> WorkerThread
_status = {}     # camera_name -> status dict

MIN_INTERVAL = 2        # seconds — floor for per-camera capture interval
RECONNECT_WAIT = 5      # seconds between retries when a source is unreachable
SOURCE_TYPES = {"rtsp", "file"}

# Real CCTV streams are far more reliable over RTSP/TCP; over UDP (the FFmpeg
# default) frames arrive out of order or get dropped entirely. The option is
# ignored for file sources.
os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")


def _safe_name(camera_name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", camera_name)


def _frame_url(camera_name: str):
    return f"/images/live/{_safe_name(camera_name)}.jpg"


def _init_status(camera_name: str, **fields):
    base = {
        "camera_name": camera_name,
        "state": "stopped",          # live | reconnecting | error | stopped
        "monitoring_active": False,
        "person_count": None,
        "face_count": None,
        "alert_count": None,
        "frames_processed": 0,
        "last_update": None,
        "last_error": None,
        "frame_url": _frame_url(camera_name),
    }
    base.update(fields)
    return base


class WorkerThread(threading.Thread):
    def __init__(self, camera_name, source, source_type, interval):
        super().__init__(daemon=True, name=f"monitor-{camera_name}")
        self.camera_name = camera_name
        self.source = source
        self.source_type = source_type
        self.interval = max(MIN_INTERVAL, interval)
        self.stop_event = threading.Event()

    def _set(self, **fields):
        with _lock:
            status = _status.setdefault(self.camera_name, _init_status(self.camera_name))
            status.update(fields)

    def run(self):
        print(f"[stream_monitor] started {self.camera_name} ({self.source_type}: {self.source})")
        self._set(state="live", monitoring_active=True, last_error=None)
        cap = None
        try:
            while not self.stop_event.is_set():
                try:
                    if cap is None or not cap.isOpened():
                        cap = cv2.VideoCapture(self.source)
                        if not cap.isOpened():
                            self._set(state="reconnecting",
                                      last_error=f"Cannot open source: {self.source}")
                            if self.stop_event.wait(RECONNECT_WAIT):
                                break
                            continue

                    ok, frame = cap.read()
                    if not ok or frame is None:
                        # File sources end -> loop them; network sources drop -> reopen.
                        cap.release()
                        cap = None
                        self._set(state="reconnecting")
                        if self.stop_event.wait(1 if self.source_type == "file" else RECONNECT_WAIT):
                            break
                        continue

                    self._set(state="live", last_error=None)

                    # Always publish the frame first so the wall shows video
                    # even while detection is still grinding through it.
                    frame_path = os.path.join(LIVE_DIR, f"{_safe_name(self.camera_name)}.jpg")
                    cv2.imwrite(frame_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])

                    result = self._detect(frame)
                    with _lock:
                        status = _status.setdefault(self.camera_name,
                                                    _init_status(self.camera_name))
                        status.update({
                            "person_count": result.get("person_count"),
                            "face_count": len(result.get("detections", [])),
                            "alert_count": sum(
                                1 for d in result.get("detections", [])
                                if d.get("redlist_alert") or d.get("missing_person_alert")
                            ) + sum(
                                1 for ev in result.get("scene_events", [])
                                if ev.get("event_type") == "road_accident"
                            ),
                            "frames_processed": status.get("frames_processed", 0) + 1,
                            "last_update": time.time(),
                            "state": "live",
                        })
                except Exception as e:
                    self._set(state="error", last_error=str(e))
                    if self.stop_event.wait(RECONNECT_WAIT):
                        break
                    continue

                self.stop_event.wait(self.interval)
        finally:
            if cap is not None:
                cap.release()
            self._set(state="stopped", monitoring_active=False)
            print(f"[stream_monitor] stopped {self.camera_name}")

    def _detect(self, frame):
        # Imported lazily: the detection module pulls in the whole CV stack.
        from app.api.detection import run_detection
        db = SessionLocal()
        try:
            return run_detection(db, self.camera_name, frame)
        finally:
            db.close()


def start_monitoring(camera_name: str, db=None) -> dict:
    own_session = db is None
    db = db or SessionLocal()
    try:
        camera = db.query(Camera).filter(Camera.camera_name == camera_name).first()
        if camera is None:
            return {"started": False, "error": "Camera not found"}
        if camera.source_type not in SOURCE_TYPES:
            return {"started": False, "error": f"Camera has no server-side source "
                                               f"(source_type={camera.source_type or 'manual'}). "
                                               f"Configure an RTSP URL or video file first."}
        if not camera.source_path:
            return {"started": False, "error": "Source path is empty — set an RTSP URL or video file."}

        with _lock:
            worker = _workers.get(camera_name)
            if worker is not None and worker.is_alive():
                return {"started": True, "already_running": True}

        worker = WorkerThread(camera_name, camera.source_path, camera.source_type,
                              camera.capture_interval or 5)
        with _lock:
            _workers[camera_name] = worker
        worker.start()
        return {"started": True}
    finally:
        if own_session:
            db.close()


def stop_monitoring(camera_name: str) -> dict:
    with _lock:
        worker = _workers.pop(camera_name, None)
    if worker is None:
        return {"stopped": False, "error": "Monitoring not running"}
    worker.stop_event.set()
    return {"stopped": True}


def stop_all() -> dict:
    with _lock:
        workers = list(_workers.values())
        _workers.clear()
    for w in workers:
        w.stop_event.set()
    return {"stopped": len(workers)}


def start_enabled_cameras():
    """Auto-start monitoring for cameras flagged monitoring_enabled (called on boot)."""
    db = SessionLocal()
    try:
        names = [c.camera_name for c in db.query(Camera).all()
                 if c.monitoring_enabled and c.source_type in SOURCE_TYPES and c.source_path]
    finally:
        db.close()
    started = []
    for name in names:
        if start_monitoring(name).get("started"):
            started.append(name)
    if started:
        print(f"[stream_monitor] auto-started: {', '.join(started)}")
    return started


def get_status() -> list:
    """Per-camera monitoring status merged with camera source configuration."""
    db = SessionLocal()
    try:
        cameras = db.query(Camera).all()
    finally:
        db.close()

    statuses = []
    for c in cameras:
        with _lock:
            status = dict(_status.get(c.camera_name,
                                      _init_status(c.camera_name)))
        zones = json.loads(c.zone_config) if c.zone_config else {}
        statuses.append({
            **status,
            "purpose": c.purpose or "Custom",
            "source_type": c.source_type or "manual",
            "source_path": c.source_path,
            "capture_interval": c.capture_interval or 5,
            "monitoring_enabled": bool(c.monitoring_enabled),
            "has_zones": bool(zones),
        })
    return statuses
