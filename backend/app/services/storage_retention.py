"""Storage retention: auto-delete old detection/evidence images."""

import os
import time
import threading
import logging

from app.config import DETECTIONS_DIR, EVIDENCE_DIR

logger = logging.getLogger(__name__)

RETENTION_DAYS = int(os.environ.get("STORAGE_RETENTION_DAYS", "30"))
CLEANUP_INTERVAL_HOURS = 6


def _delete_old_files(directory: str, max_age_days: int) -> int:
    if not os.path.isdir(directory):
        return 0
    cutoff = time.time() - (max_age_days * 86400)
    deleted = 0
    for fname in os.listdir(directory):
        fpath = os.path.join(directory, fname)
        if os.path.isfile(fpath) and os.path.getmtime(fpath) < cutoff:
            try:
                os.remove(fpath)
                deleted += 1
            except OSError:
                pass
    return deleted


def cleanup_loop():
    logger.info("Storage retention: %d days, checking every %dh", RETENTION_DAYS, CLEANUP_INTERVAL_HOURS)
    while True:
        time.sleep(CLEANUP_INTERVAL_HOURS * 3600)
        d1 = _delete_old_files(DETECTIONS_DIR, RETENTION_DAYS)
        d2 = _delete_old_files(EVIDENCE_DIR, RETENTION_DAYS)
        if d1 or d2:
            logger.info("Retention cleanup: deleted %d detection + %d evidence files", d1, d2)


def start_retention():
    if RETENTION_DAYS <= 0:
        return
    threading.Thread(target=cleanup_loop, daemon=True, name="storage-retention").start()
