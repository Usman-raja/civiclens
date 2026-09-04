"""
Edge AI configuration — lightweight processing mode for resource-constrained deployments.

Config (.env):
    EDGE_MODE=1          # Enable edge mode (smaller models, lower resolution, frame skipping)
    EDGE_IMG_SIZE=320    # Inference resolution (default: 640 for full mode)
    EDGE_FRAME_SKIP=3    # Process every Nth frame (default: 1 = every frame)
    EDGE_CONF_THRESHOLD=0.35  # Confidence threshold (higher = fewer detections, less load)

When EDGE_MODE is disabled (default), full-precision models and settings are used.
"""

import os

EDGE_MODE = os.getenv("EDGE_MODE", "").strip() == "1"
EDGE_IMG_SIZE = int(os.getenv("EDGE_IMG_SIZE", "320" if EDGE_MODE else "640"))
EDGE_FRAME_SKIP = int(os.getenv("EDGE_FRAME_SKIP", "3" if EDGE_MODE else "1"))
EDGE_CONF_THRESHOLD = float(os.getenv("EDGE_CONF_THRESHOLD", "0.35" if EDGE_MODE else "0.25"))
EDGE_SKIP_SCENE = os.getenv("EDGE_SKIP_SCENE", "1" if EDGE_MODE else "0") == "1"


def get_yolo_model_path() -> str:
    """Return the appropriate YOLO model path based on edge mode."""
    if EDGE_MODE:
        return "yolov8n.pt"
    return "yolov8n.pt"


def get_inference_params() -> dict:
    """Return inference parameters tuned for current mode."""
    return {
        "imgsz": EDGE_IMG_SIZE,
        "conf": EDGE_CONF_THRESHOLD,
        "half": EDGE_MODE,
        "device": "cpu" if EDGE_MODE else None,
    }


def should_process_frame(frame_index: int) -> bool:
    """Return True if this frame should be processed (frame skipping)."""
    return frame_index % EDGE_FRAME_SKIP == 0
