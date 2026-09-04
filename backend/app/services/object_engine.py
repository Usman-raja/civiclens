from ultralytics import YOLO

from app.services.edge_config import get_yolo_model_path, get_inference_params

_yolo_model = None

PERSON_CLASS_ID = 0
VEHICLE_CLASS_IDS = {2, 3, 5, 7}  # car, motorcycle, bus, truck (COCO class indices)
OBJECT_CLASS_IDS = {24, 26, 28}    # backpack, handbag, suitcase


def get_yolo_model():
    global _yolo_model
    if _yolo_model is None:
        _yolo_model = YOLO(get_yolo_model_path())
    return _yolo_model


def detect_objects(image_bgr, conf_threshold: float | None = None):
    model = get_yolo_model()
    params = get_inference_params()
    if conf_threshold is not None:
        params["conf"] = conf_threshold
    results = model(image_bgr, verbose=False, **params)[0]

    persons, vehicles, objects = [], [], []
    effective_conf = conf_threshold if conf_threshold is not None else params["conf"]
    for box in results.boxes:
        conf = float(box.conf[0])
        if conf < effective_conf:
            continue
        cls_id = int(box.cls[0])
        x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
        if cls_id == PERSON_CLASS_ID:
            persons.append([x1, y1, x2, y2])
        elif cls_id in VEHICLE_CLASS_IDS:
            vehicles.append([x1, y1, x2, y2])
        elif cls_id in OBJECT_CLASS_IDS:
            objects.append([x1, y1, x2, y2])

    return {"persons": persons, "vehicles": vehicles, "objects": objects}
