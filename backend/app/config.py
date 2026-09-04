import os

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

load_dotenv(os.path.join(BASE_DIR, ".env"))

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{os.path.join(BASE_DIR, 'civiclens.db')}",
)

STORAGE_DIR = os.path.join(BASE_DIR, "app", "storage", "images")
REGISTERED_DIR = os.path.join(STORAGE_DIR, "registered")
DETECTIONS_DIR = os.path.join(STORAGE_DIR, "detections")
EVIDENCE_DIR = os.path.join(STORAGE_DIR, "evidence")
