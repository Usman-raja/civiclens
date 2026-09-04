from insightface.app import FaceAnalysis

print("Loading face analysis model (first run downloads ~300MB, be patient)...")
face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
face_app.prepare(ctx_id=0, det_size=(640, 640))
print("Model loaded successfully. CV stack is ready.")
