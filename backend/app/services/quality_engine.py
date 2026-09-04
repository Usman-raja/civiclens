import cv2

MIN_DIMENSION = 80
BLUR_VARIANCE_THRESHOLD = 40.0


def assess_quality(image_bgr):
    """Returns None if the image passes basic quality checks, otherwise a reason string."""
    h, w = image_bgr.shape[:2]
    if h < MIN_DIMENSION or w < MIN_DIMENSION:
        return f"Image resolution too small ({w}x{h}, need at least {MIN_DIMENSION}x{MIN_DIMENSION})"

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    if variance < BLUR_VARIANCE_THRESHOLD:
        return f"Image appears too blurry (sharpness score {variance:.1f}, need at least {BLUR_VARIANCE_THRESHOLD})"

    return None
