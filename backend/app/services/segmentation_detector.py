import numpy as np
import cv2

_processor = None
_model = None

TARGET_LABELS = {
    "road": "road",
    "sidewalk": "sidewalk",
}

MIN_CONTOUR_AREA = 800


def _load_model():
    global _processor, _model
    if _model is None:
        from transformers import SegformerImageProcessor, SegformerForSemanticSegmentation

        checkpoint = "nvidia/segformer-b0-finetuned-cityscapes-1024-1024"
        _processor = SegformerImageProcessor.from_pretrained(checkpoint)
        _model = SegformerForSemanticSegmentation.from_pretrained(checkpoint)
        _model.eval()
    return _processor, _model


def _label_id_for(model, name: str):
    for idx, label in model.config.id2label.items():
        if label.lower() == name.lower():
            return idx
    return None


def extract_zones_from_prediction(pred_classes: np.ndarray, class_probs: np.ndarray, label_id: int,
                                   zone_name: str, cityscapes_label: str, min_confidence: float = 0.5,
                                   min_area: int = MIN_CONTOUR_AREA):
    h, w = pred_classes.shape
    mask = (pred_classes == label_id).astype(np.uint8) * 255

    kernel_size = max(5, min(h, w) // 40)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = [c for c in contours if cv2.contourArea(c) >= min_area]
    if not contours:
        return []

    contour = max(contours, key=cv2.contourArea)

    region_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.drawContours(region_mask, [contour], -1, 1, thickness=cv2.FILLED)
    region_probs = class_probs[region_mask == 1]
    confidence = float(region_probs.mean()) if region_probs.size > 0 else 0.0
    if confidence < min_confidence:
        return []

    epsilon = 0.01 * cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, epsilon, True)
    polygon = [[round(float(p[0][0]), 1), round(float(p[0][1]), 1)] for p in approx]
    if len(polygon) < 3:
        return []

    return [{
        "zone_type": zone_name,
        "label": cityscapes_label,
        "confidence": round(confidence, 3),
        "polygon": polygon,
    }]


def suggest_segmentation_zones(image_bgr, min_confidence: float = 0.5):
    import torch

    processor, model = _load_model()
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    h, w = image_bgr.shape[:2]

    inputs = processor(images=image_rgb, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)

    upsampled = torch.nn.functional.interpolate(outputs.logits, size=(h, w), mode="bilinear", align_corners=False)
    probs = torch.nn.functional.softmax(upsampled, dim=1)[0]
    pred_classes = probs.argmax(dim=0).numpy()

    suggestions = []
    for zone_name, cityscapes_label in TARGET_LABELS.items():
        label_id = _label_id_for(model, cityscapes_label)
        if label_id is None:
            continue
        class_probs = probs[label_id].numpy()
        suggestions.extend(
            extract_zones_from_prediction(pred_classes, class_probs, label_id, zone_name, cityscapes_label, min_confidence)
        )

    return suggestions
