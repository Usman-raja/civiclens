import os

from app.config import STORAGE_DIR


def to_image_url(path):
    if not path:
        return None
    try:
        rel = os.path.relpath(path, STORAGE_DIR)
    except ValueError:
        return None
    if rel.startswith(".."):
        return None
    rel = rel.replace("\\", "/")
    return f"/images/{rel}"
