import numpy as np
from insightface.app import FaceAnalysis

_face_app = None


def get_face_app():
    global _face_app
    if _face_app is None:
        _face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        _face_app.prepare(ctx_id=0, det_size=(640, 640))
    return _face_app


def detect_faces(image_bgr: np.ndarray):
    face_app = get_face_app()
    return face_app.get(image_bgr)


def detect_best_face(image_bgr: np.ndarray):
    faces = detect_faces(image_bgr)
    if not faces:
        return None
    return max(faces, key=lambda f: f.det_score)


def extract_embedding(image_bgr: np.ndarray):
    best_face = detect_best_face(image_bgr)
    if best_face is None:
        return None
    return best_face.embedding


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    return float(np.dot(a, b))


def find_match(embedding, known_embeddings, threshold: float = 0.5):
    best_person_id = None
    best_score = -1.0
    for person_id, known_embedding in known_embeddings:
        score = cosine_similarity(embedding, known_embedding)
        if score > best_score:
            best_score = score
            best_person_id = person_id
    if best_score >= threshold:
        return best_person_id, best_score
    return None, best_score


def find_top_matches(embedding, known_embeddings, top_n: int = 3):
    scored = [(entity_id, cosine_similarity(embedding, known_embedding)) for entity_id, known_embedding in known_embeddings]
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored[:top_n]
