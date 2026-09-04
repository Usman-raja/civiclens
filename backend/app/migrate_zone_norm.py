"""One-off migration: convert camera zone polygons stored in reference-photo
pixel space (any coordinate > 1000) into the 0-1000 normalized space the
detection pipeline now expects. Idempotent — cameras already normalized are
skipped. The photo's dimensions are inferred from the polygon's own max
coordinates."""
import json

from app.database import SessionLocal
from app.models.camera import Camera


def migrate():
    db = SessionLocal()
    try:
        for cam in db.query(Camera).all():
            if not cam.zone_config:
                continue
            zones = json.loads(cam.zone_config)
            points = [p for poly in zones.values() for p in poly]
            if not points:
                continue
            max_x = max(p[0] for p in points)
            max_y = max(p[1] for p in points)
            if max_x <= 1000 and max_y <= 1000:
                continue
            sx = 1000.0 / max_x if max_x else 1.0
            sy = 1000.0 / max_y if max_y else 1.0
            for poly in zones.values():
                for p in poly:
                    p[0] = round(p[0] * sx, 1)
                    p[1] = round(p[1] * sy, 1)
            cam.zone_config = json.dumps(zones)
            db.commit()
            print(f"[migrate_zone_norm] {cam.camera_name}: {max_x:.0f}x{max_y:.0f} px space -> 0-1000 normalized")
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
