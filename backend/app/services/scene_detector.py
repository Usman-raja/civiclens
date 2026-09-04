from ultralytics import YOLO

_world_model = None

SCENE_CLASSES = {
    "road": "road",
    "crosswalk": "crosswalk",
    "sidewalk": "sidewalk",
    "parking lot": "no_parking_zone",
    "gate": "entrance_zone",
    "trash can": "bin_zone",
}


def get_world_model():
    global _world_model
    if _world_model is None:
        _world_model = YOLO("yolov8s-worldv2.pt")
        _world_model.set_classes(list(SCENE_CLASSES.keys()))
    return _world_model


def suggest_zones(image_bgr, conf_threshold: float = 0.1):
    model = get_world_model()
    class_names = list(SCENE_CLASSES.keys())
    results = model.predict(image_bgr, conf=0.001, verbose=False)[0]

    print(f"[scene_detector] image shape: {image_bgr.shape}")
    print(f"[scene_detector] raw box count (before confidence filtering): {len(results.boxes)}")
    for box in results.boxes:
        conf = float(box.conf[0])
        cls_id = int(box.cls[0])
        label = class_names[cls_id] if cls_id < len(class_names) else f"UNKNOWN_ID_{cls_id}"
        print(f"[scene_detector]   -> label={label!r} confidence={conf:.4f} cls_id={cls_id}")

    suggestions = []
    for box in results.boxes:
        conf = float(box.conf[0])
        if conf < conf_threshold:
            continue
        cls_id = int(box.cls[0])
        if cls_id >= len(class_names):
            continue
        label = class_names[cls_id]
        zone_type = SCENE_CLASSES[label]
        x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
        polygon = [[round(x1, 1), round(y1, 1)], [round(x2, 1), round(y1, 1)],
                   [round(x2, 1), round(y2, 1)], [round(x1, 1), round(y2, 1)]]
        suggestions.append({
            "zone_type": zone_type,
            "label": label,
            "confidence": round(conf, 3),
            "polygon": polygon,
        })

    return suggestions
